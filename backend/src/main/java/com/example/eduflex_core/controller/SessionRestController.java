package com.example.eduflex_core.controller;

import com.example.eduflex_core.model.Session;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@CrossOrigin(origins = "*") 
public class SessionRestController {

    private final MongoTemplate mongoTemplate;

    public SessionRestController(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @PostMapping("/api/sessions")
    public Session createSession() {
        Session newSession = new Session();
        String roomCode = String.format("%c%c%d%c%d%d",
                'A' + (int)(Math.random() * 26),
                'A' + (int)(Math.random() * 26),
                (int)(Math.random() * 10),
                'A' + (int)(Math.random() * 26),
                (int)(Math.random() * 10),
                (int)(Math.random() * 10));

        newSession.setRoomCode(roomCode);
        newSession.setSessionLive(false);
        newSession.setCurrentActivity(null);

        return mongoTemplate.save(newSession);
    }
}