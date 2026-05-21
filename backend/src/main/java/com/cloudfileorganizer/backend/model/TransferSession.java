package com.cloudfileorganizer.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "transfer_sessions", indexes = {
        @Index(name = "idx_transfer_session_id", columnList = "session_id", unique = true),
        @Index(name = "idx_transfer_expires_at", columnList = "expires_at"),
    @Index(name = "idx_transfer_status", columnList = "status"),
    @Index(name = "idx_transfer_owner", columnList = "created_by_user_id")
})
public class TransferSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true, length = 64)
    private String sessionId;

    @Column(name = "file_key", length = 1024)
    private String fileKey;

    @Column(name = "source_file_id", length = 64)
    private String sourceFileId;

    @Column(name = "source_file_ids", length = 4000)
    private String sourceFileIds;

    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

    @Column(name = "pin_hash", nullable = false, length = 255)
    private String pinHash;

    @Column(name = "encrypted_pin", length = 1024)
    private String encryptedPin;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "max_downloads", nullable = false)
    private Integer maxDownloads = 1;

    @Column(name = "downloads_count", nullable = false)
    private Integer downloadsCount = 0;

    @Convert(converter = TransferSessionStatusConverter.class)
    @Column(name = "status", nullable = false, length = 20)
    private TransferSessionStatus status = TransferSessionStatus.PENDING;

    @Column(name = "pin_attempts", nullable = false)
    private Integer pinAttempts = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "verification_token_hash", length = 64)
    private String verificationTokenHash;

    @Column(name = "verification_expires_at")
    private LocalDateTime verificationExpiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getFileKey() {
        return fileKey;
    }

    public void setFileKey(String fileKey) {
        this.fileKey = fileKey;
    }

    public String getSourceFileId() {
        return sourceFileId;
    }

    public void setSourceFileId(String sourceFileId) {
        this.sourceFileId = sourceFileId;
    }

    public String getSourceFileIds() {
        return sourceFileIds;
    }

    public void setSourceFileIds(String sourceFileIds) {
        this.sourceFileIds = sourceFileIds;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }

    public String getPinHash() {
        return pinHash;
    }

    public void setPinHash(String pinHash) {
        this.pinHash = pinHash;
    }

    public String getEncryptedPin() {
        return encryptedPin;
    }

    public void setEncryptedPin(String encryptedPin) {
        this.encryptedPin = encryptedPin;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Integer getMaxDownloads() {
        return maxDownloads;
    }

    public void setMaxDownloads(Integer maxDownloads) {
        this.maxDownloads = maxDownloads;
    }

    public Integer getDownloadsCount() {
        return downloadsCount;
    }

    public void setDownloadsCount(Integer downloadsCount) {
        this.downloadsCount = downloadsCount;
    }

    public TransferSessionStatus getStatus() {
        return status;
    }

    public void setStatus(TransferSessionStatus status) {
        this.status = status;
    }

    public Integer getPinAttempts() {
        return pinAttempts;
    }

    public void setPinAttempts(Integer pinAttempts) {
        this.pinAttempts = pinAttempts;
    }

    public LocalDateTime getLockedUntil() {
        return lockedUntil;
    }

    public void setLockedUntil(LocalDateTime lockedUntil) {
        this.lockedUntil = lockedUntil;
    }

    public String getVerificationTokenHash() {
        return verificationTokenHash;
    }

    public void setVerificationTokenHash(String verificationTokenHash) {
        this.verificationTokenHash = verificationTokenHash;
    }

    public LocalDateTime getVerificationExpiresAt() {
        return verificationExpiresAt;
    }

    public void setVerificationExpiresAt(LocalDateTime verificationExpiresAt) {
        this.verificationExpiresAt = verificationExpiresAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
