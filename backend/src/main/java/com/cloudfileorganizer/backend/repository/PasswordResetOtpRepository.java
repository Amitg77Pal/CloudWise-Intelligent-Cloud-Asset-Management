package com.cloudfileorganizer.backend.repository;

import com.cloudfileorganizer.backend.model.PasswordResetOtp;
import com.cloudfileorganizer.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {

    long countByUserAndCreatedAtAfter(User user, LocalDateTime createdAfter);

    Optional<PasswordResetOtp> findTopByUserAndUsedAtIsNullAndInvalidatedAtIsNullOrderByCreatedAtDesc(User user);

    List<PasswordResetOtp> findByUserAndUsedAtIsNullAndInvalidatedAtIsNull(User user);
}
