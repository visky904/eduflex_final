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
        <div className="min-h-screen bg-animated text-white flex items-center justify-center p-4 sm:p-8">
            {/* Main Container - Glass Card */}
            <div className="w-full max-w-6xl h-[85vh] glass-card rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl animate-fade-in">
                
                {/* LEFT SIDE: Hero / Branding */}
                <div className="md:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative overflow-hidden bg-black/20">
                    <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                        <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float"></div>
                        <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-float" style={{animationDelay: '2s'}}></div>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="mb-6 inline-block px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-xs font-bold tracking-widest uppercase text-blue-300">
                            Live Classroom
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black mb-6 leading-tight">
                            Edu<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Flex</span>
                        </h1>
                        <p className="text-xl text-gray-300 font-light mb-8 max-w-md leading-relaxed">
                            The interactive classroom platform that lets you <span className="text-white font-medium">improvise</span>, <span className="text-white font-medium">engage</span>, and <span className="text-white font-medium">gamify</span> learning in real-time.
                        </p>
                        
                        <div className="flex gap-4 text-sm text-gray-400 font-mono">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Zero Latency</div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> No Signup</div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-purple-400 rounded-full"></span> Secure</div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: Action Deck */}
                <div className="md:w-1/2 bg-white/5 p-8 sm:p-12 flex flex-col justify-center border-l border-white/10 backdrop-blur-md">
                    {!showLogin ? (
                        <div className="space-y-6 w-full max-w-sm mx-auto">
                            <h2 className="text-3xl font-bold mb-8">Get Started</h2>
                            
                            <button onClick={onRequestCreate} className="group w-full btn-primary p-1 rounded-xl">
                                <div className="bg-transparent text-white py-4 px-6 rounded-xl flex items-center justify-between font-bold text-lg group-hover:bg-white/10 transition">
                                    <span>➕ Create Session</span>
                                    <span className="text-2xl group-hover:translate-x-2 transition">→</span>
                                </div>
                            </button>

                            <button onClick={() => setView('student')} className="group w-full p-1 rounded-xl border border-white/20 hover:bg-white/5 transition">
                                <div className="py-4 px-6 rounded-xl flex items-center justify-between font-bold text-lg text-gray-200">
                                    <span>🎓 Join as Student</span>
                                    <span className="text-2xl group-hover:translate-x-2 transition">→</span>
                                </div>
                            </button>
                            
                            <div className="pt-8 border-t border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Sessions</span>
                                    {recentSessions.length > 0 && <button onClick={onClearHistory} className="text-xs text-red-400 hover:underline">Clear</button>}
                                </div>
                                <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                    {recentSessions.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No history found.</p>
                                    ) : (
                                        recentSessions.map((s, i) => (
                                            <button key={i} onClick={() => onTeacherLogin(s.roomCode, s.password, setError)} className="w-full text-left bg-black/20 hover:bg-white/10 p-3 rounded-lg border border-white/5 transition flex justify-between items-center group">
                                                <div>
                                                    <div className="font-bold text-blue-300 font-mono tracking-widest">{s.roomCode}</div>
                                                    <div className="text-[10px] text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">Resume</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <button onClick={() => setShowLogin(true)} className="mt-4 text-xs text-gray-400 hover:text-white underline w-full text-center">Login Manually</button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm mx-auto animate-fade-in">
                            <button onClick={() => setShowLogin(false)} className="text-sm text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
                            <h2 className="text-3xl font-bold mb-2">Teacher Login</h2>
                            <p className="text-gray-400 mb-8 text-sm">Enter credentials to resume control.</p>
                            
                            <form onSubmit={handleLoginSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Room Code</label>
                                    <input type="text" className="w-full p-4 rounded-xl bg-black/30 border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white font-mono tracking-widest uppercase transition outline-none" placeholder="AAAA00" value={loginCode} onChange={e => setLoginCode(e.target.value.toUpperCase())} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Password</label>
                                    <input type="password" className="w-full p-4 rounded-xl bg-black/30 border border-white/10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white transition outline-none" placeholder="••••••" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                                </div>
                                {error && <p className="text-red-400 text-sm font-bold bg-red-900/20 p-3 rounded-lg border border-red-500/30">{error}</p>}
                                <button type="submit" className="w-full btn-primary py-4 rounded-xl font-bold text-white shadow-lg mt-4">Login & Resume</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function App() {
    // ... (App Logic remains exactly the same as the previous fixed version) ...
    // Copy the logic from the previous answer for App() function, 
    // just use the new HomePage component above.
    
    // For completeness of the file:
    const [initialJoinCode, setInitialJoinCode] = useState(() => { const params = new URLSearchParams(window.location.search); return params.get('room'); });
    const [magicKey, setMagicKey] = useState(() => { const params = new URLSearchParams(window.location.search); return params.get('key'); });
    const [view, setView] = useState(() => { const params = new URLSearchParams(window.location.search); if (params.get('room')) return 'loading'; return 'home'; });
    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('teacherRoomCode') || null);
    const [recentSessions, setRecentSessions] = useState(() => JSON.parse(localStorage.getItem('eduFlex_recentSessions') || '[]'));
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSessionPassword, setNewSessionPassword] = useState('');

    useEffect(() => { if (roomCode) localStorage.setItem('teacherRoomCode', roomCode); }, [roomCode]);
    useEffect(() => {
        const checkMagicLink = async () => {
            if (initialJoinCode && magicKey) {
                await handleTeacherLogin(initialJoinCode, magicKey, (errMsg) => { console.error("Magic Link Failed:", errMsg); setView('student'); });
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (initialJoinCode) {
                setView('student'); window.history.replaceState({}, document.title, window.location.pathname);
            } else if (view === 'loading') { setView('home'); }
        };
        checkMagicLink();
    }, []);

    const handleCreateSession = async (e) => {
        e.preventDefault();
        if (!newSessionPassword.trim()) return alert("Please set a password.");
        const newRoomCode = generateRoomCode();
        try {
            await setDoc(doc(db, 'sessions', newRoomCode), { roomCode: newRoomCode, password: newSessionPassword, isSessionLive: false, currentActivity: null, createdAt: new Date().toISOString() });
            const newSession = { roomCode: newRoomCode, password: newSessionPassword, createdAt: new Date().toISOString() };
            const updatedSessions = [newSession, ...recentSessions];
            setRecentSessions(updatedSessions);
            localStorage.setItem('eduFlex_recentSessions', JSON.stringify(updatedSessions));
            setRoomCode(newRoomCode); setView('teacher'); setShowCreateModal(false);
        } catch (error) { console.error("Error creating session:", error); alert("Could not create a new session."); }
    };

    const handleTeacherLogin = async (code, password, setErrorCallback) => {
        if (!code || !password) return setErrorCallback("Please enter both fields.");
        try {
            const sessionRef = doc(db, 'sessions', code);
            const docSnap = await getDoc(sessionRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.password === password) {
                    setRoomCode(code); setView('teacher');
                    const exists = recentSessions.some(s => s.roomCode === code);
                    if (!exists) {
                        const newSession = { roomCode: code, password: password, createdAt: new Date().toISOString() };
                        const updatedSessions = [newSession, ...recentSessions];
                        setRecentSessions(updatedSessions);
                        localStorage.setItem('eduFlex_recentSessions', JSON.stringify(updatedSessions));
                    }
                } else { setErrorCallback("Invalid Password."); }
            } else { setErrorCallback("Room not found."); }
        } catch (err) { console.error(err); setErrorCallback("Connection error."); }
    };

    const clearHistory = () => { if(window.confirm('Clear your local session history?')) { setRecentSessions([]); localStorage.removeItem('eduFlex_recentSessions'); } };
    const handleSetView = (newView) => { if (newView === 'home') { setRoomCode(null); } setView(newView); };

    if (view === 'loading') return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

    return (
        <>
            {view === 'teacher' ? (<TeacherView setView={handleSetView} roomCode={roomCode} />) : view === 'student' ? (<StudentView setView={setView} initialJoinCode={initialJoinCode} />) : (<HomePage setView={setView} onTeacherLogin={handleTeacherLogin} recentSessions={recentSessions} onClearHistory={clearHistory} onRequestCreate={() => setShowCreateModal(true)} />)}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="glass-card bg-[#1e293b] text-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/10">
                        <h2 className="text-2xl font-bold mb-2">Create New Session</h2>
                        <p className="text-gray-400 mb-6 text-sm">Secure your room with a password.</p>
                        <form onSubmit={handleCreateSession}>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Teacher Password</label>
                            <input type="text" className="w-full p-4 border border-white/10 rounded-xl bg-black/30 focus:border-blue-500 focus:outline-none text-lg text-white mb-6" placeholder="e.g. Physics2025" value={newSessionPassword} onChange={e => setNewSessionPassword(e.target.value)} autoFocus />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition">Cancel</button>
                                <button type="submit" className="flex-1 btn-primary text-white py-3 rounded-xl font-bold shadow-lg">Create Room 🚀</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}