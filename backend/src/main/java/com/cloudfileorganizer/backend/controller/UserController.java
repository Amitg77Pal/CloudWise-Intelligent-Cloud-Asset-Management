package com.cloudfileorganizer.backend.controller;

import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Unauthorized"));
        }

        user = userRepository.findById(user.getId()).orElse(user);
        return ResponseEntity.ok(profileDto(user));
    }

    @PutMapping("/preferences")
    public ResponseEntity<?> updatePreferences(@AuthenticationPrincipal User user,
                                               @RequestBody Map<String, Object> request) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Unauthorized"));
        }

        User dbUser = userRepository.findById(user.getId()).orElse(user);

        if (request.containsKey("aiClassificationEnabled")) {
            dbUser.setAiClassificationEnabled(Boolean.parseBoolean(String.valueOf(request.get("aiClassificationEnabled"))));
        }

        if (request.containsKey("emailNotificationsEnabled")) {
            dbUser.setEmailNotificationsEnabled(Boolean.parseBoolean(String.valueOf(request.get("emailNotificationsEnabled"))));
        }

        if (request.containsKey("mfaEnabled")) {
            dbUser.setMfaEnabled(Boolean.parseBoolean(String.valueOf(request.get("mfaEnabled"))));
        }

        userRepository.save(dbUser);
        return ResponseEntity.ok(profileDto(dbUser));
    }

    private Map<String, Object> profileDto(User user) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", user.getId());
        data.put("name", user.getName());
        data.put("email", user.getEmail());
        data.put("role", user.getRole());
        data.put("aiClassificationEnabled", user.getAiClassificationEnabled());
        data.put("emailNotificationsEnabled", user.getEmailNotificationsEnabled());
        data.put("mfaEnabled", user.getMfaEnabled());
        data.put("active", user.getActive());
        data.put("storageLimitBytes", user.getStorageLimitBytes());
        data.put("createdAt", user.getCreatedAt());
        return data;
    }

    private Map<String, String> error(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("message", message);
        return error;
    }
}
