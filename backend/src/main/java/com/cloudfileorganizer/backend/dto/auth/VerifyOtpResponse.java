package com.cloudfileorganizer.backend.dto.auth;

public record VerifyOtpResponse(
        String resetToken,
        String message
) {}
