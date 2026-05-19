package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.model.TransferPinAttempt;
import com.cloudfileorganizer.backend.model.FileMetadata;
import com.cloudfileorganizer.backend.model.TransferSession;
import com.cloudfileorganizer.backend.model.TransferSessionStatus;
import com.cloudfileorganizer.backend.repository.FileRepository;
import com.cloudfileorganizer.backend.repository.TransferPinAttemptRepository;
import com.cloudfileorganizer.backend.repository.TransferSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

@Service
public class TransferService {

    private static final Logger logger = LoggerFactory.getLogger(TransferService.class);
    private static final int MAX_ALLOWED_DOWNLOADS = 10;
    private static final int MAX_ALLOWED_EXPIRY_MINUTES = 60;
    private static final String SAFE_FILENAME_PATTERN = "[^a-zA-Z0-9._-]";

    @Autowired
    private TransferSessionRepository transferSessionRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private TransferPinAttemptRepository transferPinAttemptRepository;

    @Autowired
    private S3Service s3Service;

    private final BCryptPasswordEncoder pinEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${transfer.default-expiry-minutes:10}")
    private int defaultExpiryMinutes;

    @Value("${transfer.default-max-downloads:1}")
    private int defaultMaxDownloads;

    @Value("${transfer.max-file-size-bytes:52428800}")
    private long maxFileSizeBytes;

    @Value("${transfer.pin-length:6}")
    private int pinLength;

    @Value("${transfer.max-pin-attempts:5}")
    private int maxPinAttempts;

    @Value("${transfer.pin-rate-window-minutes:15}")
    private int pinRateWindowMinutes;

    @Value("${transfer.pin-rate-max-attempts:5}")
    private int pinRateMaxAttempts;

    @Value("${transfer.lock-minutes:15}")
    private int lockMinutes;

    @Value("${transfer.verification-ttl-seconds:180}")
    private int verificationTtlSeconds;

    @Value("${transfer.download-url-seconds:60}")
    private int downloadUrlSeconds;

    @Value("${transfer.upload-url-seconds:3600}")
    private int uploadUrlSeconds;

    @Value("${transfer.pin-encryption-key:}")
    private String pinEncryptionKey;

    // Comma-separated list of allowed frontend origins (also used as fallback base URL for generated links).
    // Set via FRONTEND_URL in environment.
    @Value("${frontend.urls:http://localhost:5173}")
    private String frontendUrls;

    public Map<String, Object> createSession(Integer maxDownloads, Integer expiryMinutes, String clientBaseUrl, Long createdByUserId) {
        return createSessionInternal(maxDownloads, expiryMinutes, clientBaseUrl, createdByUserId, null, null, null);
    }

    public Map<String, Object> createSessionFromExistingFile(String fileId, Integer maxDownloads, Integer expiryMinutes, String clientBaseUrl, Long createdByUserId) {
        if (fileId == null || fileId.isBlank()) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "file_id is required");
        }

        FileMetadata file = fileRepository.findById(fileId)
            .filter(existing -> existing.getUser() != null && Objects.equals(existing.getUser().getId(), createdByUserId))
            .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "File not found"));

        return createSessionInternal(
                maxDownloads,
                expiryMinutes,
                clientBaseUrl,
                createdByUserId,
                file.getS3Key(),
                file.getOriginalName() != null ? file.getOriginalName() : file.getName(),
                file.getId()
        );
    }

    private Map<String, Object> createSessionInternal(Integer maxDownloads, Integer expiryMinutes, String clientBaseUrl, Long createdByUserId,
                                                      String fileKey, String originalFileName, String sourceFileId) {
        int safeMaxDownloads = (maxDownloads == null) ? defaultMaxDownloads : maxDownloads;
        int safeExpiryMinutes = (expiryMinutes == null) ? defaultExpiryMinutes : expiryMinutes;

        if (safeMaxDownloads < 1 || safeMaxDownloads > MAX_ALLOWED_DOWNLOADS) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "max_downloads must be between 1 and 10");
        }
        if (safeExpiryMinutes < 1 || safeExpiryMinutes > MAX_ALLOWED_EXPIRY_MINUTES) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "expiry_minutes must be between 1 and 60");
        }

        String sessionId = UUID.randomUUID().toString();
        String rawPin = generatePin(pinLength);

        TransferSession session = new TransferSession();
        session.setSessionId(sessionId);
        session.setPinHash(pinEncoder.encode(rawPin));
        session.setEncryptedPin(encryptPin(rawPin));
        session.setCreatedByUserId(createdByUserId);
        session.setExpiresAt(LocalDateTime.now().plusMinutes(safeExpiryMinutes));
        session.setMaxDownloads(safeMaxDownloads);
        session.setDownloadsCount(0);
        session.setFileKey(fileKey);
        session.setOriginalFileName(originalFileName);
        session.setSourceFileId(sourceFileId);
        session.setStatus(fileKey == null ? TransferSessionStatus.PENDING : TransferSessionStatus.UPLOADED);
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());

        transferSessionRepository.save(session);

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        data.put("pin", rawPin);
        data.put("expires_at", session.getExpiresAt());
        data.put("auto_delete_at", session.getExpiresAt());
        data.put("max_downloads", safeMaxDownloads);
        data.put("source_file_id", sourceFileId);
        data.put("source_file_name", originalFileName);
        data.put("transfer_mode", sourceFileId == null ? "upload" : "existing_file");
        String transferBase = resolveTransferBaseUrl(clientBaseUrl);
        data.put("transfer_url", transferBase + "/transfer/" + sessionId);
        if (fileKey != null && !fileKey.isBlank()) {
            // Provide QR code immediately for sessions that already reference an existing file
            data.put("qr_code", generateQrCodeDataUrl(transferBase + "/transfer/" + sessionId));
        }
        return data;
    }

    public Map<String, Object> getMyActiveSessions(Long userId, String clientBaseUrl) {
        List<TransferSession> sessions = transferSessionRepository
                .findByCreatedByUserIdAndExpiresAtAfterOrderByCreatedAtDesc(userId, LocalDateTime.now());

        String transferBase = resolveTransferBaseUrl(clientBaseUrl);
        List<Map<String, Object>> items = new ArrayList<>();
        for (TransferSession session : sessions) {
            if (session.getStatus() == TransferSessionStatus.EXPIRED) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("session_id", session.getSessionId());
            item.put("status", session.getStatus().name().toLowerCase());
            item.put("expires_at", session.getExpiresAt());
            item.put("auto_delete_at", session.getExpiresAt());
            item.put("downloads_count", session.getDownloadsCount());
            item.put("max_downloads", session.getMaxDownloads());
            item.put("transfer_url", transferBase + "/transfer/" + session.getSessionId());
            item.put("source_file_id", session.getSourceFileId());
            item.put("transfer_mode", session.getSourceFileId() == null ? "upload" : "existing_file");
                item.put("pin", (session.getEncryptedPin() == null || session.getEncryptedPin().isBlank())
                    ? "Unavailable"
                    : decryptPin(session.getEncryptedPin()));
            item.put("file_name", session.getOriginalFileName());
            items.add(item);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("items", items);
        data.put("count", items.size());
        return data;
    }

    public Map<String, Object> getSessionMetadata(String sessionId) {
        validateSessionId(sessionId);
        TransferSession session = transferSessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", session.getSessionId());
        data.put("status", session.getStatus().name().toLowerCase());
        data.put("expires_at", session.getExpiresAt());
        data.put("auto_delete_at", session.getExpiresAt());
        data.put("max_downloads", session.getMaxDownloads());
        data.put("downloads_count", session.getDownloadsCount());
        data.put("has_file", session.getFileKey() != null && !session.getFileKey().isBlank());
        data.put("file_name", session.getOriginalFileName());
        data.put("source_file_id", session.getSourceFileId());
        data.put("transfer_mode", session.getSourceFileId() == null ? "upload" : "existing_file");
        data.put("created_at", session.getCreatedAt());
        return data;
    }

    public Map<String, Object> getUploadUrl(String sessionId, String filename, Long fileSize, String contentType, Long requesterUserId) {
        validateSessionId(sessionId);
        if (filename == null || filename.isBlank()) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "filename is required");
        }
        if (fileSize == null || fileSize <= 0) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "file_size must be greater than 0");
        }
        if (fileSize > maxFileSizeBytes) {
            throw new TransferServiceException(HttpStatus.PAYLOAD_TOO_LARGE, "File size exceeds 50MB limit");
        }

        TransferSession session = transferSessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        if (session.getStatus() != TransferSessionStatus.PENDING) {
            throw new TransferServiceException(HttpStatus.CONFLICT, "Session is not pending upload");
        }

        if (!Objects.equals(session.getCreatedByUserId(), requesterUserId)) {
            throw new TransferServiceException(HttpStatus.FORBIDDEN, "You do not own this transfer session");
        }

        String safeName = sanitizeFilename(filename);
        String fileKey = "transfers/" + sessionId + "/" + safeName;

        S3Service.PresignedPutPayload uploadPayload = s3Service.generatePresignedPutUrl(
                fileKey,
                (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType,
            Duration.ofSeconds(uploadUrlSeconds)
        );

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        data.put("file_key", fileKey);
        data.put("upload_url", uploadPayload.getUrl());
        data.put("upload_headers", uploadPayload.getSignedHeaders());
        data.put("expires_in_seconds", uploadUrlSeconds);
        return data;
    }

    @Transactional
    public Map<String, Object> markUploadComplete(String sessionId, String fileKey, String clientBaseUrl, Long requesterUserId) {
        validateSessionId(sessionId);
        if (fileKey == null || fileKey.isBlank()) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "file_key is required");
        }

        TransferSession session = transferSessionRepository.findBySessionIdAndStatusNot(sessionId, TransferSessionStatus.EXPIRED)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        if (!fileKey.startsWith("transfers/" + sessionId + "/")) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "Invalid file_key for this session");
        }

        if (!Objects.equals(session.getCreatedByUserId(), requesterUserId)) {
            throw new TransferServiceException(HttpStatus.FORBIDDEN, "You do not own this transfer session");
        }

        session.setFileKey(fileKey);
        session.setOriginalFileName(extractFileNameFromKey(fileKey));
        session.setStatus(TransferSessionStatus.UPLOADED);
        session.setUpdatedAt(LocalDateTime.now());
        transferSessionRepository.save(session);

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        String transferUrl = resolveTransferBaseUrl(clientBaseUrl) + "/transfer/" + sessionId;
        data.put("transfer_url", transferUrl);
        data.put("auto_delete_at", session.getExpiresAt());
        data.put("qr_code", generateQrCodeDataUrl(transferUrl));
        return data;
    }

    @Transactional
    public DownloadStreamPayload consumeDownloadForStream(String sessionId, String verificationToken) {
        validateSessionId(sessionId);
        if (verificationToken == null || verificationToken.isBlank()) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "verification_token is required");
        }

        TransferSession session = transferSessionRepository.findBySessionIdAndStatusNot(sessionId, TransferSessionStatus.EXPIRED)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        if (session.getFileKey() == null || session.getFileKey().isBlank()) {
            throw new TransferServiceException(HttpStatus.CONFLICT, "File not uploaded yet");
        }

        if (session.getDownloadsCount() >= session.getMaxDownloads()) {
            session.setStatus(TransferSessionStatus.DOWNLOADED);
            session.setUpdatedAt(LocalDateTime.now());
            transferSessionRepository.save(session);
            throw new TransferServiceException(HttpStatus.GONE, "Download limit exceeded");
        }

        if (session.getVerificationTokenHash() == null || session.getVerificationExpiresAt() == null
                || session.getVerificationExpiresAt().isBefore(LocalDateTime.now())) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "PIN verification required");
        }

        String providedHash = sha256Hex(verificationToken);
        if (!MessageDigest.isEqual(
                providedHash.getBytes(StandardCharsets.UTF_8),
                session.getVerificationTokenHash().getBytes(StandardCharsets.UTF_8)
        )) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "PIN verification required");
        }

        S3Service.S3ObjectPayload objectPayload;
        try {
            objectPayload = s3Service.getFileWithMetadata(session.getFileKey());
        } catch (RuntimeException ex) {
            throw new TransferServiceException(HttpStatus.BAD_GATEWAY, "Unable to fetch file from storage");
        }

        InputStream stream = objectPayload.getStream();
        String contentType = objectPayload.getContentType();
        Long contentLength = objectPayload.getContentLength();
        String fileName = (session.getOriginalFileName() == null || session.getOriginalFileName().isBlank())
                ? extractFileNameFromKey(session.getFileKey())
                : session.getOriginalFileName();

        session.setDownloadsCount(session.getDownloadsCount() + 1);
        if (session.getDownloadsCount() >= session.getMaxDownloads()) {
            session.setStatus(TransferSessionStatus.DOWNLOADED);
        }

        session.setVerificationTokenHash(null);
        session.setVerificationExpiresAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        transferSessionRepository.save(session);

        return new DownloadStreamPayload(stream, contentType, contentLength, fileName);
    }

    @Transactional
    public Map<String, Object> verifyPin(String sessionId, String pin, String ipAddress) {
        validateSessionId(sessionId);
        if (pin == null || pin.isBlank()) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "pin is required");
        }

        TransferSession session = transferSessionRepository.findBySessionIdAndStatusNot(sessionId, TransferSessionStatus.EXPIRED)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        if (session.getStatus() == TransferSessionStatus.PENDING) {
            throw new TransferServiceException(HttpStatus.CONFLICT, "File not uploaded yet");
        }

        LocalDateTime now = LocalDateTime.now();
        if (session.getLockedUntil() != null && session.getLockedUntil().isAfter(now)) {
            throw new TransferServiceException(HttpStatus.TOO_MANY_REQUESTS, "Session temporarily locked due to too many failed attempts");
        }

        LocalDateTime windowStart = now.minusMinutes(pinRateWindowMinutes);
        long ipAttempts = transferPinAttemptRepository.countByIpAddressAndCreatedAtAfter(ipAddress, windowStart);
        long sessionAttemptsWindow = transferPinAttemptRepository.countBySessionIdAndCreatedAtAfter(sessionId, windowStart);

        if (ipAttempts >= pinRateMaxAttempts || sessionAttemptsWindow >= pinRateMaxAttempts) {
            throw new TransferServiceException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again later");
        }

        boolean valid = pinEncoder.matches(pin, session.getPinHash());
        if (!valid) {
            transferPinAttemptRepository.save(new TransferPinAttempt(sessionId, ipAddress));

            int attempts = session.getPinAttempts() + 1;
            session.setPinAttempts(attempts);
            if (attempts >= maxPinAttempts) {
                session.setLockedUntil(now.plusMinutes(lockMinutes));
            }
            session.setUpdatedAt(now);
            transferSessionRepository.save(session);
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "Invalid PIN");
        }

        String verificationToken = UUID.randomUUID() + "-" + UUID.randomUUID();
        session.setVerificationTokenHash(sha256Hex(verificationToken));
        session.setVerificationExpiresAt(now.plusSeconds(verificationTtlSeconds));
        session.setPinAttempts(0);
        session.setLockedUntil(null);
        session.setUpdatedAt(now);
        transferSessionRepository.save(session);

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        data.put("verification_token", verificationToken);
        data.put("verification_expires_in_seconds", verificationTtlSeconds);
        return data;
    }

    @Transactional
    public Map<String, Object> getDownloadUrl(String sessionId, String verificationToken) {
        validateSessionId(sessionId);
        if (verificationToken == null || verificationToken.isBlank()) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "verification_token is required");
        }

        TransferSession session = transferSessionRepository.findBySessionIdAndStatusNot(sessionId, TransferSessionStatus.EXPIRED)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (isExpired(session)) {
            expireSession(session);
            throw new TransferServiceException(HttpStatus.GONE, "Session expired");
        }

        if (session.getFileKey() == null || session.getFileKey().isBlank()) {
            throw new TransferServiceException(HttpStatus.CONFLICT, "File not uploaded yet");
        }

        if (session.getDownloadsCount() >= session.getMaxDownloads()) {
            session.setStatus(TransferSessionStatus.DOWNLOADED);
            session.setUpdatedAt(LocalDateTime.now());
            transferSessionRepository.save(session);
            throw new TransferServiceException(HttpStatus.GONE, "Download limit exceeded");
        }

        if (session.getVerificationTokenHash() == null || session.getVerificationExpiresAt() == null
                || session.getVerificationExpiresAt().isBefore(LocalDateTime.now())) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "PIN verification required");
        }

        String providedHash = sha256Hex(verificationToken);
        if (!MessageDigest.isEqual(
                providedHash.getBytes(StandardCharsets.UTF_8),
                session.getVerificationTokenHash().getBytes(StandardCharsets.UTF_8)
        )) {
            throw new TransferServiceException(HttpStatus.UNAUTHORIZED, "PIN verification required");
        }

        String downloadUrl = s3Service.generatePresignedGetUrl(
                session.getFileKey(),
                Duration.ofSeconds(downloadUrlSeconds),
                null
        );

        session.setDownloadsCount(session.getDownloadsCount() + 1);
        if (session.getDownloadsCount() >= session.getMaxDownloads()) {
            session.setStatus(TransferSessionStatus.DOWNLOADED);
        }

        // One-time verification token to reduce replay risk.
        session.setVerificationTokenHash(null);
        session.setVerificationExpiresAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        transferSessionRepository.save(session);

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        data.put("download_url", downloadUrl);
        data.put("expires_in_seconds", downloadUrlSeconds);
        data.put("downloads_count", session.getDownloadsCount());
        data.put("downloads_remaining", Math.max(session.getMaxDownloads() - session.getDownloadsCount(), 0));
        return data;
    }

    @Transactional
    public Map<String, Object> endSession(String sessionId, Long requesterUserId) {
        return endSession(sessionId, requesterUserId, false);
    }

    @Transactional
    public Map<String, Object> endSession(String sessionId, Long requesterUserId, boolean isAdmin) {
        validateSessionId(sessionId);

        TransferSession session = transferSessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new TransferServiceException(HttpStatus.NOT_FOUND, "Session not found"));

        if (!isAdmin && !Objects.equals(session.getCreatedByUserId(), requesterUserId)) {
            throw new TransferServiceException(HttpStatus.FORBIDDEN, "You do not own this transfer session");
        }

        if (session.getStatus() == TransferSessionStatus.EXPIRED) {
            Map<String, Object> data = new HashMap<>();
            data.put("session_id", sessionId);
            data.put("status", "expired");
            return data;
        }

        if (session.getSourceFileId() == null && session.getFileKey() != null && !session.getFileKey().isBlank()) {
            try {
                s3Service.deleteFile(session.getFileKey());
            } catch (Exception ex) {
                logger.warn("Failed to delete S3 object for ended session {}: {}", sessionId, ex.getMessage());
            }
        }

        session.setStatus(TransferSessionStatus.EXPIRED);
        session.setVerificationTokenHash(null);
        session.setVerificationExpiresAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        transferSessionRepository.save(session);

        Map<String, Object> data = new HashMap<>();
        data.put("session_id", sessionId);
        data.put("status", "expired");
        return data;
    }

    public Map<String, Object> getActiveSessionsForAdmin(String clientBaseUrl) {
        List<TransferSession> sessions = transferSessionRepository
                .findByExpiresAtAfterAndStatusNot(LocalDateTime.now(), TransferSessionStatus.EXPIRED);

        String transferBase = resolveTransferBaseUrl(clientBaseUrl);
        List<Map<String, Object>> items = new ArrayList<>();
        for (TransferSession session : sessions) {
            Map<String, Object> item = new HashMap<>();
            item.put("session_id", session.getSessionId());
            item.put("status", session.getStatus().name().toLowerCase());
            item.put("expires_at", session.getExpiresAt());
            item.put("downloads_count", session.getDownloadsCount());
            item.put("max_downloads", session.getMaxDownloads());
            item.put("transfer_url", transferBase + "/transfer/" + session.getSessionId());
            item.put("file_name", session.getOriginalFileName());
            item.put("source_file_id", session.getSourceFileId());
            item.put("transfer_mode", session.getSourceFileId() == null ? "upload" : "existing_file");
            item.put("created_by_user_id", session.getCreatedByUserId());
            items.add(item);
        }

        Map<String, Object> data = new HashMap<>();
        data.put("items", items);
        data.put("count", items.size());
        return data;
    }

    @Scheduled(fixedDelayString = "${transfer.cleanup-interval-ms:300000}")
    @Transactional
    public void cleanupExpiredTransfers() {
        LocalDateTime now = LocalDateTime.now();
        List<TransferSession> expired = transferSessionRepository.findByExpiresAtBeforeAndStatusNot(now, TransferSessionStatus.EXPIRED);

        logger.info("Starting transfer cleanup: {} expired sessions found", expired.size());

        int deletedCount = 0;
        int failedCount = 0;

        for (TransferSession session : expired) {
            if (session.getSourceFileId() == null && session.getFileKey() != null && !session.getFileKey().isBlank()) {
                try {
                    s3Service.deleteFile(session.getFileKey());
                    logger.debug("Successfully deleted S3 object for session {}: {}", session.getId(), session.getFileKey());
                    deletedCount++;
                } catch (Exception e) {
                    logger.warn("Failed to delete S3 object for session {}: {} - Error: {}",
                            session.getId(), session.getFileKey(), e.getMessage());
                    failedCount++;
                    // Continue cleanup of database record even if S3 deletion fails.
                    // The file can be cleaned up manually if needed.
                }
            }
            session.setStatus(TransferSessionStatus.EXPIRED);
            session.setVerificationTokenHash(null);
            session.setVerificationExpiresAt(null);
            session.setUpdatedAt(now);
        }
        transferSessionRepository.saveAll(expired);
        
        transferPinAttemptRepository.deleteByCreatedAtBefore(now.minusMinutes(Math.max(pinRateWindowMinutes * 2L, 60L)));

        logger.info("Transfer cleanup completed: {} S3 deletions successful, {} failed, {} database records expired",
                deletedCount, failedCount, expired.size());
    }

    private String generatePin(int length) {
        int safeLength = (length < 6 || length > 8) ? 6 : length;
        String chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < safeLength; i++) {
            sb.append(chars.charAt(secureRandom.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String extractFileNameFromKey(String fileKey) {
        if (fileKey == null || fileKey.isBlank()) {
            return "download";
        }
        int idx = fileKey.lastIndexOf('/');
        return idx >= 0 && idx < fileKey.length() - 1 ? fileKey.substring(idx + 1) : fileKey;
    }

    private void validateSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "session_id is required");
        }
        try {
            UUID.fromString(sessionId);
        } catch (Exception ex) {
            throw new TransferServiceException(HttpStatus.BAD_REQUEST, "Invalid session_id format");
        }
    }

    private String sanitizeFilename(String filename) {
        String onlyName = filename.replace("..", "").replace("/", "_").replace("\\", "_");
        String sanitized = onlyName.replaceAll(SAFE_FILENAME_PATTERN, "_");
        if (sanitized.isBlank()) {
            sanitized = "file";
        }
        return sanitized.length() > 180 ? sanitized.substring(0, 180) : sanitized;
    }

    private boolean isExpired(TransferSession session) {
        return session.getExpiresAt() == null || session.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private void expireSession(TransferSession session) {
        session.setStatus(TransferSessionStatus.EXPIRED);
        session.setVerificationTokenHash(null);
        session.setVerificationExpiresAt(null);
        session.setUpdatedAt(LocalDateTime.now());
        transferSessionRepository.save(session);
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new TransferServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Internal security error");
        }
    }

    private String resolveTransferBaseUrl(String clientBaseUrl) {
        if (clientBaseUrl != null) {
            String trimmed = clientBaseUrl.trim();
            if (!trimmed.isEmpty() && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
                return trimmed.replaceAll("/$", "");
            }
        }
        return resolvePrimaryFrontendUrl();
    }

    private String resolvePrimaryFrontendUrl() {
        String raw = frontendUrls;
        if (raw == null || raw.isBlank()) {
            return "http://localhost:5173";
        }

        String first = raw.split(",", 2)[0].trim();
        if (first.endsWith("/")) {
            first = first.replaceAll("/$", "");
        }
        if (first.startsWith("http://") || first.startsWith("https://")) {
            return first;
        }
        return "http://localhost:5173";
    }

    private String generateQrCodeDataUrl(String value) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix matrix = qrCodeWriter.encode(value, BarcodeFormat.QR_CODE, 300, 300);
            ByteArrayOutputStream pngStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", pngStream);
            String base64 = Base64.getEncoder().encodeToString(pngStream.toByteArray());
            return "data:image/png;base64," + base64;
        } catch (WriterException | java.io.IOException ex) {
            throw new TransferServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate QR code");
        }
    }

    private String encryptPin(String rawPin) {
        try {
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, buildAesKey(), new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(rawPin.getBytes(StandardCharsets.UTF_8));

            return Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception ex) {
            throw new TransferServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to encrypt transfer PIN");
        }
    }

    private String decryptPin(String encryptedPin) {
        try {
            String[] parts = encryptedPin.split(":", 2);
            if (parts.length != 2) {
                throw new IllegalArgumentException("Invalid encrypted pin format");
            }

            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[1]);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, buildAesKey(), new GCMParameterSpec(128, iv));
            byte[] decrypted = cipher.doFinal(ciphertext);

            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new TransferServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to decrypt transfer PIN");
        }
    }

    private SecretKeySpec buildAesKey() throws Exception {
        String source = (pinEncryptionKey == null || pinEncryptionKey.isBlank())
                ? "project-scfo-default-transfer-pin-key-change-me"
                : pinEncryptionKey;

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] keyBytes = digest.digest(source.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(keyBytes, "AES");
    }

    public static class DownloadStreamPayload {
        private final InputStream stream;
        private final String contentType;
        private final Long contentLength;
        private final String fileName;

        public DownloadStreamPayload(InputStream stream, String contentType, Long contentLength, String fileName) {
            this.stream = stream;
            this.contentType = contentType;
            this.contentLength = contentLength;
            this.fileName = fileName;
        }

        public InputStream getStream() {
            return stream;
        }

        public String getContentType() {
            return contentType;
        }

        public Long getContentLength() {
            return contentLength;
        }

        public String getFileName() {
            return fileName;
        }
    }

    public static class TransferServiceException extends RuntimeException {
        private final HttpStatus status;

        public TransferServiceException(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }

        public HttpStatus getStatus() {
            return status;
        }
    }
}
