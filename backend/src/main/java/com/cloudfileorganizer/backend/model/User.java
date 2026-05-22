package com.cloudfileorganizer.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(unique = true, nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 500)
    private String password;

    @Column(nullable = false, length = 20)
    private String role = "USER";

    @Column
    private Boolean aiClassificationEnabled = true;

    @Column
    private Boolean emailNotificationsEnabled = true;

    @Column
    private Boolean active = true;

    @Column
    private Long storageLimitBytes;

    @Column(length = 120)
    private String resetToken;

    @Column
    private LocalDateTime resetTokenExpiresAt;

    @Column
    private Boolean mfaEnabled = false;

    @Column(length = 10)
    private String mfaOtp;

    @Column
    private LocalDateTime mfaOtpExpiresAt;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    public void prePersist() {
        if (aiClassificationEnabled == null) {
            aiClassificationEnabled = true;
        }
        if (emailNotificationsEnabled == null) {
            emailNotificationsEnabled = true;
        }
        if (active == null) {
            active = true;
        }
        if (mfaEnabled == null) {
            mfaEnabled = false;
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // DEFAULT CONSTRUCTOR - REQUIRED BY HIBERNATE
    public User() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Boolean getAiClassificationEnabled() { return aiClassificationEnabled; }
    public void setAiClassificationEnabled(Boolean aiClassificationEnabled) { this.aiClassificationEnabled = aiClassificationEnabled; }

    public Boolean getEmailNotificationsEnabled() { return emailNotificationsEnabled; }
    public void setEmailNotificationsEnabled(Boolean emailNotificationsEnabled) { this.emailNotificationsEnabled = emailNotificationsEnabled; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Long getStorageLimitBytes() { return storageLimitBytes; }
    public void setStorageLimitBytes(Long storageLimitBytes) { this.storageLimitBytes = storageLimitBytes; }

    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }

    public LocalDateTime getResetTokenExpiresAt() { return resetTokenExpiresAt; }
    public void setResetTokenExpiresAt(LocalDateTime resetTokenExpiresAt) { this.resetTokenExpiresAt = resetTokenExpiresAt; }

    public Boolean getMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(Boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }

    public String getMfaOtp() { return mfaOtp; }
    public void setMfaOtp(String mfaOtp) { this.mfaOtp = mfaOtp; }

    public LocalDateTime getMfaOtpExpiresAt() { return mfaOtpExpiresAt; }
    public void setMfaOtpExpiresAt(LocalDateTime mfaOtpExpiresAt) { this.mfaOtpExpiresAt = mfaOtpExpiresAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
