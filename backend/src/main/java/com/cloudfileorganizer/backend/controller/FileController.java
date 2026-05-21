package com.cloudfileorganizer.backend.controller;

import com.cloudfileorganizer.backend.model.FileMetadata;
import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.service.FileService;
import com.cloudfileorganizer.backend.service.S3Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileService fileService;

    @Autowired
    private S3Service s3Service;

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", required = false) String category) {
        
        try {
            User user = getCurrentUser();
            
            if (file.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "File is empty");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            FileMetadata fileMetadata = fileService.uploadFile(file, user, category);

            Map<String, Object> response = new HashMap<>();
            response.put("id", fileMetadata.getId());
            response.put("name", fileMetadata.getName());
            response.put("size", fileMetadata.getSize());
            response.put("category", fileMetadata.getCategory());
            response.put("uploadDate", fileMetadata.getUploadDate());
            response.put("mimeType", fileMetadata.getMimeType());
            response.put("aiCategory", fileMetadata.getAiCategory());
            response.put("aiSummary", fileMetadata.getAiSummary());
            response.put("aiTags", fileMetadata.getAiTags());
            response.put("aiConfidence", fileMetadata.getAiConfidence());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (IOException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "File upload failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Upload failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping
    public ResponseEntity<?> getFiles(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "aiCategory", required = false) String aiCategory) {
        
        try {
            User user = getCurrentUser();
            List<FileMetadata> files = fileService.getFilesFiltered(user, category, aiCategory);

            List<Map<String, Object>> fileList = files.stream().map(file -> {
                Map<String, Object> fileMap = new HashMap<>();
                fileMap.put("id", file.getId());
                fileMap.put("name", file.getName());
                fileMap.put("originalName", file.getOriginalName());
                fileMap.put("size", file.getSize());
                fileMap.put("category", file.getCategory());
                fileMap.put("uploadDate", file.getUploadDate());
                fileMap.put("mimeType", file.getMimeType());
                fileMap.put("aiCategory", file.getAiCategory());
                fileMap.put("aiSummary", file.getAiSummary());
                fileMap.put("aiTags", file.getAiTags());
                fileMap.put("aiConfidence", file.getAiConfidence());
                return fileMap;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(fileList);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to retrieve files: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchFiles(@RequestParam("q") String query) {
        try {
            User user = getCurrentUser();
            List<FileMetadata> files = fileService.searchFiles(user, query);
            List<Map<String, Object>> fileList = files.stream().map(file -> {
                Map<String, Object> fileMap = new HashMap<>();
                fileMap.put("id", file.getId());
                fileMap.put("name", file.getName());
                fileMap.put("originalName", file.getOriginalName());
                fileMap.put("size", file.getSize());
                fileMap.put("category", file.getCategory());
                fileMap.put("uploadDate", file.getUploadDate());
                fileMap.put("mimeType", file.getMimeType());
                fileMap.put("aiCategory", file.getAiCategory());
                fileMap.put("aiSummary", file.getAiSummary());
                fileMap.put("aiTags", file.getAiTags());
                fileMap.put("aiConfidence", file.getAiConfidence());
                return fileMap;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(fileList);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Search failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getCategories() {
        try {
            User user = getCurrentUser();
            
            // Standard categories
            List<Object[]> categoryCounts = fileService.getCategoryCounts(user);
            List<Map<String, Object>> standardCategories = categoryCounts.stream().map(obj -> {
                Map<String, Object> map = new HashMap<>();
                map.put("category", obj[0]);
                map.put("count", obj[1]);
                return map;
            }).collect(Collectors.toList());

            // AI categories
            List<Object[]> aiCategoryCounts = fileService.getAiCategoryCounts(user);
            List<Map<String, Object>> aiCategories = aiCategoryCounts.stream().map(obj -> {
                Map<String, Object> map = new HashMap<>();
                map.put("category", obj[0]);
                map.put("count", obj[1]);
                return map;
            }).collect(Collectors.toList());

            Map<String, Object> combinedResponse = new HashMap<>();
            combinedResponse.put("standard", standardCategories);
            combinedResponse.put("ai", aiCategories);

            return ResponseEntity.ok(combinedResponse);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to get categories: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getFile(@PathVariable String id) {
        try {
            User user = getCurrentUser();
            FileMetadata fileMetadata = fileService.getFileById(id, user)
                    .orElseThrow(() -> new IllegalArgumentException("File not found"));

            Map<String, Object> fileMap = new HashMap<>();
            fileMap.put("id", fileMetadata.getId());
            fileMap.put("name", fileMetadata.getName());
            fileMap.put("originalName", fileMetadata.getOriginalName());
            fileMap.put("size", fileMetadata.getSize());
            fileMap.put("category", fileMetadata.getCategory());
            fileMap.put("uploadDate", fileMetadata.getUploadDate());
            fileMap.put("mimeType", fileMetadata.getMimeType());
            fileMap.put("aiCategory", fileMetadata.getAiCategory());
            fileMap.put("aiSummary", fileMetadata.getAiSummary());
            fileMap.put("aiTags", fileMetadata.getAiTags());
            fileMap.put("aiConfidence", fileMetadata.getAiConfidence());

            return ResponseEntity.ok(fileMap);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to retrieve file: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<?> downloadFile(@PathVariable String id) {
        try {
            User user = getCurrentUser();
            FileMetadata fileMetadata = fileService.getFileById(id, user)
                    .orElseThrow(() -> new IllegalArgumentException("File not found"));

            // Stream the file through the backend — never expose S3 URLs to the client
            InputStreamResource resource = new InputStreamResource(
                    s3Service.getFileStream(fileMetadata.getS3Key())
            );

            String contentType = fileMetadata.getMimeType() != null 
                    ? fileMetadata.getMimeType() 
                    : "application/octet-stream";
            
            String fileName = fileMetadata.getOriginalName() != null 
                    ? fileMetadata.getOriginalName() 
                    : fileMetadata.getName();

            // Use RFC 5987 encoding for proper Unicode/special character support
            String encodedFileName = java.net.URLEncoder.encode(fileName, java.nio.charset.StandardCharsets.UTF_8)
                    .replace("+", "%20");

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, 
                            "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encodedFileName)
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileMetadata.getSize()))
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.CONTENT_DISPOSITION)
                    .body(resource);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to download file: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/download-zip")
    public ResponseEntity<?> downloadZip(@RequestBody Map<String, Object> request) {
        try {
            User user = getCurrentUser();

            Object rawIds = request == null ? null : request.get("ids");
            List<String> ids = fileService.normalizeIds(rawIds);
            if (ids.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "No IDs provided");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            InputStreamResource resource = new InputStreamResource(fileService.buildZipStream(ids, user));

            String fileName = "my-files.zip";
            String encoded = java.net.URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileName + "\"; filename*=UTF-8''" + encoded)
                    .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.CONTENT_DISPOSITION)
                    .body(resource);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to download ZIP: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFile(@PathVariable String id) {
        try {
            User user = getCurrentUser();
            fileService.deleteFile(id, user);

            Map<String, String> response = new HashMap<>();
            response.put("message", "File deleted successfully");

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (IOException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to delete file: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Delete failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<?> deleteFilesBulk(@RequestBody Map<String, List<String>> request) {
        try {
            User user = getCurrentUser();
            List<String> ids = request.get("ids");
            if (ids == null || ids.isEmpty()) {
                throw new IllegalArgumentException("No IDs provided");
            }
            fileService.deleteFilesBulk(ids, user);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Files deleted successfully");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Bulk delete failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/{id}/category")
    public ResponseEntity<?> updateCategory(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            User user = getCurrentUser();
            String newCategory = request.get("category");
            if (newCategory == null || newCategory.trim().isEmpty()) {
                throw new IllegalArgumentException("Category cannot be empty");
            }
            FileMetadata updatedFile = fileService.updateCategory(id, user, newCategory);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", updatedFile.getId());
            response.put("category", updatedFile.getCategory());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Category update failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PutMapping("/bulk/category")
    public ResponseEntity<?> updateCategoryBulk(@RequestBody Map<String, Object> request) {
        try {
            User user = getCurrentUser();
            Object rawIds = request == null ? null : request.get("ids");
            List<String> ids = fileService.normalizeIds(rawIds);
            String newCategory = request == null || request.get("category") == null ? null : request.get("category").toString();

            if (ids.isEmpty()) {
                throw new IllegalArgumentException("No IDs provided");
            }
            if (newCategory == null || newCategory.trim().isEmpty()) {
                throw new IllegalArgumentException("Category cannot be empty");
            }

            int updated = fileService.updateCategoryBulk(ids, user, newCategory);

            Map<String, Object> response = new HashMap<>();
            response.put("updated", updated);
            response.put("category", newCategory);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Bulk category update failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/{id}/reanalyze")
    public ResponseEntity<?> reanalyzeFile(@PathVariable String id) {
        try {
            User user = getCurrentUser();
            fileService.reanalyzeFile(id, user);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Analysis triggered successfully");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to trigger analysis: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
