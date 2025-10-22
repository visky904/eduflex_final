import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc, collection, addDoc, query, deleteDoc, getDocs } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCc2S--XG8PlVYFwopYOTBU23fg4LL2m1g",
  authDomain: "eduflex-53f92.firebaseapp.com",
  projectId: "eduflex-53f92",
  storageBucket: "eduflex-53f92.firebasestorage.app",
  messagingSenderId: "802519341041",
  appId: "1:802519341041:web:9b0773e818c1e53de1d650",
  measurementId: "G-BHB7FXL9KJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// --- Helper Functions & Constants ---
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let code = '';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += nums.charAt(Math.floor(Math.random() * nums.length));
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    code += nums.charAt(Math.floor(Math.random() * nums.length));
    code += nums.charAt(Math.floor(Math.random() * nums.length));
    return code;
};

// --- Profanity Filter ---
const PROFANITY_LIST = ['darn', 'heck', 'fuck', 'shit'/*more to add*/];

const filterProfanity = (text) => {
    if (typeof text !== 'string') return text;
    let filteredText = text;
    PROFANITY_LIST.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filteredText = filteredText.replace(regex, '***');
    });
    return filteredText;
};


// --- SVG Icons ---
const IconUsers = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const IconSettings = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconPlus = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconImage = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
);
const IconTrash = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
);
const IconChevronLeft = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><polyline points="15 18 9 12 15 6" /></svg>
);
const IconListCheck = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-3 flex-shrink-0"><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></svg>
);
const IconCloud = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-3 flex-shrink-0"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /></svg>
);
const IconSmile = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-3 flex-shrink-0"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
);
const IconMessageSquare = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-3 flex-shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);


// --- Teacher's Interaction Creation Components ---

const McqCreator = ({ activity, setActivity }) => {
    const handleAddOption = () => {
        setActivity(prev => ({ ...prev, options: [...prev.options, { text: '', isCorrect: false }] }));
    };

    const handleRemoveOption = (index) => {
        if (activity.options.length <= 2) return;
        const newOptions = activity.options.filter((_, i) => i !== index);
        setActivity(prev => ({ ...prev, options: newOptions }));
    };

    const handleOptionChange = (index, text) => {
        const newOptions = [...activity.options];
        newOptions[index].text = text;
        setActivity(prev => ({ ...prev, options: newOptions }));
    };

    const handleCorrectToggle = (index) => {
        const newOptions = [...activity.options];
        if (!activity.settings.allowMultiple) {
            newOptions.forEach((opt, i) => opt.isCorrect = i === index);
        } else {
            newOptions[index].isCorrect = !newOptions[index].isCorrect;
        }
        setActivity(prev => ({ ...prev, options: newOptions }));
    };

    const handleImageUpload = (e) => {
        if (e.target.files && e.target.files[0]) {
            const imageUrl = URL.createObjectURL(e.target.files[0]);
            setActivity(prev => ({ ...prev, image: imageUrl }));
        }
    };
    
    return (
        <div className="bg-gray-900 bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-700 animate-fade-in text-gray-200">
            <h3 className="text-xl font-semibold text-white mb-4">MCQ / Poll Creator</h3>
            <textarea
                className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-red-500 transition placeholder-gray-400"
                rows="3"
                placeholder="Type your question here..."
                value={activity.question}
                onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
            ></textarea>
            
            {activity.image && (
                <div className="mt-4 relative">
                    <img src={activity.image} alt="upload-preview" className="rounded-lg max-h-48 w-auto"/>
                    <button onClick={() => setActivity(prev => ({...prev, image: null}))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition">
                        <IconTrash />
                    </button>
                </div>
            )}

            <div className="mt-4 space-y-3">
                <h4 className="font-medium text-gray-300">Options</h4>
                {activity.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3">
                        {activity.settings.markCorrect && (
                            <input
                                type={activity.settings.allowMultiple ? "checkbox" : "radio"}
                                name="correct-option"
                                checked={option.isCorrect}
                                onChange={() => handleCorrectToggle(index)}
                                className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
                            />
                        )}
                        <input
                            type="text"
                            className="flex-grow p-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400"
                            placeholder={`Option ${index + 1}`}
                            value={option.text}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                        />
                        {activity.options.length > 2 && (
                            <button onClick={() => handleRemoveOption(index)} className="text-red-500 hover:text-red-400 transition">
                                <IconTrash />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button onClick={handleAddOption} className="mt-4 flex items-center text-red-500 hover:text-red-400 font-medium transition">
                <IconPlus /> Add Option
            </button>

            <div className="mt-6 border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-300 flex items-center"><IconSettings />Settings</h4>
                    <label htmlFor="image-upload" className="flex items-center text-red-500 hover:text-red-400 font-medium transition cursor-pointer">
                        <IconImage /> Add Image
                        <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                </div>
                <div className="mt-4 space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500" checked={activity.settings.markCorrect} onChange={e => setActivity(prev => ({ ...prev, settings: { ...prev.settings, markCorrect: e.target.checked } }))} />
                        <span>Enable 'Mark Correct Answer' (MCQ Mode)</span>
                    </label>
                    {activity.settings.markCorrect && (
                         <label className="flex items-center space-x-3 cursor-pointer pl-8">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500" checked={activity.settings.allowMultiple} onChange={e => setActivity(prev => ({ ...prev, settings: { ...prev.settings, allowMultiple: e.target.checked } }))} />
                            <span>Allow multiple correct answers</span>
                        </label>
                    )}
                </div>
            </div>
        </div>
    );
};

const WordCloudCreator = ({ activity, setActivity, liveResults }) => {
    const handleImageUpload = (e) => {
        if (e.target.files && e.target.files[0]) {
            const imageUrl = URL.createObjectURL(e.target.files[0]);
            setActivity(prev => ({ ...prev, image: imageUrl }));
        }
    };

    return (
        <div>
            <div className="bg-gray-900 bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-700 animate-fade-in text-gray-200">
                <h3 className="text-xl font-semibold text-white mb-4">Word Cloud Creator</h3>
                <textarea
                    className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-red-500 transition placeholder-gray-400"
                    rows="3"
                    placeholder="Enter your prompt for the word cloud..."
                    value={activity.question}
                    onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
                ></textarea>
                {activity.image && (
                    <div className="mt-4 relative">
                        <img src={activity.image} alt="upload-preview" className="rounded-lg max-h-48 w-auto"/>
                        <button onClick={() => setActivity(prev => ({...prev, image: null}))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition">
                            <IconTrash />
                        </button>
                    </div>
                )}
                <div className="mt-6 border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-300 flex items-center"><IconSettings />Settings</h4>
                        <label htmlFor="image-upload-wc" className="flex items-center text-red-500 hover:text-red-400 font-medium transition cursor-pointer">
                            <IconImage /> Add Image
                            <input id="image-upload-wc" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                    <div className="mt-4 space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500" checked={activity.settings.allowMultiple} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, allowMultiple: e.target.checked}}))} />
                            <span>Allow multiple entries per student</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500" checked={activity.settings.profanityFilter} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, profanityFilter: e.target.checked}}))} />
                            <span>Enable profanity filter</span>
                        </label>
                    </div>
                </div>
            </div>

            {liveResults && liveResults.words && liveResults.words.length > 0 && (
                <div className="mt-8 p-6 bg-gray-900 bg-opacity-75 rounded-lg border border-gray-700">
                   <h4 className="text-lg font-semibold text-white mb-4">Live Word Cloud</h4>
                   <div className="text-center p-4 min-h-[10rem] flex items-center justify-center flex-wrap">
                       {liveResults.words.map((w,i) => (
                           <span key={i} style={{fontSize: `${Math.min(48, Math.max(12, 10 + w.value*2))}px`, margin: '4px 8px', display: 'inline-block', fontWeight: '600', color: `hsl(${200 + i*25}, 80%, 70%)`}}>
                               {w.text}
                           </span>
                       ))}
                   </div>
                </div>
            )}
        </div>
    );
};


const ReviewsCreator = ({ activity, setActivity }) => (
    <div className="bg-gray-900 bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-700 animate-fade-in text-gray-200">
        <h3 className="text-xl font-semibold text-white mb-4">Reviews / Feedback Creator</h3>
        <textarea
            className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-red-500 transition placeholder-gray-400"
            rows="3"
            placeholder="Enter your prompt for feedback..."
            value={activity.question}
            onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
        ></textarea>
        
        <div className="mt-6 border-t border-gray-700 pt-4">
            <h4 className="font-medium text-gray-300 flex items-center"><IconSettings />Settings</h4>
            <div className="mt-4">
                <span className="text-gray-300">Review Style</span>
                <div className="mt-2 flex rounded-lg shadow-sm">
                    <button
                        onClick={() => setActivity(prev => ({...prev, settings: {...prev.settings, reviewStyle: 'emoji'}}))}
                        className={`px-4 py-2 text-sm font-medium rounded-l-lg transition ${activity.settings.reviewStyle === 'emoji' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                        😄 Emojis
                    </button>
                    <button
                        onClick={() => setActivity(prev => ({...prev, settings: {...prev.settings, reviewStyle: 'stars'}}))}
                        className={`px-4 py-2 text-sm font-medium rounded-r-lg transition ${activity.settings.reviewStyle === 'stars' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                    >
                        ⭐️ Stars
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const ShortFeedbackCreator = ({ activity, setActivity, liveResults, onDelete }) => {
    return (
        <div>
            <div className="bg-gray-900 bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-700 animate-fade-in text-gray-200">
                <h3 className="text-xl font-semibold text-white mb-4">Short Feedback Creator</h3>
                <textarea
                    className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-red-500 transition placeholder-gray-400"
                    rows="3"
                    placeholder="Enter your question or prompt (e.g., How was your day?)"
                    value={activity.question}
                    onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
                ></textarea>
                
                <div className="mt-6 border-t border-gray-700 pt-4">
                    <h4 className="font-medium text-gray-300 flex items-center"><IconSettings />Settings</h4>
                    <div className="mt-4 space-y-3">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500" checked={activity.settings.profanityFilter} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, profanityFilter: e.target.checked}}))} />
                            <span>Enable profanity filter</span>
                        </label>
                    </div>
                </div>
            </div>

            {liveResults && liveResults.responses && liveResults.responses.length > 0 && (
                <div className="mt-8 p-6 bg-gray-900 bg-opacity-75 rounded-lg border border-gray-700">
                    <h4 className="text-lg font-semibold text-white mb-4">Live Feedback</h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {liveResults.responses.map((res) => (
                           <div key={res.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center text-gray-300">
                               <p>{res.answer}</p>
                               <button onClick={() => onDelete(res.id)} className="text-red-500 hover:text-red-400 p-1 rounded-full transition-colors">
                                    <IconTrash />
                               </button>
                           </div>
                       ))}
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Teacher View ---
const TeacherView = ({ setView, roomCode }) => {
    const [sessionTopic, setSessionTopic] = useState('');
    const [currentActivityType, setCurrentActivityType] = useState('mcq');
    
    const [showParticipants, setShowParticipants] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSessionLive, setIsSessionLive] = useState(false);
    const [liveResponses, setLiveResponses] = useState([]);
    
    const [activity, setActivity] = useState({
        type: 'mcq',
        question: '',
        image: null,
        options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
        settings: {
            markCorrect: true,
            allowMultiple: false,
            profanityFilter: true,
            reviewStyle: 'emoji',
        }
    });

    useEffect(() => {
        if (!roomCode) return;

        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const responses = [];
            querySnapshot.forEach((doc) => {
                responses.push({ id: doc.id, ...doc.data() });
            });
            setLiveResponses(responses);
        });

        return () => unsubscribe();
    }, [roomCode]);

    useEffect(() => {
        const baseSettings = {
            markCorrect: false, allowMultiple: false, profanityFilter: true, reviewStyle: 'emoji',
        };
        const newActivity = { question: '', image: null, options: [], settings: baseSettings };

        if (currentActivityType === 'mcq') {
            setActivity({ ...newActivity, type: 'mcq', options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }], settings: { ...baseSettings, markCorrect: true } });
        } else if (currentActivityType === 'wordcloud') {
             setActivity({ ...newActivity, type: 'wordcloud', settings: { ...baseSettings, allowMultiple: true, profanityFilter: false } }); // Profanity filter removed
        } else if (currentActivityType === 'reviews') {
             setActivity({ ...newActivity, type: 'reviews', settings: { ...baseSettings, reviewStyle: 'emoji' } });
        } else if (currentActivityType === 'feedback') {
            setActivity({ ...newActivity, type: 'feedback', settings: { ...baseSettings, profanityFilter: true }});
        }
    }, [currentActivityType]);
    
    const liveResults = useMemo(() => {
        if (!activity) return { total: 0, responses: [] };

        const total = liveResponses.length;

        if (activity.type === 'mcq') {
            const responses = activity.options.map(option => {
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

        return { total: 0, responses: [] };
    }, [liveResponses, activity]);
    
    const renderCreator = () => {
        switch (currentActivityType) {
            case 'mcq': return <McqCreator activity={activity} setActivity={setActivity} />;
            case 'wordcloud': return <WordCloudCreator activity={activity} setActivity={setActivity} liveResults={liveResults} />;
            case 'reviews': return <ReviewsCreator activity={activity} setActivity={setActivity} />;
            case 'feedback': return <ShortFeedbackCreator activity={activity} setActivity={setActivity} liveResults={liveResults} onDelete={handleDeleteFeedback} />;
            default: return null;
        }
    };

    const handleStartSession = async () => {
        if(activity.question.trim() === '') {
            alert('Please enter a question or prompt for the activity.');
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

        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            isSessionLive: true,
            currentActivity: activity,
        });
        setIsSessionLive(true);
    };

    const handleStopSession = async () => {
        const sessionRef = doc(db, 'sessions', roomCode);
        await updateDoc(sessionRef, {
            isSessionLive: false,
            currentActivity: null,
        });
        setIsSessionLive(false);
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

    const sidebarItems = [
        { id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> },
        { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> },
        { id: 'reviews', name: 'Reviews', icon: <IconSmile /> },
        { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> },
    ];

    return (
        <div className="flex h-screen bg-red-900 font-sans">
            {/* Sidebar */}
            <aside className={`bg-gray-900 text-gray-300 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className={`flex items-center justify-between p-4 border-b border-gray-700 ${isSidebarOpen ? 'h-16' : ''}`}>
                    {isSidebarOpen && <h1 className="text-xl font-bold text-white whitespace-nowrap">Activities</h1>}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
                        {isSidebarOpen ? <IconChevronLeft /> : <div className="text-2xl font-bold">»</div>}
                    </button>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {sidebarItems.map(item => (
                        <button key={item.id} onClick={() => setCurrentActivityType(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${isSidebarOpen ? '' : 'justify-center'} ${currentActivityType === item.id ? 'bg-red-600 text-white' : 'hover:bg-gray-700 hover:text-white'}`}
                        >
                            {item.icon}
                            {isSidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-y-auto bg-red-900">
                 <header className="bg-gray-900 shadow-lg p-4 border-b border-gray-700 flex flex-col md:flex-row items-center justify-between sticky top-0 z-10">
                    <input 
                        type="text"
                        placeholder="Enter Session Topic..."
                        className="w-full md:w-1/3 text-lg font-semibold text-white bg-transparent border-b-2 border-transparent focus:border-red-500 outline-none p-2 transition placeholder-gray-400"
                        value={sessionTopic}
                        onChange={e => setSessionTopic(e.target.value)}
                    />
                    <div className="flex items-center space-x-4 mt-4 md:mt-0">
                         <div className="text-center">
                            <span className="text-xs text-gray-400">Room Code</span>
                            <p className="text-2xl font-bold tracking-widest text-red-500">{roomCode}</p>
                        </div>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center bg-gray-700 text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                            <IconUsers /> <span className="hidden sm:inline">Participants ({liveResponses.length})</span>
                        </button>
                        <button onClick={() => setView('home')} className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                           Exit
                        </button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {renderCreator()}
                </div>
                
                 <footer className="bg-gray-900 p-4 border-t border-gray-700 flex items-center justify-center sticky bottom-0 z-10">
                    {isSessionLive && (
                        <div className="mr-6 text-center">
                             <p className="font-bold text-green-500">Interaction is Live!</p>
                             <button onClick={() => setShowResults(true)} className="text-sm text-red-500 hover:underline">
                                 View Analysis Modal
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={handleStartSession}
                        disabled={isSessionLive}
                        className={`px-8 py-3 text-lg font-bold rounded-full transition text-white ${isSessionLive ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg transform hover:-translate-y-1'}`}
                    >
                        {isSessionLive ? 'Live' : 'Start Interaction'}
                    </button>
                    {isSessionLive && (
                         <button 
                            onClick={handleStopSession}
                            className="ml-4 px-8 py-3 text-lg font-bold rounded-full transition bg-gray-600 hover:bg-gray-700 text-white shadow-lg transform hover:-translate-y-1"
                        >
                            Stop
                        </button>
                    )}
                </footer>
            </main>

            {/* Analysis Modal */}
            {showResults && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 w-full max-w-lg text-white">
                        <h3 className="text-2xl font-bold mb-4 text-white">Live Results</h3>
                        <p className="mb-4 text-gray-300">Total Responses: <span className="font-bold">{liveResults.total}</span></p>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {activity.type === 'mcq' && liveResults.responses.map((res, i) => (
                               <div key={i}>
                                   <div className="flex justify-between mb-1">
                                       <span className="text-base font-medium text-gray-200">{res.option}</span>
                                       <span className="text-sm font-medium text-gray-300">{res.count} votes</span>
                                   </div>
                                   <div className="w-full bg-gray-700 rounded-full h-4">
                                       <div className="bg-red-600 h-4 rounded-full" style={{width: `${liveResults.total > 0 ? (res.count/liveResults.total)*100 : 0}%`}}></div>
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
                               <div className="text-center p-4 bg-gray-900 rounded-lg flex flex-wrap justify-center items-center">
                                    {liveResults.words.map((w,i) => (
                                        <span key={i} style={{fontSize: `${Math.min(48, Math.max(12, 10 + w.value*2))}px`, margin: '4px 8px', display: 'inline-block', fontWeight: '600', color: `hsl(${200 + i*25}, 80%, 70%)`}}>
                                            {w.text}
                                        </span>
                                    ))}
                               </div>
                           )}
                           {activity.type === 'feedback' && liveResults.responses.map((res) => (
                               <div key={res.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                   <p className="text-gray-200">{res.answer}</p>
                                   <button onClick={() => handleDeleteFeedback(res.id)} className="text-red-500 hover:text-red-400 p-1 rounded-full">
                                        <IconTrash />
                                   </button>
                               </div>
                           ))}
                        </div>
                        <button onClick={() => setShowResults(false)} className="mt-6 w-full bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
                    </div>
                </div>
            )}
            
            {/* Participants Modal */}
            {showParticipants && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in-fast">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl p-6 w-full max-w-md text-white">
                        <h3 className="text-2xl font-bold mb-4 text-white">Participants ({liveResponses.length})</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {liveResponses.length > 0 ? (
                               <p className="text-gray-400">A list of participant names would appear here in a future version.</p>
                           ) : (
                               <p className="text-gray-400">No one has responded yet.</p>
                           )}
                        </div>
                        <button onClick={() => setShowParticipants(false)} className="mt-6 w-full bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Student View ---
const StudentView = ({ setView }) => {
    const [enteredCode, setEnteredCode] = useState('');
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState({ isSessionLive: false, currentActivity: null });

    useEffect(() => {
        if (sessionData.isSessionLive) {
            setSubmitted(false);
            setFeedbackText("");
        }
    }, [sessionData.isSessionLive, sessionData.currentActivity]);

    const handleJoin = async (e) => {
        e.preventDefault();
        setError(""); 
        if (!enteredCode) {
            setError("Please enter a room code.");
            return;
        }
        
        const sessionRef = doc(db, 'sessions', enteredCode);
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
        if (!joined || !enteredCode) return;

        const sessionRef = doc(db, 'sessions', enteredCode);
        const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
            if (docSnap.exists()) {
                setSessionData(docSnap.data());
            } else {
                alert("The session has ended.");
                setView('home');
            }
        });

        return () => unsubscribe();
    }, [joined, enteredCode, setView]);

    const handleSubmit = async (answerPayload) => {
        if (!enteredCode || !sessionData.currentActivity) return;
        
        let finalAnswer = answerPayload;
        if (sessionData.currentActivity.settings.profanityFilter && sessionData.currentActivity.type !== 'wordcloud') {
            finalAnswer = filterProfanity(answerPayload);
        }

        const responsesCol = collection(db, 'sessions', enteredCode, 'responses');
        try {
            await addDoc(responsesCol, {
                answer: finalAnswer,
                type: sessionData.currentActivity.type,
                timestamp: new Date()
            });
            setSubmitted(true);
        } catch (error) {
            console.error("Error submitting response:", error);
            alert("Could not submit your response. Please try again.");
        }
    };
    
    const renderActivity = () => {
        if(submitted) {
            return (
                <div className="text-center animate-fade-in">
                    <h2 className="text-2xl font-bold text-gray-800">Thank you!</h2>
                    <p className="mt-2 text-gray-600">Your response has been submitted. Waiting for the next activity.</p>
                </div>
            )
        }
        
        if (!sessionData.currentActivity) return null;
        
        const { currentActivity } = sessionData;

        switch(currentActivity.type) {
            case 'mcq':
                return (
                    <div className="w-full animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentActivity.question}</h2>
                        {currentActivity.image && <img src={currentActivity.image} alt="activity" className="rounded-lg mb-4 max-h-64 w-auto mx-auto"/>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentActivity.options.map((opt, i) => (
                                <button key={i} onClick={() => handleSubmit(opt.text)} className="p-4 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition transform hover:scale-105">
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
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 transition"
                                rows="4"
                                placeholder="Type your word(s) here..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                            ></textarea>
                            <button type="submit" className="w-full mt-4 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition shadow-md">
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
                                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 transition"
                                rows="4"
                                placeholder="Type your feedback here..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                            ></textarea>
                            <button type="submit" className="w-full mt-4 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition shadow-md">
                                Submit
                            </button>
                        </form>
                   </div>
                )
            default:
                 return <p>Unknown activity type</p>;
        }
    }

    if (!joined) {
        return (
             <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Join Session</h1>
                    <p className="text-center text-gray-600 mb-6">Enter the code provided by your teacher.</p>
                    <form onSubmit={handleJoin} className="bg-white shadow-lg rounded-lg p-8">
                        <input
                            type="text"
                            maxLength="6"
                            value={enteredCode}
                            onChange={e => setEnteredCode(e.target.value.trim().toUpperCase())}
                            placeholder="AANANN"
                            className="w-full p-4 text-center text-2xl tracking-widest border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                        />
                        {error && <p className="text-red-500 text-center mt-4">{error}</p>}
                        <button type="submit" className="w-full mt-6 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition shadow-md">
                            Join
                        </button>
                    </form>
                     <button onClick={() => setView('home')} className="mt-6 text-gray-600 hover:text-red-600 transition">
                         Back to Home
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-200 flex flex-col items-center justify-center p-4 text-center">
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
const HomePage = ({ setView }) => {
    return (
        <div className="min-h-screen bg-red-900 flex items-center justify-center">
            <div className="text-center p-4">
                <h1 className="text-5xl font-extrabold text-white mb-4">Interactive Classroom</h1>
                <p className="text-lg text-red-100 mb-12">Engage, Interact, and Learn in Real-Time</p>
                <div className="space-y-4 sm:space-y-0 sm:space-x-6 flex flex-col sm:flex-row justify-center">
                    <button onClick={() => setView('teacher')} className="bg-red-600 text-white font-bold py-4 px-8 rounded-lg text-lg hover:bg-red-700 transition shadow-lg transform hover:-translate-y-1">
                        Create Session
                    </button>
                    <button onClick={() => setView('student')} className="bg-white text-red-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-gray-50 transition shadow-lg border-2 border-red-600 transform hover:-translate-y-1">
                        Join Session
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('home'); 
    const [roomCode, setRoomCode] = useState(null);

    const handleSetView = async (newView) => {
        if (newView === 'teacher') {
            const newRoomCode = generateRoomCode();
            const sessionRef = doc(db, 'sessions', newRoomCode);
            try {
                await setDoc(sessionRef, {
                    roomCode: newRoomCode,
                    isSessionLive: false,
                    currentActivity: null,
                });
                setRoomCode(newRoomCode);
                setView('teacher');
            } catch (error) {
                console.error("Error creating session in Firestore: ", error);
                alert("Could not create a new session. Please check your connection and Firebase setup.");
            }
        } else {
            setView(newView);
        }
    };

    switch (view) {
        case 'teacher':
            return <TeacherView setView={handleSetView} roomCode={roomCode} />;
        case 'student':
            return <StudentView setView={handleSetView} />;
        default:
            return <HomePage setView={handleSetView} />;
    }
}

