package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

@Service
public class ResendEmailService {

    private static final String DEFAULT_FROM = "onboarding@resend.dev";

    private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);

    private final RestClient restClient;
    private final String resendApiKey;
    private final String resendFrom;

    public ResendEmailService(
            RestClient.Builder restClientBuilder,
            @Value("${resend.api-key:${RESEND_API_KEY:}}") String resendApiKey,
            @Value("${resend.from:${RESEND_FROM:" + DEFAULT_FROM + "}}") String resendFrom
    ) {
        this.restClient = restClientBuilder.build();
        this.resendApiKey = resendApiKey;
        this.resendFrom = (resendFrom == null || resendFrom.isBlank()) ? DEFAULT_FROM : resendFrom.trim();
    }

    public void sendPasswordResetOtp(String toEmail, String otp) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "RESEND_API_KEY is not configured");
        }

        Map<String, Object> body = Map.of(
                "from", resendFrom,
                "to", List.of(toEmail),
                "subject", "Password Reset OTP",
                "text", "Your password reset OTP is: " + otp + "\n\nThis code expires in 5 minutes.",
                "html", "<p>Your password reset OTP is: <b>" + otp + "</b></p><p>This code expires in 5 minutes.</p>"
        );

        try {
            restClient.post()
                    .uri("https://api.resend.com/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Sent password reset OTP email via Resend to={} from={}", toEmail, resendFrom);
        } catch (RestClientResponseException ex) {
            String responseBody = ex.getResponseBodyAsString();
            log.warn(
                    "Resend email send failed: status={} to={} from={} body={}",
                    ex.getRawStatusCode(),
                    toEmail,
                    resendFrom,
                    truncate(responseBody, 500)
            );

            // Provide an actionable but still safe message (frontend will display this).
            String message = switch (ex.getRawStatusCode()) {
                case 401, 403 -> "Email service is not authorized. Check RESEND_API_KEY and verify your sender domain (RESEND_FROM).";
                case 422 -> "Email service rejected this recipient. In Resend sandbox/unverified setups you can only send to verified emails. Verify your domain and set RESEND_FROM.";
                default -> "Failed to send OTP email";
            };
            throw new ApiException(HttpStatus.BAD_GATEWAY, message);
        } catch (Exception ex) {
            log.warn("Resend email send failed (unexpected): to={} from={} error={}", toEmail, resendFrom, ex.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Failed to send OTP email");
        }
    }

    public void sendMfaOtp(String toEmail, String otp) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "RESEND_API_KEY is not configured");
        }

        Map<String, Object> body = Map.of(
                "from", resendFrom,
                "to", List.of(toEmail),
                "subject", "Your Login Security Code",
                "text", "Your login security code is: " + otp + "\n\nThis code expires in 5 minutes.",
                "html", "<p>Your login security code is: <b>" + otp + "</b></p><p>This code expires in 5 minutes. Do not share this code with anyone.</p>"
        );

        try {
            restClient.post()
                    .uri("https://api.resend.com/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Sent MFA OTP email via Resend to={} from={}", toEmail, resendFrom);
        } catch (RestClientResponseException ex) {
            String responseBody = ex.getResponseBodyAsString();
            log.warn(
                    "Resend MFA email send failed: status={} to={} from={} body={}",
                    ex.getRawStatusCode(),
                    toEmail,
                    resendFrom,
                    truncate(responseBody, 500)
            );

            throw new ApiException(HttpStatus.BAD_GATEWAY, "Failed to send MFA email");
        } catch (Exception ex) {
            log.warn("Resend MFA email send failed (unexpected): to={} from={} error={}", toEmail, resendFrom, ex.toString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Failed to send MFA email");
        }
    }

    private static String truncate(String value, int maxChars) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxChars) {
            return value;
        }
        return value.substring(0, maxChars) + "…";
    }
}
