import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateRoomCode } from './utils/helpers';
import TeacherView from './components/TeacherView';
import StudentView from './components/StudentView';
import './App.css';

const HomePage = ({ setView }) => (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-white flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl">
            <h1 className="text-5xl font-extrabold text-teal-700 mb-4">Interactive Classroom </h1>
            <p className="text-lg text-gray-600 mb-12">Engage, Interact, and Learn in Real-Time</p>
            <div className="space-y-4 sm:space-y-0 sm:space-x-6 flex flex-col sm:flex-row justify-center">
                <button onClick={() => setView('teacher')} className="bg-teal-600 text-white font-bold py-4 px-8 rounded-lg text-lg hover:bg-teal-700 transition shadow-lg transform hover:-translate-y-1 hover:shadow-xl">
                     Create Session
                </button>
                <button onClick={() => setView('student')} className="bg-white text-teal-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-teal-50 transition shadow-lg border-2 border-teal-600 transform hover:-translate-y-1 hover:shadow-xl">
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
