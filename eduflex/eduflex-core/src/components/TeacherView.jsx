import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, getDocs, getDoc, setDoc, increment, arrayUnion } from 'firebase/firestore';
import { playSound } from '../utils/helpers';
import { generatePDF, generateCombinedPDF } from '../utils/pdfGenerator';
import { generateSessionReport } from '../utils/sessionUtils';
import { McqCreator, WordCloudCreator, ReviewsCreator, QaCreator, WordleCreator, ShortFeedbackCreator } from './activities/ActivityCreators';
import { IconUsers, IconChevronLeft, IconListCheck, IconCloud, IconSmile, IconMessageSquare, IconHelpCircle, IconLink, IconCopy, IconPlus, IconTrash } from './Icons';

const TeacherView = ({ setView, roomCode }) => {
    // --- CONSTANTS ---
    const DEFAULT_STATES = {
        mcq: { type: 'mcq', questions: [{ id: 1, question: '', image: null, options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] }], currentQuestionIndex: 0, settings: { markCorrect: true, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji', isStudentPaced: false } },
        wordcloud: { type: 'wordcloud', question: '', image: null, settings: { allowMultiple: true, profanityFilter: false } },
        reviews: { type: 'reviews', question: '', settings: { reviewStyle: 'emoji' } },
        feedback: { type: 'feedback', question: '', settings: { profanityFilter: true } },
        qa: { type: 'qa', questions: [{ id: 1, text: '', type: 'short', options: [], correctAnswer: '', timeLimit: 60 }], currentQuestionIndex: 0, settings: { isStudentPaced: false } },
        wordle: { type: 'wordle', question: 'Enter the secret 5-letter word for Wordle', wordleAnswer: '', settings: {} }
    };

    // --- STATE ---
    const [sessionTopic, setSessionTopic] = useState('');
    const [currentActivityType, setCurrentActivityType] = useState('mcq');
    const [drafts, setDrafts] = useState(JSON.parse(JSON.stringify(DEFAULT_STATES)));
    const [sessionPassword, setSessionPassword] = useState('');


    // PLAYLIST STATE
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
    const [wordleStats, setWordleStats] = useState({ total: 0, attempting: 0, won: 0, lost: 0 });
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

    const [completedActivities, setCompletedActivities] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [enableGamification, setEnableGamification] = useState(true);

    // --- AUDIO STATE ---
    const [musicSrc, setMusicSrc] = useState('/game-music.mp3');
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const bgMusicRef = useRef(new Audio('/game-music.mp3'));

    const sessionStartTimeRef = useRef(null);

    // --- EFFECTS ---
    useEffect(() => {
        if (!roomCode) return;
        const fetchPassword = async () => {
            const snap = await getDoc(doc(db, 'sessions', roomCode));
            if (snap.exists()) setSessionPassword(snap.data().password || '');
        };
        fetchPassword();
    }, [roomCode]);

    // Audio Logic
    useEffect(() => {
        const music = bgMusicRef.current;
        music.src = musicSrc;
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
                    if (data.currentActivity) {
                        setLiveActivity(data.currentActivity);
                    }
                }
            } catch (error) { console.error("Error loading session:", error); }
        };
        loadSession();
        const unsub = onSnapshot(collection(db, "sessions", roomCode, "completedActivities"), (snap) => {
            setCompletedActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        });
        return () => unsub();
    }, [roomCode]);

    // Global Wordle Stats Listener
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

    // --- LOGIC: Define Display Activity Globally ---
    const displayActivity = isSessionLive && liveActivity ? liveActivity : activity;

    const liveResults = useMemo(() => {
        if (displayActivity && displayActivity.type === 'playlist') {
            return { total: liveResponses.length, responses: [] };
        }

        if (!displayActivity) return { total: 0, responses: [] };

        // STRICT FILTER: Match Type AND ID
        const relevantResponses = liveResponses.filter(r => {
            if (r.type !== displayActivity.type) return false;
            // Match specific ID to prevent ghost data from playlist items leaking into main view
            if (displayActivity.activityId && r.activityId && r.activityId !== displayActivity.activityId && r.activityId !== 'single') return false;
            return true;
        });

        // Filter Ghost Data
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

        // Playlist Drill-Down Logic
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

            const activityStartTime = sessionStartTimeRef.current || (Date.now() - 10000);
            const sortedResponses = [...liveResponses].sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
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
            if (updates.length > 0) await Promise.all(updates);
        };
        processScores();
    }, [liveResponses, isSessionLive, enableGamification, liveActivity, roomCode]);


    // --- ACTIONS ---
    // ✅ FIX: Defined delete handler to prevent crash
    const handleDeleteResponse = async (responseId) => {
        if (!window.confirm("Delete this response?")) return;
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
        sessionStartTimeRef.current = Date.now();
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

        // Pass the FULL liveActivity object (including queue for playlists) to the generator
        const report = generateSessionReport(liveActivity, liveResponses, sessionTopic, roomCode);
        await setDoc(doc(db, "sessions", roomCode, "completedActivities", String(Date.now())), { timestamp: new Date().toISOString(), activityType: liveActivity.type, activityDetails: liveActivity, responses: liveResponses, report });
        await updateDoc(doc(db, "sessions", roomCode), { isSessionLive: false, currentActivity: null });
        setIsSessionLive(false);
        setLiveActivity(null);
    };

    const handleCloseRoom = async () => { if (!window.confirm("Close room?")) return; await deleteDoc(doc(db, 'sessions', roomCode)); setView('home'); };
    const handleCopyCode = () => { navigator.clipboard.writeText(roomCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); };
    const handleCopyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };


    const handleReuseActivity = (pastActivity) => {
        if (!window.confirm("Load this previous question into the editor?")) return;
        setDrafts(prev => ({ ...prev, [pastActivity.activityType]: pastActivity.activityDetails }));
        setCurrentActivityType(pastActivity.activityType);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- RENDER HELPERS ---
    const renderCreator = () => {
        // ✅ FIX: Only pass liveResults if types match, to prevent Ghost Data
        const matchingResults = (isSessionLive && liveActivity && liveActivity.type === currentActivityType && liveActivity.type !== 'playlist') ? liveResults : null;

        // ✅ FIX: Pass the delete handler down
        const props = { activity, setActivity, liveResults: matchingResults, onDelete: handleDeleteResponse };

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

    // --- NEW: PLAYLIST MONITORING COMPONENT ---
    const renderPlaylistMonitor = () => {
        if (!liveActivity || liveActivity.type !== 'playlist') return null;

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="glass-card bg-gradient-to-r from-blue-900/60 to-purple-900/60 border border-white/10 p-6 rounded-2xl shadow-xl flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/20 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div>
                        <h3 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
                            Playlist Live Monitor
                        </h3>
                        <p className="text-gray-300 font-medium">Students are progressing through {liveActivity.queue.length} activities.</p>
                    </div>
                    <div className="text-right z-10">
                        <div className="text-4xl font-black text-white">{liveResponses.length}</div>
                        <div className="text-xs uppercase font-bold text-blue-300 tracking-wider">Total Interactions</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {liveActivity.queue.map((item, idx) => {
                        // Strict filter for playlist items
                        const itemResponses = liveResponses.filter(r => r.activityId === item.playlistId && r.type === item.type && r.answer && r.answer.trim() !== "");

                        return (
                            <div key={idx} className="glass-card bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all duration-300 group">
                                <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg font-bold text-xs uppercase tracking-widest">{item.type}</div>
                                        <h4 className="text-lg font-bold text-white group-hover:text-blue-300 transition">{item.question || item.questions?.[0]?.question || `Activity #${idx + 1}`}</h4>
                                    </div>
                                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 shadow-sm">{itemResponses.length} Responses</span>
                                </div>

                                <div className="p-5 max-h-64 overflow-y-auto custom-scrollbar">
                                    {item.type === 'wordcloud' && (
                                        <div className="flex flex-wrap gap-2">
                                            {itemResponses.map((r, i) => (
                                                <span key={i} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm border border-white/5 hover:bg-white/20 transition">{r.answer}</span>
                                            ))}
                                            {itemResponses.length === 0 && <span className="text-gray-500 italic">Waiting for words...</span>}
                                        </div>
                                    )}

                                    {item.type === 'mcq' && (
                                        <div className="space-y-3">
                                            {(item.questions?.[0]?.options || []).map((opt, i) => {
                                                const count = itemResponses.filter(r => r.answer === opt.text).length;
                                                const percent = itemResponses.length ? (count / itemResponses.length) * 100 : 0;
                                                return (
                                                    <div key={i} className="flex items-center gap-3 text-sm">
                                                        <div className="w-40 truncate font-medium text-gray-300">{opt.text}</div>
                                                        <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                                                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                                        </div>
                                                        <div className="w-8 text-right font-bold text-white">{count}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {item.type === 'wordle' && (
                                        <div className="grid grid-cols-4 gap-4 text-center py-2">
                                            <div className="bg-green-500/20 rounded-lg p-2 border border-green-500/30">
                                                <span className="block text-2xl font-bold text-green-400">{wordleStats.won}</span>
                                                <span className="text-[10px] uppercase font-bold text-green-300/70">Won</span>
                                            </div>
                                            <div className="bg-yellow-500/20 rounded-lg p-2 border border-yellow-500/30">
                                                <span className="block text-2xl font-bold text-yellow-400">{wordleStats.attempting}</span>
                                                <span className="text-[10px] uppercase font-bold text-yellow-300/70">Trying</span>
                                            </div>
                                            <div className="bg-red-500/20 rounded-lg p-2 border border-red-500/30">
                                                <span className="block text-2xl font-bold text-red-400">{wordleStats.lost}</span>
                                                <span className="text-[10px] uppercase font-bold text-red-300/70">Lost</span>
                                            </div>
                                            <div className="bg-white/10 rounded-lg p-2 border border-white/20">
                                                <span className="block text-2xl font-bold text-white">{wordleStats.total}</span>
                                                <span className="text-[10px] uppercase font-bold text-gray-400">Total</span>
                                            </div>
                                        </div>
                                    )}

                                    {(item.type === 'feedback' || item.type === 'qa') && (
                                        <div className="space-y-2">
                                            {itemResponses.map((r, i) => (
                                                <div key={i} className="flex justify-between items-start bg-white/5 p-2 rounded border border-white/5">
                                                    <span className="text-sm text-gray-300">{r.answer}</span>
                                                    <button onClick={() => handleDeleteResponse(r.id)} className="text-red-400 hover:text-red-300 p-1 opacity-50 hover:opacity-100 transition"><IconTrash /></button>
                                                </div>
                                            ))}
                                            {itemResponses.length === 0 && <span className="text-gray-500 italic">No responses yet.</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen font-sans text-gray-100 overflow-hidden relative transition-colors duration-1000">
            {/* Background Animation */}
            <div className="absolute inset-0 z-0 bg-animated transition-all duration-1000" style={enableGamification ? { backgroundColor: '#000000', backgroundImage: `radial-gradient(circle at 15% 20%, rgba(168, 85, 247, 0.25), transparent 40%), radial-gradient(circle at 85% 80%, rgba(59, 130, 246, 0.25), transparent 40%), linear-gradient(135deg, #2e1065 0%, #172554 50%, #020617 100%)` } : { background: 'linear-gradient(to bottom right, #111827, #7f1d1d, #000000)' }}></div>

            {/* Glass Sidebar */}
            <aside className={`relative z-10 glass-panel border-r ${enableGamification ? 'border-purple-500/30' : 'border-red-900/30'} flex flex-col transition-all duration-300 shadow-2xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-white/10 transition-colors mr-3 text-white"><IconChevronLeft /></button>
                        <button onClick={() => { if (window.confirm("Go back to Home?")) setView('home'); }} className="p-2 rounded-lg hover:bg-white/10 transition-colors mr-2 text-gray-400 hover:text-white" title="Exit">🏠</button>
                        {isSidebarOpen && <h1 className="text-xl font-bold whitespace-nowrap tracking-wider text-white">EDU<span className="text-blue-400">FLEX</span></h1>}
                    </div>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-3 custom-scrollbar overflow-y-auto">
                    {[{ id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> }, { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> }, { id: 'reviews', name: 'Reviews', icon: <IconSmile /> }, { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> }, { id: 'qa', name: 'Q&A Session', icon: <IconHelpCircle /> }, { id: 'wordle', name: 'Wordle Game', icon: <IconListCheck /> }, { id: 'analytics', name: 'Analytics', icon: <IconListCheck /> }].map(item => (
                        <button key={item.id} onClick={() => item.id === "analytics" ? setShowAnalyticsModal(true) : setCurrentActivityType(item.id)} className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 text-left border ${currentActivityType === item.id && item.id !== 'analytics' ? 'bg-gradient-to-r from-blue-600/40 to-purple-600/40 border-blue-400/50 text-white shadow-lg shadow-blue-500/20' : 'border-transparent hover:bg-white/5 text-gray-400 hover:text-white'}`}>
                            {item.icon} {isSidebarOpen && <span className="whitespace-nowrap ml-2 font-medium">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-y-auto relative z-10 custom-scrollbar">
                {/* Glass Header */}
                <header className="glass-card m-4 rounded-2xl p-4 sticky top-4 z-20 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex-1 w-full md:w-auto">
                        <input type="text" placeholder="Enter Session Topic..." className="w-full bg-transparent border-b-2 border-white/20 focus:border-blue-500 text-xl font-bold text-white placeholder-gray-500 outline-none px-2 py-1 text-center md:text-left transition-colors" value={sessionTopic} onChange={e => setSessionTopic(e.target.value)} />
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Room Code Badge */}
                        <div className="flex flex-col items-center bg-black/30 px-4 py-2 rounded-xl border border-white/10">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Room Code</span>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-black text-white tracking-widest font-mono">{roomCode}</p>
                                <button onClick={handleCopyCode} className="text-white hover:text-blue-400 transition">{codeCopied ? '✓' : '📋'}</button>
                            </div>
                        </div>

                        {/* Music Player */}
                        <div className="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-xl border border-white/10">
                            <label className="cursor-pointer hover:scale-110 transition p-1 bg-white/10 rounded-full" title="Upload Custom MP3">
                                📂 <input type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />
                            </label>
                            <button onClick={toggleMusic} className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-white shadow-lg hover:scale-110 transition">
                                {isMusicPlaying ? '⏸' : '▶'}
                            </button>
                        </div>

                        <div className="h-8 w-[1px] bg-white/10 mx-2 hidden md:block"></div>

                        <button onClick={() => setShowShareLink(true)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-bold border border-white/10 transition"><IconLink /> Link</button>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-bold border border-white/10 transition"><IconUsers /> Users</button>
                        <button onClick={() => { playSound('click'); setShowLeaderboard(true); }} className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition transform hover:-translate-y-0.5">🏆 Leaderboard</button>

                        {/* GAMIFY TOGGLE - VISIBLE */}
                        <label className={`flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 border transition ${enableGamification ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-gray-700'}`}>
                            <input type="checkbox" checked={enableGamification} onChange={(e) => { setEnableGamification(e.target.checked); playSound(e.target.checked ? 'success' : 'click'); }} className={`w-4 h-4 ${enableGamification ? 'accent-purple-500' : 'accent-red-600'}`} /><span>🎮 Gamify</span>
                        </label>

                        <button onClick={handleCloseRoom} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 px-4 py-2 rounded-lg transition font-bold text-sm">Close</button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {/* Playlist Queue */}
                    {playlist.length > 0 && !isSessionLive && (
                        <div className="mb-8 p-6 glass-card rounded-2xl animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">📋 Activity Queue <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">{playlist.length}</span></h3>
                                <button onClick={() => setPlaylist([])} className="text-red-400 text-xs hover:text-red-300 font-bold uppercase tracking-wider transition">Clear Queue</button>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                                {playlist.map((item, idx) => (
                                    <div key={idx} className="flex-shrink-0 bg-white/5 p-4 rounded-xl border border-white/10 w-56 hover:bg-white/10 transition group relative">
                                        <div className="absolute top-2 right-2 text-gray-600 font-black text-4xl opacity-20 select-none">#{idx + 1}</div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-900/30 px-2 py-1 rounded">{item.type}</span>
                                        </div>
                                        <p className="text-sm text-gray-300 font-medium line-clamp-2">{item.question || item.questions?.[0]?.question || "Untitled Activity"}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LIVE MONITOR: PLAYLIST MODE */}
                    {isSessionLive && liveActivity && liveActivity.type === 'playlist' ? (
                        renderPlaylistMonitor()
                    ) : (
                        // STANDARD MODE: Ad-Hoc / Single
                        <>
                            {(!isSessionLive || (liveActivity && liveActivity.type !== 'playlist')) && renderCreator()}

                            {/* Live Activity Banner */}
                            {isSessionLive && liveActivity && (
                                <div className="mt-8 glass-card bg-gradient-to-r from-green-900/40 to-teal-900/40 border border-green-500/30 p-6 rounded-2xl text-center animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                                    <h3 className="text-2xl font-black text-green-400 tracking-wide uppercase mb-1">● Live: {liveActivity.type.toUpperCase()}</h3>
                                    <p className="text-green-200/70 font-medium">Students are currently responding...</p>
                                </div>
                            )}

                            {/* Wordle Live Stats (Ad-Hoc) */}
                            {currentActivityType === 'wordle' && (
                                <div className="mt-8 glass-card p-6 rounded-2xl border border-white/10 bg-black/20">
                                    <h4 className="text-lg font-bold mb-6 text-center text-gray-400 uppercase tracking-widest">Live Game Stats</h4>
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 text-center">
                                            <span className="block text-4xl font-black text-green-400 mb-1">{wordleStats.won}</span>
                                            <span className="text-xs font-bold text-green-600 uppercase">Won</span>
                                        </div>
                                        <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20 text-center">
                                            <span className="block text-4xl font-black text-yellow-400 mb-1">{wordleStats.attempting}</span>
                                            <span className="text-xs font-bold text-yellow-600 uppercase">Trying</span>
                                        </div>
                                        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
                                            <span className="block text-4xl font-black text-red-400 mb-1">{wordleStats.lost}</span>
                                            <span className="text-xs font-bold text-red-600 uppercase">Failed</span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                                            <span className="block text-4xl font-black text-white mb-1">{wordleStats.total}</span>
                                            <span className="text-xs font-bold text-gray-500 uppercase">Total</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Inline History */}
                    {(() => {
                        const historyItems = completedActivities.filter(item => item.activityType === currentActivityType);
                        if (historyItems.length === 0) return null;
                        return (
                            <div className="mt-12">
                                <h3 className="text-xl font-bold text-gray-400 mb-6 flex items-center gap-3">
                                    <span className="w-8 h-[2px] bg-gray-600"></span> Previous {currentActivityType.toUpperCase()}s
                                </h3>
                                <div className="space-y-4">
                                    {historyItems.map((item) => (
                                        <div key={item.id} className="glass-card p-4 rounded-xl border border-white/5 hover:border-white/20 transition group flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-white text-lg mb-1">{item.activityDetails.question || item.activityDetails.questions?.[0]?.question || "Untitled Activity"}</p>
                                                <p className="text-xs text-gray-500 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right mr-4">
                                                    <span className="block text-2xl font-bold text-white">{item.responses?.length || 0}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase">Responses</span>
                                                </div>
                                                <button onClick={() => handleReuseActivity(item)} className="p-2 bg-white/5 hover:bg-white/20 rounded-lg text-blue-300 transition" title="Reuse"><IconCopy /></button>
                                                <button onClick={() => generatePDF(item.report)} className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow-lg transition" title="Download Report">📥</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Footer Controls */}
                <footer className="glass-card m-4 p-4 rounded-2xl flex items-center justify-center sticky bottom-4 z-20 border border-white/10 shadow-2xl">
                    <div className="flex gap-4">
                        {(!isSessionLive || liveActivity?.type !== 'playlist') && (
                            <button onClick={handleAddToPlaylist} className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition flex items-center gap-2 border border-white/10">
                                <IconPlus /> Add to Playlist
                            </button>
                        )}
                        {(!isSessionLive || liveActivity?.type !== 'playlist') && (
                            <button onClick={handleLaunchSingle} className="px-8 py-3 rounded-xl btn-primary text-white font-bold shadow-lg shadow-purple-500/30 border border-white/20">
                                🚀 Start This Activity
                            </button>
                        )}
                        {playlist.length > 0 && !isSessionLive && (
                            <button onClick={handleLaunchPlaylist} className="px-8 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold shadow-lg shadow-pink-500/30 border border-white/20 flex items-center gap-2">
                                <span className="animate-pulse">💽</span> Launch Playlist ({playlist.length})
                            </button>
                        )}
                        {isSessionLive && (
                            <button onClick={handleEndActivity} className="px-10 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-bold shadow-lg shadow-orange-500/30 border border-white/20">
                                ⏸️ End Activity
                            </button>
                        )}
                    </div>
                </footer>
            </main>

            {showShareLink && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100"><div className="p-8"><h2 className="text-3xl font-extrabold text-gray-900 mb-2">Share Session</h2><p className="text-gray-500 mb-8 text-base">Share this link with your students to let them join the session:</p><div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Shareable Link:</label><div className="flex items-center bg-gray-700 rounded-lg text-gray-200 p-3 font-mono text-sm overflow-x-auto whitespace-nowrap shadow-inner">{`${window.location.origin}/?room=${roomCode}`}</div></div><div className="bg-gray-50 p-6 rounded-xl mb-8 border border-gray-100 text-center"><label className="block text-gray-400 text-sm font-medium mb-2">Room Code:</label><div className="text-4xl font-black text-teal-500 tracking-[0.2em] drop-shadow-sm">{roomCode}</div></div><div className="space-y-3"><button onClick={handleCopyLink} className={`w-full font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-lg ${linkCopied ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>{linkCopied ? <span>✓ Copied!</span> : <><IconCopy /> Copy Link</>}</button><button onClick={() => setShowShareLink(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition-colors">Close</button></div></div></div></div>)}

            {showResults && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="glass-card bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-xl text-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Live Results</h3>
                            <button onClick={() => setShowResults(false)} className="text-gray-400 hover:text-white transition text-2xl">×</button>
                        </div>
                        <p className="mb-6 text-gray-400 font-medium">Total Responses: <span className="text-white font-bold text-xl">{liveResults.total}</span></p>
                        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                            {displayActivity.type === 'mcq' && liveResults.responses.map((res, i) => (<div key={i}><div className="flex justify-between mb-2"><span className="text-lg font-medium text-gray-200">{res.option}</span><span className="text-sm font-bold text-blue-400">{res.count} votes</span></div><div className="w-full bg-white/10 rounded-full h-4 overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-1000" style={{ width: `${liveResults.total > 0 ? (res.count / liveResults.total) * 100 : 0}%` }}></div></div></div>))}
                            {displayActivity.type === 'reviews' && (<div className="flex justify-around items-center text-center py-4">{liveResults.responses.map((res, i) => (<div key={i} className="flex flex-col items-center gap-2"><span className="text-5xl">{res.icon}</span><span className="font-black text-2xl text-white">{res.count}</span></div>))}</div>)}
                            {displayActivity.type === 'wordcloud' && (
                                <div className="relative w-full min-h-[400px] p-6 bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                    {liveResults.words.map((w, i) => {
                                        // Enhanced size scaling: base 16px + exponential growth based on frequency
                                        const size = Math.min(64, Math.max(16, 16 + Math.pow(w.value, 1.5) * 8));
                                        const colors = [
                                            'from-blue-400 to-cyan-400',
                                            'from-purple-400 to-pink-400',
                                            'from-green-400 to-emerald-400',
                                            'from-orange-400 to-red-400',
                                            'from-indigo-400 to-purple-400',
                                            'from-teal-400 to-blue-400',
                                            'from-yellow-400 to-orange-400',
                                            'from-rose-400 to-pink-400'
                                        ];
                                        const colorClass = colors[i % colors.length];

                                        // Spiral placement algorithm for better distribution
                                        const angle = i * 137.5; // Golden angle
                                        const radius = Math.sqrt(i + 1) * 45;
                                        const centerX = 50;
                                        const centerY = 50;
                                        const x = centerX + radius * Math.cos(angle * Math.PI / 180);
                                        const y = centerY + radius * Math.sin(angle * Math.PI / 180);

                                        // Random rotation for natural look
                                        const rotation = (i * 47) % 60 - 30; // -30 to +30 degrees

                                        return (
                                            <span
                                                key={i}
                                                style={{
                                                    fontSize: `${size}px`,
                                                    fontWeight: Math.min(900, 600 + w.value * 50),
                                                    position: 'absolute',
                                                    left: `${Math.max(5, Math.min(90, x))}%`,
                                                    top: `${Math.max(10, Math.min(85, y))}%`,
                                                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                                    whiteSpace: 'nowrap'
                                                }}
                                                className={`text-transparent bg-clip-text bg-gradient-to-br ${colorClass} hover:scale-110 transition-transform cursor-default animate-fade-in`}
                                            >
                                                {w.text}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {(displayActivity.type === 'feedback' || displayActivity.type === 'qa') && liveResults.responses.map((res, idx) => (<div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/5 mb-3"><div className="flex justify-between items-start"><span className="font-bold text-sm text-blue-400 block mb-1">{res.studentName}</span><span className="text-[10px] text-gray-500">{new Date(res.timestamp?.seconds * 1000).toLocaleTimeString()}</span></div><p className="text-gray-200">{res.answer}</p></div>))}
                        </div>
                        <div className="mt-8">
                            <button onClick={() => setShowResults(false)} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showAnalyticsModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="glass-card bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar text-white">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">📊 Session Analytics</h2>
                            <button onClick={() => setShowAnalyticsModal(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>
                        {completedActivities.length === 0 ? (<p className="text-gray-500 text-center py-12 text-lg">No activities have been completed yet.</p>) : (
                            <div className="space-y-4">{completedActivities.map((act) => (<div key={act.id} className="p-6 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center hover:bg-white/10 transition"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xl">{act.activityType.charAt(0).toUpperCase()}</div><div><p className="text-lg font-bold text-white uppercase tracking-wide">{act.activityType}</p><p className="text-sm text-gray-400">{new Date(act.timestamp).toLocaleString()}</p></div></div><button onClick={() => Array.isArray(act.report) ? generateCombinedPDF(act.report) : generatePDF(act.report)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition">Download PDF</button></div>))}</div>
                        )}
                        {completedActivities.length > 0 && (<button onClick={() => generateCombinedPDF([...completedActivities].reverse().map(a => a.report).flat())} className="w-full mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-4 rounded-xl font-bold shadow-lg transition">📘 Download Full Session Report (All Activities)</button>)}
                    </div>
                </div>
            )}

            {showLeaderboard && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="glass-card bg-[#fffbeb] rounded-2xl shadow-2xl p-8 w-full max-w-5xl flex flex-col h-[85vh] relative overflow-hidden border border-white/20">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h2 className="text-4xl font-black text-amber-600 flex items-center gap-3 tracking-wide drop-shadow-sm"><span className="text-5xl">🏆</span> Leaderboard</h2>
                            <button onClick={() => { playSound('click'); setShowLeaderboard(false); }} className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95">✕ Close</button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-white/60 rounded-xl shadow-inner mb-6 border border-amber-200 p-4 custom-scrollbar">
                            {allParticipants.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4"><p className="text-2xl font-light">No players yet.</p></div>
                            ) : (
                                <table className="w-full">
                                    <thead className="sticky top-0 bg-[#fffbeb] text-gray-700 z-10 border-b-2 border-amber-200">
                                        <tr><th className="px-6 py-4 text-left text-xl font-bold text-gray-600">Rank</th><th className="px-6 py-4 text-left text-xl font-bold text-gray-600">Player</th><th className="px-4 py-4 text-center text-xl font-bold text-gray-600">Badges</th><th className="px-6 py-4 text-right text-xl font-bold text-gray-600">Points</th></tr>
                                    </thead>
                                    <tbody className="text-gray-700">
                                        {allParticipants.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, idx) => (
                                            <tr key={idx} className="border-b border-amber-100 hover:bg-amber-50 transition-colors">
                                                <td className="px-6 py-4"><span className="text-2xl font-bold text-gray-400">#{idx + 1}</span></td>
                                                <td className="px-6 py-4"><div className="flex items-center gap-4"><span className="text-3xl bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-sm border border-amber-100">{player.avatar || '👤'}</span><span className="text-xl font-bold text-gray-800">{player.name}</span></div></td>
                                                <td className="px-4 py-4 text-center"><div className="flex justify-center gap-2 flex-wrap">{player.badges && player.badges.map((b, i) => (<span key={i} className="text-2xl filter drop-shadow-sm" title="Badge">{b}</span>))}</div></td>
                                                <td className="px-6 py-4 text-right"><span className="text-3xl font-black text-amber-600">{player.score || 0}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="flex-shrink-0 text-center border-t border-amber-200 pt-6">
                            <div className="flex flex-wrap justify-center gap-8 text-amber-900/70 text-sm font-medium">
                                <span className="flex items-center gap-2"><b className="text-amber-700">Participation:</b> 10 pts</span>
                                <span className="flex items-center gap-2"><b className="text-amber-700">Correct:</b> +20 pts</span>
                                <span className="flex items-center gap-2"><b className="text-amber-700">Speed (&lt;3s):</b> +15 pts</span>
                                <span className="flex items-center gap-2"><b className="text-amber-700">Wordle Win:</b> +20 pts</span>
                                <span className="flex items-center gap-2"><b className="text-amber-700">Quality:</b> +15 pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showParticipants && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="glass-card bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-md text-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-white">Room Participants <span className="text-blue-400">({allParticipants.length})</span></h3>
                            <button onClick={() => setShowParticipants(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>
                        <div className="bg-white/5 rounded-xl border border-white/5 shadow-inner max-h-96 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {allParticipants.map((p, index) => (
                                <div key={index} className="p-3 flex items-center hover:bg-white/10 rounded-lg transition-colors gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-xl shadow-lg">
                                        {p.avatar || (p.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-gray-200 text-lg">{p.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherView;