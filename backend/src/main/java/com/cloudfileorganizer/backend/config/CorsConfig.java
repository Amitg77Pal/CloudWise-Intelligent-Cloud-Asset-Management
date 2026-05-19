package com.cloudfileorganizer.backend.config;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.net.URI;
import java.net.URISyntaxException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Value("${frontend.urls:}")
    private String frontendUrls;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> configuredOrigins = Arrays.stream((frontendUrls == null ? "" : frontendUrls).split(","))
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .collect(Collectors.toList());

        // Use origin patterns so one FRONTEND_URL can cover subdomains (e.g., https://scfo.app + https://auth.scfo.app).
        // Exact origins are also added as patterns.
        config.setAllowedOriginPatterns(buildAllowedOriginPatterns(configuredOrigins));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        config.setExposedHeaders(Arrays.asList("Content-Disposition", "Content-Type", "Content-Length"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    private List<String> buildAllowedOriginPatterns(List<String> configuredOrigins) {
        Set<String> patterns = new LinkedHashSet<>();

        for (String rawOrigin : configuredOrigins) {
            if (rawOrigin == null) {
                continue;
            }

            String origin = rawOrigin.trim();
            if (origin.isEmpty()) {
                continue;
            }

            // If the user provides a wildcard, treat it as a pattern verbatim.
            if (origin.contains("*")) {
                patterns.add(origin);
                continue;
            }

            NormalizedOrigin normalized = normalizeOrigin(origin);
            if (normalized == null) {
                // Fall back to raw value if it can't be parsed.
                patterns.add(origin);
                continue;
            }

            patterns.add(normalized.origin);

            if (shouldAddSubdomainWildcard(normalized.host)) {
                patterns.add(normalized.scheme + "://*." + normalized.host);
            }
        }

        // Safe default for local dev if nothing is configured.
        if (patterns.isEmpty()) {
            patterns.add("http://localhost:5173");
            patterns.add("http://127.0.0.1:5173");
        }

        return patterns.stream().toList();
    }

    private static boolean shouldAddSubdomainWildcard(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        if ("localhost".equalsIgnoreCase(host)) {
            return false;
        }
        if (host.matches("\\d{1,3}(\\.\\d{1,3}){3}")) {
            return false;
        }
        // Simple IPv6 heuristic.
        if (host.contains(":")) {
            return false;
        }
        return true;
    }

    private static NormalizedOrigin normalizeOrigin(String origin) {
        try {
            URI uri = new URI(origin);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();

            if (scheme == null || host == null) {
                return null;
            }

            // Drop default ports so values like https://example.com:443 still match browser Origin.
            if (("https".equalsIgnoreCase(scheme) && port == 443) || ("http".equalsIgnoreCase(scheme) && port == 80)) {
                port = -1;
            }

            String normalized = port == -1
                    ? scheme + "://" + host
                    : scheme + "://" + host + ":" + port;

            return new NormalizedOrigin(scheme, host, normalized);
        } catch (URISyntaxException ex) {
            return null;
        }
    }

    private record NormalizedOrigin(String scheme, String host, String origin) {}
}