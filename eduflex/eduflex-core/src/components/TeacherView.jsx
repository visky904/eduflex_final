import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
// ✅ FIX 1: Added arrayUnion to the imports here
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, getDocs, getDoc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { playSound, generateRoomCode } from '../utils/helpers';
import { generatePDF } from '../utils/pdfGenerator';
import { generateSessionReport } from '../utils/sessionUtils';
import { McqCreator, WordCloudCreator, ReviewsCreator, FeedbackCreator, QaCreator, WordleCreator, ShortFeedbackCreator } from './activities/ActivityCreators';
import { IconUsers, IconSettings, IconPlus, IconChevronLeft, IconListCheck, IconCloud, IconSmile, IconMessageSquare, IconHelpCircle, IconLink, IconCopy, IconTrash } from './Icons';

const TeacherView = ({ setView, roomCode }) => {
    const [sessionTopic, setSessionTopic] = useState('');
    const [currentActivityType, setCurrentActivityType] = useState('mcq');
    const [wordleStats, setWordleStats] = useState({ total: 0, attempting: 0, won: 0, lost: 0 });
    
    const [showParticipants, setShowParticipants] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showShareLink, setShowShareLink] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSessionLive, setIsSessionLive] = useState(false);
    const [liveResponses, setLiveResponses] = useState([]);
    const [linkCopied, setLinkCopied] = useState(false);
    
    const [allParticipants, setAllParticipants] = useState([]);
    
    const [sessionHistory, setSessionHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [sessionReport, setSessionReport] = useState(null);
    
    // Gamification states
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [enableGamification, setEnableGamification] = useState(true);
    
    const [activity, setActivity] = useState({
        type: 'mcq',
        question: '',
        image: null,
        options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
        settings: { markCorrect: true, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji' }
    });

    // --- Listener for Permanent Participants List ---
    useEffect(() => {
        if (!roomCode) return;

        // Listen to the 'participants' sub-collection
        const participantsCol = collection(db, 'sessions', roomCode, 'participants');
        const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
            const participants = [];
            snapshot.forEach((doc) => {
                participants.push(doc.data());
            });
            setAllParticipants(participants);
        });

        return () => unsubscribe();
    }, [roomCode]);

    // --- Global Point Processing Engine ---
    useEffect(() => {
        if (!isSessionLive || !enableGamification || liveResponses.length === 0) return;

        const processScores = async () => {
            const updates = [];
            
            // 1. Identify responses that haven't been scored yet
            const unscoredResponses = liveResponses.filter(r => !r.pointsAwarded);
            
            if (unscoredResponses.length === 0) return;

            const activityStartTime = Date.now() - 10000; // Fallback

            for (const response of unscoredResponses) {
                const isFirst = liveResponses.length === 1; 
                const { points, badges } = calculatePoints(response, activityStartTime, isFirst, enableGamification, activity);

                if (points > 0) {
                    // 2. Update the Student's PERMANENT record in 'participants'
                    const participantRef = doc(db, 'sessions', roomCode, 'participants', response.studentName);
                    
                    // ✅ FIX 2: Used the imported arrayUnion directly (removed require)
                    updates.push(
                        updateDoc(participantRef, {
                            score: increment(points),
                            badges: arrayUnion(...badges),
                            lastActive: new Date()
                        }).catch(err => console.log("Participant not found, skipping score"))
                    );

                    // 3. Mark response as awarded so we don't count it again
                    const responseRef = doc(db, 'sessions', roomCode, 'responses', response.id);
                    updates.push(updateDoc(responseRef, { pointsAwarded: true }));
                }
            }
            
            if(updates.length > 0) await Promise.all(updates);
        };

        processScores();
    }, [liveResponses, isSessionLive, enableGamification, activity, roomCode]);

    // Listen for Live Responses
    useEffect(() => {
        if (!roomCode || !activity) return;

        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const responsesMap = new Map();
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.type === activity.type) {
                    const studentKey = data.studentName || doc.id;
                    const existingResponse = responsesMap.get(studentKey);
                    
                    if (!existingResponse || 
                        (data.timestamp && existingResponse.timestamp && 
                         data.timestamp.toMillis() > existingResponse.timestamp.toMillis())) {
                        responsesMap.set(studentKey, { id: doc.id, ...data });
                    }
                }
            });
            
            const responses = Array.from(responsesMap.values());
            setLiveResponses(responses);
        });
        
        return () => unsubscribe();
    }, [roomCode, activity]);

    // Load session history from localStorage
    useEffect(() => {
        const savedHistory = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        setSessionHistory(savedHistory);
    }, []);

    // Load session state from Firebase on mount
    useEffect(() => {
        if (!roomCode) return;
        
        const sessionRef = doc(db, 'sessions', roomCode);
        const loadSession = async () => {
            try {
                const docSnap = await getDoc(sessionRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.sessionTopic) setSessionTopic(data.sessionTopic);
                    if (data.currentActivity) {
                        setActivity(data.currentActivity);
                        setCurrentActivityType(data.currentActivity.type);
                    }
                    if (data.isSessionLive !== undefined) setIsSessionLive(data.isSessionLive);
                }
            } catch (error) {
                console.error("Error loading session state:", error);
            }
        };
        
        loadSession();
    }, [roomCode]);

    // Save session configuration to Firebase whenever it changes
    useEffect(() => {
        if (!roomCode) return;
        
        const sessionRef = doc(db, 'sessions', roomCode);
        const saveSession = async () => {
            try {
                await updateDoc(sessionRef, {
                    sessionTopic: sessionTopic,
                    savedActivity: activity,
                    lastUpdated: new Date()
                });
            } catch (error) {
                console.error("Error saving session state:", error);
            }
        };
        
        const timer = setTimeout(() => {
            if (sessionTopic || activity.question) saveSession();
        }, 1000);
        
        return () => clearTimeout(timer);
    }, [roomCode, sessionTopic, activity]);

    useEffect(() => {
      if (!roomCode || activity.type !== "wordle") return;

      const progressCol = collection(db, "sessions", roomCode, "wordleProgress");
      const q = query(progressCol);

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        let total = 0, won = 0, lost = 0, attempting = 0;

        querySnapshot.forEach((doc) => {
          total++;
          const data = doc.data();
          if (data.status === "won") won++;
          else if (data.status === "lost") lost++;
          else attempting++;
        });

        setWordleStats({ total, won, lost, attempting });
      });

      return () => unsubscribe();
    }, [roomCode, activity.type]);

    useEffect(() => {
        const baseSettings = {
            markCorrect: false, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji',
        };
        const newActivity = { question: '', image: null, options: [], settings: baseSettings };

        if (currentActivityType === 'mcq') {
            setActivity({ 
                ...newActivity, 
                type: 'mcq', 
                questions: [{ 
                    id: 1, 
                    question: '', 
                    image: null,
                    options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] 
                }],
                currentQuestionIndex: 0,
                settings: { ...baseSettings, markCorrect: true } 
            });
        } else if (currentActivityType === 'wordcloud') {
             setActivity({ ...newActivity, type: 'wordcloud', settings: { ...baseSettings, allowMultiple: true, profanityFilter: false } });
        } else if (currentActivityType === 'reviews') {
             setActivity({ ...newActivity, type: 'reviews', settings: { ...baseSettings, reviewStyle: 'emoji' } });
        } else if (currentActivityType === 'feedback') {
            setActivity({ ...newActivity, type: 'feedback', settings: { ...baseSettings, profanityFilter: true }});
        } else if (currentActivityType === 'qa') {
            setActivity({
                ...newActivity,
                type: 'qa',
                questions: [{ id: 1, text: '', type: 'short', options: [], correctAnswer: '', timeLimit: 60 }],
                currentQuestionIndex: 0,
                settings: { ...baseSettings }
            });
        } else if (currentActivityType === 'wordle') {
            setActivity({
                ...newActivity,
                type: 'wordle',
                question: 'Enter the secret 5-letter word for Wordle',
                settings: { ...baseSettings },
                wordleAnswer: '',
            });
        }
        
    }, [currentActivityType]);
    
    const liveResults = useMemo(() => {
        if (!activity) return { total: 0, responses: [] };

        const total = liveResponses.length;

        if (activity.type === 'mcq') {
            const currentMcqQ = activity.questions?.[activity.currentQuestionIndex || 0] || activity;
            const options = currentMcqQ.options || activity.options || [];
            const responses = options.map(option => {
                const count = liveResponses.filter(r => r.answer === option.text).length;
                return { option: option.text, count };
            });
            return { total, responses };
        }
        
        if (activity.type === 'reviews') {
             const reviewOptions = activity.settings.reviewStyle === 'emoji' 
                ? ['😠', '🙁', '😐', '🙂', '😄'] 
                : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
            const responses = reviewOptions.map(icon => {
                const count = liveResponses.filter(r => r.answer === icon).length;
                return { icon, count };
            });
            return { total, responses };
        }

        if (activity.type === 'wordcloud') {
            const wordMap = {};
            liveResponses.forEach(r => {
                if (r.type !== 'wordcloud') return;
                const words = String(r.answer || '').split(/\s+/);
                words.forEach(word => {
                    if (word) {
                        const cleanedWord = word.toLowerCase();
                        wordMap[cleanedWord] = (wordMap[cleanedWord] || 0) + 1;
                    }
                });
            });
            const words = Object.entries(wordMap).map(([text, value]) => ({ text, value }));
            return { total: words.length, words };
        }
        
        if (activity.type === 'feedback') {
            const feedbackResponses = liveResponses.filter(r => r.type === 'feedback');
            return { total: feedbackResponses.length, responses: feedbackResponses };
        }

        if (activity.type === 'qa') {
            const qaResponses = liveResponses.filter(r => r.type === 'qa');
            return { total: qaResponses.length, responses: qaResponses };
        }

        return { total: 0, responses: [] };
    }, [liveResponses, activity]);
    
    const renderCreator = () => {
        switch (currentActivityType) {
            case 'mcq': return <McqCreator activity={activity} setActivity={setActivity} />;
            case 'wordcloud': return <WordCloudCreator activity={activity} setActivity={setActivity} liveResults={liveResults} />;
            case 'reviews': return <ReviewsCreator activity={activity} setActivity={setActivity} />;
            case 'feedback': return <ShortFeedbackCreator activity={activity} setActivity={setActivity} liveResults={liveResults} onDelete={handleDeleteFeedback} />;
            case 'qa': return <QaCreator activity={activity} setActivity={setActivity} liveResults={liveResults} onDelete={handleDeleteFeedback} />;
            case 'wordle': return <WordleCreator activity={activity} setActivity={setActivity} />;
            default: return null;
        }
    };

    const handleCopyLink = () => {
        const shareLink = `${window.location.origin}/join/${roomCode}`;
        navigator.clipboard.writeText(shareLink).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    };

    const handleStartSession = async () => {
        // Validation
        if (activity.type === 'qa') {
            if (!activity.questions || activity.questions.length === 0 || 
                !activity.questions.some(q => q.text && q.text.trim() !== '')) {
                alert('Please enter at least one question for the Q&A session.');
                return;
            }
        } else if (activity.type === 'mcq') {
            if (!activity.questions || activity.questions.length === 0 || 
                !activity.questions.some(q => q.question && q.question.trim() !== '')) {
                alert('Please enter at least one question for the MCQ session.');
                return;
            }
        } else {
            if (!activity.question || activity.question.trim() === '') {
                alert('Please enter a question or prompt for the activity.');
                return;
            }
        }

        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);

        const activityToSend = { ...activity };
        if ((activity.type === 'mcq' || activity.type === 'qa') && activity.questions) {
            activityToSend.currentQuestionIndex = 0;
        }

        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            isSessionLive: true,
            currentActivity: activityToSend,
        });
        setIsSessionLive(true);
    };

    const handleStopSession = async () => {
        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            isSessionLive: false,
            currentActivity: null,
        });
        
        const report = generateSessionReport(activity, liveResponses, sessionTopic, roomCode);
        setSessionReport(report);
        
        const historyEntry = {
            id: Date.now(),
            roomCode: roomCode,
            topic: sessionTopic || 'Untitled Session',
            activityType: activity.type,
            timestamp: new Date().toLocaleString(),
            responseCount: liveResponses.length,
            activityDetails: activity,
            responses: liveResponses,
            report: report
        };
        
        const savedHistory = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        const newHistory = [...savedHistory, historyEntry];
        localStorage.setItem('sessionHistory', JSON.stringify(newHistory));
        setSessionHistory(newHistory);
        
        setIsSessionLive(false);
        setShowReport(true);
    };

    const handleNextQuestion = async () => {
        if (!activity.questions || activity.questions.length === 0) return;
        
        const currentIndex = activity.currentQuestionIndex || 0;
        const nextIndex = currentIndex + 1;
        
        if (nextIndex >= activity.questions.length) {
            alert('This is the last question. Click "End Session" to finish.');
            return;
        }
        
        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
        
        const updatedActivity = { ...activity, currentQuestionIndex: nextIndex };
        setActivity(updatedActivity);
        
        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            currentActivity: updatedActivity,
        });
        
        playSound('notification');
    };

    const handleDeleteFeedback = async (id) => {
        if (!roomCode || !id) return;
        const responseDoc = doc(db, 'sessions', roomCode, 'responses', id);
        try {
            await deleteDoc(responseDoc);
        } catch (error) {
            console.error("Error deleting feedback:", error);
            alert("Could not delete feedback.");
        }
    };

    const calculatePoints = (response, activityStartTime, isFirstResponse = false) => {
        if (!enableGamification) return { points: 0, badges: [] };
        
        let points = 10; 
        const badges = [];
        
        if (isFirstResponse) badges.push('🎯');
        
        if (activity.type === 'mcq' && response.answer) {
            const correctOption = activity.options.find(opt => opt.isCorrect);
            if (correctOption && response.answer === correctOption.text) {
                points += 20; 
                badges.push('✅');
                
                if (response.timestamp && activityStartTime) {
                    const responseTime = response.timestamp.toMillis();
                    const timeTaken = (responseTime - activityStartTime) / 1000;
                    if (timeTaken <= 3) {
                        points += 15; badges.push('⚡');
                    } else if (timeTaken <= 5) {
                        points += 10;
                    } else if (timeTaken <= 10) {
                        points += 5;
                    }
                }
            }
        }
        
        if (activity.type === 'qa' && response.answer) {
            const wordCount = response.answer.split(' ').length;
            if (wordCount > 50) {
                points += 15; badges.push('📝');
            } else if (wordCount > 20) {
                points += 10;
            } else if (wordCount > 10) {
                points += 5;
            }
        }
        if (activity.type === 'wordle' && response.answer) {
            // If they submitted a response in Wordle mode, it means they won (via onGameEnd)
            if (response.answer.toUpperCase() === (activity.wordleAnswer || '').toUpperCase()) {
                points += 50; // Big reward for solving the puzzle!
                badges.push('🧠'); // "Mastermind" badge
            }
        }
        
        return { points, badges };
    };

    // Update leaderboard (Using the PERMANENT Participants List now)
    useEffect(() => {
        if (!enableGamification || !isSessionLive) return;
        
        // The new logic uses 'allParticipants' for the leaderboard table,
        // but for real-time 'badges' calculation based on current responses, 
        // we keep the logic here or just rely on the DB.
        // We will let the DB be the source of truth.
        
        // Note: We are not setting local 'leaderboard' state here anymore because
        // we render 'allParticipants' directly in the JSX.
    }, [liveResponses, enableGamification, isSessionLive, activity]);
    // Note: You can remove this effect if you only use 'allParticipants' for the leaderboard UI.
    // I kept it empty to show where the old logic was.

    const sidebarItems = [
        { id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> },
        { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> },
        { id: 'reviews', name: 'Reviews', icon: <IconSmile /> },
        { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> },
        { id: 'qa', name: 'Q&A Session', icon: <IconHelpCircle /> },
        { id: 'wordle', name: 'Wordle Game', icon: <IconListCheck /> },
    ];

    return (
        <div className="flex h-screen bg-gray-900 font-sans text-gray-100">
            
            {/* Sidebar - Now Dark Gray/Black */}
            <aside className={`bg-black/40 backdrop-blur-md border-r border-gray-800 text-gray-300 flex flex-col transition-all duration-300 ease-in-out shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className={`flex items-center justify-between p-4 border-b border-gray-800 ${isSidebarOpen ? 'h-16' : ''}`}>
                    {isSidebarOpen && <h1 className="text-xl font-bold text-red-500 whitespace-nowrap tracking-wider">EDU<span className="text-white">FLEX</span></h1>}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-red-500">
                        {isSidebarOpen ? <IconChevronLeft /> : <div className="text-2xl font-bold">»</div>}
                    </button>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {sidebarItems.map(item => (
                        <button key={item.id} onClick={() => setCurrentActivityType(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${isSidebarOpen ? '' : 'justify-center'} ${currentActivityType === item.id ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'hover:bg-gray-800 hover:text-white'}`}
                        >
                            {item.icon}
                            {isSidebarOpen && <span className="whitespace-nowrap ml-2">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content - Dark Gradient */}
            <main className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-br from-gray-900 via-red-950 to-black relative">
                 
                 {/* Header - Dark Glassmorphism */}
                 <header className="bg-black/20 backdrop-blur-md shadow-md p-4 border-b border-gray-800 sticky top-0 z-10">
                    <div className="flex justify-center mb-4">
                        <input 
                            type="text"
                            placeholder="Enter Session Topic..."
                            className="w-full max-w-md text-xl font-semibold text-white bg-transparent border-b-2 border-gray-600 focus:border-red-500 outline-none p-2 transition placeholder-gray-500 text-center"
                            value={sessionTopic}
                            onChange={e => setSessionTopic(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                         <div className="text-center">
                            <span className="text-xs text-gray-400">Room Code</span>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold tracking-widest text-red-500 drop-shadow-md">{roomCode}</p>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(roomCode);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }}
                                    className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition border border-gray-700"
                                >
                                    📋
                                </button>
                                {linkCopied && <span className="text-green-400 text-sm font-semibold">✓ Copied!</span>}
                            </div>
                        </div>

                        <div className="h-8 w-px bg-gray-700"></div>

                        {/* Action Buttons - Updated for Dark Mode */}
                        <button onClick={() => setShowShareLink(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition">
                            <IconLink /> <span className="ml-1">Link</span>
                        </button>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition">
                            <IconUsers /> <span className="ml-1">({allParticipants.length})</span>
                        </button>
                        <button onClick={() => setShowHistory(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition">
                            📊 <span className="ml-1">History</span>
                        </button>
                        <button 
                            onClick={() => {
                                playSound('click');
                                setShowLeaderboard(true);
                            }} 
                            className="flex items-center bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition shadow-lg" 
                        >
                            🏆 <span className="ml-1">Leaderboard</span>
                        </button>
                        <label className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 border border-gray-700 transition">
                            <input 
                                type="checkbox" 
                                checked={enableGamification} 
                                onChange={(e) => {
                                    setEnableGamification(e.target.checked);
                                    playSound(e.target.checked ? 'success' : 'click');
                                }} 
                                className="w-4 h-4 accent-red-600"
                            />
                            <span>🎮 Gamify</span>
                        </label>
                        <button 
                            onClick={() => {
                                if (window.confirm('Are you sure you want to exit?')) {
                                    setView('home');
                                }
                            }} 
                            className="bg-red-900/50 text-red-200 px-4 py-2 rounded-lg hover:bg-red-900 border border-red-900 transition"
                        >
                           🚪
                        </button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {renderCreator()}
                </div>
                
                 <footer className="bg-black/20 backdrop-blur-md p-4 border-t border-gray-800 flex items-center justify-center sticky bottom-0 z-10">
                    {isSessionLive && (
                        <div className="mr-6 text-center">
                             <p className="font-bold text-green-400 animate-pulse">● LIVE</p>
                             <button onClick={() => setShowResults(true)} className="text-sm text-gray-400 hover:text-white underline">
                                 View Results
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={handleStartSession}
                        disabled={isSessionLive}
                        className={`px-8 py-3 text-lg font-bold rounded-full transition text-white ${isSessionLive ? 'bg-gray-700 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:-translate-y-1'}`}
                    >
                        {isSessionLive ? 'Session Active' : 'Start Interaction'}
                    </button>
                    {isSessionLive && (activity.type === 'mcq' || activity.type === 'qa') && activity.questions && activity.questions.length > 1 && (
                        <button 
                            onClick={handleNextQuestion}
                            disabled={(activity.currentQuestionIndex || 0) >= activity.questions.length - 1}
                            className={`ml-4 px-6 py-3 text-lg font-bold rounded-full transition shadow-lg transform hover:-translate-y-1 ${
                                (activity.currentQuestionIndex || 0) >= activity.questions.length - 1
                                    ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            ➡️ Next
                        </button>
                    )}
                    {isSessionLive && (
                         <button 
                            onClick={() => {
                                if (window.confirm('Stop session?')) handleStopSession();
                            }}
                            className="ml-4 px-8 py-3 text-lg font-bold rounded-full transition bg-gray-700 hover:bg-gray-600 text-white shadow-lg"
                        >
                            ⏹️ Stop
                        </button>
                    )}
                </footer>
            </main>

            {/* Analysis Modal */}
            {showResults && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 w-full max-w-lg text-gray-900">
                        <h3 className="text-2xl font-bold mb-2 text-teal-700">Live Results</h3>
                        {(activity.type === 'mcq' || activity.type === 'qa') && activity.questions && activity.questions.length > 1 && (
                            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-center">
                                <p className="text-lg font-bold text-teal-700">
                                    Question {(activity.currentQuestionIndex || 0) + 1} of {activity.questions.length}
                                </p>
                                <p className="text-sm text-teal-600 mt-1">
                                    {activity.questions[activity.currentQuestionIndex || 0]?.question || ''}
                                </p>
                            </div>
                        )}
                        <p className="mb-4 text-gray-600">Total Responses: <span className="font-bold">{liveResults.total}</span></p>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {activity.type === 'mcq' && liveResults.responses.map((res, i) => (
                               <div key={i}>
                                   <div className="flex justify-between mb-1">
                                       <span className="text-base font-medium text-gray-700">{res.option}</span>
                                       <span className="text-sm font-medium text-gray-600">{res.count} votes</span>
                                   </div>
                                   <div className="w-full bg-gray-100 rounded-full h-4">
                                       <div className="bg-teal-600 h-4 rounded-full" style={{width: `${liveResults.total > 0 ? (res.count/liveResults.total)*100 : 0}%`}}></div>
                                   </div>
                               </div>
                           ))}
                           {activity.type === 'reviews' && (
                                <div className="flex justify-around items-center text-center">
                                    {liveResults.responses.map((res, i) => (
                                        <div key={i}>
                                            <p className="text-5xl">{res.icon}</p>
                                            <p className="font-bold text-xl mt-2">{res.count}</p>
                                        </div>
                                    ))}
                                </div>
                           )}
                           {activity.type === 'wordcloud' && (
                               <div className="text-center p-4 bg-white rounded-lg flex flex-wrap justify-center items-center">
                                    {liveResults.words.map((w,i) => (
                                        <span key={i} style={{fontSize: `${Math.min(48, Math.max(12, 10 + w.value*2))}px`, margin: '4px 8px', display: 'inline-block', fontWeight: '600', color: `hsl(${200 + i*25}, 80%, 70%)`}}>
                                            {w.text}
                                        </span>
                                    ))}
                               </div>
                           )}
                           {activity.type === 'feedback' && liveResults.responses.map((res) => (
                               <div key={res.id} className="bg-gray-100 p-3 rounded-lg flex justify-between items-center">
                                   <p className="text-gray-700">{res.answer}</p>
                                   <button onClick={() => handleDeleteFeedback(res.id)} className="text-teal-500 hover:text-teal-400 p-1 rounded-full">
                                        <IconTrash />
                                   </button>
                               </div>
                           ))}
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={() => setShowResults(false)} 
                                className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => {
                                    const report = generateSessionReport(activity, liveResponses, sessionTopic, roomCode);
                                    generatePDF(report);
                                }}
                                className="flex-1 bg-blue-600 text-gray-900 px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                            >
                                📥 Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {activity.type === "wordle" && (
  <div className="mt-4 bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
    <h4 className="text-lg font-bold text-gray-900 mb-2">Wordle Progress</h4>
    <div className="flex justify-around text-gray-600">
      <div><span className="text-green-400 font-bold text-xl">{wordleStats.won}</span><p>Correct</p></div>
      <div><span className="text-yellow-400 font-bold text-xl">{wordleStats.attempting}</span><p>Attempting</p></div>
      <div><span className="text-teal-400 font-bold text-xl">{wordleStats.lost}</span><p>Failed</p></div>
      <div><span className="text-gray-900 font-bold text-xl">{wordleStats.total}</span><p>Total</p></div>
    </div>
  </div>
)}
            
            {/* Participants Modal */}
            {showParticipants && (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
        <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-2xl p-6 w-full max-w-md text-gray-900">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900">
                    Room Participants <span className="text-teal-600">({allParticipants.length})</span>
                </h3>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 shadow-inner max-h-80 overflow-y-auto">
                {allParticipants.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                        {allParticipants.map((p, index) => (
                            <li key={index} className="p-3 flex items-center hover:bg-teal-50 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">
                                    {(p.name || 'A').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-800">
                                    {p.name}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <p>Waiting for students to join...</p>
                    </div>
                )}
            </div>

            <button onClick={() => setShowParticipants(false)} className="mt-6 w-full bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-semibold">
                Close
            </button>
        </div>
    </div>
)}

            {/* Share Link Modal */}
            {showShareLink && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-2xl p-6 w-full max-w-md text-gray-900">
                        <h3 className="text-2xl font-bold mb-4 text-gray-900">Share Session</h3>
                        <p className="text-gray-500 mb-4">Share this link with your students to let them join the session:</p>
                        
                        <div className="bg-gray-100 p-4 rounded-lg mb-4">
                            <p className="text-sm text-gray-500 mb-2">Shareable Link:</p>
                            <input
                                type="text"
                                value={`${window.location.origin}/join/${roomCode}`}
                                readOnly
                                className="w-full p-2 bg-gray-600 text-gray-900 rounded border border-gray-500 text-sm"
                            />
                        </div>

                        <div className="bg-gray-100 p-4 rounded-lg mb-4">
                            <p className="text-sm text-gray-500 mb-2">Room Code:</p>
                            <p className="text-2xl font-bold tracking-widest text-teal-500 text-center">{roomCode}</p>
                        </div>

                        <button
                            onClick={handleCopyLink}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-gray-900 font-bold py-2 px-4 rounded-lg transition flex items-center justify-center mb-2"
                        >
                            <IconCopy /> {linkCopied ? 'Copied!' : 'Copy Link'}
                        </button>

                        <button onClick={() => setShowShareLink(false)} className="w-full bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
                    </div>
                </div>
            )}

            {/* Leaderboard Modal */}
            {showLeaderboard && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-2xl p-8 w-full max-w-3xl border-4 border-yellow-400">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600">
                                🏆 Leaderboard - Top Players
                            </h2>
                            <button
                                onClick={() => {
                                    playSound('click');
                                    setShowLeaderboard(false);
                                }}
                                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                            >
                                ✕ Close
                            </button>
                        </div>
                        
                        {allParticipants.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600 text-lg">No players yet. Start a session to see rankings!</p>
                                <p className="text-gray-500 text-sm mt-2">🎮 Enable gamification to track points</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900">
                                            <th className="px-6 py-4 text-left text-lg font-bold">Rank</th>
                                            <th className="px-6 py-4 text-left text-lg font-bold">Player</th>
                                            <th className="px-4 py-4 text-center text-lg font-bold">Badges</th>
                                            <th className="px-6 py-4 text-right text-lg font-bold">Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allParticipants
                                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                                            .map((player, idx) => (
                                            <tr key={idx} className="border-b border-gray-200 hover:bg-yellow-50">
                                                <td className="px-6 py-4">
                                                    <span className="text-2xl font-bold text-gray-600">#{idx + 1}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-lg font-semibold text-gray-800">{player.name}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center gap-1 flex-wrap">
                                                        {player.badges && player.badges.map((b, i) => (
                                                            <span key={i} className="text-lg">{b}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-2xl font-bold text-yellow-600">{player.score || 0} XP</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        <div className="mt-6 text-center text-sm text-gray-600">
                            <p className="font-semibold">🎯 Points System:</p>
                            <p className="mt-2">Participation: 10 pts | Correct Answer: +20 pts | Speed Bonus: +15 pts | Quality Answer: +15 pts</p>
                            <p className="mt-3 font-semibold">🏅 Badges:</p>
                            <p className="mt-1">🎯 First Response | ✅ Correct | ⚡ Speed Demon | 📝 Wordsmith | 💯 Perfect Score | 👑 Participation King</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Session History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-gray-900 max-h-96 overflow-y-auto">
                        <h3 className="text-2xl font-bold mb-4 text-gray-900">Session History</h3>
                        
                        {sessionHistory.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No sessions recorded yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {sessionHistory.map((entry, idx) => (
                                    <div key={entry.id} className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-lg text-gray-900">{entry.topic}</h4>
                                                <p className="text-sm text-gray-500">Room: {entry.roomCode}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">{entry.timestamp}</p>
                                                <p className="text-teal-400 font-semibold">{entry.activityType.toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded text-sm">
                                            <p className="text-gray-600">Participants: <span className="font-bold text-green-400">{entry.report?.totalParticipants || entry.responseCount}</span></p>
                                            {entry.responses && entry.responses.length > 0 && (
                                                <div className="mt-2 text-xs text-gray-500 max-h-20 overflow-y-auto">
                                                    <p className="font-semibold mb-1">Sample responses:</p>
                                                    {entry.responses.slice(0, 3).map((res, i) => (
                                                        <p key={i} className="text-gray-600">• {res.studentName || 'Anonymous'}: {res.answer?.substring(0, 50) || 'No answer'}</p>
                                                    ))}
                                                    {entry.responses.length > 3 && <p className="text-gray-500 mt-1">... and {entry.responses.length - 3} more</p>}
                                                </div>
                                            )}
                                        </div>
                                        {entry.report && (
                                            <button 
                                                onClick={() => {
                                                    setSessionReport(entry.report);
                                                    setShowReport(true);
                                                    setShowHistory(false);
                                                }}
                                                className="mt-2 w-full bg-blue-600 text-gray-900 text-sm px-3 py-1 rounded hover:bg-blue-700 transition"
                                            >
                                                View Full Report
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <button onClick={() => setShowHistory(false)} className="w-full mt-4 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
                        
                        {sessionHistory.length > 0 && (
                            <button 
                                onClick={() => {
                                    localStorage.setItem('sessionHistory', '[]');
                                    setSessionHistory([]);
                                }}
                                className="w-full mt-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition"
                            >
                                Clear History
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Session Report Modal */}
            {showReport && sessionReport && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="mb-6 border-b pb-4">
                            <h2 className="text-3xl font-bold text-gray-800">Session Report</h2>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Topic: <span className="font-semibold text-gray-800">{sessionReport.topic}</span></p>
                                    <p className="text-gray-600">Room Code: <span className="font-semibold text-gray-800">{sessionReport.roomCode}</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-600">Activity: <span className="font-semibold text-teal-600">{sessionReport.activityType.toUpperCase()}</span></p>
                                    <p className="text-gray-600">Time: <span className="font-semibold text-gray-800">{sessionReport.timestamp}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">📊 Overview</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-200">
                                    <p className="text-3xl font-bold text-blue-600">{sessionReport.totalParticipants}</p>
                                    <p className="text-sm text-gray-600">Participants</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg text-center border border-green-200">
                                    <p className="text-3xl font-bold text-green-600">{sessionReport.participants.length}</p>
                                    <p className="text-sm text-gray-600">Unique Students</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg text-center border border-purple-200">
                                    <p className="text-3xl font-bold text-purple-600">{sessionReport.analysis.totalResponses || sessionReport.totalParticipants}</p>
                                    <p className="text-sm text-gray-600">Total Responses</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">👥 Participants</h3>
                            <div className="bg-gray-50 p-4 rounded-lg border max-h-32 overflow-y-auto">
                                <div className="flex flex-wrap gap-2">
                                    {sessionReport.participants.map((name, idx) => (
                                        <span key={idx} className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 border">
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* MCQ Analysis */}
                        {sessionReport.activityType === 'mcq' && sessionReport.analysis && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">📝 MCQ Analysis</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="font-semibold text-gray-800 mb-2">Question: {sessionReport.analysis.question}</p>
                                    <p className="text-green-600 font-semibold mb-3">Correct Answer: {sessionReport.analysis.correctAnswer}</p>
                                    <p className="text-lg mb-3">Accuracy: <span className="font-bold text-blue-600">{sessionReport.analysis.accuracy}</span></p>
                                    
                                    <h4 className="font-semibold text-gray-700 mb-2">Answer Distribution:</h4>
                                    {Object.entries(sessionReport.analysis.answerDistribution).map(([answer, count]) => (
                                        <div key={answer} className="mb-2">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm font-medium">{answer}</span>
                                                <span className="text-sm font-bold">{count} ({((count / sessionReport.analysis.totalResponses) * 100).toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-300 rounded-full h-2">
                                                <div className="bg-teal-600 h-2 rounded-full" style={{width: `${(count / sessionReport.analysis.totalResponses) * 100}%`}}></div>
                                            </div>
                                        </div>
                                    ))}

                                    <h4 className="font-semibold text-gray-700 mt-4 mb-2">Student Responses:</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {sessionReport.analysis.studentAnswers.map((sa, idx) => (
                                            <div key={idx} className={`p-2 rounded text-sm ${sa.isCorrect ? 'bg-green-100' : 'bg-teal-100'}`}>
                                                <span className="font-medium">{sa.name}:</span> {sa.answer} {sa.isCorrect ? '✅' : '❌'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Wordcloud Analysis */}
                        {sessionReport.activityType === 'wordcloud' && sessionReport.analysis && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">☁️ Wordcloud Analysis</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="font-semibold mb-3">Question: {sessionReport.analysis.question}</p>
                                    <p className="text-gray-600 mb-3">Total unique words: <span className="font-bold">{sessionReport.analysis.totalWords}</span></p>
                                    
                                    <h4 className="font-semibold text-gray-700 mb-2">Top 10 Words:</h4>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {sessionReport.analysis.topWords.map((word, idx) => (
                                            <div key={idx} className="bg-white p-2 rounded border flex justify-between">
                                                <span className="font-medium">{word.word}</span>
                                                <span className="text-teal-600 font-bold">{word.count}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="font-semibold text-gray-700 mb-2">All Responses:</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {sessionReport.analysis.allResponses.map((res, idx) => (
                                            <div key={idx} className="p-2 bg-white rounded text-sm border">
                                                <span className="font-medium">{res.name}:</span> {res.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Q&A Analysis */}
                        {sessionReport.activityType === 'qa' && sessionReport.analysis && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">❓ Q&A Responses</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                        {sessionReport.analysis.responses.map((res, idx) => (
                                            <div key={idx} className="p-3 bg-white rounded border">
                                                <p className="font-semibold text-gray-800">{res.name}</p>
                                                <p className="text-gray-700 mt-1">{res.answer}</p>
                                                <p className="text-xs text-gray-500 mt-1">{res.timestamp}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reviews Analysis */}
                        {sessionReport.activityType === 'reviews' && sessionReport.analysis && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">⭐ Reviews Analysis</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="font-semibold mb-3">Question: {sessionReport.analysis.question}</p>
                                    <p className="text-2xl font-bold text-yellow-600 mb-4">Average Rating: {sessionReport.analysis.averageRating} ⭐</p>
                                    
                                    <h4 className="font-semibold text-gray-700 mb-2">Distribution:</h4>
                                    {Object.entries(sessionReport.analysis.distribution).map(([rating, count]) => (
                                        <div key={rating} className="mb-2">
                                            <div className="flex justify-between mb-1">
                                                <span>{rating}</span>
                                                <span className="font-bold">{count}</span>
                                            </div>
                                            <div className="w-full bg-gray-300 rounded-full h-2">
                                                <div className="bg-yellow-500 h-2 rounded-full" style={{width: `${(count / sessionReport.analysis.totalReviews) * 100}%`}}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Feedback Analysis */}
                        {sessionReport.activityType === 'feedback' && sessionReport.analysis && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-3">💬 Feedback Responses</h3>
                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="font-semibold mb-3">Question: {sessionReport.analysis.question}</p>
                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                        {sessionReport.analysis.feedback.map((fb, idx) => (
                                            <div key={idx} className="p-3 bg-white rounded border">
                                                <p className="font-semibold text-gray-800">{fb.name}</p>
                                                <p className="text-gray-700 mt-1">{fb.text}</p>
                                                <p className="text-xs text-gray-500 mt-1">{fb.timestamp}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button onClick={() => setShowReport(false)} className="flex-1 bg-gray-600 text-gray-900 px-4 py-3 rounded-lg hover:bg-gray-100 transition font-semibold">
                                Close
                            </button>
                            <button 
                                onClick={() => generatePDF(sessionReport)}
                                className="flex-1 bg-blue-600 text-gray-900 px-4 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                            >
                                📥 Download PDF Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
const WordleGame = ({ word, onSubmit, roomCode, studentId }) => {
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentGuess.length !== 5 || gameOver) return;

    const guess = currentGuess.toUpperCase();
    const result = guess.split("").map((ch, i) => {
      if (ch === word[i]) return { letter: ch, color: "bg-green-500" };
      else if (word.includes(ch)) return { letter: ch, color: "bg-yellow-500" };
      else return { letter: ch, color: "bg-gray-100" };
    });

    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);

    let status = "attempting";

    if (guess === word) {
      setGameOver(true);
      setMessage("🎉 Correct! You guessed the word!");
      status = "won";
    } else if (newGuesses.length >= 6) {
      setGameOver(true);
      setMessage(`❌ Out of attempts! The word was ${word}`);
      status = "lost";
    }

    // ✅ Update Firestore with progress
    if (roomCode && studentId) {
      const progressRef = doc(db, "sessions", roomCode, "wordleProgress", studentId);
      await setDoc(progressRef, {
        attempts: newGuesses.length,
        lastGuess: guess,
        status,
        timestamp: new Date(),
      });
    }

    setCurrentGuess("");
  };

    return (
        <div className="text-center animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Guess the Word</h2>
            <div className="space-y-2 mb-6">
                {guesses.map((guess, i) => (
                    <div key={i} className="flex justify-center space-x-1">
                        {guess.map((g, j) => (
                            <div key={j} className={`w-10 h-10 flex items-center justify-center text-gray-900 text-xl font-bold ${g.color} rounded`}>
                                {g.letter}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            {!gameOver ? (
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        maxLength="5"
                        className="p-3 border-2 border-gray-400 rounded-lg text-center text-2xl tracking-widest uppercase focus:ring-2 focus:ring-teal-500 transition"
                        placeholder="Enter guess"
                        value={currentGuess}
                        onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    />
                    <button type="submit" className="ml-4 px-6 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700">
                        Submit
                    </button>
                </form>
            ) : (
                <p className="mt-4 text-xl font-semibold text-gray-700">{message}</p>
            )}
        </div>
    );
};

// --- Student View ---

export default TeacherView;