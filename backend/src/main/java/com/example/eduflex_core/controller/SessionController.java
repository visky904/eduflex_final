package com.example.eduflex_core.controller;

import com.example.eduflex_core.model.Session;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
public class SessionController {

    /**
     * This method is called when a teacher starts an activity.
     * @param roomCode 
     * @param activity 
     * @return 
     */
    @MessageMapping("/session.start/{roomCode}")
    @SendTo("/topic/session/{roomCode}")
    public Map<String, Object> startActivity(@DestinationVariable String roomCode, @Payload Map<String, Object> activity) {
        // In a full application, you would update the session state in your MongoDB database here.
        // For example: sessionRepository.updateActivity(roomCode, activity);
        
       
        activity.put("isSessionLive", true);
        
        return activity;
    }

    /**
     * This method is called when a teacher stops an activity.
     * The teacher's client sends a message to "/app/session.stop/{roomCode}".
     * @param roomCode The session room code.
     * @return An object indicating the session is no longer live.
     */
    @MessageMapping("/session.stop/{roomCode}")
    @SendTo("/topic/session/{roomCode}")
    public Map<String, Object> stopActivity(@DestinationVariable String roomCode) {
        // Update the session in MongoDB to reflect that it is no longer live.
        // For example: sessionRepository.deactivateSession(roomCode);

        
        return Map.of("isSessionLive", false, "currentActivity", (Object) null);
    }
}
