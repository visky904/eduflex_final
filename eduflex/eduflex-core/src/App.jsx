import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import { generateRoomCode } from './utils/helpers';
import TeacherView from './components/TeacherView';
import StudentView from './components/StudentView';
import './App.css';

const HomePage = ({ setView, onTeacherLogin, recentSessions, onClearHistory, onRequestCreate }) => {
    const [showLogin, setShowLogin] = useState(false);
    const [loginCode, setLoginCode] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [error, setError] = useState('');

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        onTeacherLogin(loginCode, loginPass, setError);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center animate-fade-in p-4">
            {!showLogin ? (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* LEFT COLUMN: Main Actions */}
                    <div className="text-center p-10 bg-black/40 backdrop-blur-md rounded-2xl shadow-2xl border border-red-900/30 flex flex-col justify-center">
                        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-red-500 mb-4 drop-shadow-sm">
                            EduFlex <span className="text-2xl text-white block mt-2 font-light">Interactive Classroom</span>
                        </h1>
                        <p className="text-lg text-gray-300 mb-10 font-light">Engage, Interact, and Compete in Real-Time</p>
                        
                        <div className="space-y-4">
                            <button onClick={onRequestCreate} className="w-full bg-red-600 text-white font-bold py-4 rounded-lg text-lg hover:bg-red-700 transition shadow-[0_0_20px_rgba(220,38,38,0.5)] transform hover:-translate-y-1">
                                Create New Session
                            </button>
                            <button onClick={() => setView('student')} className="w-full bg-transparent text-white font-bold py-4 rounded-lg text-lg hover:bg-white/10 transition shadow-lg border-2 border-red-600 transform hover:-translate-y-1">
                                Join as Student
                            </button>
                            <button onClick={() => setShowLogin(true)} className="mt-4 text-gray-400 hover:text-white underline text-sm block w-full">
                                Login manually (Different Device)
                            </button>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Recent Sessions */}
                    <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-700 p-6 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">🕒 Recent Sessions</h2>
                            {recentSessions.length > 0 && (<button onClick={onClearHistory} className="text-xs text-red-400 hover:text-red-300 underline">Clear History</button>)}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                            {recentSessions.length === 0 ? (
                                <div className="text-center text-gray-500 py-12 border-2 border-dashed border-gray-700 rounded-xl">
                                    <p>No active sessions found on this device.</p>
                                    <p className="text-sm mt-2">Create a room to see it here.</p>
                                </div>
                            ) : (
                                recentSessions.map((session, idx) => (
                                    <div key={idx} className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-teal-500 transition group relative">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-2xl font-bold text-teal-400 tracking-wider">{session.roomCode}</span>
                                                <p className="text-gray-400 text-xs mt-1">{new Date(session.createdAt).toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => onTeacherLogin(session.roomCode, session.password, setError)} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-500 shadow-lg">Rejoin 🚀</button>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Auto-saved</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-8 bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-gray-900">
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">Teacher Login</h2>
                    <p className="text-gray-500 mb-6 text-sm">Enter the Room Code and your Password.</p>
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Room Code</label>
                            <input type="text" className="w-full p-3 border rounded-lg bg-gray-50 font-mono tracking-widest uppercase" placeholder="AAAA00" value={loginCode} onChange={e => setLoginCode(e.target.value.toUpperCase())} required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Teacher Password</label>
                            <input type="password" className="w-full p-3 border rounded-lg bg-gray-50 font-mono" placeholder="Your Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                        </div>
                        {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={() => {setShowLogin(false); setError('');}} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold">Cancel</button>
                            <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700">Login</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default function App() {
    // 1. Check URL Params
    const [initialJoinCode, setInitialJoinCode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('room');
    });

    const [magicKey, setMagicKey] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('key');
    });

    // 2. View State: Defaults to 'home' unless URL params exist. NO localStorage auto-login for view.
    const [view, setView] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('room')) return 'loading'; 
        return 'home'; // <--- FIXED: Always start at Home
    });

    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('teacherRoomCode') || null);
    const [recentSessions, setRecentSessions] = useState(() => JSON.parse(localStorage.getItem('eduFlex_recentSessions') || '[]'));
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSessionPassword, setNewSessionPassword] = useState('');

    useEffect(() => { if (roomCode) localStorage.setItem('teacherRoomCode', roomCode); }, [roomCode]);

    // Handle Magic Link / URL Routing
    useEffect(() => {
        const checkMagicLink = async () => {
            if (initialJoinCode && magicKey) {
                await handleTeacherLogin(initialJoinCode, magicKey, (errMsg) => {
                    console.error("Magic Link Failed:", errMsg);
                    setView('student'); 
                });
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (initialJoinCode) {
                setView('student');
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (view === 'loading') {
                setView('home');
            }
        };
        checkMagicLink();
    }, []);

    const handleCreateSession = async (e) => {
        e.preventDefault();
        if (!newSessionPassword.trim()) return alert("Please set a password.");

        const newRoomCode = generateRoomCode();
        try {
            await setDoc(doc(db, 'sessions', newRoomCode), {
                roomCode: newRoomCode,
                password: newSessionPassword,
                isSessionLive: false,
                currentActivity: null,
                createdAt: new Date().toISOString()
            });

            const newSession = { roomCode: newRoomCode, password: newSessionPassword, createdAt: new Date().toISOString() };
            const updatedSessions = [newSession, ...recentSessions];
            setRecentSessions(updatedSessions);
            localStorage.setItem('eduFlex_recentSessions', JSON.stringify(updatedSessions));

            setRoomCode(newRoomCode);
            setView('teacher');
            setShowCreateModal(false);
        } catch (error) {
            console.error("Error creating session:", error);
            alert("Could not create a new session.");
        }
    };

    const handleTeacherLogin = async (code, password, setErrorCallback) => {
        if (!code || !password) return setErrorCallback("Please enter both fields.");
        try {
            const sessionRef = doc(db, 'sessions', code);
            const docSnap = await getDoc(sessionRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.password === password) {
                    setRoomCode(code);
                    setView('teacher');
                    
                    const exists = recentSessions.some(s => s.roomCode === code);
                    if (!exists) {
                        const newSession = { roomCode: code, password: password, createdAt: new Date().toISOString() };
                        const updatedSessions = [newSession, ...recentSessions];
                        setRecentSessions(updatedSessions);
                        localStorage.setItem('eduFlex_recentSessions', JSON.stringify(updatedSessions));
                    }
                } else {
                    setErrorCallback("Invalid Password.");
                }
            } else {
                setErrorCallback("Room not found.");
            }
        } catch (err) {
            console.error(err);
            setErrorCallback("Connection error.");
        }
    };

    const clearHistory = () => {
        if(window.confirm('Clear your local session history?')) {
            setRecentSessions([]);
            localStorage.removeItem('eduFlex_recentSessions');
        }
    };

    // Pass handleSetView to TeacherView so it can "logout"
    const handleSetView = (newView) => {
        if (newView === 'home') {
            setRoomCode(null);
        }
        setView(newView);
    };

    if (view === 'loading') return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

    return (
        <>
            {view === 'teacher' ? (
                <TeacherView setView={handleSetView} roomCode={roomCode} />
            ) : view === 'student' ? (
                <StudentView setView={setView} initialJoinCode={initialJoinCode} />
            ) : (
                <HomePage setView={setView} onTeacherLogin={handleTeacherLogin} recentSessions={recentSessions} onClearHistory={clearHistory} onRequestCreate={() => setShowCreateModal(true)} />
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Session</h2>
                        <p className="text-gray-500 mb-6">Set a password to secure your teacher controls.</p>
                        <form onSubmit={handleCreateSession}>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Set Teacher Password</label>
                            <input type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg mb-6 focus:border-red-500 focus:outline-none text-lg" placeholder="e.g. Physics2025" value={newSessionPassword} onChange={e => setNewSessionPassword(e.target.value)} autoFocus />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold">Cancel</button>
                                <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700">Create Room 🚀</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}