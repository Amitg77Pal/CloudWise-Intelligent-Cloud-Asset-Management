package com.cloudfileorganizer.backend.service;

import com.cloudfileorganizer.backend.model.AiChatHistory;
import com.cloudfileorganizer.backend.model.FileMetadata;
import com.cloudfileorganizer.backend.model.User;
import com.cloudfileorganizer.backend.repository.AiChatHistoryRepository;
import com.cloudfileorganizer.backend.repository.FileRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.cloudfileorganizer.backend.model.AiAnalysisStatus;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiService {

    private static final Logger logger = LoggerFactory.getLogger(AiService.class);

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.url}")
    private String geminiUrl;

    @Autowired
    private FileRepository fileRepository;

    @Autowired
    private AiChatHistoryRepository aiChatHistoryRepository;

    @Autowired
    private S3Service s3Service;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @jakarta.annotation.PostConstruct
    public void init() {
        if (apiKey == null || apiKey.trim().isEmpty() || apiKey.contains("${")) {
            logger.error("GEMINI_API_KEY is NOT correctly loaded from environment variables! Current value: {}", apiKey);
        } else {
            logger.info("GEMINI_API_KEY loaded successfully (Length: {})", apiKey.length());
        }
    }

    /**
     * Analyze file asynchronously (categorize and summarize)
     */
    @Async("taskExecutor")
    public void analyzeFile(String fileId, User user) {
        FileMetadata file = null;
        for (int i = 0; i < 5; i++) {
            file = fileRepository.findByIdAndUser(fileId, user).orElse(null);
            if (file != null) {
                break;
            }
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        if (file == null) {
            logger.warn("AI analysis failed: File with ID {} for user {} not found in database after retries.", fileId, user.getEmail());
            return;
        }

        try {
            file.setAiAnalysisStatus(AiAnalysisStatus.IN_PROGRESS);
            fileRepository.save(file);

            logger.info("Analyzing file: {}", file.getName());

            String prompt = String.format(
                "Analyze the following file metadata and provide a JSON response with 'category', 'summary', 'tags' (list), and 'confidence' (0.0 to 1.0).\n" +
                "File Name: %s\n" +
                "Mime Type: %s\n" +
                "Size: %d bytes\n" +
                "Prompt: Choose the most appropriate category for this file (e.g. Academic, Finance, Resume, Legal, Medical, Images, Videos, Music, Code, Presentation, Spreadsheet, Design, Personal, Work, or any other fitting category). " +
                "Be specific and accurate — pick a category that best describes the file's actual purpose. Provide a 2-sentence summary of what this file likely contains.",
                file.getName(), file.getMimeType(), file.getSize()
            );

            String responseBody = callGemini(prompt);
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidate = root.path("candidates").get(0).path("content").path("parts").get(0);
            String text = candidate.path("text").asText();

            // Clean JSON if Gemini wraps it in markdown code blocks
            if (text.contains("```json")) {
                text = text.substring(text.indexOf("```json") + 7, text.lastIndexOf("```")).trim();
            } else if (text.contains("```")) {
                text = text.substring(text.indexOf("```") + 3, text.lastIndexOf("```")).trim();
            }

            JsonNode aiResult = objectMapper.readTree(text);
            
            String category = aiResult.path("category").asText("Others");
            String summary = aiResult.path("summary").asText("No summary available.");
            String tags = aiResult.path("tags").toString();
            double confidence = aiResult.path("confidence").asDouble(0.0);

            file.setAiCategory(category);
            file.setAiSummary(summary);
            file.setAiTags(tags);
            file.setAiConfidence(confidence);
            file.setAiAnalysisStatus(AiAnalysisStatus.COMPLETED);
            file.setAiAnalysisCompletedAt(LocalDateTime.now());

            fileRepository.save(file);
            logger.info("File analysis complete and saved for: {}. Category: {}", file.getName(), category);

        } catch (Exception e) {
            logger.error("CRITICAL: Failed to analyze file {}. Error: {}. Stacktrace follows.", fileId, e.getMessage());
            e.printStackTrace();
            file.setAiAnalysisStatus(AiAnalysisStatus.FAILED);
            file.setAiAnalysisError(e.getMessage());
            fileRepository.save(file);
        }
    }

    /**
     * Chat with Agent
     */
    public String chatWithAgent(String query, User user) {
        try {
            // Fetch user's files for context
            List<FileMetadata> userFiles = fileRepository.findByUser(user);
            
            // Build file context summary
            StringBuilder fileContext = new StringBuilder();
            if (!userFiles.isEmpty()) {
                fileContext.append("\n\nThe user currently has ").append(userFiles.size()).append(" files:\n");
                for (FileMetadata f : userFiles) {
                    String sizeStr = f.getSize() > 1024 * 1024 
                        ? String.format("%.1f MB", f.getSize() / (1024.0 * 1024.0)) 
                        : String.format("%.1f KB", f.getSize() / 1024.0);
                    fileContext.append(String.format("- %s (%s, %s, Category: %s%s)\n",
                        f.getOriginalName() != null ? f.getOriginalName() : f.getName(),
                        f.getMimeType(),
                        sizeStr,
                        f.getAiCategory() != null ? f.getAiCategory() : (f.getCategory() != null ? f.getCategory() : "Uncategorized"),
                        f.getAiSummary() != null ? ", Summary: " + f.getAiSummary() : ""
                    ));
                }
            } else {
                fileContext.append("\n\nThe user has no files uploaded yet.");
            }

            // Fetch history
            List<AiChatHistory> history = aiChatHistoryRepository.findByUserOrderByTimestampAsc(user);
            
            // Limit history to last 10 messages
            int start = Math.max(0, history.size() - 10);
            List<AiChatHistory> recentHistory = history.subList(start, history.size());

            // Build payload
            Map<String, Object> payload = new HashMap<>();
            List<Map<String, Object>> contents = new ArrayList<>();

            // Enhanced system instruction with file context
            String systemInstruction = "You are CloudWise AI Assistant — a helpful, friendly file management assistant. " +
                "You help users understand, search, and organize their cloud files. " +
                "You have access to the user's file inventory and can answer questions about their files, suggest organization strategies, summarize files, and help them find what they need. " +
                "Be concise, helpful, and proactive in suggesting useful actions. " +
                "If the user asks about files, reference their actual files by name. " +
                "Respond in a warm, human tone — not robotic." +
                fileContext.toString();

            for (AiChatHistory h : recentHistory) {
                Map<String, Object> part = new HashMap<>();
                part.put("text", h.getContent());
                
                Map<String, Object> content = new HashMap<>();
                content.put("role", h.getRole());
                content.put("parts", Collections.singletonList(part));
                contents.add(content);
            }

            // Current query
            Map<String, Object> queryPart = new HashMap<>();
            queryPart.put("text", systemInstruction + "\n\nUser Question: " + query);
            Map<String, Object> queryContent = new HashMap<>();
            queryContent.put("role", "user");
            queryContent.put("parts", Collections.singletonList(queryPart));
            contents.add(queryContent);

            payload.put("contents", contents);

            // Call API
            String responseBody = callGemini(payload);
            JsonNode root = objectMapper.readTree(responseBody);
            String aiResponse = root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();

            // Save history
            saveHistory(user, "user", query);
            saveHistory(user, "model", aiResponse);

            return aiResponse;

        } catch (Exception e) {
            logger.error("Chat error: {}", e.getMessage());
            return "I'm sorry, I'm having trouble processing your request right now.";
        }
    }

    private String callGemini(String prompt) throws Exception {
        Map<String, Object> part = new HashMap<>();
        part.put("text", prompt);
        
        Map<String, Object> content = new HashMap<>();
        content.put("parts", Collections.singletonList(part));
        
        Map<String, Object> payload = new HashMap<>();
        payload.put("contents", Collections.singletonList(content));
        
        return callGemini(payload);
    }

    private String callGemini(Map<String, Object> payload) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        
        String urlWithKey = geminiUrl + "?key=" + apiKey;
        
        try {
            logger.info("Attempting Gemini API call. URL: {}", urlWithKey.split("\\?")[0]); // Don't log key
            ResponseEntity<String> response = restTemplate.postForEntity(urlWithKey, entity, String.class);
            logger.info("Gemini API call successful. Status: {}", response.getStatusCode());
            return response.getBody();
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("Gemini API Client Error (4xx): {}. Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Gemini API Client Error: " + e.getStatusCode() + ". Check API Key or Request format.", e);
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            logger.error("Gemini API Server Error (5xx): {}. Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Gemini API Server Error: " + e.getStatusCode() + ". API might be overloaded or down.", e);
        } catch (Exception e) {
            logger.error("Unexpected error during Gemini API call: {}. Cause: {}", e.getMessage(), e.getCause());
            throw new RuntimeException("Unexpected Gemini API call error: " + e.getMessage(), e);
        }
    }

    private void saveHistory(User user, String role, String content) {
        AiChatHistory h = new AiChatHistory();
        h.setUser(user);
        h.setRole(role);
        h.setContent(content);
        aiChatHistoryRepository.save(h);
    }
}
