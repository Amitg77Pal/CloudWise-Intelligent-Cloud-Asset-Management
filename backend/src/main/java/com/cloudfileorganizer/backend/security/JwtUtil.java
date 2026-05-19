package com.cloudfileorganizer.backend.security;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import java.security.Key;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private static final String DEFAULT_SECRET = "cloud-file-secret-cloud-file-secret-cloud-file-secret-cloud-file-secret-cloud-file-secret";
    private static final long EXPIRATION_TIME = 86400000; // 24 hours

    @Value("${app.jwt.secret:${JWT_SECRET:}}")
    private String configuredSecret;

    private Key key;

    @PostConstruct
    public void init() {
        String secret = (configuredSecret == null || configuredSecret.isBlank()) ? DEFAULT_SECRET : configuredSecret;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String email) {
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractEmail(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.getSubject();
    }

    public boolean validateToken(String token, String email) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            return claims.getSubject().equals(email) && !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
