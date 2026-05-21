package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.model.FileMetadata;
import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.repository.FileRepository;
import com.cloudfileorganizer.backend.service.AppSettingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.transaction.annotation.Transactional;
import com.cloudfileorganizer.backend.model.AiAnalysisStatus;

@Service
public class FileService {

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private S3Service s3Service;

    @Autowired
    private AiService aiService;

    @Autowired
    private AppSettingService appSettingService;

    /**
     * Upload file to S3 and save metadata
     */
    @Transactional
    public FileMetadata uploadFile(MultipartFile file, User user, String category) throws IOException {
        // Validate file
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        long uploadMaxBytes = appSettingService.getLong(
                AppSettingService.KEY_UPLOAD_MAX_FILE_SIZE_BYTES,
                100L * 1024 * 1024
        );

        if (uploadMaxBytes > 0 && file.getSize() > uploadMaxBytes) {
            throw new IllegalArgumentException("File size exceeds upload limit");
        }

        Long storageLimitBytes = user.getStorageLimitBytes();
        if (storageLimitBytes != null && storageLimitBytes > 0) {
            Long usedBytes = fileRepository.getTotalStorageSizeByUser(user);
            long nextTotal = (usedBytes == null ? 0L : usedBytes) + file.getSize();
            if (nextTotal > storageLimitBytes) {
                throw new IllegalArgumentException("Storage limit exceeded for this account");
            }
        }

        // Normalize or infer category
        String inferredCategory = category;
        if (inferredCategory == null || inferredCategory.trim().isEmpty()) {
            inferredCategory = inferCategoryFromType(file.getOriginalFilename(), file.getContentType());
        }
        String normalizedCategory = normalizeCategory(inferredCategory);

        // Upload to S3
        String s3Key = s3Service.uploadFile(file, normalizedCategory, user.getId());

        // Create file metadata
        FileMetadata fileMetadata = new FileMetadata();
        fileMetadata.setName(file.getOriginalFilename());
        fileMetadata.setOriginalName(file.getOriginalFilename());
        fileMetadata.setSize(file.getSize());
        fileMetadata.setMimeType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        fileMetadata.setS3Key(s3Key);
        fileMetadata.setBucketName(s3Service.getBucketName());
        fileMetadata.setCategory(normalizedCategory);
        fileMetadata.setUploadDate(LocalDateTime.now());
        fileMetadata.setUser(user);
        boolean aiEnabledForUser = user.getAiClassificationEnabled() == null || user.getAiClassificationEnabled();
        fileMetadata.setAiAnalysisStatus(aiEnabledForUser ? AiAnalysisStatus.PENDING : AiAnalysisStatus.COMPLETED);
        if (!aiEnabledForUser) {
            fileMetadata.setAiSummary("AI classification disabled by user preference.");
        }

        // Save metadata to database
        FileMetadata savedFile = fileRepository.save(fileMetadata);

        // Trigger AI analysis asynchronously only when user preference allows it.
        if (aiEnabledForUser) {
            aiService.analyzeFile(savedFile.getId(), user);
        }

        return savedFile;
    }

    /**
     * Get all files for a user
     */
    public List<FileMetadata> getFilesByUser(User user) {
        return fileRepository.findByUser(user);
    }

    /**
     * Get file by ID (user-restricted)
     */
    public Optional<FileMetadata> getFileById(String id, User user) {
        return fileRepository.findByIdAndUser(id, user);
    }

    /**
     * Get files by category (user-restricted)
     */
    public List<FileMetadata> getFilesByCategory(User user, String category) {
        return fileRepository.findByUserAndCategory(user, category);
    }

    /**
     * Get files by AI category (user-restricted)
     */
    /**
     * Get files by AI category (user-restricted)
     */
    public List<FileMetadata> getFilesByAiCategory(User user, String aiCategory) {
        return fileRepository.findByUserAndAiCategory(user, aiCategory);
    }

    /**
     * Get files by combined category and AI category (user-restricted)
     */
    public List<FileMetadata> getFilesByCombinedCategory(User user, String category, String aiCategory) {
        return fileRepository.findByUserAndCategoryAndAiCategory(user, category, aiCategory);
    }

    /**
     * Delete file from S3 and database
     */
    public void deleteFile(String id, User user) throws IOException {
        FileMetadata fileMetadata = fileRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));

        // Delete from S3
        try {
            s3Service.deleteFile(fileMetadata.getS3Key());
        } catch (Exception e) {
            throw new IOException("Failed to delete file from S3: " + e.getMessage(), e);
        }

        // Delete from database
        fileRepository.delete(fileMetadata);
    }

    /**
     * Generate download URL for file
     */
    public String generateDownloadUrl(String id, User user) {
        FileMetadata fileMetadata = fileRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));

        return s3Service.generatePresignedUrl(fileMetadata.getS3Key(), fileMetadata.getName());
    }

    /**
     * Normalize category name
     */
    private String normalizeCategory(String category) {
        if (category == null || category.trim().isEmpty()) {
            return "Others";
        }
        // Simply capitalize the first letter and pass through
        String trimmed = category.trim();
        return trimmed.substring(0, 1).toUpperCase() + trimmed.substring(1).toLowerCase();
    }

    private String inferCategoryFromType(String filename, String mimeType) {
        if (mimeType != null) {
            if (mimeType.startsWith("image/")) return "Images";
            if (mimeType.startsWith("video/")) return "Videos";
            if (mimeType.startsWith("audio/")) return "Audio";
            if (mimeType.equals("application/pdf")) return "Documents";
        }
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) return "Spreadsheets";
            if (lower.endsWith(".pdf") || lower.endsWith(".docx")) return "Documents";
            if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "Presentations";
        }
        return "Others";
    }

    public List<Object[]> getCategoryCounts(User user) {
        return fileRepository.countFilesByCategory(user);
    }

    public List<Object[]> getAiCategoryCounts(User user) {
        return fileRepository.countFilesByAiCategory(user);
    }

    public FileMetadata updateCategory(String id, User user, String newCategory) {
        FileMetadata file = fileRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));
        file.setCategory(normalizeCategory(newCategory));
        return fileRepository.save(file);
    }

    @Transactional
    public int updateCategoryBulk(List<String> ids, User user, String newCategory) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("No IDs provided");
        }
        String normalizedCategory = normalizeCategory(newCategory);

        int updated = 0;
        for (String id : ids) {
            if (id == null || id.isBlank()) continue;
            FileMetadata file = fileRepository.findByIdAndUser(id.trim(), user)
                    .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));
            file.setCategory(normalizedCategory);
            fileRepository.save(file);
            updated++;
        }
        return updated;
    }

    /**
     * Normalizes an incoming request payload value into a unique list of string IDs.
     * Accepts either a JSON array or a single string.
     */
    public List<String> normalizeIds(Object rawIds) {
        List<String> ids = new ArrayList<>();

        if (rawIds instanceof List<?> list) {
            for (Object item : list) {
                if (item == null) continue;
                String value = String.valueOf(item).trim();
                if (!value.isEmpty()) {
                    ids.add(value);
                }
            }
        } else if (rawIds != null) {
            String value = String.valueOf(rawIds).trim();
            if (!value.isEmpty()) {
                ids.add(value);
            }
        }

        // distinct, keep order
        List<String> distinct = new ArrayList<>();
        for (String id : ids) {
            if (!distinct.contains(id)) {
                distinct.add(id);
            }
        }
        return distinct;
    }

    @Transactional(readOnly = true)
    public InputStream buildZipStream(List<String> ids, User user) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("No IDs provided");
        }

        // Pre-validate all requested files up-front so we can fail fast with a clean HTTP error
        // rather than starting a ZIP stream that later becomes corrupt.
        List<String> normalizedIds = new ArrayList<>();
        for (String id : ids) {
            if (id == null) continue;
            String trimmed = id.trim();
            if (!trimmed.isEmpty() && !normalizedIds.contains(trimmed)) {
                normalizedIds.add(trimmed);
            }
        }
        if (normalizedIds.isEmpty()) {
            throw new IllegalArgumentException("No IDs provided");
        }

        List<FileMetadata> filesToZip = new ArrayList<>();
        for (String id : normalizedIds) {
            FileMetadata file = fileRepository.findByIdAndUser(id, user)
                    .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));
            if (file.getS3Key() == null || file.getS3Key().isBlank()) {
                throw new IllegalArgumentException("File storage reference missing");
            }
            // Ensure the object exists before streaming.
            if (!s3Service.fileExists(file.getS3Key())) {
                throw new IllegalArgumentException("File content missing in storage");
            }
            filesToZip.add(file);
        }

        try {
            PipedOutputStream output = new PipedOutputStream();
            PipedInputStream input = new PipedInputStream(output, 64 * 1024);

            Thread worker = new Thread(() -> {
                try (ZipOutputStream zip = new ZipOutputStream(output)) {
                    Map<String, Integer> seenNames = new HashMap<>();

                    for (FileMetadata file : filesToZip) {
                        String rawName = (file.getOriginalName() != null && !file.getOriginalName().isBlank())
                                ? file.getOriginalName()
                                : (file.getName() != null ? file.getName() : "file");
                        String safeName = makeZipEntryNameUnique(sanitizeZipEntryName(rawName), seenNames);

                        boolean entryOpened = false;
                        try {
                            zip.putNextEntry(new ZipEntry(safeName));
                            entryOpened = true;

                            S3Service.S3ObjectPayload payload = s3Service.getFileWithMetadata(file.getS3Key());
                            try (InputStream in = payload.getStream()) {
                                in.transferTo(zip);
                            }
                        } catch (Exception ex) {
                            // Keep the ZIP valid even if a single file fails unexpectedly.
                            try {
                                if (entryOpened) {
                                    zip.closeEntry();
                                }
                            } catch (IOException ignored) {
                                // ignore
                            }

                            try {
                                String errorEntryName = makeZipEntryNameUnique("__ERROR__-" + safeName + ".txt", seenNames);
                                zip.putNextEntry(new ZipEntry(errorEntryName));
                                String msg = "Failed to include file '" + rawName + "' in ZIP download.\nReason: " + ex.getMessage() + "\n";
                                zip.write(msg.getBytes(StandardCharsets.UTF_8));
                                zip.closeEntry();
                            } catch (Exception ignored) {
                                // If even the error entry fails, best effort is to continue.
                            }
                            continue;
                        }

                        try {
                            zip.closeEntry();
                        } catch (IOException ignored) {
                            // ignore
                        }
                    }
                } catch (Exception ex) {
                    try {
                        output.close();
                    } catch (IOException ignored) {
                        // ignore
                    }
                }
            }, "files-zip-" + Objects.hash(user.getId(), System.nanoTime()));

            worker.setDaemon(true);
            worker.start();
            return input;
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to prepare ZIP download");
        }
    }

    private String sanitizeZipEntryName(String filename) {
        String input = filename == null ? "" : filename;
        String noTraversal = input.replace("..", "");
        String noSlashes = noTraversal.replace("/", "_").replace("\\", "_");
        String collapsed = noSlashes.trim();
        if (collapsed.isEmpty()) {
            return "file";
        }
        return collapsed.length() > 180 ? collapsed.substring(0, 180) : collapsed;
    }

    private String makeZipEntryNameUnique(String proposed, Map<String, Integer> seen) {
        String name = (proposed == null || proposed.isBlank()) ? "file" : proposed;

        int current = seen.getOrDefault(name, 0);
        if (current == 0) {
            seen.put(name, 1);
            return name;
        }

        String base = name;
        String ext = "";
        int dot = name.lastIndexOf('.');
        if (dot > 0 && dot < name.length() - 1) {
            base = name.substring(0, dot);
            ext = name.substring(dot);
        }

        int nextIndex = current + 1;
        String next = base + "-" + nextIndex + ext;
        while (seen.containsKey(next)) {
            nextIndex++;
            next = base + "-" + nextIndex + ext;
        }
        seen.put(name, nextIndex);
        seen.put(next, 1);
        return next;
    }

    public List<FileMetadata> searchFiles(User user, String query) {
        return fileRepository.searchFiles(user, query);
    }

    public List<FileMetadata> getFilesFiltered(User user, String category, String aiCategory) {
        if (category != null && !category.isEmpty() && aiCategory != null && !aiCategory.isEmpty()) {
            return getFilesByCombinedCategory(user, category, aiCategory);
        } else if (category != null && !category.isEmpty()) {
            return getFilesByCategory(user, category);
        } else if (aiCategory != null && !aiCategory.isEmpty()) {
            return getFilesByAiCategory(user, aiCategory);
        } else {
            return getFilesByUser(user);
        }
    }

    public void reanalyzeFile(String id, User user) {
        if (user.getAiClassificationEnabled() != null && !user.getAiClassificationEnabled()) {
            throw new IllegalArgumentException("AI classification is disabled in your settings");
        }
        FileMetadata file = fileRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new IllegalArgumentException("File not found or access denied"));
        aiService.analyzeFile(file.getId(), user);
    }

    @Transactional
    public void deleteFilesBulk(List<String> ids, User user) throws IOException {
        for (String id : ids) {
            deleteFile(id, user);
        }
    }
}
