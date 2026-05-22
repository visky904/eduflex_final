package com.example.eduflex_core.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // messages sent to destinations prefixed with "/topic" will be routed to the broker.
        // the broker then broadcasts these messages to all connected clients subscribed to that topic.
        config.enableSimpleBroker("/topic");
        // designates the "/app" prefix for messages that are bound for @MessageMapping-annotated methods in the controller.
        config.setApplicationDestinationPrefixes("/app");
    }

   @Override
public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws")
            .setAllowedOrigins("http://localhost:3000") 
            .withSockJS();
}
}
