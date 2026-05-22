package com.cloudfileorganizer.backend.controller;

import com.cloudfileorganizer.backend.dto.auth.ForgotPasswordRequest;
import com.cloudfileorganizer.backend.dto.auth.ResetPasswordRequest;
import com.cloudfileorganizer.backend.dto.auth.VerifyOtpRequest;
import com.cloudfileorganizer.backend.dto.auth.VerifyOtpResponse;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import com.cloudfileorganizer.backend.repository.UserRepository;
import com.cloudfileorganizer.backend.security.JwtUtil;
import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.service.AppSettingService;
import com.cloudfileorganizer.backend.service.AuditService;
import com.cloudfileorganizer.backend.service.PasswordResetService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AppSettingService appSettingService;

    @Autowired
    private PasswordResetService passwordResetService;

    @Autowired
    private AuditService auditService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user, HttpServletRequest servletRequest) {
        try {
            // Check if email already exists
            if (userRepo.findByEmail(user.getEmail()).isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Email already exists");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            // Validate required fields
            if (user.getName() == null || user.getName().trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Name is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Email is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Password is required");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            // Validate password strength
            String pwd = user.getPassword();
            if (pwd.length() < 8 || !pwd.matches(".*[A-Z].*") || !pwd.matches(".*[a-z].*") || !pwd.matches(".*[0-9].*") || !pwd.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Password must be at least 8 characters with uppercase, lowercase, number, and special character");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
            }

            // Encode password and set role
            user.setPassword(encoder.encode(user.getPassword()));
            user.setRole("USER");

            if (user.getStorageLimitBytes() == null) {
                Long defaultLimit = appSettingService.getLong(
                        AppSettingService.KEY_DEFAULT_USER_STORAGE_LIMIT_BYTES,
                        1L * 1024 * 1024 * 1024
                );
                user.setStorageLimitBytes(defaultLimit);
            }
            
            // Save user
            User savedUser = userRepo.save(user);

            // Generate JWT token
            String token = jwtUtil.generateToken(savedUser.getEmail());

            // Create response with token and user data
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", savedUser.getId());
            userData.put("name", savedUser.getName());
            userData.put("email", savedUser.getEmail());
            userData.put("role", savedUser.getRole());
            userData.put("aiClassificationEnabled", savedUser.getAiClassificationEnabled());
            userData.put("emailNotificationsEnabled", savedUser.getEmailNotificationsEnabled());
            userData.put("active", savedUser.getActive());
            userData.put("storageLimitBytes", savedUser.getStorageLimitBytes());
            userData.put("createdAt", savedUser.getCreatedAt());
            
            response.put("user", userData);

            auditService.log("USER_REGISTER", savedUser.getId(), savedUser.getEmail(),
                    String.valueOf(savedUser.getId()), "USER", "New user registered",
                    servletRequest != null ? servletRequest.getRemoteAddr() : null);

            return ResponseEntity.ok(response);
        } catch (DataIntegrityViolationException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Email already exists");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Registration failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User request, HttpServletRequest servletRequest) {
        try {
            String email = request.getEmail() == null ? null : request.getEmail().trim();
            User user = userRepo.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (!encoder.matches(request.getPassword(), user.getPassword())) {
                auditService.log("USER_LOGIN_FAILED", null, request.getEmail(),
                        null, "USER", "Failed login attempt",
                        servletRequest != null ? servletRequest.getRemoteAddr() : null);
                Map<String, String> error = new HashMap<>();
                error.put("message", "Invalid credentials");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
            }

            if (user.getActive() != null && !user.getActive()) {
                Map<String, String> error = new HashMap<>();
                error.put("message", "Account is disabled. Contact support.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
            }

            // Generate JWT token
            String token = jwtUtil.generateToken(user.getEmail());

            // Create response with token and user data
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            
            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("name", user.getName());
            userData.put("email", user.getEmail());
            userData.put("role", user.getRole());
            userData.put("aiClassificationEnabled", user.getAiClassificationEnabled());
            userData.put("emailNotificationsEnabled", user.getEmailNotificationsEnabled());
            userData.put("active", user.getActive());
            userData.put("storageLimitBytes", user.getStorageLimitBytes());
            userData.put("createdAt", user.getCreatedAt());
            
            response.put("user", userData);

            auditService.log("USER_LOGIN", user.getId(), user.getEmail(),
                    String.valueOf(user.getId()), "USER", "User logged in",
                    servletRequest != null ? servletRequest.getRemoteAddr() : null);

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Login failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest payload, HttpServletRequest request) {
        String requestIp = request == null ? null : request.getRemoteAddr();
        passwordResetService.requestOtp(payload.email(), requestIp);

        Map<String, String> response = new HashMap<>();
        response.put("message", "If the account exists, an OTP has been sent.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody VerifyOtpRequest payload, HttpServletRequest request) {
        String requestIp = request == null ? null : request.getRemoteAddr();
        VerifyOtpResponse response = passwordResetService.verifyOtp(payload.email(), payload.otp(), requestIp);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest payload) {
        passwordResetService.resetPassword(payload.token(), payload.password());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Password reset successfully");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        // JWT is stateless, so logout is handled on client side
        // This endpoint is just for consistency
        Map<String, String> response = new HashMap<>();
        response.put("message", "Logged out successfully");
        return ResponseEntity.ok(response);
    }
}
