import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateRoomCode } from './utils/helpers';
import TeacherView from './components/TeacherView';
import StudentView from './components/StudentView';
import './App.css';

const HomePage = ({ setView }) => (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center animate-fade-in">
        <div className="text-center p-10 bg-black/40 backdrop-blur-md rounded-2xl shadow-2xl border border-red-900/30 max-w-2xl">
            <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-red-500 mb-4 drop-shadow-sm">
                EduFlex <span className="text-3xl text-white block mt-2 font-light">Interactive Classroom</span>
            </h1>
            <p className="text-xl text-gray-300 mb-12 font-light">Engage, Interact, and Compete in Real-Time</p>
            
            <div className="space-y-4 sm:space-y-0 sm:space-x-6 flex flex-col sm:flex-row justify-center">
                <button onClick={() => setView('teacher')} className="bg-red-600 text-white font-bold py-4 px-8 rounded-lg text-lg hover:bg-red-700 transition shadow-[0_0_20px_rgba(220,38,38,0.5)] transform hover:-translate-y-1">
                     Create Session
                </button>
                <button onClick={() => setView('student')} className="bg-transparent text-white font-bold py-4 px-8 rounded-lg text-lg hover:bg-white/10 transition shadow-lg border-2 border-red-600 transform hover:-translate-y-1">
                     Join Session
                </button>
            </div>
        </div>
    </div>
);

export default function App() {
    const [view, setView] = useState(() => localStorage.getItem('currentView') === 'teacher' ? 'teacher' : 'home');
    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('teacherRoomCode') || null);
    const [initialJoinCode, setInitialJoinCode] = useState(null);

    useEffect(() => { if (view) localStorage.setItem('currentView', view); }, [view]);
    useEffect(() => { if (roomCode) localStorage.setItem('teacherRoomCode', roomCode); }, [roomCode]);

    useEffect(() => {
        const pathname = window.location.pathname;
        const joinMatch = pathname.match(/\/join\/([A-Z0-9]+)/i);
        if (joinMatch) {
            setInitialJoinCode(joinMatch[1].toUpperCase());
            setView('student');
        } else if (pathname === '/' || pathname === '/index.html') {
            localStorage.removeItem('currentView');
            setView('home');
        }
    }, []);

    const handleSetView = async (newView) => {
        if (newView === 'teacher') {
            const newRoomCode = generateRoomCode();
            try {
                await setDoc(doc(db, 'sessions', newRoomCode), {
                    roomCode: newRoomCode,
                    isSessionLive: false,
                    currentActivity: null,
                });
                setRoomCode(newRoomCode);
                setView('teacher');
            } catch (error) {
                console.error("Error creating session:", error);
                alert("Could not create a new session.");
            }
        } else if (newView === 'home') {
            localStorage.removeItem('currentView');
            localStorage.removeItem('teacherRoomCode');
            setView(newView);
            setRoomCode(null);
        } else {
            setView(newView);
        }
    };

    switch (view) {
        case 'teacher': return <TeacherView setView={handleSetView} roomCode={roomCode} />;
        case 'student': return <StudentView setView={handleSetView} initialJoinCode={initialJoinCode} />;
        default: return <HomePage setView={handleSetView} />;
    }
}
