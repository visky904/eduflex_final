import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc, collection, addDoc, query, deleteDoc, getDocs } from 'firebase/firestore';
import { playSound, generateRoomCode, filterProfanity } from './utils/helpers';
import { generatePDF } from './utils/pdfGenerator';
import { IconUsers, IconSettings, IconPlus, IconImage, IconTrash, IconChevronLeft, IconListCheck, IconCloud, IconSmile, IconMessageSquare, IconHelpCircle, IconLink, IconCopy } from './components/Icons';

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

// --- Teacher's Interaction Creation Components ---

const McqCreator = ({ activity, setActivity }) => {
    const handleAddQuestion = () => {
        const newQuestion = {
            id: Date.now(),
            question: '',
            image: null,
            options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }]
        };
        setActivity(prev => ({
            ...prev,
            questions: [...(prev.questions || []), newQuestion],
            currentQuestionIndex: (prev.questions || []).length
        }));
    };

    const handleUpdateQuestion = (id, field, value) => {
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === id ? { ...q, [field]: value } : q)
        }));
    };

    const handleAddOption = () => {
        const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
        if (!currentQ) return;
        
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => 
                q.id === currentQ.id 
                    ? { ...q, options: [...q.options, { text: '', isCorrect: false }] }
                    : q
            )
        }));
    };

    const handleRemoveOption = (index) => {
        const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
        if (!currentQ || currentQ.options.length <= 2) return;
        
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => 
                q.id === currentQ.id 
                    ? { ...q, options: q.options.filter((_, i) => i !== index) }
                    : q
            )
        }));
    };

    const handleOptionChange = (index, text) => {
        const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
        if (!currentQ) return;
        
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => {
                if (q.id === currentQ.id) {
                    const newOptions = [...q.options];
                    newOptions[index].text = text;
                    return { ...q, options: newOptions };
                }
                return q;
            })
        }));
    };

    const handleCorrectToggle = (index) => {
        const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
        if (!currentQ) return;
        
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => {
                if (q.id === currentQ.id) {
                    const newOptions = [...q.options];
                    if (!activity.settings.allowMultiple) {
                        newOptions.forEach((opt, i) => opt.isCorrect = i === index);
                    } else {
                        newOptions[index].isCorrect = !newOptions[index].isCorrect;
                    }
                    return { ...q, options: newOptions };
                }
                return q;
            })
        }));
    };

    const handleImageUpload = (e) => {
        const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
        if (!currentQ || !e.target.files || !e.target.files[0]) return;
        
        const imageUrl = URL.createObjectURL(e.target.files[0]);
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => 
                q.id === currentQ.id ? { ...q, image: imageUrl } : q
            )
        }));
    };

    const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];
    
    return (
        <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 animate-fade-in text-gray-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">MCQ / Poll Creator</h3>
                <button
                    onClick={handleAddQuestion}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center"
                >
                    <IconPlus /> Add Question
                </button>
            </div>

            {activity.questions && activity.questions.length > 0 && (
                <div className="mb-6">
                    <div className="flex space-x-2 overflow-x-auto pb-2">
                        {activity.questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => setActivity(prev => ({ ...prev, currentQuestionIndex: idx }))}
                                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                                    activity.currentQuestionIndex === idx
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-600'
                                }`}
                            >
                                Q{idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {currentQ && (
                <div>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 transition placeholder-gray-500"
                        rows="3"
                        placeholder="Type your question here..."
                        value={currentQ.question}
                        onChange={(e) => handleUpdateQuestion(currentQ.id, 'question', e.target.value)}
                    ></textarea>
            
                    {currentQ.image && (
                        <div className="mt-4 relative">
                            <img src={currentQ.image} alt="upload-preview" className="rounded-lg max-h-48 w-auto"/>
                            <button onClick={() => handleUpdateQuestion(currentQ.id, 'image', null)} className="absolute top-2 right-2 bg-teal-600 text-white rounded-full p-1.5 hover:bg-teal-700 transition">
                                <IconTrash />
                            </button>
                        </div>
                    )}

                    <div className="mt-4 space-y-3">
                        <h4 className="font-medium text-gray-600">Options</h4>
                        {currentQ.options.map((option, index) => (
                            <div key={index} className="flex items-center space-x-3">
                                {activity.settings.markCorrect && (
                                    <input
                                        type={activity.settings.allowMultiple ? "checkbox" : "radio"}
                                        name={`correct-option-${currentQ.id}`}
                                        checked={option.isCorrect}
                                        onChange={() => handleCorrectToggle(index)}
                                        className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500"
                                    />
                                )}
                                <input
                                    type="text"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500"
                                    placeholder={`Option ${index + 1}`}
                                    value={option.text}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                />
                                {currentQ.options.length > 2 && (
                                    <button onClick={() => handleRemoveOption(index)} className="text-teal-500 hover:text-teal-400 transition">
                                        <IconTrash />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button onClick={handleAddOption} className="mt-4 flex items-center text-teal-500 hover:text-teal-400 font-medium transition">
                        <IconPlus /> Add Option
                    </button>

                    <div className="mt-6 border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-600 flex items-center"><IconSettings />Settings</h4>
                            <label htmlFor={`image-upload-${currentQ.id}`} className="flex items-center text-teal-500 hover:text-teal-400 font-medium transition cursor-pointer">
                                <IconImage /> Add Image
                                <input id={`image-upload-${currentQ.id}`} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        </div>
                        <div className="mt-4 space-y-3">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input type="checkbox" className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500" checked={activity.settings.markCorrect} onChange={e => setActivity(prev => ({ ...prev, settings: { ...prev.settings, markCorrect: e.target.checked } }))} />
                                <span>Enable 'Mark Correct Answer' (MCQ Mode)</span>
                            </label>
                            {activity.settings.markCorrect && (
                                 <label className="flex items-center space-x-3 cursor-pointer pl-8">
                                    <input type="checkbox" className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500" checked={activity.settings.allowMultiple} onChange={e => setActivity(prev => ({ ...prev, settings: { ...prev.settings, allowMultiple: e.target.checked } }))} />
                                    <span>Allow multiple correct answers</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
            <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 animate-fade-in text-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Word Cloud Creator</h3>
                <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 transition placeholder-gray-500"
                    rows="3"
                    placeholder="Enter your prompt for the word cloud..."
                    value={activity.question}
                    onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
                ></textarea>
                {activity.image && (
                    <div className="mt-4 relative">
                        <img src={activity.image} alt="upload-preview" className="rounded-lg max-h-48 w-auto"/>
                        <button onClick={() => setActivity(prev => ({...prev, image: null}))} className="absolute top-2 right-2 bg-teal-600 text-white rounded-full p-1.5 hover:bg-teal-700 transition">
                            <IconTrash />
                        </button>
                    </div>
                )}
                <div className="mt-6 border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-600 flex items-center"><IconSettings />Settings</h4>
                        <label htmlFor="image-upload-wc" className="flex items-center text-teal-500 hover:text-teal-400 font-medium transition cursor-pointer">
                            <IconImage /> Add Image
                            <input id="image-upload-wc" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                    <div className="mt-4 space-y-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500" checked={activity.settings.allowMultiple} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, allowMultiple: e.target.checked}}))} />
                            <span>Allow multiple entries per student</span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500" checked={activity.settings.profanityFilter} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, profanityFilter: e.target.checked}}))} />
                            <span>Enable profanity filter</span>
                        </label>
                    </div>
                </div>
            </div>

            {liveResults && liveResults.words && liveResults.words.length > 0 && (
                <div className="mt-8 p-6 bg-white bg-opacity-75 rounded-lg border border-gray-200">
                   <h4 className="text-lg font-semibold text-gray-900 mb-4">Live Word Cloud</h4>
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
    <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 animate-fade-in text-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Reviews / Feedback Creator</h3>
        <textarea
            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 transition placeholder-gray-500"
            rows="3"
            placeholder="Enter your prompt for feedback..."
            value={activity.question}
            onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
        ></textarea>
        
        <div className="mt-6 border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-600 flex items-center"><IconSettings />Settings</h4>
            <div className="mt-4">
                <span className="text-gray-600">Review Style</span>
                <div className="mt-2 flex rounded-lg shadow-sm">
                    <button
                        onClick={() => setActivity(prev => ({...prev, settings: {...prev.settings, reviewStyle: 'emoji'}}))}
                        className={`px-4 py-2 text-sm font-medium rounded-l-lg transition ${activity.settings.reviewStyle === 'emoji' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-600'}`}
                    >
                        😄 Emojis
                    </button>
                    <button
                        onClick={() => setActivity(prev => ({...prev, settings: {...prev.settings, reviewStyle: 'stars'}}))}
                        className={`px-4 py-2 text-sm font-medium rounded-r-lg transition ${activity.settings.reviewStyle === 'stars' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-600'}`}
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
            <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 animate-fade-in text-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Short Feedback Creator</h3>
                <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 transition placeholder-gray-500"
                    rows="3"
                    placeholder="Enter your question or prompt (e.g., How was your day?)"
                    value={activity.question}
                    onChange={(e) => setActivity(prev => ({ ...prev, question: e.target.value }))}
                ></textarea>
                
                <div className="mt-6 border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-600 flex items-center"><IconSettings />Settings</h4>
                    <div className="mt-4 space-y-3">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-teal-600 bg-gray-100 border-gray-300 rounded focus:ring-teal-500" checked={activity.settings.profanityFilter} onChange={e => setActivity(prev => ({...prev, settings: {...prev.settings, profanityFilter: e.target.checked}}))} />
                            <span>Enable profanity filter</span>
                        </label>
                    </div>
                </div>
            </div>

            {liveResults && liveResults.responses && liveResults.responses.length > 0 && (
                <div className="mt-8 p-6 bg-white bg-opacity-75 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Live Feedback</h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {liveResults.responses.map((res) => (
                           <div key={res.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center text-gray-600">
                               <p>{res.answer}</p>
                               <button onClick={() => onDelete(res.id)} className="text-teal-500 hover:text-teal-400 p-1 rounded-full transition-colors">
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

const WordleCreator = ({ activity, setActivity }) => {
    return (
        <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 text-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Wordle Game Creator</h3>
            <p className="text-gray-500 mb-2">
                Choose a secret 5-letter word. Students will have 6 attempts to guess it.
            </p>
            <input
                type="text"
                maxLength="5"
                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-center text-2xl tracking-widest uppercase focus:ring-2 focus:ring-teal-500 transition"
                placeholder="APPLE"
                value={activity.wordleAnswer || ''}
                onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                    setActivity(prev => ({ ...prev, wordleAnswer: val }));
                }}
            />
            <p className="mt-4 text-sm text-gray-500">
                Once you click <span className="font-semibold text-gray-900">Start Interaction</span>, the word is locked and students can start guessing!
            </p>
        </div>
    );
};

const QaCreator = ({ activity, setActivity, liveResults, onDelete }) => {
    const handleAddQuestion = () => {
        const newQuestion = {
            id: Date.now(),
            text: '',
            type: 'short', // 'short', 'long', or 'multiple'
            options: [],
            correctAnswer: '',
            timeLimit: 60
        };
        setActivity(prev => ({
            ...prev,
            questions: [...(prev.questions || []), newQuestion],
            currentQuestionIndex: (prev.questions || []).length
        }));
    };

    const handleRemoveQuestion = (id) => {
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== id)
        }));
    };

    const handleUpdateQuestion = (id, field, value) => {
        setActivity(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.id === id ? { ...q, [field]: value } : q)
        }));
    };

    const currentQ = activity.questions?.[activity.currentQuestionIndex || 0];

    return (
        <div>
            <div className="bg-white bg-opacity-75 p-6 rounded-lg shadow-lg border border-gray-200 animate-fade-in text-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">Q&A Session Creator</h3>
                    <button
                        onClick={handleAddQuestion}
                        className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center"
                    >
                        <IconPlus /> Add Question
                    </button>
                </div>

                {activity.questions && activity.questions.length > 0 && (
                    <div className="mb-6">
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                            {activity.questions.map((q, idx) => (
                                <button
                                    key={q.id}
                                    onClick={() => setActivity(prev => ({ ...prev, currentQuestionIndex: idx }))}
                                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                                        activity.currentQuestionIndex === idx
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-600'
                                    }`}
                                >
                                    Q{idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {currentQ && (
                    <div className="space-y-4">
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:ring-2 focus:ring-teal-500 transition placeholder-gray-500"
                            rows="3"
                            placeholder="Enter your question..."
                            value={currentQ.text}
                            onChange={(e) => handleUpdateQuestion(currentQ.id, 'text', e.target.value)}
                        ></textarea>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500 block mb-2">Question Type</label>
                                <select
                                    value={currentQ.type}
                                    onChange={(e) => handleUpdateQuestion(currentQ.id, 'type', e.target.value)}
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-teal-500 transition"
                                >
                                    <option value="short">Short Answer</option>
                                    <option value="long">Long Answer</option>
                                    <option value="multiple">Multiple Choice</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-gray-500 block mb-2">Time Limit (sec)</label>
                                <input
                                    type="number"
                                    min="10"
                                    max="300"
                                    value={currentQ.timeLimit}
                                    onChange={(e) => handleUpdateQuestion(currentQ.id, 'timeLimit', parseInt(e.target.value))}
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-teal-500 transition"
                                />
                            </div>
                        </div>

                        {currentQ.type === 'multiple' && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm text-gray-500">Options</label>
                                    <button
                                        onClick={() => {
                                            const newOptions = currentQ.options || [];
                                            newOptions.push('');
                                            handleUpdateQuestion(currentQ.id, 'options', newOptions);
                                        }}
                                        className="text-teal-500 hover:text-teal-400 text-sm transition"
                                    >
                                        + Add Option
                                    </button>
                                </div>
                                {(currentQ.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOptions = [...currentQ.options];
                                                newOptions[idx] = e.target.value;
                                                handleUpdateQuestion(currentQ.id, 'options', newOptions);
                                            }}
                                            className="flex-1 p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-teal-500 transition"
                                            placeholder={`Option ${idx + 1}`}
                                        />
                                        <button
                                            onClick={() => {
                                                const newOptions = currentQ.options.filter((_, i) => i !== idx);
                                                handleUpdateQuestion(currentQ.id, 'options', newOptions);
                                            }}
                                            className="text-teal-500 hover:text-teal-400 p-2 transition"
                                        >
                                            <IconTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-gray-500 block mb-2">
                                {currentQ.type === 'multiple' ? 'Correct Answer' : 'Expected Answer (for reference)'}
                            </label>
                            <input
                                type="text"
                                value={currentQ.correctAnswer}
                                onChange={(e) => handleUpdateQuestion(currentQ.id, 'correctAnswer', e.target.value)}
                                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-teal-500 transition"
                                placeholder="Enter correct/reference answer"
                            />
                        </div>

                        <button
                            onClick={() => handleRemoveQuestion(currentQ.id)}
                            className="w-full mt-4 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center justify-center"
                        >
                            <IconTrash /> Delete This Question
                        </button>
                    </div>
                )}
            </div>

            {liveResults && liveResults.responses && liveResults.responses.length > 0 && (
                <div className="mt-8 p-6 bg-white bg-opacity-75 rounded-lg border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Live Responses ({liveResults.responses.length})</h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {liveResults.responses.map((res) => (
                            <div key={res.id} className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-gray-600 font-medium">{res.studentName || 'Student'}</p>
                                <p className="text-gray-500 text-sm">{res.answer}</p>
                                <button onClick={() => onDelete(res.id)} className="text-teal-500 hover:text-teal-400 text-sm mt-2 transition">
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Session Report Generator ---
const generateSessionReport = (activity, responses, topic, roomCode) => {
    const report = {
        topic: topic || 'Untitled Session',
        roomCode: roomCode,
        activityType: activity.type,
        timestamp: new Date().toLocaleString(),
        totalParticipants: responses.length,
        participants: [],
        analysis: {}
    };

    // Get unique participants
    const participantNames = [...new Set(responses.map(r => r.studentName || 'Anonymous'))];
    report.participants = participantNames;

    // Generate analysis based on activity type
    switch (activity.type) {
        case 'mcq':
            const answerCounts = {};
            responses.forEach(r => {
                answerCounts[r.answer] = (answerCounts[r.answer] || 0) + 1;
            });
            
            const currentMcqQ = activity.questions?.[0] || activity;
            const correctAnswer = (currentMcqQ.options || activity.options || []).find(opt => opt.isCorrect)?.text;
            const correctCount = answerCounts[correctAnswer] || 0;
            
            report.analysis = {
                question: currentMcqQ.question || activity.question,
                questions: activity.questions || [],
                totalResponses: responses.length,
                answerDistribution: answerCounts,
                correctAnswer: correctAnswer,
                correctResponses: correctCount,
                accuracy: responses.length > 0 ? ((correctCount / responses.length) * 100).toFixed(1) + '%' : '0%',
                studentAnswers: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer,
                    isCorrect: r.answer === correctAnswer
                }))
            };
            break;

        case 'qa':
            report.analysis = {
                questions: activity.questions || [],
                totalResponses: responses.length,
                responses: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer,
                    timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
                }))
            };
            break;

        case 'wordcloud':
            const wordFrequency = {};
            responses.forEach(r => {
                const words = r.answer.toLowerCase().split(/\s+/);
                words.forEach(word => {
                    if (word.length > 2) {
                        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
                    }
                });
            });
            report.analysis = {
                question: activity.question,
                totalWords: Object.keys(wordFrequency).length,
                topWords: Object.entries(wordFrequency)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([word, count]) => ({ word, count })),
                allResponses: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    text: r.answer
                }))
            };
            break;

        case 'reviews':
            const reviewCounts = {};
            responses.forEach(r => {
                reviewCounts[r.answer] = (reviewCounts[r.answer] || 0) + 1;
            });
            const avgRating = responses.length > 0 
                ? (responses.reduce((sum, r) => {
                    const rating = r.answer.length; // Count stars/emojis
                    return sum + rating;
                }, 0) / responses.length).toFixed(1)
                : 0;
            report.analysis = {
                question: activity.question,
                totalResponses: responses.length,
                totalReviews: responses.length,
                averageRating: avgRating,
                distribution: reviewCounts,
                individualRatings: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    rating: r.answer.length // Count stars/emojis as rating number
                })),
                reviews: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    rating: r.answer
                }))
            };
            break;

        case 'feedback':
            report.analysis = {
                prompt: activity.question,
                question: activity.question,
                totalResponses: responses.length,
                totalFeedback: responses.length,
                feedback: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    text: r.answer,
                    timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
                }))
            };
            break;

        default:
            report.analysis = {
                totalResponses: responses.length,
                responses: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer
                }))
            };
    }

    return report;
};

// --- Teacher View ---
const TeacherView = ({ setView, roomCode }) => {
    const [sessionTopic, setSessionTopic] = useState('');
    const [currentActivityType, setCurrentActivityType] = useState('mcq');
    const [wordleStats, setWordleStats] = useState({
  total: 0,
  attempting: 0,
  won: 0,
  lost: 0,
});
    const [showParticipants, setShowParticipants] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [showShareLink, setShowShareLink] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSessionLive, setIsSessionLive] = useState(false);
    const [liveResponses, setLiveResponses] = useState([]);
    const [linkCopied, setLinkCopied] = useState(false);
    
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
        settings: {
            markCorrect: true,
            allowMultiple: false,
            profanityFilter: true,
            reviewStyle: 'emoji',
        }
    });

    useEffect(() => {
        if (!roomCode || !activity) return;

        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const responsesMap = new Map();
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Only include responses that match the current activity type
                if (data.type === activity.type) {
                    const studentKey = data.studentName || doc.id;
                    const existingResponse = responsesMap.get(studentKey);
                    
                    // Keep only the latest response per student (by timestamp)
                    if (!existingResponse || 
                        (data.timestamp && existingResponse.timestamp && 
                         data.timestamp.toMillis() > existingResponse.timestamp.toMillis())) {
                        responsesMap.set(studentKey, { id: doc.id, ...data });
                    }
                }
            });
            
            // Convert Map to array
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
                    
                    // Restore session state from Firebase
                    if (data.sessionTopic) {
                        setSessionTopic(data.sessionTopic);
                    }
                    if (data.currentActivity) {
                        setActivity(data.currentActivity);
                        setCurrentActivityType(data.currentActivity.type);
                    }
                    if (data.isSessionLive !== undefined) {
                        setIsSessionLive(data.isSessionLive);
                    }
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
        
        // Debounce to avoid too many writes
        const timer = setTimeout(() => {
            if (sessionTopic || activity.question) {
                saveSession();
            }
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
        // Validation based on activity type
        if (activity.type === 'qa') {
            // For Q&A, check if there are questions with text
            if (!activity.questions || activity.questions.length === 0 || 
                !activity.questions.some(q => q.text && q.text.trim() !== '')) {
                alert('Please enter at least one question for the Q&A session.');
                return;
            }
        } else if (activity.type === 'mcq') {
            // For MCQ, check if there are questions with text and options
            if (!activity.questions || activity.questions.length === 0 || 
                !activity.questions.some(q => q.question && q.question.trim() !== '')) {
                alert('Please enter at least one question for the MCQ session.');
                return;
            }
        } else {
            // For other activities, check activity.question
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

        // For MCQ and Q&A with multiple questions, start with question index 0
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
        
        // Generate comprehensive session report
        const report = generateSessionReport(activity, liveResponses, sessionTopic, roomCode);
        setSessionReport(report);
        
        // Save session history
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
        
        // Save to localStorage and update state
        const savedHistory = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        const newHistory = [...savedHistory, historyEntry];
        localStorage.setItem('sessionHistory', JSON.stringify(newHistory));
        setSessionHistory(newHistory); // Update state with new history
        
        setIsSessionLive(false);
        setShowReport(true); // Show report modal
    };

    const handleNextQuestion = async () => {
        if (!activity.questions || activity.questions.length === 0) return;
        
        const currentIndex = activity.currentQuestionIndex || 0;
        const nextIndex = currentIndex + 1;
        
        if (nextIndex >= activity.questions.length) {
            alert('This is the last question. Click "End Session" to finish.');
            return;
        }
        
        // Clear responses for next question
        const responsesCol = collection(db, 'sessions', roomCode, 'responses');
        const q = query(responsesCol);
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
        
        // Update activity with next question index
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

    // Gamification: Calculate points and badges for a response
    const calculatePoints = (response, activityStartTime, isFirstResponse = false) => {
        if (!enableGamification) return { points: 0, badges: [] };
        
        let points = 10; // Base points for participation
        const badges = [];
        
        // First response badge
        if (isFirstResponse) {
            badges.push('🎯');
        }
        
        // Bonus points for correct answers (MCQ only)
        if (activity.type === 'mcq' && response.answer) {
            const correctOption = activity.options.find(opt => opt.isCorrect);
            if (correctOption && response.answer === correctOption.text) {
                points += 20; // Correct answer bonus
                badges.push('✅');
                
                // Speed bonus (answered within first 5 seconds)
                if (response.timestamp && activityStartTime) {
                    const responseTime = response.timestamp.toMillis();
                    const timeTaken = (responseTime - activityStartTime) / 1000;
                    if (timeTaken <= 3) {
                        points += 15; // Speed demon!
                        badges.push('⚡');
                    } else if (timeTaken <= 5) {
                        points += 10;
                    } else if (timeTaken <= 10) {
                        points += 5; // Quick responder
                    }
                }
            }
        }
        
        // Bonus points for Q&A (based on response length and quality)
        if (activity.type === 'qa' && response.answer) {
            const wordCount = response.answer.split(' ').length;
            if (wordCount > 50) {
                points += 15; // Very detailed answer
                badges.push('📝');
            } else if (wordCount > 20) {
                points += 10; // Detailed answer
            } else if (wordCount > 10) {
                points += 5; // Good answer
            }
        }
        
        return { points, badges };
    };

    // Update leaderboard from responses
    useEffect(() => {
        if (!enableGamification || !isSessionLive || liveResponses.length === 0) {
            setLeaderboard([]);
            return;
        }

        const activityStartTime = Date.now() - 30000; // Approximate start time
        const playerData = new Map();
        let firstResponseStudentName = null;

        // Find the first responder
        if (liveResponses.length > 0) {
            const sortedByTime = [...liveResponses].sort((a, b) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return a.timestamp.toMillis() - b.timestamp.toMillis();
            });
            firstResponseStudentName = sortedByTime[0]?.studentName;
        }

        liveResponses.forEach((response, idx) => {
            const playerName = response.studentName || 'Anonymous';
            const isFirstResponse = playerName === firstResponseStudentName;
            const { points, badges } = calculatePoints(response, activityStartTime, isFirstResponse);
            
            if (playerData.has(playerName)) {
                const existing = playerData.get(playerName);
                playerData.set(playerName, {
                    points: existing.points + points,
                    badges: [...new Set([...existing.badges, ...badges])] // Unique badges
                });
            } else {
                playerData.set(playerName, { points, badges });
            }
        });

        // Check for perfect score badge (all correct)
        playerData.forEach((data, playerName) => {
            const playerResponses = liveResponses.filter(r => r.studentName === playerName);
            if (activity.type === 'mcq') {
                const correctOption = activity.options.find(opt => opt.isCorrect);
                const allCorrect = playerResponses.every(r => r.answer === correctOption?.text);
                if (allCorrect && playerResponses.length > 0) {
                    data.badges.push('💯');
                }
            }
        });

        // Check for participation king (most responses)
        if (playerData.size > 0) {
            const responseCounts = new Map();
            liveResponses.forEach(r => {
                const name = r.studentName || 'Anonymous';
                responseCounts.set(name, (responseCounts.get(name) || 0) + 1);
            });
            const maxResponses = Math.max(...responseCounts.values());
            responseCounts.forEach((count, name) => {
                if (count === maxResponses && count > 3) {
                    const data = playerData.get(name);
                    if (data) data.badges.push('👑');
                }
            });
        }

        const leaderboardData = Array.from(playerData.entries())
            .map(([name, data]) => ({ name, points: data.points, badges: data.badges }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 10); // Top 10 players

        setLeaderboard(leaderboardData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveResponses, enableGamification, isSessionLive, activity]);

    const sidebarItems = [
        { id: 'mcq', name: 'MCQ / Poll', icon: <IconListCheck /> },
        { id: 'wordcloud', name: 'Word Cloud', icon: <IconCloud /> },
        { id: 'reviews', name: 'Reviews', icon: <IconSmile /> },
        { id: 'feedback', name: 'Short Feedback', icon: <IconMessageSquare /> },
        { id: 'qa', name: 'Q&A Session', icon: <IconHelpCircle /> },
        { id: 'wordle', name: 'Wordle Game', icon: <IconListCheck /> },
    ];

    return (
        <div className="flex h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-white font-sans">
            {/* Sidebar */}
            <aside className={`bg-white text-gray-600 flex flex-col transition-all duration-300 ease-in-out shadow-lg border-r border-gray-200 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className={`flex items-center justify-between p-4 border-b border-gray-200 ${isSidebarOpen ? 'h-16' : ''}`}>
                    {isSidebarOpen && <h1 className="text-xl font-bold text-teal-700 whitespace-nowrap">Activities</h1>}
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-teal-50 transition-colors text-teal-600">
                        {isSidebarOpen ? <IconChevronLeft /> : <div className="text-2xl font-bold">»</div>}
                    </button>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {sidebarItems.map(item => (
                        <button key={item.id} onClick={() => setCurrentActivityType(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${isSidebarOpen ? '' : 'justify-center'} ${currentActivityType === item.id ? 'bg-teal-600 text-white shadow-md' : 'hover:bg-teal-50 hover:text-teal-700'}`}
                        >
                            {item.icon}
                            {isSidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-y-auto bg-white">
                 <header className="bg-white shadow-md p-4 border-b border-gray-200 sticky top-0 z-10">
                    {/* Session Topic - First Row */}
                    <div className="flex justify-center mb-4">
                        <input 
                            type="text"
                            placeholder="Enter Session Topic..."
                            className="w-full max-w-md text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-gray-300 focus:border-teal-500 outline-none p-2 transition placeholder-gray-500 text-center"
                            value={sessionTopic}
                            onChange={e => setSessionTopic(e.target.value)}
                        />
                    </div>

                    {/* Room Code and Buttons - Second Row */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                         <div className="text-center">
                            <span className="text-xs text-gray-500">Room Code</span>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold tracking-widest text-teal-500">{roomCode}</p>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(roomCode);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2000);
                                    }}
                                    className="bg-gray-100 hover:bg-gray-600 text-gray-900 p-2 rounded-lg transition"
                                    title="Copy room code"
                                >
                                    📋
                                </button>
                                {linkCopied && <span className="text-green-400 text-sm font-semibold">✓ Copied!</span>}
                            </div>
                        </div>

                        <div className="h-8 w-px bg-gray-100"></div>

                        <button onClick={() => setShowShareLink(true)} className="flex items-center bg-blue-600 text-gray-900 px-4 py-2 rounded-lg hover:bg-blue-700 transition" title="Share session link">
                            <IconLink /> <span className="ml-1">Share Link</span>
                        </button>
                        <button onClick={() => setShowParticipants(true)} className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                            <IconUsers /> <span className="ml-1">Participants ({liveResponses.length})</span>
                        </button>
                        <button onClick={() => setShowHistory(true)} className="flex items-center bg-purple-700 text-gray-900 px-4 py-2 rounded-lg hover:bg-purple-800 transition" title="View session history">
                            📊 <span className="ml-1">History</span>
                        </button>
                        <button 
                            onClick={() => {
                                playSound('click');
                                setShowLeaderboard(true);
                            }} 
                            className="flex items-center bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg hover:bg-yellow-700 transition relative" 
                            title="View leaderboard"
                        >
                            🏆 <span className="ml-1">Leaderboard</span>
                            {leaderboard.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-teal-500 text-gray-900 text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                                    {leaderboard.length}
                                </span>
                            )}
                        </button>
                        <label className="flex items-center gap-2 bg-gray-100 text-gray-900 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-600 transition" title="Toggle gamification">
                            <input 
                                type="checkbox" 
                                checked={enableGamification} 
                                onChange={(e) => {
                                    setEnableGamification(e.target.checked);
                                    playSound(e.target.checked ? 'success' : 'click');
                                }} 
                                className="w-4 h-4"
                            />
                            <span>🎮 Gamify</span>
                        </label>
                        <button 
                            onClick={() => {
                                if (window.confirm('Are you sure you want to exit? This will end the current session.')) {
                                    setView('home');
                                }
                            }} 
                            className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                        >
                           🚪 Exit
                        </button>
                    </div>
                </header>

                <div className="p-4 sm:p-6 lg:p-8 flex-1">
                    {renderCreator()}
                </div>
                
                 <footer className="bg-white p-4 border-t border-gray-200 flex items-center justify-center sticky bottom-0 z-10">
                    {isSessionLive && (
                        <div className="mr-6 text-center">
                             <p className="font-bold text-green-500">Interaction is Live!</p>
                             <button onClick={() => setShowResults(true)} className="text-sm text-teal-500 hover:underline">
                                 View Analysis Modal
                            </button>
                        </div>
                    )}
                    <button 
                        onClick={handleStartSession}
                        disabled={isSessionLive}
                        className={`px-8 py-3 text-lg font-bold rounded-full transition text-gray-900 ${isSessionLive ? 'bg-gray-500 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 shadow-lg transform hover:-translate-y-1'}`}
                    >
                        {isSessionLive ? 'Live' : 'Start Interaction'}
                    </button>
                    {isSessionLive && (activity.type === 'mcq' || activity.type === 'qa') && activity.questions && activity.questions.length > 1 && (
                        <button 
                            onClick={handleNextQuestion}
                            disabled={(activity.currentQuestionIndex || 0) >= activity.questions.length - 1}
                            className={`ml-4 px-6 py-3 text-lg font-bold rounded-full transition shadow-lg transform hover:-translate-y-1 ${
                                (activity.currentQuestionIndex || 0) >= activity.questions.length - 1
                                    ? 'bg-gray-500 cursor-not-allowed text-gray-600'
                                    : 'bg-blue-600 hover:bg-blue-700 text-gray-900'
                            }`}
                        >
                            ➡️ Next Question ({(activity.currentQuestionIndex || 0) + 1}/{activity.questions.length})
                        </button>
                    )}
                    {isSessionLive && (
                         <button 
                            onClick={() => {
                                if (window.confirm('Are you sure you want to stop the session? This will end it for all students.')) {
                                    handleStopSession();
                                }
                            }}
                            className="ml-4 px-8 py-3 text-lg font-bold rounded-full transition bg-gray-600 hover:bg-gray-100 text-gray-900 shadow-lg transform hover:-translate-y-1"
                        >
                            ⏹️ End Session
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
                        <h3 className="text-2xl font-bold mb-4 text-gray-900">Participants ({liveResponses.length})</h3>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {liveResponses.length > 0 ? (
                               <p className="text-gray-500">A list of participant names would appear here in a future version.</p>
                           ) : (
                               <p className="text-gray-500">No one has responded yet.</p>
                           )}
                        </div>
                        <button onClick={() => setShowParticipants(false)} className="mt-6 w-full bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-600 transition">Close</button>
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
                        
                        {leaderboard.length === 0 ? (
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
                                        {leaderboard.map((player, idx) => (
                                            <tr 
                                                key={idx}
                                                className={`border-b border-gray-200 hover:bg-yellow-50 transition-colors ${
                                                    idx === 0 ? 'bg-yellow-100' : 
                                                    idx === 1 ? 'bg-orange-50' : 
                                                    idx === 2 ? 'bg-amber-50' : 
                                                    'bg-white'
                                                }`}
                                            >
                                                <td className="px-6 py-4">
                                                    <span className={`text-3xl font-bold ${
                                                        idx === 0 ? 'text-yellow-500' :
                                                        idx === 1 ? 'text-gray-500' :
                                                        idx === 2 ? 'text-orange-600' :
                                                        'text-gray-600'
                                                    }`}>
                                                        {idx === 0 ? '🥇' : 
                                                         idx === 1 ? '🥈' : 
                                                         idx === 2 ? '🥉' : 
                                                         `${idx + 1}.`}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-lg font-semibold ${
                                                        idx < 3 ? 'text-gray-800' : 'text-gray-700'
                                                    }`}>
                                                        {player.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex justify-center gap-1">
                                                        {player.badges && player.badges.length > 0 ? (
                                                            player.badges.map((badge, badgeIdx) => (
                                                                <span key={badgeIdx} className="text-xl" title={
                                                                    badge === '🎯' ? 'First Response' :
                                                                    badge === '✅' ? 'Correct Answer' :
                                                                    badge === '⚡' ? 'Speed Demon' :
                                                                    badge === '📝' ? 'Wordsmith' :
                                                                    badge === '💯' ? 'Perfect Score' :
                                                                    badge === '👑' ? 'Participation King' :
                                                                    'Achievement'
                                                                }>
                                                                    {badge}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-500 text-sm">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-2xl font-bold ${
                                                        idx === 0 ? 'text-yellow-600' :
                                                        idx === 1 ? 'text-gray-600' :
                                                        idx === 2 ? 'text-orange-600' :
                                                        'text-gray-700'
                                                    }`}>
                                                        {player.points}
                                                        <span className="text-sm ml-1 text-gray-500">pts</span>
                                                    </span>
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
const StudentView = ({ setView, initialJoinCode }) => {
    const [enteredCode, setEnteredCode] = useState(initialJoinCode || '');
    const [studentName, setStudentName] = useState('');
    const [joined, setJoined] = useState(false);
    const [submitted, setSubmitted] = useState(false);
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
            setSubmitted(false);
            setFeedbackText("");
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
                // Get the current question based on currentQuestionIndex
                const currentIndex = currentActivity.currentQuestionIndex || 0;
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
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-white flex items-center justify-center">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl">
                <h1 className="text-5xl font-extrabold text-teal-700 mb-4">Interactive Classroom 🎓</h1>
                <p className="text-lg text-gray-600 mb-12">Engage, Interact, and Learn in Real-Time</p>
                <div className="space-y-4 sm:space-y-0 sm:space-x-6 flex flex-col sm:flex-row justify-center">
                    <button onClick={() => setView('teacher')} className="bg-teal-600 text-white font-bold py-4 px-8 rounded-lg text-lg hover:bg-teal-700 transition shadow-lg transform hover:-translate-y-1 hover:shadow-xl">
                        🏫 Create Session
                    </button>
                    <button onClick={() => setView('student')} className="bg-white text-teal-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-teal-50 transition shadow-lg border-2 border-teal-600 transform hover:-translate-y-1 hover:shadow-xl">
                        👨‍🎓 Join Session
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    // Initialize state from localStorage if available
    const [view, setView] = useState(() => {
        // Only load from localStorage if it's 'teacher' view
        // Student view should not persist after refresh
        const savedView = localStorage.getItem('currentView');
        if (savedView === 'teacher') {
            return 'teacher';
        }
        return 'home'; // Default to home (dashboard)
    }); 
    const [roomCode, setRoomCode] = useState(() => {
        return localStorage.getItem('teacherRoomCode') || null;
    });
    const [initialJoinCode, setInitialJoinCode] = useState(null);

    // Save view and roomCode to localStorage whenever they change
    useEffect(() => {
        if (view) {
            localStorage.setItem('currentView', view);
        }
    }, [view]);

    useEffect(() => {
        if (roomCode) {
            localStorage.setItem('teacherRoomCode', roomCode);
        }
    }, [roomCode]);

    // Handle URL-based routing for join links
    useEffect(() => {
        const pathname = window.location.pathname;
        const joinMatch = pathname.match(/\/join\/([A-Z0-9]+)/i);
        
        if (joinMatch) {
            const code = joinMatch[1].toUpperCase();
            setInitialJoinCode(code);
            setView('student');
        } else if (pathname === '/' || pathname === '/index.html') {
            // If on root path, always show home (dashboard)
            // Clear localStorage to prevent staying on old views after refresh
            localStorage.removeItem('currentView');
            setView('home');
        }
    }, []);

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
        } else if (newView === 'home') {
            // Clear localStorage when going back to home
            localStorage.removeItem('currentView');
            localStorage.removeItem('teacherRoomCode');
            setView(newView);
            setRoomCode(null);
        } else {
            setView(newView);
        }
    };

    switch (view) {
        case 'teacher':
            return <TeacherView setView={handleSetView} roomCode={roomCode} />;
        case 'student':
            return <StudentView setView={handleSetView} initialJoinCode={initialJoinCode} />;
        default:
            return <HomePage setView={handleSetView} />;
    }
}









