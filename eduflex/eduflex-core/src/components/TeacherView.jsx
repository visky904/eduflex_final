import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, getDocs, getDoc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { playSound, generateRoomCode } from '../utils/helpers';
import { generatePDF,generateCombinedPDF } from '../utils/pdfGenerator';
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
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
    
    const [allParticipants, setAllParticipants] = useState([]);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [sessionReport, setSessionReport] = useState(null);
    const [completedActivities, setCompletedActivities] = useState([]);
    const sessionStartTimeRef = React.useRef(null);

    // Gamification states
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [enableGamification, setEnableGamification] = useState(true);
    
    // Audio Ref
    const bgMusicRef = useRef(new Audio('/game-music.mp3'));

    const [activity, setActivity] = useState({
        type: 'mcq',
        question: '',
        image: null,
        options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
        settings: { markCorrect: true, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji' }
    });

    // --- Handle Gamification Toggle & Music ---
    useEffect(() => {
        const music = bgMusicRef.current;
        music.loop = true;
        music.volume = 0.3; 

        const updateGamificationState = async () => {
            if (!roomCode) return;
            const sessionRef = doc(db, 'sessions', roomCode);
            await updateDoc(sessionRef, { isGamified: enableGamification }).catch(err => console.log(err));
        };

        if (enableGamification) {
            music.play().catch(e => console.log("Audio waiting for interaction"));
        } else {
            music.pause();
            music.currentTime = 0;
        }

        updateGamificationState();

        return () => {
            music.pause();
        };
    }, [enableGamification, roomCode]);

    // --- Listener for Permanent Participants ---
    useEffect(() => {
        if (!roomCode) return;
        const participantsCol = collection(db, 'sessions', roomCode, 'participants');
        const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
            const participants = [];
            snapshot.forEach((doc) => participants.push(doc.data()));
            setAllParticipants(participants);
        });
        return () => unsubscribe();
    }, [roomCode]);

    // --- Global Point Processing Engine ---
    useEffect(() => {
        if (!isSessionLive || !enableGamification || liveResponses.length === 0) return;

        const processScores = async () => {
            const updates = [];
            const unscoredResponses = liveResponses.filter(r => !r.pointsAwarded);
            
            if (unscoredResponses.length === 0) return;

            const activityStartTime = Date.now() - 10000; 

            for (const response of unscoredResponses) {
                if (!response.studentName) continue;

                const isFirst = liveResponses.length === 1; 
                const { points, badges } = calculatePoints(response, activityStartTime, isFirst, enableGamification, activity);

                if (points > 0) {
                    const participantRef = doc(db, 'sessions', roomCode, 'participants', response.studentName);
                    updates.push(
                        setDoc(participantRef, {
                            score: increment(points),
                            badges: arrayUnion(...badges),
                            lastActive: new Date()
                        }, { merge: true }).catch(err => console.error("Score update failed"))
                    );

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
                    responsesMap.set(doc.id, { id: doc.id, ...data });
                }
            });
            setLiveResponses(Array.from(responsesMap.values()));
        });
        return () => unsubscribe();
    }, [roomCode, activity]);

    // Load Data & History
    useEffect(() => {
        if (!roomCode) return;
        const colRef = collection(db, "sessions", roomCode, "completedActivities");
        const unsub = onSnapshot(colRef, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCompletedActivities(list.sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
        });
        return () => unsub();
    }, [roomCode]);

    useEffect(() => {
        const savedHistory = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        setSessionHistory(savedHistory);
    }, []);

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
                    if (data.isGamified !== undefined) setEnableGamification(data.isGamified);
                }
            } catch (error) { console.error("Error loading session:", error); }
        };
        loadSession();
    }, [roomCode]);

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
            } catch (error) { console.error("Error saving session:", error); }
        };
        const timer = setTimeout(() => { if (sessionTopic || activity.question) saveSession(); }, 1000);
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
        const baseSettings = { markCorrect: false, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji' };
        const newActivity = { question: '', image: null, options: [], settings: baseSettings };

        if (currentActivityType === 'mcq') {
            setActivity({ ...newActivity, type: 'mcq', questions: [{ id: 1, question: '', image: null, options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] }], currentQuestionIndex: 0, settings: { ...baseSettings, markCorrect: true } });
        } else if (currentActivityType === 'wordcloud') {
             setActivity({ ...newActivity, type: 'wordcloud', settings: { ...baseSettings, allowMultiple: true, profanityFilter: false } });
        } else if (currentActivityType === 'reviews') {
             setActivity({ ...newActivity, type: 'reviews', settings: { ...baseSettings, reviewStyle: 'emoji' } });
        } else if (currentActivityType === 'feedback') {
            setActivity({ ...newActivity, type: 'feedback', settings: { ...baseSettings, profanityFilter: true }});
        } else if (currentActivityType === 'qa') {
            setActivity({ ...newActivity, type: 'qa', questions: [{ id: 1, text: '', type: 'short', options: [], correctAnswer: '', timeLimit: 60 }], currentQuestionIndex: 0, settings: { ...baseSettings } });
        } else if (currentActivityType === 'wordle') {
            setActivity({ ...newActivity, type: 'wordle', question: 'Enter the secret 5-letter word for Wordle', settings: { ...baseSettings }, wordleAnswer: '' });
        }
    }, [currentActivityType]);

    useEffect(() => {
        if (!roomCode) return;
        const sessionRef = doc(db, "sessions", roomCode);
        const load = async () => {
            const snap = await getDoc(sessionRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.activityStartTime) sessionStartTimeRef.current = data.activityStartTime;
            }
        };
        load();
    }, [roomCode]);

    const liveResults = useMemo(() => {
        if (!activity) return { total: 0, responses: [] };
        const total = liveResponses.length;

        if (activity.type === 'mcq') {
            const currentMcqQ = activity.questions?.[activity.currentQuestionIndex || 0] || activity;
            const options = currentMcqQ.options || activity.options || [];
            
            const relevantResponses = liveResponses.filter(r => 
                (r.questionIndex === undefined && activity.currentQuestionIndex === 0) || 
                r.questionIndex === activity.currentQuestionIndex
            );

            const responses = options.map(option => {
                const count = relevantResponses.filter(r => r.answer === option.text).length;
                return { option: option.text, count };
            });
            return { total: relevantResponses.length, responses };
        }
        if (activity.type === 'reviews') {
             const reviewOptions = activity.settings.reviewStyle === 'emoji' ? ['😠', '🙁', '😐', '🙂', '😄'] : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
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
                words.forEach(word => { if (word) wordMap[word.toLowerCase()] = (wordMap[word.toLowerCase()] || 0) + 1; });
            });
            const words = Object.entries(wordMap).map(([text, value]) => ({ text, value }));
            return { total, words };
        }
        if (activity.type === 'feedback') {
            const feedbackResponses = liveResponses.filter(r => r.type === 'feedback');
            return { total, responses: feedbackResponses };
        }
        if (activity.type === 'qa') {
            const qaResponses = liveResponses.filter(r => r.type === 'qa');
            return { total, responses: qaResponses };
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
        navigator.clipboard.writeText(shareLink).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
    };

    const handleStartSession = async () => {
        if (activity.type === 'qa') {
            if (!activity.questions || activity.questions.length === 0 || !activity.questions.some(q => q.text && q.text.trim() !== '')) {
                alert('Please enter at least one question.'); return;
            }
        } else if (activity.type === 'mcq') {
            if (!activity.questions || activity.questions.length === 0 || !activity.questions.some(q => q.question && q.question.trim() !== '')) {
                alert('Please enter at least one question.'); return;
            }
        } else {
            if (!activity.question || activity.question.trim() === '') {
                alert('Please enter a question.'); return;
            }
        }
        sessionStartTimeRef.current = Date.now();

        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((doc) => deletePromises.push(deleteDoc(doc.ref)));
        await Promise.all(deletePromises);

        const activityToSend = { ...activity, activityId: Date.now() };
        if ((activity.type === 'mcq' || activity.type === 'qa') && activity.questions) {
            activityToSend.currentQuestionIndex = 0;
        }

        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            isSessionLive: true,
            currentActivity: activityToSend,
             activityStartTime: Date.now(),
        });
        setIsSessionLive(true);
    };

   const handleStopSession = async () => {
        if (!roomCode) return;
        const mainSessionRef = doc(db, "sessions", roomCode);
        await updateDoc(mainSessionRef, { isSessionLive: false, currentActivity: null });
        
        let responsesToSend = liveResponses;
        let report;

        if (activity.type === "wordle") {
            const progressRef = collection(db, "sessions", roomCode, "wordleProgress");
            const snap = await getDocs(progressRef);
            responsesToSend = snap.docs.map(d => ({ studentName: d.id, ...d.data() }));
            report = generateSessionReport(activity, responsesToSend, sessionTopic, roomCode);
        } else {
            report = generateSessionReport(activity, liveResponses, sessionTopic, roomCode);
        }

        setSessionReport(report);
        const activityRef = doc(db, "sessions", roomCode, "completedActivities", String(Date.now()));
        await setDoc(activityRef, {
            timestamp: new Date().toISOString(),
            activityType: activity.type,
            activityDetails: activity,
            responses: responsesToSend,
            report,
        });

        const historyEntry = {
            id: Date.now(),
            roomCode,
            topic: sessionTopic || "Untitled Session",
            activityType: activity.type,
            timestamp: new Date().toLocaleString(),
            responseCount: liveResponses.length,
            activityDetails: activity,
            responses: liveResponses,
            report,
        };

        const savedHistory = JSON.parse(localStorage.getItem("sessionHistory") || "[]");
        const newHistory = [...savedHistory, historyEntry];
        localStorage.setItem("sessionHistory", JSON.stringify(newHistory));
        setSessionHistory(newHistory);
        setIsSessionLive(false);
    };

    const handleNextQuestion = async () => {
        if (!activity.questions || activity.questions.length === 0) return;
        const currentIndex = activity.currentQuestionIndex || 0;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= activity.questions.length) {
            alert('This is the last question. Click "Stop" to finish.');
            return;
        }
        
        const updatedActivity = { ...activity, currentQuestionIndex: nextIndex };
        setActivity(updatedActivity);
        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, { currentActivity: updatedActivity });
        playSound('notification');
    };

    const handleDeleteFeedback = async (id) => {
        if (!roomCode || !id) return;
        const responseDoc = doc(db, 'sessions', roomCode, 'responses', id);
        try { await deleteDoc(responseDoc); } catch (error) { console.error("Error deleting:", error); }
    };

    // ✅ SCORING ENGINE
    const calculatePoints = (response, activityStartTime, isFirstResponse = false, enableGamification, activity) => {
        if (!enableGamification) return { points: 0, badges: [] };
        
        let points = 10; 
        const badges = [];

        if (isFirstResponse) badges.push("🎯");

        if (activity.type === "mcq" && response.answer) {
            const qIndex = response.questionIndex !== undefined ? response.questionIndex : activity.currentQuestionIndex;
            const currentQ = activity.questions?.[qIndex] || activity;
            const correctOption = currentQ.options?.find((opt) => opt.isCorrect);
            const isCorrect = correctOption && response.answer.trim().toLowerCase() === correctOption.text.trim().toLowerCase();

            if (isCorrect) {
                points += 50; 
                badges.push("✅");
                if (response.timestamp && activityStartTime) {
                    const responseTime = response.timestamp.toMillis();
                    const timeTaken = (responseTime - activityStartTime) / 1000;
                    if (timeTaken <= 3) { points += 10; badges.push("⚡"); }
                }
            }
        }

        if (activity.type === "qa" && response.answer) {
            const wordCount = response.answer.split(" ").length;
            if (wordCount > 50) { points += 15; badges.push("📝"); }
            else if (wordCount > 20) { points += 10; }
            else if (wordCount > 10) { points += 5; }
        }
        
        if (activity.type === 'wordle' && response.answer) {
            if (response.answer.toUpperCase() === (activity.wordleAnswer || '').toUpperCase()) {
                points += 50; 
                badges.push('🧠'); 
            }
        }

        return { points, badges };
    };

    // Update leaderboard
    useEffect(() => {
        if (!enableGamification || !isSessionLive || liveResponses.length === 0) {
            if (!isSessionLive) setLeaderboard([]);
            return;
        }

        const activityStartTime = sessionStartTimeRef.current || Date.now();
        const playerData = new Map();
        let firstResponseStudentName = null;

        if (liveResponses.length > 0) {
            const sortedByTime = [...liveResponses].sort((a, b) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return a.timestamp.toMillis() - b.timestamp.toMillis();
            });
            firstResponseStudentName = sortedByTime[0]?.studentName;
        }

        liveResponses.forEach((response) => {
            const playerName = response.studentName || "Anonymous";
            const isFirstResponse = playerName === firstResponseStudentName;
            const { points, badges } = calculatePoints(response, activityStartTime, isFirstResponse, enableGamification, activity);

            if (playerData.has(playerName)) {
                const existing = playerData.get(playerName);
                playerData.set(playerName, {
                    points: existing.points + points,
                    badges: [...new Set([...existing.badges, ...badges])],
                });
            } else {
                playerData.set(playerName, { points, badges });
            }
        });

        const leaderboardData = Array.from(playerData.entries())
            .map(([name, data]) => ({ name, points: data.points, badges: data.badges }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 10); 

        setLeaderboard(leaderboardData);
    }, [liveResponses, enableGamification, isSessionLive, activity]);

    const sidebarItems = [
        { id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> },
        { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> },
        { id: 'reviews', name: 'Reviews', icon: <IconSmile /> },
        { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> },
        { id: 'qa', name: 'Q&A Session', icon: <IconHelpCircle /> },
        { id: 'wordle', name: 'Wordle Game', icon: <IconListCheck /> },
        { id: 'analytics', name: 'Analytics / Reports', icon: <IconListCheck /> },
    ];

    return (
        // ✅ DYNAMIC INTERACTIVE BACKGROUND
        <div className="flex h-screen font-sans text-gray-100 overflow-hidden relative transition-colors duration-1000">
            
            {/* Background Layer */}
            <div 
                className="absolute inset-0 z-0 transition-all duration-1000"
                style={enableGamification ? {
                    // GAMIFIED: Cyberpunk Purple/Blue/Black with Neon Glows
                    backgroundColor: '#000000', 
                    backgroundImage: `
                        radial-gradient(circle at 15% 20%, rgba(168, 85, 247, 0.25), transparent 40%), /* Purple Neon Top Left */
                        radial-gradient(circle at 85% 80%, rgba(59, 130, 246, 0.25), transparent 40%), /* Blue Neon Bottom Right */
                        linear-gradient(135deg, #2e1065 0%, #172554 50%, #020617 100%), /* Deep Purple -> Deep Blue -> Black */
                        url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23a78bfa' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
                    `,
                    backgroundBlendMode: 'screen, screen, normal, overlay'
                } : {
                    // DEFAULT: Deep Red & Black Gradient
                    background: 'linear-gradient(to bottom right, #111827, #7f1d1d, #000000)'
                }}
            ></div>

            {/* Sidebar */}
            <aside className={`relative z-10 bg-black/40 backdrop-blur-md border-r ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} text-gray-300 flex flex-col transition-all duration-300 ease-in-out shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className={`flex items-center justify-between p-4 border-b ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} ${isSidebarOpen ? 'h-16' : ''}`}>
                    {isSidebarOpen && <h1 className={`text-xl font-bold whitespace-nowrap tracking-wider ${enableGamification ? 'text-purple-400' : 'text-red-600'}`}>EDU<span className="text-white">FLEX</span></h1>}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg hover:bg-gray-800 transition-colors ${enableGamification ? 'text-purple-400' : 'text-red-600'}`}>
                        {isSidebarOpen ? <IconChevronLeft /> : <div className="text-2xl font-bold">»</div>}
                    </button>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {sidebarItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === "analytics") {
                                    setShowAnalyticsModal(true);  
                                    return;
                                }
                                setCurrentActivityType(item.id);
                            }}
                            className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${isSidebarOpen ? '' : 'justify-center'} ${currentActivityType === item.id ? (enableGamification ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-purple-400/50' : 'bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]') : 'hover:bg-gray-800 hover:text-white'}`}
                        >
                            {item.icon}
                            {isSidebarOpen && <span className="whitespace-nowrap ml-2">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
                 <header className={`bg-black/20 backdrop-blur-md shadow-md p-4 border-b ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} sticky top-0 z-20`}>
                    <div className="flex justify-center mb-4">
                        <input type="text" placeholder="Enter Session Topic..." className={`w-full max-w-md text-xl font-semibold text-white bg-transparent border-b-2 ${enableGamification ? 'border-purple-500 focus:border-purple-300' : 'border-red-600 focus:border-red-400'} outline-none p-2 transition placeholder-gray-500 text-center`} value={sessionTopic} onChange={e => setSessionTopic(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                         <div className="text-center">
                            <span className="text-xs text-gray-400">Room Code</span>
                            <div className="flex items-center gap-2">
                                <p className={`text-2xl font-bold tracking-widest drop-shadow-md ${enableGamification ? 'text-purple-400 animate-pulse' : 'text-red-600'}`}>{roomCode}</p>
                                <button onClick={() => {navigator.clipboard.writeText(roomCode); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);}} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition border border-gray-700">📋</button>
                                {linkCopied && <span className="text-green-400 text-sm font-semibold">✓ Copied!</span>}
                            </div>
                        </div>
                        <div className="h-8 w-px bg-gray-700"></div>
                        <button onClick={() => setShowShareLink(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition"><IconLink /> <span className="ml-1">Link</span></button>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition"><IconUsers /> <span className="ml-1">({allParticipants.length})</span></button>
                        <button onClick={() => {playSound('click'); setShowLeaderboard(true);}} className="flex items-center bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition shadow-lg">🏆 <span className="ml-1">Leaderboard</span></button>
                        
                        {/* GAMIFY TOGGLE */}
                        <label className={`flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 border transition ${enableGamification ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-gray-700'}`}>
                            <input type="checkbox" checked={enableGamification} onChange={(e) => {setEnableGamification(e.target.checked); playSound(e.target.checked ? 'success' : 'click');}} className={`w-4 h-4 ${enableGamification ? 'accent-purple-500' : 'accent-red-600'}`} /><span>🎮 Gamify</span>
                        </label>
                        
                        <button onClick={() => {if (window.confirm('Are you sure you want to exit?')) setView('home');}} className="bg-red-900/50 text-red-200 px-4 py-2 rounded-lg hover:bg-red-900 border border-red-900 transition">🚪</button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {renderCreator()}
                    
                    {/* ✅ RE-ADDED: WORDLE STATS SIDEBAR (Now below creator) */}
                    {activity.type === "wordle" && (
                        <div className={`mt-6 p-4 rounded-lg border backdrop-blur-sm transition-colors ${
                            enableGamification 
                            ? 'bg-black/40 border-purple-500/30 text-gray-200' 
                            : 'bg-white/10 border-red-500/30 text-gray-100'
                        }`}>
                            <h4 className={`text-lg font-bold mb-4 text-center ${enableGamification ? 'text-purple-400' : 'text-red-400'}`}>
                                Wordle Live Progress
                            </h4>
                            <div className="flex justify-around text-center">
                                <div><span className="block text-green-400 font-bold text-2xl">{wordleStats.won}</span><span className="text-sm opacity-75">Correct</span></div>
                                <div><span className="block text-yellow-400 font-bold text-2xl">{wordleStats.attempting}</span><span className="text-sm opacity-75">Attempting</span></div>
                                <div><span className="block text-red-400 font-bold text-2xl">{wordleStats.lost}</span><span className="text-sm opacity-75">Failed</span></div>
                                <div><span className="block text-white font-bold text-2xl">{wordleStats.total}</span><span className="text-sm opacity-75">Total</span></div>
                            </div>
                        </div>
                    )}
                </div>
                
                 <footer className={`bg-black/20 backdrop-blur-md p-4 border-t ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} flex items-center justify-center sticky bottom-0 z-20`}>
                    {isSessionLive && (
                        <div className="mr-6 text-center">
                             <p className="font-bold text-green-400 animate-pulse">● LIVE</p>
                             <button onClick={() => setShowResults(true)} className="text-sm text-gray-400 hover:text-white underline">View Results</button>
                        </div>
                    )}
                    <button onClick={handleStartSession} disabled={isSessionLive} className={`px-8 py-3 text-lg font-bold rounded-full transition text-white ${isSessionLive ? 'bg-gray-700 cursor-not-allowed' : (enableGamification ? 'bg-purple-600 hover:bg-purple-700 shadow-[0_0_25px_rgba(168,85,247,0.6)] border border-purple-400/50' : 'bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.6)]') + ' hover:-translate-y-1'}`}>
                        {isSessionLive ? 'Session Active' : 'Start Interaction'}
                    </button>
                    {isSessionLive && (activity.type === 'mcq' || activity.type === 'qa') && activity.questions && activity.questions.length > 1 && (
                        <button onClick={handleNextQuestion} disabled={(activity.currentQuestionIndex || 0) >= activity.questions.length - 1} className={`ml-4 px-6 py-3 text-lg font-bold rounded-full transition shadow-lg transform hover:-translate-y-1 ${ (activity.currentQuestionIndex || 0) >= activity.questions.length - 1 ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white' }`}>
                            ➡️ Next
                        </button>
                    )}
                    {isSessionLive && (
                         <button onClick={() => {if (window.confirm('Stop session?')) handleStopSession();}} className="ml-4 px-8 py-3 text-lg font-bold rounded-full transition bg-gray-700 hover:bg-gray-600 text-white shadow-lg">
                            ⏹️ Stop
                        </button>
                    )}
                </footer>
            </main>
            
            {/* (Modals remain same) */}
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
                            <button onClick={() => setShowResults(false)} className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
                            <button onClick={() => {const report = generateSessionReport(activity, liveResponses, sessionTopic, roomCode); generatePDF(report);}} className="flex-1 bg-blue-600 text-gray-900 px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold">📥 Download PDF</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showAnalyticsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4 text-teal-700">📊 Session Analytics</h2>
                        {completedActivities.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No activities have been completed yet.</p>
                        ) : (
                            <div className="space-y-4">
                                  <button
        onClick={() => generateCombinedPDF(completedActivities.map(a => a.report))}
        className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-bold shadow-lg">
        📄 Download Full Session Report
    </button>
                                {completedActivities.map((act) => (
                                    <div key={act.id} className="p-4 bg-gray-50 rounded-lg border">
                                        <div className="flex justify-between">
                                            <div>
<p className="text-xl font-bold text-gray-900 tracking-wide">{act.activityType.toUpperCase()}</p>
                                                <p className="text-sm text-gray-500">{new Date(act.timestamp).toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => generatePDF(act.report)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">📥 Download PDF</button>
                                        </div>
                                        <button onClick={() => { setSessionReport(act.report); setShowReport(true); }} className="mt-3 w-full bg-gray-100 text-gray-900 py-2 rounded hover:bg-gray-200">View Detailed Analytics</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setShowAnalyticsModal(false)} className="mt-6 w-full bg-gray-200 text-gray-900 py-2 rounded hover:bg-gray-300">Close</button>
                    </div>
                </div>
            )}
            {showLeaderboard && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-2xl p-8 w-full max-w-3xl border-4 border-yellow-400">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600">🏆 Leaderboard</h2>
                            <button onClick={() => { playSound('click'); setShowLeaderboard(false); }} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors">✕ Close</button>
                        </div>
                        {allParticipants.length === 0 ? (
                            <div className="text-center py-12"><p className="text-gray-600 text-lg">No players yet.</p></div>
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
                                        {allParticipants.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, idx) => (
                                            <tr key={idx} className="border-b border-gray-200 hover:bg-yellow-50">
                                                <td className="px-6 py-4"><span className="text-2xl font-bold text-gray-600">#{idx + 1}</span></td>
                                                <td className="px-6 py-4"><span className="text-lg font-semibold text-gray-800">{player.name}</span></td>
                                                <td className="px-4 py-4 text-center"><div className="flex justify-center gap-1 flex-wrap">{player.badges && player.badges.map((b, i) => (<span key={i} className="text-lg">{b}</span>))}</div></td>
                                                <td className="px-6 py-4 text-right"><span className="text-2xl font-bold text-yellow-600">{player.score || 0} XP</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {showParticipants && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-2xl p-6 w-full max-w-md text-gray-900">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Room Participants <span className="text-teal-600">({allParticipants.length})</span></h3>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-inner max-h-80 overflow-y-auto">
                            <ul className="divide-y divide-gray-100">
                                {allParticipants.map((p, index) => (
                                    <li key={index} className="p-3 flex items-center hover:bg-teal-50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">{(p.name || 'A').charAt(0).toUpperCase()}</div>
                                        <span className="font-medium text-gray-800">{p.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button onClick={() => setShowParticipants(false)} className="mt-6 w-full bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-semibold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const WordleGame = ({ word, onSubmit, roomCode, studentId }) => {
    return <div></div>; 
};

export default TeacherView;