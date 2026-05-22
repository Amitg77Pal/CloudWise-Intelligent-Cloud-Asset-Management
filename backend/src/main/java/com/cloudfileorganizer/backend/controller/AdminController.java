package com.cloudfileorganizer.backend.controller;

import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.repository.FileRepository;
import com.cloudfileorganizer.backend.repository.UserRepository;
import com.cloudfileorganizer.backend.service.AppSettingService;
import com.cloudfileorganizer.backend.service.AuditService;
import com.cloudfileorganizer.backend.service.TransferService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private AppSettingService appSettingService;

    @Autowired
    private TransferService transferService;

    @Autowired
    private AuditService auditService;

    @GetMapping("/stats")
    public ResponseEntity<?> getAdminStats(@AuthenticationPrincipal User adminUser) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        try {
            List<User> users = userRepository.findAll();
            Long totalSizeBytes = fileRepository.getTotalStorageSize();
            if (totalSizeBytes == null) totalSizeBytes = 0L;
            long totalFiles = fileRepository.count();

            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", users.size());
            stats.put("activeUsers", users.size()); // Assuming all are active for now
            stats.put("totalStorage", formatSize(totalSizeBytes));
            stats.put("totalStorageBytes", totalSizeBytes);
            stats.put("totalFiles", totalFiles);
            stats.put("systemUptime", "99.99%"); // Mocked SLA
            stats.put("storageLimit", "100 GB"); // Configured limit

            List<Map<String, Object>> userList = new ArrayList<>();
            for (User u : users) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", u.getId());
                map.put("name", u.getName());
                map.put("email", u.getEmail());
                map.put("role", u.getRole());
                map.put("aiClassificationEnabled", u.getAiClassificationEnabled());
                map.put("emailNotificationsEnabled", u.getEmailNotificationsEnabled());
                map.put("createdAt", u.getCreatedAt());
                
                Long userStorageBytes = fileRepository.getTotalStorageSizeByUser(u);
                if (userStorageBytes == null) userStorageBytes = 0L;
                
                map.put("storage", formatSize(userStorageBytes));
                map.put("storageBytes", userStorageBytes);
                map.put("fileCount", fileRepository.countByUser(u));
                map.put("joined", u.getCreatedAt() != null ? u.getCreatedAt().toLocalDate().toString() : "Unknown");
                map.put("status", "Active");
                userList.add(map);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("stats", stats);
            response.put("users", userList);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", "Failed to retrieve admin stats: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(@AuthenticationPrincipal User adminUser) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        List<User> users = userRepository.findAll();
        List<Map<String, Object>> userList = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("email", u.getEmail());
            map.put("role", u.getRole());
            map.put("active", u.getActive());
            map.put("aiClassificationEnabled", u.getAiClassificationEnabled());
            map.put("emailNotificationsEnabled", u.getEmailNotificationsEnabled());
            map.put("createdAt", u.getCreatedAt());
            map.put("updatedAt", u.getUpdatedAt());

            Long userStorageBytes = fileRepository.getTotalStorageSizeByUser(u);
            if (userStorageBytes == null) userStorageBytes = 0L;
            map.put("storageBytes", userStorageBytes);
            map.put("storage", formatSize(userStorageBytes));
            map.put("storageLimitBytes", u.getStorageLimitBytes());
            map.put("fileCount", fileRepository.countByUser(u));
            map.put("status", (u.getActive() != null && u.getActive()) ? "Active" : "Disabled");
            userList.add(map);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("items", userList);
        response.put("count", userList.size());
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@PathVariable Long id,
                                              @RequestBody Map<String, Object> request,
                                              @AuthenticationPrincipal User adminUser,
                                              HttpServletRequest servletRequest) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!request.containsKey("active")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("active is required"));
        }

        boolean newActive = Boolean.parseBoolean(String.valueOf(request.get("active")));
        user.setActive(newActive);
        userRepository.save(user);

        auditService.log(
                newActive ? "ADMIN_USER_ENABLE" : "ADMIN_USER_DISABLE",
                adminUser.getId(), adminUser.getEmail(),
                String.valueOf(id), "USER",
                "Admin " + (newActive ? "enabled" : "disabled") + " user: " + user.getEmail(),
                servletRequest != null ? servletRequest.getRemoteAddr() : null
        );

        return ResponseEntity.ok(profileDto(user));
    }

    @PatchMapping("/users/{id}/storage-limit")
    public ResponseEntity<?> updateUserStorageLimit(@PathVariable Long id,
                                                    @RequestBody Map<String, Object> request,
                                                    @AuthenticationPrincipal User adminUser,
                                                    HttpServletRequest servletRequest) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!request.containsKey("storageLimitBytes")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("storageLimitBytes is required"));
        }

        Long limit = null;
        try {
            limit = Long.parseLong(String.valueOf(request.get("storageLimitBytes")));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("storageLimitBytes must be a number"));
        }

        if (limit < 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("storageLimitBytes must be >= 0"));
        }

        user.setStorageLimitBytes(limit == 0 ? null : limit);
        userRepository.save(user);

        auditService.log(
                "ADMIN_STORAGE_LIMIT_CHANGE",
                adminUser.getId(), adminUser.getEmail(),
                String.valueOf(id), "USER",
                "Storage limit set to " + (limit == 0 ? "unlimited" : formatSize(limit)) + " for user: " + user.getEmail(),
                servletRequest != null ? servletRequest.getRemoteAddr() : null
        );

        return ResponseEntity.ok(profileDto(user));
    }

    @GetMapping("/settings")
    public ResponseEntity<?> getSettings(@AuthenticationPrincipal User adminUser) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        Map<String, Object> data = appSettingService.getEffectiveSettings(
                100L * 1024 * 1024,
                10,
                1,
                50L * 1024 * 1024,
            1L * 1024 * 1024 * 1024
        );
        return ResponseEntity.ok(data);
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Object> request,
                                            @AuthenticationPrincipal User adminUser,
                                            HttpServletRequest servletRequest) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        if (request.containsKey("uploadMaxFileSizeBytes")) {
            appSettingService.set(AppSettingService.KEY_UPLOAD_MAX_FILE_SIZE_BYTES, request.get("uploadMaxFileSizeBytes"));
        }
        if (request.containsKey("transferDefaultExpiryMinutes")) {
            appSettingService.set(AppSettingService.KEY_TRANSFER_DEFAULT_EXPIRY_MINUTES, request.get("transferDefaultExpiryMinutes"));
        }
        if (request.containsKey("transferDefaultMaxDownloads")) {
            appSettingService.set(AppSettingService.KEY_TRANSFER_DEFAULT_MAX_DOWNLOADS, request.get("transferDefaultMaxDownloads"));
        }
        if (request.containsKey("transferMaxFileSizeBytes")) {
            appSettingService.set(AppSettingService.KEY_TRANSFER_MAX_FILE_SIZE_BYTES, request.get("transferMaxFileSizeBytes"));
        }
        if (request.containsKey("defaultUserStorageLimitBytes")) {
            appSettingService.set(AppSettingService.KEY_DEFAULT_USER_STORAGE_LIMIT_BYTES, request.get("defaultUserStorageLimitBytes"));
        }

        auditService.log(
                "ADMIN_SETTINGS_UPDATE",
                adminUser.getId(), adminUser.getEmail(),
                null, "SETTING",
                "Platform settings updated: " + request.keySet(),
                servletRequest != null ? servletRequest.getRemoteAddr() : null
        );

        return ResponseEntity.ok(getSettings(adminUser).getBody());
    }

    @GetMapping("/transfers")
    public ResponseEntity<?> listTransfers(@RequestParam(value = "client_base_url", required = false) String clientBaseUrl,
                                           @AuthenticationPrincipal User adminUser,
                                           HttpServletRequest servletRequest) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;
        String resolvedBaseUrl = resolveClientBaseUrl(clientBaseUrl, servletRequest);
        return ResponseEntity.ok(transferService.getActiveSessionsForAdmin(resolvedBaseUrl));
    }

    private String resolveClientBaseUrl(String explicitBaseUrl, HttpServletRequest servletRequest) {
        String fromExplicit = normalizeBaseUrl(explicitBaseUrl);
        if (fromExplicit != null) {
            return fromExplicit;
        }

        if (servletRequest == null) {
            return null;
        }

        String origin = normalizeBaseUrl(servletRequest.getHeader("Origin"));
        if (origin != null) {
            return origin;
        }

        return normalizeBaseUrl(servletRequest.getHeader("Referer"));
    }

    private String normalizeBaseUrl(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        try {
            URI uri = URI.create(trimmed);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            if (scheme == null || host == null) {
                return null;
            }

            String base = port == -1 ? scheme + "://" + host : scheme + "://" + host + ":" + port;
            return base.replaceAll("/$", "");
        } catch (Exception ex) {
            return null;
        }
    }
    @PostMapping("/transfers/end")
    public ResponseEntity<?> endTransfer(@RequestBody Map<String, Object> request,
                                         @AuthenticationPrincipal User adminUser,
                                         HttpServletRequest servletRequest) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        String sessionId = request.get("session_id") == null ? null : request.get("session_id").toString();
        try {
            Map<String, Object> result = transferService.endSession(sessionId, adminUser.getId(), true);

            auditService.log(
                    "ADMIN_TRANSFER_END",
                    adminUser.getId(), adminUser.getEmail(),
                    sessionId, "TRANSFER",
                    "Admin ended transfer session: " + sessionId,
                    servletRequest != null ? servletRequest.getRemoteAddr() : null
            );

            return ResponseEntity.ok(result);
        } catch (TransferService.TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @GetMapping("/audit-report")
    public ResponseEntity<?> getAuditReport(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @AuthenticationPrincipal User adminUser) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        try {
            LocalDateTime from = null;
            LocalDateTime to = null;

            if (fromStr != null && !fromStr.isBlank()) {
                from = LocalDate.parse(fromStr, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
            }
            if (toStr != null && !toStr.isBlank()) {
                to = LocalDate.parse(toStr, DateTimeFormatter.ISO_LOCAL_DATE).atTime(23, 59, 59);
            }

            Map<String, Object> report = auditService.generateReport(from, to);
            return ResponseEntity.ok(report);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(error("Failed to generate audit report: " + e.getMessage()));
        }
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<?> getRecentAuditLogs(@AuthenticationPrincipal User adminUser) {
        ResponseEntity<?> auth = requireAdmin(adminUser);
        if (auth != null) return auth;

        try {
            List<Map<String, Object>> logs = auditService.getRecentLogs();
            Map<String, Object> response = new HashMap<>();
            response.put("items", logs);
            response.put("count", logs.size());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(error("Failed to fetch audit logs: " + e.getMessage()));
        }
    }

    private String formatSize(long bytes) {
        if (bytes == 0) return "0 B";
        double k = 1024.0;
        String[] sizes = {"B", "KB", "MB", "GB", "TB"};
        int i = (int) Math.floor(Math.log(bytes) / Math.log(k));
        return String.format("%.2f %s", bytes / Math.pow(k, i), sizes[i]);
    }

    private ResponseEntity<?> requireAdmin(User user) {
        if (user == null || !"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error("Unauthorized access"));
        }
        return null;
    }

    private Map<String, Object> profileDto(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("name", user.getName());
        data.put("email", user.getEmail());
        data.put("role", user.getRole());
        data.put("active", user.getActive());
        data.put("storageLimitBytes", user.getStorageLimitBytes());
        data.put("aiClassificationEnabled", user.getAiClassificationEnabled());
        data.put("emailNotificationsEnabled", user.getEmailNotificationsEnabled());
        data.put("createdAt", user.getCreatedAt());
        data.put("updatedAt", user.getUpdatedAt());
        return data;
    }

    private Map<String, String> error(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return error;
    }
}
