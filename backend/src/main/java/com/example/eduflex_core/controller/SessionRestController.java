package com.example.eduflex_core.controller;

import com.example.eduflex_core.model.Session;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * REST controller for creating sessions. For local development the MongoDB
 * connection may not be available (for example when running without internet
 * or Atlas access). Make the MongoTemplate optional and fall back to an
 * in-memory store so the app can run locally.
 */
@RestController
@CrossOrigin(origins = "*")
public class SessionRestController {

    private final MongoTemplate mongoTemplate;
    // simple in-memory fallback for local dev if Mongo is not configured
    private final Map<String, Session> inMemory = new ConcurrentHashMap<>();

    public SessionRestController(@Autowired(required = false) MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @PostMapping("/api/sessions")
    public Session createSession() {
        Session newSession = new Session();
        String roomCode = String.format("%c%c%d%c%d%d",
                'A' + (int) (Math.random() * 26),
                'A' + (int) (Math.random() * 26),
                (int) (Math.random() * 10),
                'A' + (int) (Math.random() * 26),
                (int) (Math.random() * 10),
                (int) (Math.random() * 10));

        newSession.setRoomCode(roomCode);
        newSession.setSessionLive(false);
        newSession.setCurrentActivity(null);

        if (mongoTemplate != null) {
            return mongoTemplate.save(newSession);
        }

        // fallback: store in memory and return
        inMemory.put(newSession.getRoomCode(), newSession);
        return newSession;
    }
}