import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const SOCKET_URL = 'http://localhost:8081/ws'; 
let stompClient;

// Function to connect to the WebSocket server
export const connect = (roomCode, onMessageReceived) => {
    const stompConfig = {
        webSocketFactory: () => new SockJS(SOCKET_URL),
        reconnectDelay: 5000,
        onConnect: () => {
            console.log('Connected to WebSocket!');
            stompClient.subscribe(`/topic/session/${roomCode}`, (payload) => {
                onMessageReceived(JSON.parse(payload.body));
            });
        },
        onStompError: (frame) => {
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        },
    };
    
    stompClient = new Client(stompConfig);
    stompClient.activate();
};

export const sendActivity = (roomCode, activity) => {
    if (stompClient && stompClient.connected) {
        stompClient.publish({
            destination: `/app/session.start/${roomCode}`,
            body: JSON.stringify(activity)
        });
    } else {
        console.error('Cannot send message, stomp client is not connected.');
    }
};

export const stopActivity = (roomCode) => {
    if (stompClient && stompClient.connected) {
        stompClient.publish({
            destination: `/app/session.stop/${roomCode}`,
            body: JSON.stringify({})
        });
    } else {
        console.error('Cannot send message, stomp client is not connected.');
    }
};
