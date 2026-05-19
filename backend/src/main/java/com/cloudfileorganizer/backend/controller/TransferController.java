package com.cloudfileorganizer.backend.controller;

import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.service.TransferService;
import com.cloudfileorganizer.backend.service.TransferService.TransferServiceException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/transfer")
public class TransferController {

    @Autowired
    private TransferService transferService;

    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody(required = false) Map<String, Object> request,
                                    @AuthenticationPrincipal User user,
                                    HttpServletRequest servletRequest) {
        try {
            requireAuthenticatedUser(user);
            Integer maxDownloads = request != null && request.get("max_downloads") != null
                ? toInteger(request.get("max_downloads"), "max_downloads")
                    : null;
            Integer expiryMinutes = request != null && request.get("expiry_minutes") != null
                ? toInteger(request.get("expiry_minutes"), "expiry_minutes")
                    : null;
            String clientBaseUrl = resolveClientBaseUrl(
                    request != null ? request.get("client_base_url") : null,
                    servletRequest
            );

            return ResponseEntity.ok(success(transferService.createSession(maxDownloads, expiryMinutes, clientBaseUrl, user.getId())));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @PostMapping("/create-from-file")
    public ResponseEntity<?> createFromFile(@RequestBody(required = false) Map<String, Object> request,
                            @AuthenticationPrincipal User user,
                            HttpServletRequest servletRequest) {
        try {
            requireAuthenticatedUser(user);
            String fileId = request != null && request.get("file_id") != null ? request.get("file_id").toString() : null;
            Integer maxDownloads = request != null && request.get("max_downloads") != null
                    ? toInteger(request.get("max_downloads"), "max_downloads")
                    : null;
            Integer expiryMinutes = request != null && request.get("expiry_minutes") != null
                    ? toInteger(request.get("expiry_minutes"), "expiry_minutes")
                    : null;
            String clientBaseUrl = resolveClientBaseUrl(
                request != null ? request.get("client_base_url") : null,
                servletRequest
            );

            return ResponseEntity.ok(success(transferService.createSessionFromExistingFile(
                    fileId,
                    maxDownloads,
                    expiryMinutes,
                    clientBaseUrl,
                    user.getId()
            )));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @GetMapping("/my-sessions")
    public ResponseEntity<?> mySessions(@RequestParam(value = "client_base_url", required = false) String clientBaseUrl,
                                        @AuthenticationPrincipal User user,
                                        HttpServletRequest servletRequest) {
        try {
            requireAuthenticatedUser(user);
            String resolvedBaseUrl = resolveClientBaseUrl(clientBaseUrl, servletRequest);
            return ResponseEntity.ok(success(transferService.getMyActiveSessions(user.getId(), resolvedBaseUrl)));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<?> metadata(@PathVariable String sessionId) {
        try {
            return ResponseEntity.ok(success(transferService.getSessionMetadata(sessionId)));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @PostMapping("/upload-url")
    public ResponseEntity<?> uploadUrl(@RequestBody Map<String, Object> request,
                                       @AuthenticationPrincipal User user) {
        try {
            requireAuthenticatedUser(user);
            String sessionId = request.get("session_id") == null ? null : request.get("session_id").toString();
            String filename = request.get("filename") == null ? null : request.get("filename").toString();
            Long fileSize = request.get("file_size") == null ? null : toLong(request.get("file_size"), "file_size");
            String contentType = request.get("content_type") == null ? null : request.get("content_type").toString();

            return ResponseEntity.ok(success(transferService.getUploadUrl(sessionId, filename, fileSize, contentType, user.getId())));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @PostMapping("/complete-upload")
    public ResponseEntity<?> completeUpload(@RequestBody Map<String, Object> request,
                                            @AuthenticationPrincipal User user,
                                            HttpServletRequest servletRequest) {
        try {
            requireAuthenticatedUser(user);
            String sessionId = request.get("session_id") == null ? null : request.get("session_id").toString();
            String fileKey = request.get("file_key") == null ? null : request.get("file_key").toString();
            String clientBaseUrl = resolveClientBaseUrl(request.get("client_base_url"), servletRequest);
            return ResponseEntity.ok(success(transferService.markUploadComplete(sessionId, fileKey, clientBaseUrl, user.getId())));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    private String resolveClientBaseUrl(Object explicitBaseUrl, HttpServletRequest servletRequest) {
        String explicit = explicitBaseUrl == null ? null : explicitBaseUrl.toString();
        String fromExplicit = normalizeBaseUrl(explicit);
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

        String referer = servletRequest.getHeader("Referer");
        return normalizeBaseUrl(referer);
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

    @PostMapping("/end")
    public ResponseEntity<?> endSession(@RequestBody Map<String, Object> request,
                                        @AuthenticationPrincipal User user) {
        try {
            requireAuthenticatedUser(user);
            String sessionId = request.get("session_id") == null ? null : request.get("session_id").toString();
            return ResponseEntity.ok(success(transferService.endSession(sessionId, user.getId())));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @PostMapping("/verify-pin")
    public ResponseEntity<?> verifyPin(@RequestBody Map<String, Object> request,
                                       @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
                                       HttpServletRequest servletRequest) {
        try {
            String sessionId = request.get("session_id") == null ? null : request.get("session_id").toString();
            String pin = request.get("pin") == null ? null : request.get("pin").toString();
            String ip = resolveClientIp(forwardedFor, servletRequest);

            return ResponseEntity.ok(success(transferService.verifyPin(sessionId, pin, ip)));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @GetMapping("/download")
    public ResponseEntity<?> download(@RequestParam("session_id") String sessionId,
                                      @RequestParam("verification_token") String verificationToken) {
        try {
            return ResponseEntity.ok(success(transferService.getDownloadUrl(sessionId, verificationToken)));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    @GetMapping("/download/stream")
    public ResponseEntity<?> downloadStream(@RequestParam("session_id") String sessionId,
                                            @RequestParam("verification_token") String verificationToken) {
        try {
            TransferService.DownloadStreamPayload payload = transferService.consumeDownloadForStream(sessionId, verificationToken);
            String contentType = (payload.getContentType() == null || payload.getContentType().isBlank())
                    ? "application/octet-stream"
                    : payload.getContentType();

            String fileName = sanitizeFileNameForDownload(payload.getFileName());
            String contentDisposition = ContentDisposition.attachment()
                    .filename(fileName, StandardCharsets.UTF_8)
                    .build()
                    .toString();

            ResponseEntity.BodyBuilder responseBuilder = ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition);

            if (payload.getContentLength() != null && payload.getContentLength() >= 0) {
                responseBuilder.contentLength(payload.getContentLength());
            }

            return responseBuilder.body(new InputStreamResource(payload.getStream()));
        } catch (TransferServiceException ex) {
            return ResponseEntity.status(ex.getStatus()).body(error(ex.getMessage()));
        }
    }

    private String sanitizeFileNameForDownload(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            fileName = "download";
        }

        String sanitized = fileName
                .replace("\r", "")
                .replace("\n", "")
                .replace("\\0", "")
                .replace("/", "_")
                .replace("\\\\", "_");

        // Remove non-printable control characters.
        sanitized = sanitized.replaceAll("[\\x00-\\x1F\\x7F]", "");

        if (sanitized.isBlank()) {
            return "download";
        }

        return sanitized.length() > 180 ? sanitized.substring(0, 180) : sanitized;
    }

    private void requireAuthenticatedUser(User user) {
        if (user == null || user.getId() == null) {
            throw new TransferServiceException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication required");
        }
    }

    private Map<String, Object> success(Map<String, Object> data) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", data);
        return response;
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", message);
        return response;
    }

    private Integer toInteger(Object value, String fieldName) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            throw new TransferServiceException(org.springframework.http.HttpStatus.BAD_REQUEST, fieldName + " must be a number");
        }
    }

    private Long toLong(Object value, String fieldName) {
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ex) {
            throw new TransferServiceException(org.springframework.http.HttpStatus.BAD_REQUEST, fieldName + " must be a number");
        }
    }

    private String resolveClientIp(String forwardedFor, HttpServletRequest request) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr == null || remoteAddr.isBlank()) ? "unknown" : remoteAddr;
    }
}
