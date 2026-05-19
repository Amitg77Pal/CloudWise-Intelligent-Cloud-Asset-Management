package com.cloudfileorganizer.backend.repository;

import com.cloudfileorganizer.backend.model.PasswordResetSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetSessionRepository extends JpaRepository<PasswordResetSession, String> {
}
