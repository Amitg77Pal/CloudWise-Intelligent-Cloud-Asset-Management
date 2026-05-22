package com.cloudfileorganizer.backend.repository;

import com.cloudfileorganizer.backend.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime from, LocalDateTime to);

    List<AuditLog> findTop100ByOrderByTimestampDesc();

    @Query("SELECT a.action, COUNT(a) FROM AuditLog a WHERE a.timestamp BETWEEN :from AND :to GROUP BY a.action ORDER BY COUNT(a) DESC")
    List<Object[]> countByActionBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    long countByTimestampBetween(LocalDateTime from, LocalDateTime to);
}
