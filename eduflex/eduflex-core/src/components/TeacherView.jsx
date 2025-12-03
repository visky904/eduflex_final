import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, getDocs, getDoc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { playSound } from '../utils/helpers';
import { generatePDF, generateCombinedPDF } from '../utils/pdfGenerator';
import { generateSessionReport } from '../utils/sessionUtils';
import { McqCreator, WordCloudCreator, ReviewsCreator, FeedbackCreator, QaCreator, WordleCreator, ShortFeedbackCreator } from './activities/ActivityCreators';
import { IconUsers, IconChevronLeft, IconListCheck, IconCloud, IconSmile, IconMessageSquare, IconHelpCircle, IconLink, IconCopy, IconPlus } from './Icons';

const TeacherView = ({ setView, roomCode }) => {
    // --- CONSTANTS ---
    const DEFAULT_STATES = {
        mcq: { type: 'mcq', questions: [{ id: 1, question: '', image: null, options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] }], currentQuestionIndex: 0, settings: { markCorrect: true, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji', isStudentPaced: false } },
        wordcloud: { type: 'wordcloud', question: '', image: null, settings: { allowMultiple: true, profanityFilter: false } },
        reviews: { type: 'reviews', question: '', settings: { reviewStyle: 'emoji' } },
        feedback: { type: 'feedback', question: '', settings: { profanityFilter: true } },
        qa: { type: 'qa', questions: [{ id: 1, text: '', type: 'short', options: [], correctAnswer: '', timeLimit: 60 }], currentQuestionIndex: 0, settings: { isStudentPaced: false } },
        wordle: { type: 'wordle', question: 'Enter the secret 5-letter word for Wordle', wordleAnswer: '', settings: { } }
    };

    // --- STATE ---
    const [sessionTopic, setSessionTopic] = useState('');
    const [currentActivityType, setCurrentActivityType] = useState('mcq');
    const [drafts, setDrafts] = useState(JSON.parse(JSON.stringify(DEFAULT_STATES)));
    const [sessionPassword, setSessionPassword] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    
    const [playlist, setPlaylist] = useState([]); 

    // Helpers
    const activity = drafts[currentActivityType];
    const setActivity = (update) => {
        setDrafts(prev => {
            const currentDraft = prev[currentActivityType];
            const newVal = typeof update === 'function' ? update(currentDraft) : update;
            return { ...prev, [currentActivityType]: newVal };
        });
    };

    const [liveActivity, setLiveActivity] = useState(null);
    const [wordleStats, setWordleStats] = useState({ total: 0, attempting: 0, correct: 0, failed: 0 });
    const [showParticipants, setShowParticipants] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showShareLink, setShowShareLink] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSessionLive, setIsSessionLive] = useState(false);
    const [liveResponses, setLiveResponses] = useState([]);
    const [linkCopied, setLinkCopied] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
    const [allParticipants, setAllParticipants] = useState([]);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [completedActivities, setCompletedActivities] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [enableGamification, setEnableGamification] = useState(true);
    
    // --- AUDIO STATE ---
    const [musicSrc, setMusicSrc] = useState('/game-music.mp3');
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const bgMusicRef = useRef(new Audio('/game-music.mp3'));
    
    // ✅ FIXED: Added missing ref for speed bonus calculation
    const sessionStartTimeRef = useRef(null); 

    // --- EFFECTS ---
    useEffect(() => {
        if(!roomCode) return;
        const fetchPassword = async () => {
            const snap = await getDoc(doc(db, 'sessions', roomCode));
            if(snap.exists()) setSessionPassword(snap.data().password || '');
        };
        fetchPassword();
    }, [roomCode]);

    // Audio Logic
    useEffect(() => {
        const music = bgMusicRef.current;
        music.src = musicSrc; // Allow dynamic source update
        music.loop = true;
        music.volume = 0.3; 
        
        const updateGamificationState = async () => {
            if (!roomCode) return;
            await updateDoc(doc(db, 'sessions', roomCode), { isGamified: enableGamification }).catch(err => console.log(err));
        };

        if (enableGamification) {
            const playPromise = music.play();
            if (playPromise !== undefined) {
                playPromise.then(() => setIsMusicPlaying(true))
                .catch(error => {
                    console.log("Audio Autoplay blocked. Waiting for user interaction.");
                    setIsMusicPlaying(false);
                });
            }
        } else {
            music.pause();
            music.currentTime = 0;
            setIsMusicPlaying(false);
        }
        updateGamificationState();
        
        return () => { music.pause(); };
    }, [enableGamification, roomCode, musicSrc]);

    // Upload Music Handler
    const handleMusicUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setMusicSrc(objectUrl); 
        }
    };

    const toggleMusic = () => {
        if (isMusicPlaying) {
            bgMusicRef.current.pause();
            setIsMusicPlaying(false);
        } else {
            bgMusicRef.current.play().catch(e => alert("Could not play audio. Check browser permissions."));
            setIsMusicPlaying(true);
        }
    };

    useEffect(() => {
        if (!roomCode) return;
        const unsubscribe = onSnapshot(collection(db, 'sessions', roomCode, 'participants'), (snapshot) => {
            setAllParticipants(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, [roomCode]);

    // Live Response Listener
    useEffect(() => {
        if (!roomCode) return;
        const q = query(collection(db, 'sessions', roomCode, 'responses'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const responsesMap = new Map();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                responsesMap.set(doc.id, { id: doc.id, ...data });
            });
            setLiveResponses(Array.from(responsesMap.values()));
        });
        return () => unsubscribe();
    }, [roomCode]);

    useEffect(() => {
        if (!roomCode) return;
        const loadSession = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'sessions', roomCode));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.sessionTopic) setSessionTopic(data.sessionTopic);
                    if (data.isSessionLive !== undefined) setIsSessionLive(data.isSessionLive);
                    if (data.isGamified !== undefined) setEnableGamification(data.isGamified);
                    if (data.currentActivity) setLiveActivity(data.currentActivity);
                }
            } catch (error) { console.error("Error loading session:", error); }
        };
        loadSession();
        const unsub = onSnapshot(collection(db, "sessions", roomCode, "completedActivities"), (snap) => {
            setCompletedActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
        });
        return () => unsub();
    }, [roomCode]);

    // Wordle Stats Listener
    useEffect(() => {
      if (!roomCode) return;
      const unsubscribe = onSnapshot(query(collection(db, "sessions", roomCode, "wordleProgress")), (querySnapshot) => {
        let total = 0, won = 0, lost = 0, attempting = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          total++;
          if (data.status === "won") won++; 
          else if (data.status === "lost") lost++; 
          else attempting++;
        });
        setWordleStats({ total, won, lost, attempting });
      });
      return () => unsubscribe();
    }, [roomCode]);

    // --- LOGIC ---
    const displayActivity = isSessionLive && liveActivity ? liveActivity : activity;

    const liveResults = useMemo(() => {
        if (displayActivity && displayActivity.type === 'playlist') {
            return { total: liveResponses.length, responses: [] }; 
        }
        
        if (!displayActivity) return { total: 0, responses: [] };
        
        const relevantResponses = liveResponses.filter(r => {
            if (r.type !== displayActivity.type) return false;
            if (displayActivity.activityId && r.activityId && r.activityId !== displayActivity.activityId && r.activityId !== 'single') return false;
            return true;
        });

        // Filter out empty answers
        const validResponses = relevantResponses.filter(r => r.answer && r.answer.trim() !== "");
        const total = validResponses.length;

        if (displayActivity.type === 'mcq') {
            const currentMcqQ = displayActivity.questions?.[displayActivity.currentQuestionIndex || 0] || displayActivity;
            const options = currentMcqQ.options || displayActivity.options || [];
            return { total: total, responses: options.map(option => ({ option: option.text, count: validResponses.filter(r => r.answer === option.text).length })) };
        }
        if (displayActivity.type === 'reviews') {
             const reviewOptions = displayActivity.settings.reviewStyle === 'emoji' ? ['😠', '🙁', '😐', '🙂', '😄'] : ['⭐️', '⭐️⭐️', '⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️', '⭐️⭐️⭐️⭐️⭐️'];
            return { total: total, responses: reviewOptions.map(icon => ({ icon, count: validResponses.filter(r => r.answer === icon).length })) };
        }
        if (displayActivity.type === 'wordcloud') {
            const wordMap = {};
            validResponses.forEach(r => { if (r.type !== 'wordcloud') return; String(r.answer || '').split(/\s+/).forEach(word => { if (word) wordMap[word.toLowerCase()] = (wordMap[word.toLowerCase()] || 0) + 1; }); });
            return { total: total, words: Object.entries(wordMap).map(([text, value]) => ({ text, value })) };
        }
        return { total: total, responses: validResponses };
    }, [liveResponses, displayActivity]);
    
    // --- SCORING ENGINE ---
    const calculatePoints = (response, activityStartTime, isFirstResponse, enableGamification, currentLiveActivity) => {
        if (!enableGamification) return { points: 0, badges: [] };
        
        let targetActivity = currentLiveActivity;
        
        if (currentLiveActivity.type === 'playlist' && currentLiveActivity.queue) {
            targetActivity = currentLiveActivity.queue.find(item => item.playlistId === response.activityId) || currentLiveActivity.queue[0];
        }

        if (!targetActivity) return { points: 10, badges: [] };

        let points = 10; 
        const badges = [];
        if (isFirstResponse) badges.push("🎯");

        if (targetActivity.type === "mcq" && response.answer) {
            const qIndex = response.questionIndex !== undefined ? response.questionIndex : (targetActivity.currentQuestionIndex || 0);
            const currentQ = targetActivity.questions?.[qIndex] || targetActivity;
            const correctOption = currentQ.options?.find((opt) => opt.isCorrect);
            
            if (correctOption && response.answer.trim().toLowerCase() === correctOption.text.trim().toLowerCase()) {
                points += 20; badges.push("✅");
                // Use ref to calculate speed bonus
                if ((Date.now() - activityStartTime) / 1000 <= 3) { points += 15; badges.push("⚡"); }
            }
        }
        if (targetActivity.type === "qa" && response.answer) {
            const wordCount = response.answer.split(" ").length;
            if (wordCount > 50) { points += 15; badges.push("📝"); } 
            else if (wordCount > 20) { points += 10; }
        }
        if (targetActivity.type === 'wordle' && response.answer) {
            if (response.answer.toUpperCase() === (targetActivity.wordleAnswer || '').toUpperCase()) { points += 20; badges.push('🧠'); }
        }
        return { points, badges };
    };

    useEffect(() => {
        if (!isSessionLive || !enableGamification || liveResponses.length === 0 || !liveActivity) return;
        
        const processScores = async () => {
            const updates = [];
            const unscoredResponses = liveResponses.filter(r => !r.pointsAwarded);
            if (unscoredResponses.length === 0) return;
            
            // Use the Ref value here
            const activityStartTime = sessionStartTimeRef.current || (Date.now() - 10000); 
            const sortedResponses = [...liveResponses].sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
            const firstResponderId = sortedResponses[0]?.studentName;

            for (const response of unscoredResponses) {
                if (!response.studentName) continue;
                const isFirst = response.studentName === firstResponderId;
                const { points, badges } = calculatePoints(response, activityStartTime, isFirst, enableGamification, liveActivity);
                
                if (points > 0) {
                    updates.push(setDoc(doc(db, 'sessions', roomCode, 'participants', response.studentName), { score: increment(points), badges: arrayUnion(...badges), lastActive: new Date() }, { merge: true }).catch(err => console.error("Score update failed")));
                    updates.push(updateDoc(doc(db, 'sessions', roomCode, 'responses', response.id), { pointsAwarded: true }));
                }
            }
            if(updates.length > 0) await Promise.all(updates);
        };
        processScores();
    }, [liveResponses, isSessionLive, enableGamification, liveActivity, roomCode]);


    // --- ACTIONS ---
    const handleDeleteResponse = async (responseId) => {
        if(!window.confirm("Delete this response?")) return;
        try { await deleteDoc(doc(db, 'sessions', roomCode, 'responses', responseId)); } 
        catch (err) { console.error("Error deleting:", err); }
    };

    const handleAddToPlaylist = () => {
        if (currentActivityType === 'mcq' && !activity.questions[0].question) return alert("Please enter a question first.");
        const newActivity = JSON.parse(JSON.stringify(activity)); 
        newActivity.playlistId = Date.now(); 
        setPlaylist([...playlist, newActivity]);
        const resetState = JSON.parse(JSON.stringify(DEFAULT_STATES[currentActivityType]));
        setDrafts(prev => ({ ...prev, [currentActivityType]: resetState }));
        playSound('click');
    };

    const handleLaunchPlaylist = async () => {
        if (playlist.length === 0) return;
        launchSession({ type: 'playlist', queue: playlist, activityId: Date.now() });
    };

    const handleLaunchSingle = async () => {
        if (activity.type === 'qa' && (!activity.questions?.some(q => q.text?.trim()))) return alert('Please enter at least one question.');
        if (activity.type === 'mcq' && (!activity.questions?.some(q => q.question?.trim()))) return alert('Please enter at least one question.');
        const payload = { ...activity, activityId: Date.now(), currentQuestionIndex: 0 };
        launchSession(payload);
        const resetState = JSON.parse(JSON.stringify(DEFAULT_STATES[currentActivityType]));
        setDrafts(prev => ({ ...prev, [currentActivityType]: resetState }));
    };

    const launchSession = async (payload) => {
        sessionStartTimeRef.current = Date.now(); // Update Ref on Launch
        const q = query(collection(db, 'sessions', roomCode, 'responses'));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        await updateDoc(doc(db, 'sessions', roomCode), { isSessionLive: true, currentActivity: payload, activityStartTime: Date.now() });
        setLiveActivity(payload);
        setIsSessionLive(true);
        playSound('notification');
    };

    const handleEndActivity = async () => {
        if (!roomCode) return;
        let report;
        if (liveActivity.type === 'playlist') {
             report = generateSessionReport({ type: 'playlist_summary' }, liveResponses, sessionTopic, roomCode);
        } else {
             report = generateSessionReport(liveActivity, liveResponses, sessionTopic, roomCode);
        }
        await setDoc(doc(db, "sessions", roomCode, "completedActivities", String(Date.now())), { timestamp: new Date().toISOString(), activityType: liveActivity.type, activityDetails: liveActivity, responses: liveResponses, report });
        await updateDoc(doc(db, "sessions", roomCode), { isSessionLive: false, currentActivity: null });
        setIsSessionLive(false);
        setLiveActivity(null);
    };

    const handleCloseRoom = async () => { if (!window.confirm("Close room?")) return; await deleteDoc(doc(db, 'sessions', roomCode)); setView('home'); };
    const handleCopyCode = () => { navigator.clipboard.writeText(roomCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); };
    const handleCopyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
    const handleCopyRecoveryLink = () => { navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}&key=${sessionPassword}`); alert("Key Copied!"); };

    const handleReuseActivity = (pastActivity) => {
        if (!window.confirm("Load this previous question into the editor?")) return;
        setDrafts(prev => ({ ...prev, [pastActivity.activityType]: pastActivity.activityDetails }));
        setCurrentActivityType(pastActivity.activityType);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- RENDER HELPERS ---
    const renderCreator = () => {
        const props = { activity, setActivity, liveResults: liveResults, onDelete: handleDeleteResponse };
        switch (currentActivityType) {
            case 'mcq': return <McqCreator {...props} />;
            case 'wordcloud': return <WordCloudCreator {...props} />;
            case 'reviews': return <ReviewsCreator {...props} />;
            case 'feedback': return <ShortFeedbackCreator {...props} />;
            case 'qa': return <QaCreator {...props} />;
            case 'wordle': return <WordleCreator {...props} />;
            default: return null;
        }
    };

    const renderPlaylistMonitor = () => {
        if (!liveActivity || liveActivity.type !== 'playlist') return null;
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-gray-900/90 border-l-4 border-purple-500 p-6 rounded-r-lg shadow-2xl">
                    <h3 className="text-2xl font-bold text-white mb-2">🎶 Playlist Live Dashboard</h3>
                    <p className="text-purple-300 text-sm">Students are completing these activities at their own pace.</p>
                </div>
                {liveActivity.queue.map((item, idx) => {
                    const itemResponses = liveResponses.filter(r => r.activityId === item.playlistId && r.type === item.type && r.answer && r.answer.trim() !== "");
                    
                    return (
                        <div key={idx} className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-100 p-4 flex justify-between items-center border-b border-gray-200">
                                <div><span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{item.type}</span><h4 className="text-lg font-bold text-gray-800">{item.question || `Activity #${idx+1}`}</h4></div>
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">{itemResponses.length} Responses</span>
                            </div>
                            <div className="p-4">
                                {item.type === 'wordcloud' && (<div className="flex flex-wrap gap-2">{itemResponses.map((r, i) => (<span key={i} className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-sm">{r.answer}</span>))}</div>)}
                                {item.type === 'mcq' && (
                                    <div className="space-y-2">{(item.questions?.[0]?.options || []).map((opt, i) => {
                                        const count = itemResponses.filter(r => r.answer === opt.text).length;
                                        const percent = itemResponses.length ? (count / itemResponses.length) * 100 : 0;
                                        return (<div key={i} className="flex items-center gap-2 text-sm"><div className="w-32 truncate font-medium text-gray-600">{opt.text}</div><div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden"><div className="bg-teal-500 h-full" style={{width: `${percent}%`}}></div></div><div className="w-8 text-right font-bold text-gray-700">{count}</div></div>)
                                    })}</div>
                                )}
                                {item.type === 'wordle' && (
                                    <div className="flex justify-around text-center py-2 bg-gray-50 rounded-lg">
                                        <div><span className="block text-xl font-bold text-green-600">{wordleStats.won}</span><span className="text-xs text-gray-500">WON</span></div>
                                        <div><span className="block text-xl font-bold text-yellow-600">{wordleStats.attempting}</span><span className="text-xs text-gray-500">TRYING</span></div>
                                        <div><span className="block text-xl font-bold text-red-600">{wordleStats.lost}</span><span className="text-xs text-gray-500">LOST</span></div>
                                        <div><span className="block text-xl font-bold text-gray-800">{wordleStats.total}</span><span className="text-xs text-gray-500">TOTAL</span></div>
                                    </div>
                                )}
                                {(item.type === 'feedback' || item.type === 'qa') && (<div className="max-h-32 overflow-y-auto space-y-1">{itemResponses.map((r, i) => (<div key={i} className="text-sm text-gray-700 border-b border-gray-100 py-1 flex justify-between"><span>{r.answer}</span> <button onClick={() => handleDeleteResponse(r.id)} className="text-red-500 hover:text-red-700 text-xs">x</button></div>))}</div>)}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex h-screen font-sans text-gray-100 overflow-hidden relative transition-colors duration-1000">
            <div className="absolute inset-0 z-0 transition-all duration-1000" style={enableGamification ? { backgroundColor: '#000000', backgroundImage: `radial-gradient(circle at 15% 20%, rgba(168, 85, 247, 0.25), transparent 40%), radial-gradient(circle at 85% 80%, rgba(59, 130, 246, 0.25), transparent 40%), linear-gradient(135deg, #2e1065 0%, #172554 50%, #020617 100%)` } : { background: 'linear-gradient(to bottom right, #111827, #7f1d1d, #000000)' }}></div>

            <aside className={`relative z-10 bg-black/40 backdrop-blur-md border-r ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} flex flex-col transition-all duration-300 shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors mr-3"><IconChevronLeft /></button><button onClick={() => { if(window.confirm("Go back to Home?")) setView('home'); }} className="p-2 rounded-lg hover:bg-gray-800 transition-colors mr-2 text-gray-400 hover:text-white" title="Exit">🏠</button>{isSidebarOpen && <h1 className={`text-xl font-bold whitespace-nowrap tracking-wider ${enableGamification ? 'text-purple-400' : 'text-red-600'}`}>EDU<span className="text-white">FLEX</span></h1>}</div>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {[{ id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> }, { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> }, { id: 'reviews', name: 'Reviews', icon: <IconSmile /> }, { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> }, { id: 'qa', name: 'Q&A Session', icon: <IconHelpCircle /> }, { id: 'wordle', name: 'Wordle Game', icon: <IconListCheck /> }, { id: 'analytics', name: 'Analytics', icon: <IconListCheck /> }].map(item => (
                        <button key={item.id} onClick={() => item.id === "analytics" ? setShowAnalyticsModal(true) : setCurrentActivityType(item.id)} className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${isSidebarOpen ? '' : 'justify-center'} ${currentActivityType === item.id && item.id !== 'analytics' ? (enableGamification ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]' : 'bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]') : 'hover:bg-gray-800 hover:text-white'}`}>
                            {item.icon} {isSidebarOpen && <span className="whitespace-nowrap ml-2">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col overflow-y-auto relative z-10">
                 <header className={`bg-black/20 backdrop-blur-md shadow-md p-4 border-b ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} sticky top-0 z-20`}>
                    <div className="flex justify-center mb-4"><input type="text" placeholder="Enter Session Topic..." className={`w-full max-w-md text-xl font-semibold text-white bg-transparent border-b-2 ${enableGamification ? 'border-purple-500 focus:border-purple-300' : 'border-red-600 focus:border-red-400'} outline-none p-2 transition placeholder-gray-500 text-center`} value={sessionTopic} onChange={e => setSessionTopic(e.target.value)} /></div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                         <div className="text-center mr-4"><div className="flex flex-col items-center"><span className="text-xs text-gray-400 uppercase">Room Code</span><div className="flex items-center gap-2"><p className={`text-2xl font-bold tracking-widest drop-shadow-md ${enableGamification ? 'text-purple-400 animate-pulse' : 'text-red-600'}`}>{roomCode}</p><button onClick={handleCopyCode} className="p-1.5 bg-gray-800 rounded hover:bg-gray-700 text-xs text-white">{codeCopied ? '✓' : '📋'}</button></div><div className="mt-1 flex items-center gap-2 bg-gray-800/50 px-2 py-1 rounded border border-gray-700/50 cursor-pointer hover:bg-gray-700 transition" onClick={() => setShowSecret(!showSecret)} title="Password"><span className="text-[10px] text-gray-500 uppercase font-bold">Admin Pass:</span><span className={`text-sm font-mono tracking-widest ${showSecret ? 'text-white' : 'text-gray-400'}`}>{showSecret ? sessionPassword : '••••'}</span><span className="text-xs">{showSecret ? '👁️' : '🔒'}</span></div></div></div>
                        
                        {/* CUSTOM AUDIO CONTROLS */}
                        <div className="flex items-center gap-2 bg-gray-800/50 px-2 py-1 rounded border border-gray-700/50">
                            <label className="cursor-pointer text-lg hover:scale-110 transition" title="Upload Custom MP3">
                                📂 <input type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />
                            </label>
                            <button onClick={toggleMusic} className="text-white text-sm font-bold hover:text-teal-400 transition w-8 text-center">
                                {isMusicPlaying ? '⏸' : '▶'}
                            </button>
                        </div>

                        <button onClick={() => setShowShareLink(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition"><IconLink /> Link</button>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 border border-gray-700 transition"><IconUsers /> Users</button>
                        <button onClick={() => {playSound('click'); setShowLeaderboard(true);}} className="flex items-center bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition shadow-lg">🏆 Leaderboard</button>
                        
                        <label className={`flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 border transition ${enableGamification ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-gray-700'}`}>
                            <input type="checkbox" checked={enableGamification} onChange={(e) => {setEnableGamification(e.target.checked); playSound(e.target.checked ? 'success' : 'click');}} className={`w-4 h-4 ${enableGamification ? 'accent-purple-500' : 'accent-red-600'}`} /><span>🎮 Gamify</span>
                        </label>
                        
                        <button onClick={handleCopyRecoveryLink} className="flex items-center gap-1 bg-yellow-600/90 hover:bg-yellow-700 px-3 py-2 rounded text-white text-xs uppercase font-bold tracking-wide transition shadow-lg border border-yellow-500/50">🔑 Recover</button>
                        <button onClick={handleCloseRoom} className="bg-red-900/80 text-red-200 px-4 py-2 rounded-lg hover:bg-red-900 border border-red-800 transition ml-4" title="Close Room">🚪 Close</button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {playlist.length > 0 && !isSessionLive && (
                        <div className="mb-6 p-4 bg-gray-800/60 rounded-xl border border-gray-600">
                            <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-bold text-white">📋 Activity Playlist ({playlist.length})</h3><button onClick={() => setPlaylist([])} className="text-red-400 text-sm hover:underline">Clear</button></div>
                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">{playlist.map((item, idx) => (<div key={idx} className="flex-shrink-0 bg-gray-700 p-3 rounded-lg border border-gray-600 w-48"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold uppercase text-teal-400">{item.type}</span><span className="text-xs text-gray-400">#{idx + 1}</span></div><p className="text-sm text-white truncate">{item.question || item.questions?.[0]?.question || "Activity"}</p></div>))}</div>
                        </div>
                    )}

                    {isSessionLive && liveActivity && liveActivity.type === 'playlist' ? renderPlaylistMonitor() : (
                        <>
                            {(!isSessionLive || (liveActivity && liveActivity.type !== 'playlist')) && renderCreator()}
                            {isSessionLive && liveActivity && (
                                <div className={`mt-6 p-4 rounded-lg border backdrop-blur-sm text-center animate-pulse ${enableGamification ? 'bg-purple-900/20 border-purple-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                                    <h3 className={`font-bold text-lg ${enableGamification ? 'text-purple-400' : 'text-red-400'}`}>● Session is LIVE: {liveActivity.type.toUpperCase()}</h3>
                                    <p className="text-sm text-gray-300 opacity-80">Students are currently responding to: "{liveActivity.question || liveActivity.questions?.[0]?.question}"</p>
                                </div>
                            )}
                            {currentActivityType === 'wordle' && (
                                <div className="mt-6 p-4 rounded-lg border border-teal-500/30 bg-black/40">
                                    <h4 className="text-lg font-bold mb-4 text-center text-teal-300">Wordle Live Stats</h4>
                                    <div className="flex justify-around text-center">
                                        <div><span className="block text-green-400 font-bold text-2xl">{wordleStats.won}</span><span className="text-sm opacity-75 text-gray-300">WON</span></div>
                                        <div><span className="block text-yellow-400 font-bold text-2xl">{wordleStats.attempting}</span><span className="text-sm opacity-75 text-gray-300">TRYING</span></div>
                                        <div><span className="block text-red-400 font-bold text-2xl">{wordleStats.lost}</span><span className="text-sm opacity-75 text-gray-300">LOST</span></div>
                                        <div><span className="block text-white font-bold text-2xl">{wordleStats.total}</span><span className="text-sm opacity-75 text-gray-300">TOTAL</span></div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {(() => { const historyItems = completedActivities.filter(item => item.activityType === currentActivityType); if (historyItems.length === 0) return null; return (<div className={`mt-8 p-6 rounded-lg border backdrop-blur-sm ${enableGamification ? 'bg-purple-900/10 border-purple-500/20' : 'bg-red-900/10 border-red-500/20'}`}><h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${enableGamification ? 'text-purple-300' : 'text-red-300'}`}><span className="text-2xl">📜</span> Previous {currentActivityType.toUpperCase()} Questions</h3><div className="space-y-4">{historyItems.map((item) => (<div key={item.id} className="bg-white/5 p-4 rounded-lg border border-white/10 hover:bg-white/10 transition group"><div className="flex justify-between items-start mb-2"><div><p className="font-semibold text-white text-lg">{item.activityDetails.question || item.activityDetails.questions?.[0]?.question || "Question"}</p><p className="text-xs text-gray-400 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</p></div><div className="flex gap-2"><span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full h-fit">{item.responses?.length || 0} Responses</span><button onClick={() => handleReuseActivity(item)} className="bg-teal-600 hover:bg-teal-500 text-white text-xs px-3 py-1 rounded-full shadow transition opacity-0 group-hover:opacity-100">♻️ Reuse</button></div></div><div className="text-sm text-gray-300 pl-2 border-l-2 border-gray-600">{item.activityType === 'wordcloud' && <p className="italic">Word Cloud saved.</p>}{(item.activityType === 'feedback' || item.activityType === 'qa') && (<div className="max-h-20 overflow-hidden text-gray-400">{item.responses.slice(0, 2).map((r, i) => (<p key={i}>• {r.answer}</p>))}{item.responses.length > 2 && <p>...</p>}</div>)}{item.activityType === 'mcq' && <p>MCQ Results saved.</p>}</div><div className="mt-3 text-right"><button onClick={() => generatePDF(item.report)} className="text-blue-400 hover:text-blue-300 text-sm underline">Download Report 📥</button></div></div>))}</div></div>); })()}
                </div>
                
                 <footer className={`bg-black/20 backdrop-blur-md p-4 border-t ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} flex items-center justify-center sticky bottom-0 z-20`}>
                    <div className="flex gap-4">
                        {(!isSessionLive || liveActivity?.type !== 'playlist') && (<button onClick={handleAddToPlaylist} className="px-6 py-3 text-lg font-bold rounded-full bg-gray-700 hover:bg-gray-600 text-white shadow-lg flex items-center gap-2"><IconPlus /> Add to Playlist</button>)}
                        {(!isSessionLive || liveActivity?.type !== 'playlist') && (<button onClick={handleLaunchSingle} className="px-8 py-3 text-lg font-bold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg border border-blue-400">🚀 Start This Activity</button>)}
                        {playlist.length > 0 && !isSessionLive && (<button onClick={handleLaunchPlaylist} className="px-8 py-3 text-lg font-bold rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg border border-purple-400 flex items-center gap-2"><span className="animate-pulse">💽</span> Launch Playlist ({playlist.length})</button>)}
                        {isSessionLive && (<button onClick={handleEndActivity} className="px-8 py-3 text-lg font-bold rounded-full bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg">⏸️ End Activity</button>)}
                    </div>
                </footer>
            </main>
            
            {showShareLink && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100"><div className="p-8"><h2 className="text-3xl font-extrabold text-gray-900 mb-2">Share Session</h2><p className="text-gray-500 mb-8 text-base">Share this link with your students to let them join the session:</p><div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Shareable Link:</label><div className="flex items-center bg-gray-700 rounded-lg text-gray-200 p-3 font-mono text-sm overflow-x-auto whitespace-nowrap shadow-inner">{`${window.location.origin}/?room=${roomCode}`}</div></div><div className="bg-gray-50 p-6 rounded-xl mb-8 border border-gray-100 text-center"><label className="block text-gray-400 text-sm font-medium mb-2">Room Code:</label><div className="text-4xl font-black text-teal-500 tracking-[0.2em] drop-shadow-sm">{roomCode}</div></div><div className="space-y-3"><button onClick={handleCopyLink} className={`w-full font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg ${linkCopied ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>{linkCopied ? <span>✓ Copied!</span> : <><IconCopy /> Copy Link</>}</button><button onClick={() => setShowShareLink(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition-colors">Close</button></div></div></div></div>)}
            
            {showResults && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 w-full max-w-lg text-gray-900">
                        <h3 className="text-2xl font-bold mb-2 text-teal-700">Live Results: {displayActivity.type.toUpperCase()}</h3>
                        <p className="mb-4 text-gray-600">Total Responses: <span className="font-bold">{liveResults.total}</span></p>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {displayActivity.type === 'mcq' && liveResults.responses.map((res, i) => (<div key={i}><div className="flex justify-between mb-1"><span className="text-base font-medium text-gray-700">{res.option}</span><span className="text-sm font-medium text-gray-600">{res.count} votes</span></div><div className="w-full bg-gray-100 rounded-full h-4"><div className="bg-teal-600 h-4 rounded-full" style={{width: `${liveResults.total > 0 ? (res.count/liveResults.total)*100 : 0}%`}}></div></div></div>))}
                           {displayActivity.type === 'reviews' && (<div className="flex justify-around items-center text-center">{liveResults.responses.map((res, i) => (<div key={i}><p className="text-5xl">{res.icon}</p><p className="font-bold text-xl mt-2">{res.count}</p></div>))}</div>)}
                           {displayActivity.type === 'wordcloud' && (<div className="text-center p-4 bg-white rounded-lg flex flex-wrap justify-center items-center">{liveResults.words.map((w,i) => (<span key={i} style={{fontSize: `${Math.min(48, Math.max(12, 10 + w.value*2))}px`, margin: '4px 8px', display: 'inline-block', fontWeight: '600', color: `hsl(${200 + i*25}, 80%, 70%)`}}>{w.text}</span>))}</div>)}
                           {(displayActivity.type === 'feedback' || displayActivity.type === 'qa') && liveResults.responses.map((res, idx) => (<div key={idx} className="bg-gray-100 p-3 rounded-lg flex justify-between items-center mb-2"><div><span className="font-bold text-sm text-teal-600 block">{res.studentName}</span><p className="text-gray-700">{res.answer}</p></div></div>))}
                        </div>
                        <div className="mt-6 flex gap-3"><button onClick={() => setShowResults(false)} className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button></div>
                    </div>
                </div>
            )}
            
            {showAnalyticsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-gray-300 rounded-lg shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-4 text-teal-700">📊 Session Analytics</h2>
                        {completedActivities.length === 0 ? (<p className="text-gray-500 text-center py-8">No activities have been completed yet.</p>) : (
                            <div className="space-y-4">{completedActivities.map((act) => (<div key={act.id} className="p-4 bg-gray-50 rounded-lg border"><div className="flex justify-between"><div><p className="text-lg font-bold text-gray-900">{act.activityType.toUpperCase()}</p><p className="text-sm text-gray-500">{new Date(act.timestamp).toLocaleString()}</p></div><button onClick={() => generatePDF(act.report)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">📥 Download PDF</button></div></div>))}</div>
                        )}
                        {completedActivities.length > 0 && (<button onClick={() => generateCombinedPDF(completedActivities.map(a => a.report))} className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-bold shadow-md transition">📘 Download Full Session Report (All Activities)</button>)}
                        <button onClick={() => setShowAnalyticsModal(false)} className="mt-6 w-full bg-gray-200 text-gray-900 py-2 rounded hover:bg-gray-300">Close</button>
                    </div>
                </div>
            )}

            {showLeaderboard && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-[#FFFBEB] rounded-xl shadow-2xl p-8 w-full max-w-5xl flex flex-col h-[85vh] relative overflow-hidden">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h2 className="text-4xl font-bold text-[#D97706] flex items-center gap-3 tracking-wide"><span className="text-5xl drop-shadow-sm">🏆</span> Leaderboard - Top Players</h2>
                            <button onClick={() => { playSound('click'); setShowLeaderboard(false); }} className="bg-[#14B8A6] hover:bg-[#0D9488] text-white px-6 py-2 rounded-lg font-bold text-lg transition-transform transform active:scale-95 shadow-md flex items-center gap-2">✕ Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-white/60 rounded-xl shadow-inner mb-6 border border-orange-100 p-4 custom-scrollbar">
                            {allParticipants.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4"><p className="text-2xl font-light">No players yet. Start a session to see rankings!</p><p className="text-sm flex items-center gap-2 opacity-75">🎮 Enable gamification to track points</p></div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-[#FFFBEB] text-gray-700 z-10 border-b-2 border-orange-200">
                                        <tr><th className="px-6 py-4 text-left text-xl font-bold text-gray-600">Rank</th><th className="px-6 py-4 text-left text-xl font-bold text-gray-600">Player</th><th className="px-4 py-4 text-center text-xl font-bold text-gray-600">Badges</th><th className="px-6 py-4 text-right text-xl font-bold text-gray-600">Points</th></tr>
                                    </thead>
                                    <tbody className="text-gray-700">
                                        {allParticipants.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, idx) => (
                                            <tr key={idx} className="border-b border-orange-100 hover:bg-orange-50 transition-colors">
                                                <td className="px-6 py-4"><span className="text-2xl font-bold text-gray-400">#{idx + 1}</span></td>
                                                <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="text-2xl bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center shadow-sm">{player.avatar || '👤'}</span><span className="text-xl font-semibold text-gray-800">{player.name}</span></div></td>
                                                <td className="px-4 py-4 text-center"><div className="flex justify-center gap-1 flex-wrap">{player.badges && player.badges.map((b, i) => (<span key={i} className="text-2xl" title="Badge">{b}</span>))}</div></td>
                                                <td className="px-6 py-4 text-right"><span className="text-2xl font-bold text-[#D97706]">{player.score || 0}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="flex-shrink-0 text-center border-t border-orange-200 pt-4">
                            <div className="mb-4"><h4 className="text-gray-700 font-bold text-lg mb-2 flex items-center justify-center gap-2"><span>🎯</span> Points System:</h4><p className="text-gray-600 text-base font-medium">Participation: 10 pts <span className="text-gray-300 mx-3">|</span> Correct Answer: +20 pts <span className="text-gray-300 mx-3">|</span> Speed Bonus: +15 pts <span className="text-gray-300 mx-3">|</span> Quality Answer: +15 pts</p></div>
                            <div><h4 className="text-gray-700 font-bold text-lg mb-2 flex items-center justify-center gap-2"><span>🏅</span> Badges:</h4><p className="text-gray-600 text-base font-medium flex flex-wrap justify-center items-center gap-x-2"><span className="flex items-center gap-1">🎯 First Response</span> <span className="text-gray-300 mx-2">|</span> <span className="flex items-center gap-1">✅ Correct</span> <span className="text-gray-300 mx-2">|</span> <span className="flex items-center gap-1">⚡ Speed Demon</span> <span className="text-gray-300 mx-2">|</span> <span className="flex items-center gap-1">📝 Wordsmith</span> <span className="text-gray-300 mx-2">|</span> <span className="flex items-center gap-1">💯 Perfect Score</span> <span className="text-gray-300 mx-2">|</span> <span className="flex items-center gap-1">👑 Participation King</span></p></div>
                        </div>
                    </div>
                </div>
            )}

            {showParticipants && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-2xl p-6 w-full max-w-md text-gray-900">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Room Participants <span className="text-teal-600">({allParticipants.length})</span></h3>
                        <div className="bg-white rounded-lg border border-gray-200 shadow-inner max-h-80 overflow-y-auto"><ul className="divide-y divide-gray-100">{allParticipants.map((p, index) => (<li key={index} className="p-3 flex items-center hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-0"><div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3 text-xl shadow-sm">{p.avatar || (p.name || 'A').charAt(0).toUpperCase()}</div><span className="font-medium text-gray-800 text-lg">{p.name}</span></li>))}</ul></div>
                        <button onClick={() => setShowParticipants(false)} className="mt-6 w-full bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition font-semibold">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherView;