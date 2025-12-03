import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, getDoc, setDoc } from 'firebase/firestore'; 
import { playSound, filterProfanity } from '../utils/helpers';
import { WordleGame } from './WordleGame';

// --- GAMIFICATION CONSTANTS ---
const AVATARS = ['🐼', '🦊', '🐯', '🦄', '🐲', '👾', '🤖', '👻', '🦁', '🐸', '🚀', '🐱'];

const getRankTitle = (xp) => {
    if (xp >= 500) return "👑 LEGEND";
    if (xp >= 300) return "🔥 MYTHIC";
    if (xp >= 200) return "⚔️ MASTER";
    if (xp >= 100) return "🛡️ VETERAN";
    if (xp >= 50) return "⚔️ APPRENTICE";
    return "🌱 NOVICE";
};

// --- CUSTOM CONFETTI ---
const Confetti = () => {
    const [particles, setParticles] = useState([]);
    useEffect(() => {
        const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#ffffff'];
        const newParticles = Array.from({ length: 100 }).map((_, i) => ({
            id: i, x: 50, y: 50,
            angle: Math.random() * 360,
            velocity: Math.random() * 20 + 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.2
        }));
        setParticles(newParticles);
    }, []);
    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {particles.map((p) => (
                <div key={p.id} style={{ position: 'absolute', left: '50%', top: '50%', width: '10px', height: '10px', backgroundColor: p.color, borderRadius: '50%', transform: `translate(-50%, -50%)`, animation: `explode 1s ease-out forwards`, animationDelay: `${p.delay}s`, '--angle': `${p.angle}deg`, '--velocity': `${p.velocity}rem`, }} />
            ))}
            <style>{`@keyframes explode { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(calc(-50% + (cos(var(--angle)) * var(--velocity))), calc(-50% + (sin(var(--angle)) * var(--velocity)))) scale(0); opacity: 0; } }`}</style>
        </div>
    );
};

const StudentView = ({ setView, initialJoinCode }) => {
    const [enteredCode, setEnteredCode] = useState(initialJoinCode || '');
    const [studentName, setStudentName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]); 
    
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    
    // NAVIGATION STATE
    const [localIndex, setLocalIndex] = useState(0); 
    const [playlistIndex, setPlaylistIndex] = useState(0); 
    const [lastActivityId, setLastActivityId] = useState(null);

    const [feedbackText, setFeedbackText] = useState("");
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState({ isSessionLive: false, currentActivity: null, isGamified: false });
    const [timeLeft, setTimeLeft] = useState(null);
    const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [myScore, setMyScore] = useState(0);
    const [myBadges, setMyBadges] = useState([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const bgMusicRef = useRef(new Audio('/game-music.mp3'));

    useEffect(() => {
        const handleMouseMove = (e) => { if (sessionData.isGamified) setMousePos({ x: e.clientX, y: e.clientY }); };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [sessionData.isGamified]);

    useEffect(() => {
        const music = bgMusicRef.current;
        music.loop = true;
        music.volume = 0.3;
        if (joined && sessionData.isGamified) { music.play().catch(e => console.log("Audio blocked")); } 
        else { music.pause(); }
        return () => music.pause();
    }, [joined, sessionData.isGamified]);

    const getLevelInfo = (xp) => {
        const safeXP = xp || 0;
        const level = Math.floor(safeXP / 100) + 1;
        const progress = safeXP % 100;
        return { level, progress };
    };

    const triggerConfetti = () => {
        setShowConfetti(true);
        playSound('success');
        setTimeout(() => setShowConfetti(false), 3000);
    };

    // --- ACTIVITY RESOLVER ---
    let currentActivity = sessionData.currentActivity;
    let isPlaylistMode = false;

    if (currentActivity && currentActivity.type === 'playlist') {
        isPlaylistMode = true;
        currentActivity = currentActivity.queue[playlistIndex];
    }

    const isStudentPacedQuestions = currentActivity?.settings?.isStudentPaced;
    const currentQuestionIndex = (isStudentPacedQuestions || isPlaylistMode) ? localIndex : (currentActivity?.currentQuestionIndex || 0);

    // --- RESET LOGIC ---
    useEffect(() => {
        if (sessionData.isSessionLive && sessionData.currentActivity) {
            const serverActivityId = sessionData.currentActivity.activityId;
            
            if (serverActivityId && serverActivityId !== lastActivityId) {
                setSubmitted(false); 
                setFeedbackText(""); 
                setLastActivityId(serverActivityId);
                setLocalIndex(0); 
                setPlaylistIndex(0);
            } 
            
            if (!isStudentPacedQuestions && !isPlaylistMode) {
                 const serverQIndex = sessionData.currentActivity.currentQuestionIndex || 0;
                 if (serverQIndex !== lastServerIndexRef.current) {
                     setSubmitted(false);
                     setFeedbackText("");
                     lastServerIndexRef.current = serverQIndex;
                 }
            }
        }
    }, [sessionData, lastActivityId, isStudentPacedQuestions, isPlaylistMode]);
    
    const lastServerIndexRef = useRef(-1);

    useEffect(() => {
        if (!joined || !enteredCode || !studentName) return;
        const myParticipantRef = doc(db, 'sessions', enteredCode.toUpperCase(), 'participants', studentName);
        const unsubscribe = onSnapshot(myParticipantRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMyScore(data.score || 0);
                setMyBadges(data.badges || []);
            }
        });
        return () => unsubscribe();
    }, [joined, enteredCode, studentName]);

    useEffect(() => {
        if (!currentActivity || submitted) { setTimeLeft(null); setAutoSubmitTriggered(false); return; }
        const currentQuestion = currentActivity.questions?.[currentQuestionIndex];
        
        if (currentQuestion?.timeLimit && currentActivity.type === 'qa') {
            setTimeLeft(currentQuestion.timeLimit);
            setAutoSubmitTriggered(false);
        } else {
            setTimeLeft(null);
            return;
        }
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null) { clearInterval(timer); return null; }
                if (prev <= 1) {
                    clearInterval(timer);
                    if (!autoSubmitTriggered) {
                        setAutoSubmitTriggered(true);
                        setTimeout(() => { if (feedbackText.trim()) handleSubmit(feedbackText); else handleSubmit('(No answer provided)'); }, 100);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [currentActivity, submitted, autoSubmitTriggered, currentQuestionIndex]);

    const handleJoin = async (e) => {
        e.preventDefault();
        setError(""); 
        if (!studentName.trim()) { setError("Please enter your name."); return; }
        if (!enteredCode) { setError("Please enter a room code."); return; }
        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
        try {
            const docSnap = await getDoc(sessionRef);
            if (docSnap.exists()) {
                const participantRef = doc(db, 'sessions', enteredCode.toUpperCase(), 'participants', studentName);
                await setDoc(participantRef, { name: studentName, avatar: selectedAvatar, joinedAt: new Date(), score: 0, badges: [] }, { merge: true });
                setJoined(true);
            } else { setError("Invalid Room Code."); }
        } catch (err) { console.error(err); setError("Connection failed."); }
    };
    
    useEffect(() => {
        if (!enteredCode) return; 
        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
        const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            if (docSnap.exists()) { setSessionData(docSnap.data()); } 
            else if (joined) { alert("Session ended."); setView('home'); }
        });
        return () => unsubscribe();
    }, [joined, enteredCode, setView]);

    const handleSubmit = async (answerPayload) => {
        if (!enteredCode || !currentActivity) return;
        let finalAnswer = answerPayload;
        if (currentActivity.settings?.profanityFilter && currentActivity.type !== 'wordcloud') {
            finalAnswer = filterProfanity(answerPayload);
        }

        if (currentActivity.type === 'mcq') {
            const currentQ = currentActivity.questions?.[currentQuestionIndex] || currentActivity;
            const correctOption = currentQ.options?.find(opt => opt.isCorrect);
            if (correctOption && finalAnswer.trim() === correctOption.text.trim()) { triggerConfetti(); }
        }

        const responsesCol = collection(db, 'sessions', enteredCode.toUpperCase(), 'responses');
        try {
            await addDoc(responsesCol, {
                answer: finalAnswer,
                studentName: studentName,
                type: currentActivity.type,
                // CRITICAL FIX: Send playlistId so TeacherView knows which item was answered
                activityId: currentActivity.playlistId || 'single', 
                questionIndex: currentQuestionIndex,
                timestamp: new Date()
            });
            setSubmitted(true);
        } catch (error) { console.error("Submit error:", error); }
    };
    
    const handleNext = () => {
        const totalQuestions = currentActivity.questions?.length || 1;
        
        if (currentQuestionIndex < totalQuestions - 1) {
            setLocalIndex(prev => prev + 1);
            setSubmitted(false);
            setFeedbackText("");
            window.scrollTo(0,0);
            return;
        }

        if (isPlaylistMode && sessionData.currentActivity.queue && playlistIndex < sessionData.currentActivity.queue.length - 1) {
            setPlaylistIndex(prev => prev + 1);
            setLocalIndex(0); 
            setSubmitted(false);
            setFeedbackText("");
            window.scrollTo(0,0);
            return;
        }
    };

    const renderActivity = () => {
        if (!currentActivity) return <p>Waiting for teacher...</p>;
        
        const totalQuestions = currentActivity.questions?.length || 1;
        const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
        const isLastActivity = !isPlaylistMode || (playlistIndex >= sessionData.currentActivity.queue.length - 1);
        
        if(submitted) {
            return (
                <div className="text-center animate-fade-in py-8">
                    <div className="text-6xl mb-4">🚀</div>
                    <h2 className="text-3xl font-bold text-gray-800">Answer Sent!</h2>
                    
                    {((!isLastQuestion) || (isPlaylistMode && !isLastActivity)) ? (
                        <div className="mt-6">
                            <button onClick={handleNext} className="bg-teal-600 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg hover:bg-teal-700 transform transition hover:scale-105">
                                {!isLastQuestion ? "Next Question ➡️" : "Next Activity ⏭️"}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-6">
                            <p className="text-gray-600">All done! Check the leaderboard.</p>
                            <div className="mt-6 w-full max-w-xs mx-auto bg-gray-200 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 animate-loading-bar"></div>
                            </div>
                        </div>
                    )}
                </div>
            )
        }
        
        const currentQData = currentActivity.questions?.[currentQuestionIndex] || currentActivity;

        switch(currentActivity.type) {
            case 'mcq':
                return (
                    <div className="w-full animate-fade-in">
                        {isPlaylistMode && <span className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Activity {playlistIndex + 1} / {sessionData.currentActivity.queue.length}</span>}
                        {totalQuestions > 1 && <span className="inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-bold mb-4">Question {currentQuestionIndex + 1} / {totalQuestions}</span>}
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">{currentQData.question}</h2>
                        {currentQData.image && <img src={currentQData.image} alt="activity" className="rounded-lg mb-6 max-h-64 w-auto mx-auto shadow-md"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(currentQData.options || []).map((opt, i) => (
                                <button key={i} onClick={() => handleSubmit(opt.text)} className="p-4 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:border-teal-500 hover:bg-teal-50 hover:shadow-md transition-all transform hover:-translate-y-1 text-lg text-left">
                                    <span className="inline-block w-8 h-8 bg-gray-100 rounded-full text-center leading-8 mr-3 text-sm text-gray-500">{String.fromCharCode(65+i)}</span>
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 'wordcloud':
            case 'feedback':
                 return (
                    <div className="w-full animate-fade-in">
                        {isPlaylistMode && <span className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Activity {playlistIndex + 1} / {sessionData.currentActivity.queue.length}</span>}
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentActivity.question}</h2>
                        {currentActivity.image && <img src={currentActivity.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            <textarea className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition text-lg" rows="4" placeholder="Type your answer here..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}></textarea>
                            <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-4 rounded-xl hover:bg-teal-700 transition shadow-lg transform active:scale-95">Submit Answer</button>
                        </form>
                    </div>
                );
             case 'reviews':
                 const reviewOptions = currentActivity.settings.reviewStyle === 'emoji' ? ['😠', '🙁', '😐', '🙂', '😄'] : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
                return (
                    <div className="w-full animate-fade-in text-center">
                         {isPlaylistMode && <span className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Activity {playlistIndex + 1} / {sessionData.currentActivity.queue.length}</span>}
                         <h2 className="text-2xl font-bold text-gray-800 mb-8">{currentActivity.question}</h2>
                         <div className="flex justify-center gap-4 flex-wrap">
                             {reviewOptions.map((opt, i) => (<button key={i} onClick={() => handleSubmit(opt)} className="text-5xl p-4 rounded-2xl hover:bg-gray-100 transition-all transform hover:scale-125 duration-200">{opt}</button>))}
                         </div>
                    </div>
                );
            case 'qa':
                return (
                    <div className="w-full animate-fade-in">
                        <div className="mb-6">
                            {isPlaylistMode && <span className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">Activity {playlistIndex + 1} / {sessionData.currentActivity.queue.length}</span>}
                            {totalQuestions > 1 && <span className="inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-bold mb-4">Question {currentQuestionIndex + 1} / {totalQuestions}</span>}
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentQData.text}</h2>
                            {timeLeft !== null && <div className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg font-mono font-bold">⏱️ {timeLeft}s remaining</div>}
                        </div>
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            {currentQData.type === 'short' ? (<input type="text" className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-teal-500 text-lg" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />) : currentQData.type === 'long' ? (<textarea className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-teal-500 text-lg" rows="5" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}></textarea>) : (<div className="space-y-3">{(currentQData.options || []).map((opt, idx) => (<button key={idx} type="button" onClick={() => handleSubmit(opt)} className="w-full p-4 bg-white border-2 border-gray-200 text-gray-800 font-bold rounded-xl hover:bg-teal-50 hover:border-teal-500 text-left transition">{opt}</button>))}</div>)}
                            {currentQData.type !== 'multiple' && <button type="submit" className="w-full mt-6 bg-teal-600 text-white font-bold py-4 rounded-xl hover:bg-teal-700 shadow-lg">Submit Answer</button>}
                        </form>
                    </div>
                );
            case 'wordle':
                return (
                    <WordleGame 
                        word={currentActivity.wordleAnswer?.toUpperCase() || ''} 
                        roomCode={enteredCode} 
                        studentId={studentName}
                        onGameEnd={(winningWord) => { triggerConfetti(); if (!submitted) { handleSubmit(winningWord); } }}
                    />
                );
            default: return <p>Waiting for activity...</p>;
        }
    }

    if (!joined) {
        return (
             <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border-t-8 border-purple-500">
                    <h1 className="text-3xl font-extrabold text-center text-gray-800 mb-2">Student Join</h1>
                    <p className="text-center text-gray-500 mb-6">Pick your hero and enter the arena!</p>
                    <form onSubmit={handleJoin} className="space-y-5">
                        <div><label className="block text-gray-700 font-bold mb-2">Choose Avatar</label><div className="grid grid-cols-6 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">{AVATARS.map((av) => (<button key={av} type="button" onClick={() => setSelectedAvatar(av)} className={`text-2xl p-2 rounded-lg transition transform hover:scale-110 ${selectedAvatar === av ? 'bg-purple-100 ring-2 ring-purple-500 scale-110' : 'hover:bg-gray-200'}`}>{av}</button>))}</div></div>
                        <div><label className="block text-gray-700 font-bold mb-1">Name</label><input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Your Name" className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none transition" /></div>
                        <div><label className="block text-gray-700 font-bold mb-1">Room Code</label><input type="text" maxLength="6" value={enteredCode} onChange={e => setEnteredCode(e.target.value.trim().toUpperCase())} placeholder="AAAA00" className={`w-full p-4 text-center text-2xl tracking-widest border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-mono uppercase ${initialJoinCode ? 'bg-gray-100 text-gray-500' : ''}`} readOnly={!!initialJoinCode} /></div>
                        {error && <p className="text-red-500 text-center font-bold">{error}</p>}
                        <button type="submit" className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl hover:bg-purple-700 transition shadow-lg transform active:scale-95 text-lg">Ready to Play! 🚀</button>
                    </form>
                     <button onClick={() => setView('home')} className="mt-6 w-full text-gray-400 hover:text-purple-600 transition text-sm">Back to Home</button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center min-h-screen font-sans text-gray-100 overflow-hidden relative transition-colors duration-1000">
            <div className="absolute inset-0 z-0 transition-all duration-1000" style={sessionData.isGamified ? { backgroundColor: '#0f172a', backgroundImage: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.10) 40%, transparent 80%), url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` } : { background: 'linear-gradient(to bottom right, #1e293b, #991b1b, #000000)' }}></div>
            {showConfetti && <Confetti />}
            <div className="fixed top-0 left-0 right-0 z-50 p-2 sm:p-4 flex justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-3 flex items-center gap-4 border-b-4 border-indigo-500 w-full max-w-lg pointer-events-auto transform transition-all hover:scale-105">
                    <div className="relative shrink-0"><div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-3xl shadow-inner border border-indigo-200">{selectedAvatar}</div><div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 text-xs font-black px-1.5 py-0.5 rounded-md shadow-sm border border-yellow-200">{getLevelInfo(myScore).level}</div></div>
                    <div className="flex-1 min-w-0"><div className="flex justify-between items-end mb-1"><h3 className="font-bold text-gray-800 truncate">{studentName}</h3><span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{getRankTitle(myScore)}</span></div><div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner"><div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-400 to-purple-600 transition-all duration-1000 ease-out" style={{ width: `${getLevelInfo(myScore).progress}%` }}><div className="absolute inset-0 bg-white/30 animate-pulse"></div></div></div><div className="flex justify-between text-[10px] font-bold text-gray-400 mt-1"><span>{myScore} XP</span><span>Next: {getLevelInfo(myScore).level * 100}</span></div></div>
                    {myBadges.length > 0 && (<div className="hidden sm:flex flex-col items-center justify-center pl-2 border-l border-gray-200"><div className="text-2xl animate-bounce-slight">{myBadges[myBadges.length - 1]}</div></div>)}
                </div>
            </div>
            <button onClick={() => setView('home')} className="fixed bottom-4 right-4 bg-red-500/80 hover:bg-red-600 text-white p-3 rounded-full shadow-lg backdrop-blur-sm transition z-50">🚪</button>
            <div className="relative z-10 w-full max-w-3xl p-4 mt-24 pb-20">
                {!sessionData.isSessionLive ? (
                    <div className="animate-fade-in text-center mt-20"><div className="text-6xl mb-4 animate-bounce">{selectedAvatar}</div><h2 className="text-3xl font-bold text-white mb-2">You're in, {studentName}!</h2><p className="text-indigo-200 text-lg">Waiting for the teacher to start...</p><div className="mt-8 flex justify-center gap-2"><div className="w-3 h-3 bg-white rounded-full animate-bounce delay-0"></div><div className="w-3 h-3 bg-white rounded-full animate-bounce delay-150"></div><div className="w-3 h-3 bg-white rounded-full animate-bounce delay-300"></div></div></div>
                ) : (
                    <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20 text-left text-black transform transition-all duration-500">{renderActivity()}</div>
                )}
            </div>
        </div>
    );
};

export default StudentView;