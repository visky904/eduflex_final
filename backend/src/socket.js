import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

const SOCKET_URL = 'http://localhost:8080/ws';
let stompClient;

// Function to connect to the WebSocket server
export const connect = (roomCode, onMessageReceived) => {
    const socket = new SockJS(SOCKET_URL);
    stompClient = Stomp.over(socket);

    stompClient.connect({}, () => {
        // Subscribe to the topic for this specific room
        stompClient.subscribe(`/topic/session/${roomCode}`, (payload) => {
            // This function will be called every time a message is received
            onMessageReceived(JSON.parse(payload.body));
        });
    });
};

// Function for the teacher to start/update an activity
export const sendActivity = (roomCode, activity) => {
    if (stompClient) {
        stompClient.send(`/app/session.start/${roomCode}`, {}, JSON.stringify(activity));
    }
};

// Function for the teacher to stop an activity
export const stopActivity = (roomCode) => {
    if (stompClient) {
        stompClient.send(`/app/session.stop/${roomCode}`, {}, {});
    }
};
