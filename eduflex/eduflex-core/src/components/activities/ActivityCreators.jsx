import React from 'react';
import { IconPlus, IconImage, IconTrash, IconSettings } from '../Icons';

// Short Feedback Creator Component
export const ShortFeedbackCreator = ({ activity, setActivity, liveResults, onDelete }) => {
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

// MCQ Creator Component
export const McqCreator = ({ activity, setActivity }) => {
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
                <button onClick={handleAddQuestion} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center">
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

// Word Cloud Creator Component
export const WordCloudCreator = ({ activity, setActivity, liveResults }) => {
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

// Reviews Creator Component
export const ReviewsCreator = ({ activity, setActivity }) => (
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

// Feedback Creator Component
export const FeedbackCreator = ({ activity, setActivity, liveResults, onDelete }) => {
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

// Wordle Creator Component
export const WordleCreator = ({ activity, setActivity }) => {
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

// Q&A Creator Component
export const QaCreator = ({ activity, setActivity, liveResults, onDelete }) => {
    const handleAddQuestion = () => {
        const newQuestion = {
            id: Date.now(),
            text: '',
            type: 'short',
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
                    <button onClick={handleAddQuestion} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center">
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
