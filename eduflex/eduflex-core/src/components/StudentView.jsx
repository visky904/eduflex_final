import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; 
import { playSound, filterProfanity } from '../utils/helpers';
import { WordleGame } from './WordleGame';

// --- CUSTOM CONFETTI COMPONENT ---
const Confetti = () => {
    const [particles, setParticles] = useState([]);
    useEffect(() => {
        const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#ffffff'];
        const newParticles = [];
        for (let i = 0; i < 100; i++) {
            newParticles.push({
                id: i, x: 50, y: 50,
                angle: Math.random() * 360,
                velocity: Math.random() * 20 + 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                delay: Math.random() * 0.2
            });
        }
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
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedQuestionIndex, setSubmittedQuestionIndex] = useState(-1);
    const [feedbackText, setFeedbackText] = useState("");
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState({ isSessionLive: false, currentActivity: null, isGamified: false });
    const [codeCopied, setCodeCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [myScore, setMyScore] = useState(0);
    const [myBadges, setMyBadges] = useState([]);
    
    // ✅ NEW: Track the unique ID of the activity to force resets
    const [lastActivityId, setLastActivityId] = useState(null);

    // Mouse Tracker
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Audio Ref
    const bgMusicRef = useRef(new Audio('/game-music.mp3'));

    // --- Mouse Follower Logic ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (sessionData.isGamified) {
                setMousePos({ x: e.clientX, y: e.clientY });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [sessionData.isGamified]);

    // --- Manage Audio based on session state ---
    useEffect(() => {
        const music = bgMusicRef.current;
        music.loop = true;
        music.volume = 0.3;

        if (joined && sessionData.isGamified) {
            music.play().catch(e => console.log("Audio blocked until interaction"));
        } else {
            music.pause();
        }

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

    // --- RESET LOGIC (THE FIX) ---
    useEffect(() => {
        if (sessionData.isSessionLive && sessionData.currentActivity) {
            const serverActivityId = sessionData.currentActivity.activityId; // Unique ID from Teacher
            const serverQuestionIndex = sessionData.currentActivity.currentQuestionIndex || 0;

            // 1. Completely New Activity? (ID changed)
            if (serverActivityId && serverActivityId !== lastActivityId) {
                setSubmitted(false);
                setFeedbackText("");
                setSubmittedQuestionIndex(-1);
                setLastActivityId(serverActivityId); // Sync ID
            } 
            // 2. Same Activity, New Question? (Index changed)
            else if (serverQuestionIndex !== submittedQuestionIndex) {
                setSubmitted(false);
                setFeedbackText("");
            }
        }
    }, [sessionData, lastActivityId, submittedQuestionIndex]);

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
        if (!sessionData.currentActivity || submitted) {
            setTimeLeft(null);
            setAutoSubmitTriggered(false);
            return;
        }
        const currentQuestion = sessionData.currentActivity.questions?.[0];
        if (currentQuestion?.timeLimit && sessionData.currentActivity.type === 'qa') {
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
                        setTimeout(() => {
                            if (feedbackText.trim()) handleSubmit(feedbackText);
                            else handleSubmit('(No answer provided)');
                        }, 100);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [sessionData.currentActivity, submitted, autoSubmitTriggered]);

    const handleCopyCode = async () => {
        if (enteredCode) {
            try {
                await navigator.clipboard.writeText(enteredCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
            } catch (err) { console.error("Failed to copy code:", err); }
        }
    };

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
                await setDoc(participantRef, {
                    name: studentName,
                    joinedAt: new Date(),
                    score: 0,
                    badges: []
                }, { merge: true });
                setJoined(true);
            } else {
                setError("Invalid Room Code. Please try again.");
            }
        } catch (err) {
            console.error("Error checking session:", err);
            setError("Could not connect to the server.");
        }
    };
    
    useEffect(() => {
        if (!joined || !enteredCode) return;
        if (initialJoinCode) return;
        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
        const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            if (docSnap.exists()) {
                setSessionData(docSnap.data());
            } else {
                alert("The session has ended.");
                setView('home');
            }
        });
        return () => unsubscribe();
    }, [joined, enteredCode, setView, initialJoinCode]);

    const handleSubmit = async (answerPayload) => {
        if (!enteredCode || !sessionData.currentActivity) return;
        let finalAnswer = answerPayload;
        if (sessionData.currentActivity.settings.profanityFilter && sessionData.currentActivity.type !== 'wordcloud') {
            finalAnswer = filterProfanity(answerPayload);
        }

        const activity = sessionData.currentActivity;
        const currentIndex = activity.currentQuestionIndex || 0;
        
        if (activity.type === 'mcq') {
            const currentQ = activity.questions?.[currentIndex] || activity;
            const correctOption = currentQ.options?.find(opt => opt.isCorrect);
            if (correctOption && finalAnswer.trim() === correctOption.text.trim()) {
                triggerConfetti();
            }
        } else if (activity.type === 'qa') {
            const currentQ = activity.questions?.[0];
            if (currentQ?.correctAnswer && currentQ.correctAnswer.trim() !== "") {
                if (finalAnswer.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase()) {
                    triggerConfetti();
                }
            }
        }

        const responsesCol = collection(db, 'sessions', enteredCode.toUpperCase(), 'responses');
        try {
            await addDoc(responsesCol, {
                answer: finalAnswer,
                studentName: studentName,
                type: sessionData.currentActivity.type,
                questionIndex: currentIndex,
                timestamp: new Date()
            });
            setSubmitted(true);
            setSubmittedQuestionIndex(currentIndex);
        } catch (error) {
            console.error("Error submitting:", error);
            alert("Could not submit.");
        }
    };
    
    const renderActivity = () => {
        if (!sessionData.currentActivity) return null;
        const { currentActivity } = sessionData;
        const currentIndex = currentActivity.currentQuestionIndex || 0;
        const totalQuestions = currentActivity.questions?.length || 1;
        const isLastQuestion = currentIndex >= totalQuestions - 1;
        const isMultiQuestion = (currentActivity.type === 'mcq' || currentActivity.type === 'qa') && totalQuestions > 1;
        
        if(submitted && isMultiQuestion && !isLastQuestion) {
            return (
                <div className="text-center animate-fade-in">
                    <h2 className="text-2xl font-bold text-green-600">Answer Submitted!</h2>
                    <p className="mt-2 text-gray-600 text-lg">Question {currentIndex + 1} of {totalQuestions} completed</p>
                    <p className="mt-4 text-gray-800 font-semibold text-xl animate-pulse">Waiting for teacher...</p>
                    <div className="mt-4 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600"></div></div>
                </div>
            )
        }
        if(submitted) {
            return (
                <div className="text-center animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800">Thank you!</h2>
                    <p className="mt-2 text-gray-600">Your response has been submitted.</p>
                </div>
            )
        }
        
        switch(currentActivity.type) {
            case 'mcq':
                const currentMcqQuestion = currentActivity.questions?.[currentIndex] || currentActivity;
                return (
                    <div className="w-full animate-fade-in">
                        {totalQuestions > 1 && (<div className="mb-4 text-center"><span className="inline-block bg-teal-600 text-white px-4 py-2 rounded-full font-semibold shadow-md">Question {currentIndex + 1} of {totalQuestions}</span></div>)}
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentMcqQuestion.question}</h2>
                        {currentMcqQuestion.image && <img src={currentMcqQuestion.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(currentMcqQuestion.options || []).map((opt, i) => (
                                <button key={i} onClick={() => handleSubmit(opt.text)} className="p-4 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition transform hover:scale-105">{opt.text}</button>
                            ))}
                        </div>
                    </div>
                );
            case 'wordcloud':
            case 'feedback':
                 return (
                    <div className="w-full animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentActivity.question}</h2>
                        {currentActivity.image && <img src={currentActivity.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            <textarea className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition" rows="4" placeholder="Type here..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}></textarea>
                            <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">Submit</button>
                        </form>
                    </div>
                );
             case 'reviews':
                 const reviewOptions = currentActivity.settings.reviewStyle === 'emoji' ? ['😠', '🙁', '😐', '🙂', '😄'] : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
                return (
                    <div className="w-full animate-fade-in text-center">
                         <h2 className="text-2xl font-bold text-gray-800 mb-6">{currentActivity.question}</h2>
                         <div className="flex justify-center space-x-2 md:space-x-4">
                             {reviewOptions.map((opt, i) => (<button key={i} onClick={() => handleSubmit(opt)} className="text-4xl md:text-5xl p-2 rounded-full hover:bg-gray-200 transition-colors transform hover:scale-110">{opt}</button>))}
                         </div>
                    </div>
                );
            case 'qa':
                const currentQ = currentActivity.questions?.[0];
                return (
                    <div className="w-full animate-fade-in">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentQ?.text}</h2>
                            {timeLeft !== null && (<div className={`text-center mb-4 ${timeLeft <= 5 ? 'text-teal-600 animate-pulse' : 'text-gray-600'}`}><p className="text-lg font-bold">⏱️ Time Remaining: {timeLeft}s</p></div>)}
                        </div>
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            {currentQ?.type === 'short' ? (<input type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />) : currentQ?.type === 'long' ? (<textarea className="w-full p-3 border-2 border-gray-300 rounded-lg" rows="6" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}></textarea>) : (<div className="space-y-2">{(currentQ?.options || []).map((opt, idx) => (<button key={idx} type="button" onClick={() => handleSubmit(opt)} className="w-full p-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700">{opt}</button>))}</div>)}
                            {currentQ?.type !== 'multiple' && <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-3 rounded-lg">Submit Answer</button>}
                        </form>
                    </div>
                );
            case 'wordle':
                return (
                    <WordleGame 
                        word={currentActivity.wordleAnswer?.toUpperCase() || ''} 
                        roomCode={enteredCode} 
                        studentId={studentName}
                        onGameEnd={(winningWord) => {
                            triggerConfetti(); 
                            if (!submitted) { handleSubmit(winningWord); }
                        }}
                    />
                );
            default: return <p>Unknown activity type</p>;
        }
    }

    if (!joined) {
        return (
             <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-lg shadow-2xl p-8 border-t-4 border-red-600">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Join Session</h1>
                    <p className="text-center text-gray-600 mb-6">Enter your name and the session code.</p>
                    <form onSubmit={handleJoin} className="bg-white shadow-lg rounded-lg p-8">
                        <div className="mb-4"><label className="block text-gray-700 font-semibold mb-2">Name *</label><input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Enter your name" className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" /></div>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Room Code *</label>
                            <div className="flex gap-2 items-center"><input type="text" maxLength="6" value={enteredCode} onChange={e => setEnteredCode(e.target.value.trim().toUpperCase())} placeholder="AANANN" className="flex-1 p-4 text-center text-2xl tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" /><button type="button" onClick={handleCopyCode} disabled={!enteredCode} className="p-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">📋</button></div>
                        </div>
                        {codeCopied && <p className="text-green-600 text-center mt-2 text-sm font-semibold">✓ Code copied!</p>}
                        {error && <p className="text-teal-500 text-center mt-4">{error}</p>}
                        <button type="submit" className="w-full mt-6 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">Join</button>
                    </form>
                     <button onClick={() => setView('home')} className="mt-6 text-gray-600 hover:text-teal-600 transition">Back to Home</button>
                </div>
            </div>
        )
    }

    return (
        // ✅ DYNAMIC INTERACTIVE BACKGROUND
        <div className="flex flex-col items-center justify-center min-h-screen font-sans text-gray-100 overflow-hidden relative transition-colors duration-1000">
            
            {/* Background Layer */}
            <div 
                className="absolute inset-0 z-0 transition-all duration-1000"
                style={sessionData.isGamified ? {
                    // GAMIFIED: Cyberpunk Neon Ripple
                    backgroundColor: '#0a0a12', 
                    backgroundImage: `
                        radial-gradient(
                            800px circle at ${mousePos.x}px ${mousePos.y}px, 
                            rgba(192, 38, 211, 0.15), 
                            rgba(56, 189, 248, 0.10) 40%, 
                            transparent 80%
                        ),
                        url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
                    `,
                } : {
                    // DEFAULT: Deep Red & Black Gradient
                    background: 'linear-gradient(to bottom right, #111827, #7f1d1d, #000000)'
                }}
            ></div>

            {showConfetti && <Confetti />}

            {/* XP Bar - Centered & Constrained Width */}
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-50">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-2 flex items-center gap-3 border-b-4 border-teal-600 animate-slide-down">
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-teal-100">{getLevelInfo(myScore).level}</div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-[10px] font-black px-1.5 rounded-sm text-gray-900 tracking-tighter">LVL</div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs font-bold text-gray-600 mb-1 px-1"><span>{myScore} XP</span><span className="text-teal-600">Next: {(getLevelInfo(myScore).level) * 100}</span></div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner"><div className="bg-gradient-to-r from-teal-400 to-teal-600 h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${getLevelInfo(myScore).progress}%` }}><div className="absolute inset-0 bg-white/20 animate-pulse"></div></div></div>
                    </div>
                    {myBadges.length > 0 && (<div className="hidden sm:flex animate-bounce-slight text-2xl" title="Latest Badge">{myBadges[myBadges.length - 1]}</div>)}
                </div>
            </div>

            {/* Exit Button - Moved to Bottom Right */}
            <button 
                onClick={() => setView('home')} 
                className="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white font-bold p-3 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2 z-50 hover:scale-105"
                title="Exit Session"
            >
                <span className="text-xl">✕</span>
                <span className="hidden sm:inline">Exit</span>
            </button>

            {/* Content Wrapper */}
            <div className="relative z-10 w-full max-w-2xl p-4">
                {!sessionData.isSessionLive ? (
                    <div className="animate-fade-in text-center">
                        <h2 className="text-3xl font-bold text-white mb-2">You're in!</h2>
                        <p className="mt-2 text-gray-300">Waiting for the teacher to start...</p>
                        <div className="mt-8"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto shadow-[0_0_15px_rgba(220,38,38,0.6)]"></div></div>
                    </div>
                ) : (
                    <div className="w-full bg-white/95 backdrop-blur p-8 rounded-lg shadow-2xl border border-gray-200 text-left text-black">
                        {renderActivity()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentView;