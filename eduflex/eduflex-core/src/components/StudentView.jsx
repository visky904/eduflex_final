import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; 
import { playSound, filterProfanity } from '../utils/helpers';
import { WordleGame } from './WordleGame';

const StudentView = ({ setView, initialJoinCode }) => {
    const [enteredCode, setEnteredCode] = useState(initialJoinCode || '');
    const [studentName, setStudentName] = useState('');
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedQuestionIndex, setSubmittedQuestionIndex] = useState(-1);
    const [feedbackText, setFeedbackText] = useState("");
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState({ isSessionLive: false, currentActivity: null });
    const [codeCopied, setCodeCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
    
    // --- Gamification State ---
    const [myScore, setMyScore] = useState(0);
    const [myBadges, setMyBadges] = useState([]);

    // --- Helper Function (Moved to Top Level) ---
    const getLevelInfo = (xp) => {
        const safeXP = xp || 0;
        const level = Math.floor(safeXP / 100) + 1;
        const progress = safeXP % 100;
        return { level, progress };
    };

    // --- Listener for My Score ---
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

    // Countdown timer logic
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
useEffect(() => {
    if (!sessionData.currentActivity) return;

    // 🔥 When teacher starts new activity, always reset UI
    setSubmitted(false);
    setFeedbackText("");
    setSubmittedQuestionIndex(-1);
}, [sessionData.currentActivity?.activityId]);

    // Auto-join logic
    useEffect(() => {
        if (initialJoinCode && studentName && joined) {
            const sessionRef = doc(db, 'sessions', initialJoinCode.toUpperCase());
            const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
                if (snapshot.exists()) {
                    setSessionData(snapshot.data());
                    setError("");
                } else {
                    setError("Session not found. Please check the room code.");
                    setJoined(false);
                }
            }, (error) => {
                console.error("Error joining session:", error);
                setError("Failed to join session. Please try again.");
                setJoined(false);
            });
            
            return () => unsubscribe();
        }
    }, [initialJoinCode, studentName, joined]);

    useEffect(() => {
        if (sessionData.isSessionLive && sessionData.currentActivity) {
            const currentIndex = sessionData.currentActivity.currentQuestionIndex || 0;
            if (submittedQuestionIndex !== currentIndex) {
                setSubmitted(false);
                setFeedbackText("");
            }
        }
    }, [sessionData.isSessionLive, sessionData.currentActivity?.currentQuestionIndex, sessionData.currentActivity?.type]);

    const handleCopyCode = async () => {
        if (enteredCode) {
            try {
                await navigator.clipboard.writeText(enteredCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
            } catch (err) {
                console.error("Failed to copy code:", err);
            }
        }
    };

    const handleJoin = async (e) => {
        e.preventDefault();
        setError(""); 
        
        if (!studentName.trim()) { setError("Please enter your name."); return; }
        if (!enteredCode) { setError("Please enter a room code."); return; }
        
        // ✅ REMOVED: The check for split(' ').length < 2 is gone.
        
        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
        try {
            const docSnap = await getDoc(sessionRef);
            if (docSnap.exists()) {
                // Register student
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
            console.error("Error checking for session:", err);
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

        const responsesCol = collection(db, 'sessions', enteredCode.toUpperCase(), 'responses');
        try {
            await addDoc(responsesCol, {
                answer: finalAnswer,
                studentName: studentName,
                type: sessionData.currentActivity.type,
                timestamp: new Date()
            });
            
            const currentIndex = sessionData.currentActivity.currentQuestionIndex || 0;
            const totalQuestions = sessionData.currentActivity.questions?.length || 1;
            const isMultiQuestion = (sessionData.currentActivity.type === 'mcq' || sessionData.currentActivity.type === 'qa') && totalQuestions > 1;
            const isNotLastQuestion = currentIndex < totalQuestions - 1;
            
            setSubmitted(true);
            setSubmittedQuestionIndex(currentIndex);
            
            if (isMultiQuestion && isNotLastQuestion) {
                setTimeout(async () => {
                    try {
                        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
                        await updateDoc(sessionRef, {
                            'currentActivity.currentQuestionIndex': currentIndex + 1
                        });
                    } catch (error) {
                        console.error("Error advancing to next question:", error);
                    }
                }, 1500); 
            }
        } catch (error) {
            console.error("Error submitting response:", error);
            alert("Could not submit your response. Please try again.");
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
                    <p className="mt-4 text-gray-800 font-semibold text-xl">Loading Question {currentIndex + 2}...</p>
                    <div className="mt-4 flex justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600"></div>
                    </div>
                </div>
            )
        }
        
        if(submitted) {
            return (
                <div className="text-center animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800">Thank you!</h2>
                    <p className="mt-2 text-gray-600">Your response has been submitted. Waiting for the next activity.</p>
                </div>
            )
        }
        
        switch(currentActivity.type) {
            case 'mcq':
                const currentMcqQuestion = currentActivity.questions?.[currentIndex] || currentActivity;
                return (
                    <div className="w-full animate-fade-in">
                        {totalQuestions > 1 && (
                            <div className="mb-4 text-center">
                                <span className="inline-block bg-teal-600 text-white px-4 py-2 rounded-full font-semibold shadow-md">
                                    Question {currentIndex + 1} of {totalQuestions}
                                </span>
                            </div>
                        )}
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentMcqQuestion.question}</h2>
                        {currentMcqQuestion.image && <img src={currentMcqQuestion.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(currentMcqQuestion.options || []).map((opt, i) => (
                                <button key={i} onClick={() => handleSubmit(opt.text)} className="p-4 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition transform hover:scale-105">
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
                             {reviewOptions.map((opt, i) => (
                                 <button key={i} onClick={() => handleSubmit(opt)} className="text-4xl md:text-5xl p-2 rounded-full hover:bg-gray-200 transition-colors transform hover:scale-110">{opt}</button>
                             ))}
                         </div>
                    </div>
                );
            case 'qa':
                const currentQ = currentActivity.questions?.[0];
                return (
                    <div className="w-full animate-fade-in">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentQ?.text}</h2>
                            {timeLeft !== null && (
                                <div className={`text-center mb-4 ${timeLeft <= 5 ? 'text-teal-600 animate-pulse' : 'text-gray-600'}`}>
                                    <p className="text-lg font-bold">⏱️ Time Remaining: {timeLeft}s</p>
                                </div>
                            )}
                        </div>
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            {currentQ?.type === 'short' ? (
                                <input type="text" className="w-full p-3 border-2 border-gray-300 rounded-lg" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                            ) : currentQ?.type === 'long' ? (
                                <textarea className="w-full p-3 border-2 border-gray-300 rounded-lg" rows="6" placeholder="Type answer..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}></textarea>
                            ) : (
                                <div className="space-y-2">
                                    {(currentQ?.options || []).map((opt, idx) => (
                                        <button key={idx} type="button" onClick={() => handleSubmit(opt)} className="w-full p-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700">{opt}</button>
                                    ))}
                                </div>
                            )}
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
                        // ✅ NEW: When game is won, submit the correct word to get points!
                        onGameEnd={(winningWord) => {
                            if (!submitted) {
                                handleSubmit(winningWord);
                            }
                        }}
                    />
                );
        }
    }

    // --- LOGIN SCREEN (if not joined) ---
    if (!joined) {
        return (
             <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-950 to-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-lg shadow-2xl p-8 border-t-4 border-red-600">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Join Session</h1>
                    <p className="text-center text-gray-600 mb-6">Enter your name and the session code.</p>
                    <form onSubmit={handleJoin} className="bg-white shadow-lg rounded-lg p-8">
                        <div className="mb-4">
                            {/* Updated Label */}
                            <label className="block text-gray-700 font-semibold mb-2">Name *</label>
                            {/* Updated Placeholder */}
                            <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Enter your name" className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                            {/* Removed the helper text about first/last name */}
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Room Code *</label>
                            <div className="flex gap-2 items-center">
                                <input type="text" maxLength="6" value={enteredCode} onChange={e => setEnteredCode(e.target.value.trim().toUpperCase())} placeholder="AANANN" className="flex-1 p-4 text-center text-2xl tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500" />
                                <button type="button" onClick={handleCopyCode} disabled={!enteredCode} className="p-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">📋</button>
                            </div>
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

    // --- ACTIVE SESSION SCREEN (if joined) ---
    return (
        <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4 text-center relative">
            
            {/* --- XP BAR --- */}
            <div className="fixed top-4 left-4 right-16 z-50">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl p-2 flex items-center gap-3 border-b-4 border-teal-600 animate-slide-down">
                    <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-teal-100">
                            {getLevelInfo(myScore).level}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-[10px] font-black px-1.5 rounded-sm text-gray-900 tracking-tighter">
                            LVL
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs font-bold text-gray-600 mb-1 px-1">
                            <span>{myScore} XP</span>
                            <span className="text-teal-600">Next: {(getLevelInfo(myScore).level) * 100}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                            <div 
                                className="bg-gradient-to-r from-teal-400 to-teal-600 h-full rounded-full transition-all duration-1000 ease-out relative"
                                style={{ width: `${getLevelInfo(myScore).progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                    {myBadges.length > 0 && (
                         <div className="hidden sm:flex animate-bounce-slight text-2xl" title="Latest Badge">
                            {myBadges[myBadges.length - 1]}
                         </div>
                    )}
                </div>
            </div>

            <button onClick={() => setView('home')} className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold p-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 z-50">
                <span className="text-xl">✕</span>
                <span className="hidden sm:inline">Exit</span>
            </button>

            {!sessionData.isSessionLive ? (
            <div className="animate-fade-in">
                <h2 className="text-3xl font-bold text-white mb-2">You're in!</h2>
                <p className="mt-2 text-gray-300">Waiting for the teacher to start...</p>
                <div className="mt-8">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto shadow-[0_0_15px_rgba(220,38,38,0.6)]"></div>
                </div>
            </div>
        ) : (
            // We keep the activity card white for readability
            <div className="w-full max-w-2xl bg-white/95 backdrop-blur p-8 rounded-lg shadow-2xl border border-gray-200">
                {renderActivity()}
            </div>
        )}
    </div>
);
};

export default StudentView;