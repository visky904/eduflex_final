package com.example.eduflex_core.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Map;

@Data
@Document(collection = "sessions")
public class Session {

    @Id
    private String id;

    private String roomCode;

    private boolean isSessionLive;

    /**
     * use a flexible Map to store the current activity.
     * allows us to handle different activity types ;MCQ, WordCloud, etc.
     * frontend will know how to interpret this map based on the 'type' field within it.
     */
    private Map<String, Object> currentActivity;
}

