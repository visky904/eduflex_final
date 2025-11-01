import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { playSound, filterProfanity } from '../utils/helpers';
import { WordleGame } from './WordleGame';

const StudentView = ({ setView, initialJoinCode }) => {
    const [enteredCode, setEnteredCode] = useState(initialJoinCode || '');
    const [studentName, setStudentName] = useState('');
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedQuestionIndex, setSubmittedQuestionIndex] = useState(-1); // Track which question was submitted
    const [feedbackText, setFeedbackText] = useState("");
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState({ isSessionLive: false, currentActivity: null });
    const [codeCopied, setCodeCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

    // Countdown timer logic with auto-submit
    useEffect(() => {
        if (!sessionData.currentActivity || submitted) {
            setTimeLeft(null);
            setAutoSubmitTriggered(false);
            return;
        }

        // Initialize timer when new activity starts
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
                if (prev === null) {
                    clearInterval(timer);
                    return null;
                }
                if (prev <= 1) {
                    clearInterval(timer);
                    // Auto-submit when time runs out
                    if (!autoSubmitTriggered) {
                        setAutoSubmitTriggered(true);
                        setTimeout(() => {
                            if (feedbackText.trim()) {
                                handleSubmit(feedbackText);
                            } else {
                                handleSubmit('(No answer provided)');
                            }
                        }, 100);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionData.currentActivity, submitted, autoSubmitTriggered]);

    // Auto-join if initialJoinCode is provided (but still need name first)
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
        // Reset submitted state when session goes live or when activity changes (including question index)
        if (sessionData.isSessionLive && sessionData.currentActivity) {
            const currentIndex = sessionData.currentActivity.currentQuestionIndex || 0;
            // Only reset if we're on a different question than what was submitted
            if (submittedQuestionIndex !== currentIndex) {
                setSubmitted(false);
                setFeedbackText("");
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        
        if (!studentName.trim()) {
            setError("Please enter your full name.");
            return;
        }
        
        if (studentName.trim().split(' ').length < 2) {
            setError("Please enter your full name (first and last name).");
            return;
        }
        
        if (!enteredCode) {
            setError("Please enter a room code.");
            return;
        }
        
        const sessionRef = doc(db, 'sessions', enteredCode.toUpperCase());
        try {
            const docSnap = await getDoc(sessionRef);
            if (docSnap.exists()) {
                setJoined(true);
            } else {
                setError("Invalid Room Code. Please try again.");
            }
        } catch (err) {
            console.error("Error checking for session:", err);
            setError("Could not connect to the server to verify room code.");
        }
    };
    
    useEffect(() => {
        // Only set up listener if joined manually (not via initialJoinCode)
        // The auto-join useEffect already handles the listener for link-based joins
        if (!joined || !enteredCode) return;
        if (initialJoinCode) return; // Skip if joining via link

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
            
            // Automatically advance to next question in Firebase after 1.5 seconds for multi-question activities
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
                }, 1500); // Advance to next question after 1.5 seconds
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
        
        // Only show "Thank you" if submitted AND it's the last question OR single activity types
        const isLastQuestion = currentIndex >= totalQuestions - 1;
        const isMultiQuestion = (currentActivity.type === 'mcq' || currentActivity.type === 'qa') && totalQuestions > 1;
        
        // If submitted but NOT the last question in a multi-question activity, show waiting message
        if(submitted && isMultiQuestion && !isLastQuestion) {
            return (
                <div className="text-center animate-fade-in">
                    <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
                        <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-green-600">Answer Submitted!</h2>
                    <p className="mt-2 text-gray-600 text-lg">
                        Question {currentIndex + 1} of {totalQuestions} completed
                    </p>
                    <p className="mt-4 text-gray-800 font-semibold text-xl">
                        Loading Question {currentIndex + 2}...
                    </p>
                    <div className="mt-4 flex justify-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600"></div>
                    </div>
                </div>
            )
        }
        
        // Show final thank you only for last question or single-question activities
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
                // Get the current question based on currentQuestionIndex
                const currentMcqQuestion = currentActivity.questions?.[currentIndex] || currentActivity;
                const totalQuestions = currentActivity.questions?.length || 1;
                return (
                    <div className="w-full animate-fade-in">
                        {/* Question Number Indicator */}
                        {totalQuestions > 1 && (
                            <div className="mb-4 text-center">
                                <span className="inline-block bg-teal-600 text-white px-4 py-2 rounded-full font-semibold shadow-md">
                                    Question {currentIndex + 1} of {totalQuestions}
                                </span>
                            </div>
                        )}
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentMcqQuestion.question || currentActivity.question}</h2>
                        {currentMcqQuestion.image && <img src={currentMcqQuestion.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(currentMcqQuestion.options || currentActivity.options || []).map((opt, i) => (
                                <button key={i} onClick={() => handleSubmit(opt.text)} className="p-4 bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:bg-teal-700 transition transform hover:scale-105">
                                    {opt.text}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 'wordcloud':
                 return (
                    <div className="w-full animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentActivity.question}</h2>
                        {currentActivity.image && <img src={currentActivity.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            <textarea
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                                rows="4"
                                placeholder="Type your word(s) here..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                            ></textarea>
                            <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">
                                Submit
                            </button>
                        </form>
                    </div>
                )
             case 'reviews':
                 const reviewOptions = currentActivity.settings.reviewStyle === 'emoji' 
                    ? ['😠', '🙁', '😐', '🙂', '😄'] 
                    : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
                return (
                    <div className="w-full animate-fade-in text-center">
                         <h2 className="text-2xl font-bold text-gray-800 mb-6">{currentActivity.question}</h2>
                         <div className="flex justify-center space-x-2 md:space-x-4">
                             {reviewOptions.map((opt, i) => (
                                 <button key={i} onClick={() => handleSubmit(opt)} className="text-4xl md:text-5xl p-2 rounded-full hover:bg-gray-200 transition-colors transform hover:scale-110">
                                     {opt}
                                 </button>
                             ))}
                         </div>
                    </div>
                )
            case 'feedback':
                return (
                   <div className="w-full animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentActivity.question}</h2>
                        <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                            <textarea
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                                rows="4"
                                placeholder="Type your feedback here..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                            ></textarea>
                            <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">
                                Submit
                            </button>
                        </form>
                   </div>
                )
                case 'qa':
                    const currentQuestion = currentActivity.questions?.[0];
                    return (
                        <div className="w-full animate-fade-in">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentQuestion?.text}</h2>
                                {timeLeft !== null && (
                                    <div className={`text-center mb-4 ${timeLeft <= 5 ? 'text-teal-600 animate-pulse' : 'text-gray-600'}`}>
                                        <p className="text-lg font-bold">
                                            ⏱️ Time Remaining: {timeLeft} second{timeLeft !== 1 ? 's' : ''}
                                        </p>
                                        {timeLeft <= 5 && <p className="text-sm">Hurry up!</p>}
                                    </div>
                                )}
                            </div>
                            <form onSubmit={(e) => {e.preventDefault(); handleSubmit(feedbackText)}}>
                                {currentQuestion?.type === 'short' && (
                                    <input
                                        type="text"
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                                        placeholder="Type your answer..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    />
                                )}
                                {currentQuestion?.type === 'long' && (
                                    <textarea
                                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                                        rows="6"
                                        placeholder="Type your detailed answer here..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    ></textarea>
                                )}
                                {currentQuestion?.type === 'multiple' && (
                                    <div className="space-y-2">
                                        {(currentQuestion?.options || []).map((opt, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSubmit(opt)}
                                                className="w-full p-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition transform hover:scale-105"
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {currentQuestion?.type !== 'multiple' && (
                                    <button type="submit" className="w-full mt-4 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">
                                        Submit Answer
                                    </button>
                                )}
                            </form>
                        </div>
                    )
                case 'wordle':
      return (
           <WordleGame
               word={currentActivity.wordleAnswer?.toUpperCase() || ''}
               onSubmit={(guess) => console.log('Guess submitted:', guess)}
               roomCode={enteredCode}
  studentId={window.crypto.randomUUID()}
          />
           );
            default:
                 return <p>Unknown activity type</p>;
        }
    }

    if (!joined) {
        return (
             <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Join Session</h1>
                    <p className="text-center text-gray-600 mb-6">Enter your name and the session code.</p>
                    <form onSubmit={handleJoin} className="bg-white shadow-lg rounded-lg p-8">
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Full Name *</label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={e => setStudentName(e.target.value)}
                                placeholder="Enter your full name"
                                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                            />
                            <p className="text-xs text-gray-500 mt-1">Please enter first and last name</p>
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700 font-semibold mb-2">Room Code *</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    maxLength="6"
                                    value={enteredCode}
                                    onChange={e => setEnteredCode(e.target.value.trim().toUpperCase())}
                                    placeholder="AANANN"
                                    className="flex-1 p-4 text-center text-2xl tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                                />
                                <button
                                    type="button"
                                    onClick={handleCopyCode}
                                    disabled={!enteredCode}
                                    className="p-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Copy room code"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                        {codeCopied && <p className="text-green-600 text-center mt-2 text-sm font-semibold">✓ Code copied!</p>}
                        {error && <p className="text-teal-500 text-center mt-4">{error}</p>}
                        <button type="submit" className="w-full mt-6 bg-teal-600 text-white font-bold py-3 rounded-lg hover:bg-teal-700 transition shadow-md">
                            Join
                        </button>
                    </form>
                     <button onClick={() => setView('home')} className="mt-6 text-gray-600 hover:text-teal-600 transition">
                         Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4 text-center relative">
            {/* Close Button - Top Right */}
            <button 
                onClick={() => setView('home')}
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white font-bold p-3 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 z-50"
                title="Exit Session"
            >
                <span className="text-xl">✕</span>
                <span className="hidden sm:inline">Exit</span>
            </button>

            {!sessionData.isSessionLive ? (
                <div className="animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800">You're in!</h2>
                    <p className="mt-2 text-gray-600">Waiting for the teacher to start the interaction...</p>
                    <div className="mt-6">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-xl">
                    {renderActivity()}
                </div>
            )}
        </div>
    );
};


// --- Home Page ---

export default StudentView;
