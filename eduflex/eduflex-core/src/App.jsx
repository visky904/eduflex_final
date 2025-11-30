import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
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

// Wrapper component for joining with room code
const JoinSession = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    
    return <StudentView setView={(view) => {
        if (view === 'home') navigate('/');
    }} initialJoinCode={roomCode?.toUpperCase()} />;
};

// Main App component
function AppContent() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('teacherRoomCode') || null);

    useEffect(() => { 
        if (roomCode) localStorage.setItem('teacherRoomCode', roomCode); 
    }, [roomCode]);

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
                navigate('/teacher');
            } catch (error) {
                console.error("Error creating session:", error);
                alert("Could not create a new session.");
            }
        } else if (newView === 'home') {
            localStorage.removeItem('currentView');
            localStorage.removeItem('teacherRoomCode');
            setRoomCode(null);
            navigate('/');
        } else if (newView === 'student') {
            navigate('/student');
        }
    };

    return (
        <Routes>
            <Route path="/" element={<HomePage setView={handleSetView} />} />
            <Route path="/teacher" element={<TeacherView setView={handleSetView} roomCode={roomCode} />} />
            <Route path="/student" element={<StudentView setView={handleSetView} initialJoinCode={null} />} />
            <Route path="/join/:roomCode" element={<JoinSession />} />
        </Routes>
    );
}

export default function App() {
    return <AppContent />;
}
