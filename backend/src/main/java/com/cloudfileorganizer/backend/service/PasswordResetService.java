package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.dto.auth.VerifyOtpResponse;
import com.cloudfileorganizer.backend.exception.ApiException;
import com.cloudfileorganizer.backend.model.PasswordResetOtp;
import com.cloudfileorganizer.backend.model.PasswordResetSession;
import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.repository.PasswordResetOtpRepository;
import com.cloudfileorganizer.backend.repository.PasswordResetSessionRepository;
import com.cloudfileorganizer.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PasswordResetService {

    private static final Duration OTP_TTL = Duration.ofMinutes(5);
    private static final Duration SESSION_TTL = Duration.ofMinutes(15);
    private static final Duration REQUEST_RATE_WINDOW = Duration.ofMinutes(15);

    private static final int OTP_MAX_ATTEMPTS = 5;
    private static final int MAX_OTP_REQUESTS_PER_USER_PER_WINDOW = 3;

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordResetSessionRepository sessionRepository;
    private final ResendEmailService resendEmailService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    private final InMemoryFixedWindowRateLimiter requestIpLimiter = new InMemoryFixedWindowRateLimiter(10, Duration.ofMinutes(5));
    private final InMemoryFixedWindowRateLimiter verifyIpLimiter = new InMemoryFixedWindowRateLimiter(30, Duration.ofMinutes(5));

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetOtpRepository otpRepository,
            PasswordResetSessionRepository sessionRepository,
            ResendEmailService resendEmailService
    ) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.sessionRepository = sessionRepository;
        this.resendEmailService = resendEmailService;
    }

    @Transactional
    public void requestOtp(String rawEmail, String requestIp) {
        if (requestIp != null && !requestIp.isBlank()) {
            requestIpLimiter.check("forgot:" + requestIp);
        }

        String email = normalizeEmail(rawEmail);
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            return; // Do not reveal whether the account exists.
        }

        LocalDateTime now = LocalDateTime.now();
        long recentCount = otpRepository.countByUserAndCreatedAtAfter(user, now.minus(REQUEST_RATE_WINDOW));
        if (recentCount >= MAX_OTP_REQUESTS_PER_USER_PER_WINDOW) {
            return; // Enforce rate limit without revealing account existence.
        }

        // Invalidate any previous active OTPs for this user.
        List<PasswordResetOtp> activeOtps = otpRepository.findByUserAndUsedAtIsNullAndInvalidatedAtIsNull(user);
        for (PasswordResetOtp existing : activeOtps) {
            existing.setInvalidatedAt(now);
        }
        otpRepository.saveAll(activeOtps);

        String otp = generateOtp();
        String otpHash = encoder.encode(otp);

        PasswordResetOtp record = new PasswordResetOtp(user, otpHash, now.plus(OTP_TTL), requestIp);
        otpRepository.save(record);

        resendEmailService.sendPasswordResetOtp(user.getEmail(), otp);
    }

    @Transactional
    public VerifyOtpResponse verifyOtp(String rawEmail, String otp, String requestIp) {
        if (requestIp != null && !requestIp.isBlank()) {
            verifyIpLimiter.check("verify:" + requestIp);
        }

        String email = normalizeEmail(rawEmail);
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Invalid OTP"));

        LocalDateTime now = LocalDateTime.now();
        PasswordResetOtp otpRecord = otpRepository
                .findTopByUserAndUsedAtIsNullAndInvalidatedAtIsNullOrderByCreatedAtDesc(user)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Invalid OTP"));

        if (!otpRecord.isActive(now)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP is expired or invalid");
        }

        if (otpRecord.getAttemptCount() != null && otpRecord.getAttemptCount() >= OTP_MAX_ATTEMPTS) {
            otpRecord.setInvalidatedAt(now);
            otpRepository.save(otpRecord);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP attempts. Please request a new OTP.");
        }

        boolean matches = encoder.matches(otp, otpRecord.getOtpHash());
        if (!matches) {
            otpRecord.setAttemptCount((otpRecord.getAttemptCount() == null ? 0 : otpRecord.getAttemptCount()) + 1);
            if (otpRecord.getAttemptCount() >= OTP_MAX_ATTEMPTS) {
                otpRecord.setInvalidatedAt(now);
            }
            otpRepository.save(otpRecord);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid OTP");
        }

        otpRecord.setUsedAt(now);
        otpRepository.save(otpRecord);

        String sessionToken = UUID.randomUUID().toString();
        PasswordResetSession session = new PasswordResetSession(sessionToken, user, now.plus(SESSION_TTL), requestIp);
        sessionRepository.save(session);

        return new VerifyOtpResponse(sessionToken, "OTP verified");
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        validatePasswordStrength(newPassword);

        LocalDateTime now = LocalDateTime.now();
        PasswordResetSession session = sessionRepository.findById(token)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Reset token is invalid or expired"));

        if (!session.isActive(now)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Reset token is invalid or expired");
        }

        User user = session.getUser();
        user.setPassword(encoder.encode(newPassword));
        userRepository.save(user);

        session.setUsedAt(now);
        sessionRepository.save(session);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase();
    }

    private String generateOtp() {
        int value = secureRandom.nextInt(1_000_000);
        return String.format("%06d", value);
    }

    private void validatePasswordStrength(String password) {
        if (password == null || password.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        String pwd = password;
        if (pwd.length() < 8
                || !pwd.matches(".*[A-Z].*")
                || !pwd.matches(".*[a-z].*")
                || !pwd.matches(".*[0-9].*")
                || !pwd.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Password must be at least 8 characters with uppercase, lowercase, number, and special character");
        }
    }

    private static class InMemoryFixedWindowRateLimiter {
        private final int maxRequests;
        private final long windowMillis;
        private final ConcurrentHashMap<String, Window> store = new ConcurrentHashMap<>();

        private InMemoryFixedWindowRateLimiter(int maxRequests, Duration window) {
            this.maxRequests = maxRequests;
            this.windowMillis = window.toMillis();
        }

        private void check(String key) {
            long now = System.currentTimeMillis();
            Window window = store.compute(key, (k, existing) -> {
                if (existing == null || now - existing.windowStartMillis >= windowMillis) {
                    return new Window(now, 1);
                }
                return new Window(existing.windowStartMillis, existing.count + 1);
            });

            if (window.count > maxRequests) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please try again later.");
            }
        }

        private record Window(long windowStartMillis, int count) {}
    }
}
