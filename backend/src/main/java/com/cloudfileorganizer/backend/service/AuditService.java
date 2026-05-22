package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.model.AuditLog;
import com.cloudfileorganizer.backend.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class AuditService {

    private static final Logger logger = LoggerFactory.getLogger(AuditService.class);

    @Autowired
    private AuditLogRepository auditLogRepository;

    /**
     * Log an audit event asynchronously (fire-and-forget).
     */
    @Async("taskExecutor")
    public void log(String action, Long performedBy, String performedByEmail,
                    String targetId, String targetType, String details, String ipAddress) {
        try {
            AuditLog entry = new AuditLog(action, performedBy, performedByEmail,
                    targetId, targetType, details, ipAddress);
            auditLogRepository.save(entry);
        } catch (Exception e) {
            logger.error("Failed to persist audit log: action={}, error={}", action, e.getMessage());
        }
    }

    /**
     * Convenience overload without IP address.
     */
    public void log(String action, Long performedBy, String performedByEmail,
                    String targetId, String targetType, String details) {
        log(action, performedBy, performedByEmail, targetId, targetType, details, null);
    }

    /**
     * Get recent audit log entries (last 100).
     */
    public List<Map<String, Object>> getRecentLogs() {
        List<AuditLog> logs = auditLogRepository.findTop100ByOrderByTimestampDesc();
        return toMapList(logs);
    }

    /**
     * Generate a structured audit report for a date range.
     */
    public Map<String, Object> generateReport(LocalDateTime from, LocalDateTime to) {
        if (from == null) {
            from = LocalDateTime.now().minusDays(30);
        }
        if (to == null) {
            to = LocalDateTime.now();
        }

        List<AuditLog> logs = auditLogRepository.findByTimestampBetweenOrderByTimestampDesc(from, to);
        List<Object[]> actionCounts = auditLogRepository.countByActionBetween(from, to);
        long totalEvents = auditLogRepository.countByTimestampBetween(from, to);

        // Build action breakdown
        List<Map<String, Object>> breakdown = new ArrayList<>();
        for (Object[] row : actionCounts) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("action", row[0]);
            item.put("count", row[1]);
            breakdown.add(item);
        }

        // Unique users
        Set<Long> uniqueUsers = new HashSet<>();
        for (AuditLog log : logs) {
            if (log.getPerformedBy() != null) {
                uniqueUsers.add(log.getPerformedBy());
            }
        }

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("generatedAt", LocalDateTime.now().format(fmt));
        report.put("periodFrom", from.format(fmt));
        report.put("periodTo", to.format(fmt));
        report.put("totalEvents", totalEvents);
        report.put("uniqueUsers", uniqueUsers.size());
        report.put("actionBreakdown", breakdown);
        report.put("entries", toMapList(logs));

        return report;
    }

    private List<Map<String, Object>> toMapList(List<AuditLog> logs) {
        List<Map<String, Object>> list = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        for (AuditLog log : logs) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", log.getId());
            item.put("action", log.getAction());
            item.put("performedBy", log.getPerformedBy());
            item.put("performedByEmail", log.getPerformedByEmail());
            item.put("targetId", log.getTargetId());
            item.put("targetType", log.getTargetType());
            item.put("details", log.getDetails());
            item.put("ipAddress", log.getIpAddress());
            item.put("timestamp", log.getTimestamp() != null ? log.getTimestamp().format(fmt) : null);
            list.add(item);
        }
        return list;
    }
}
