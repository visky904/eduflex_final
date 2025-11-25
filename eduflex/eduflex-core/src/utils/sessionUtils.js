// Session Report Generator
export const generateSessionReport = (activity, responses, topic, roomCode) => {
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
                if (r.answer) {
                    answerCounts[r.answer] = (answerCounts[r.answer] || 0) + 1;
                }
            });
            
            const currentMcqQ = activity.questions?.[0] || activity;
            
            // ✅ FIX: Added "|| null" to prevent "undefined" error in Firebase
            const correctOptionObj = (currentMcqQ.options || activity.options || []).find(opt => opt.isCorrect);
            const correctAnswer = correctOptionObj ? correctOptionObj.text : null;
            
            const correctCount = correctAnswer ? (answerCounts[correctAnswer] || 0) : 0;
            
            report.analysis = {
                question: currentMcqQ.question || activity.question || "No Question",
                questions: activity.questions || [],
                totalResponses: responses.length,
                answerDistribution: answerCounts,
                correctAnswer: correctAnswer, // Now strictly null if undefined
                correctResponses: correctCount,
                accuracy: responses.length > 0 ? ((correctCount / responses.length) * 100).toFixed(1) + '%' : '0%',
                studentAnswers: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer || "",
                    isCorrect: correctAnswer && r.answer === correctAnswer
                }))
            };
            break;

        case 'qa':
            report.analysis = {
                questions: activity.questions || [],
                totalResponses: responses.length,
                responses: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer || "",
                    timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
                }))
            };
            break;

       case 'wordle':
            report.analysis = {
                totalPlayers: responses.length,
                won: responses.filter(r => r.status === "won").length,
                lost: responses.filter(r => r.status === "lost").length,
                attempting: responses.filter(r => r.status === "attempting").length,
                attemptsPerPlayer: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    attempts: r.attempts || 0,
                    lastGuess: r.lastGuess || "",
                    status: r.status || "unknown",
                    timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
                }))
            };
            break;

        case 'reviews':
            const reviewCounts = {};
            responses.forEach(r => {
                if(r.answer) reviewCounts[r.answer] = (reviewCounts[r.answer] || 0) + 1;
            });
            const avgRating = responses.length > 0 
                ? (responses.reduce((sum, r) => {
                    const rating = r.answer ? r.answer.length : 0;
                    return sum + rating;
                }, 0) / responses.length).toFixed(1)
                : 0;
            report.analysis = {
                question: activity.question || "Review",
                totalResponses: responses.length,
                totalReviews: responses.length,
                averageRating: avgRating,
                distribution: reviewCounts,
                individualRatings: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    rating: r.answer ? r.answer.length : 0
                })),
                reviews: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    rating: r.answer || ""
                }))
            };
            break;

        case 'feedback':
            report.analysis = {
                prompt: activity.question || "Feedback",
                question: activity.question || "Feedback",
                totalResponses: responses.length,
                totalFeedback: responses.length,
                feedback: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    text: r.answer || "",
                    timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
                }))
            };
            break;

        default:
            report.analysis = {
                totalResponses: responses.length,
                responses: responses.map(r => ({
                    name: r.studentName || 'Anonymous',
                    answer: r.answer || ""
                }))
            };
    }

    return report;
};

// Gamification: Calculate points and badges for a response
export const calculatePoints = (response, activityStartTime, isFirstResponse, enableGamification, activity) => {
    if (!enableGamification) return { points: 0, badges: [] };
    
    let points = 10; // Base points for participation
    const badges = [];
    
    // First response badge
    if (isFirstResponse) {
        badges.push('🎯');
    }
    
    // Bonus points for correct answers (MCQ only)
    if (activity.type === 'mcq' && response.answer) {
        const correctOption = activity.options?.find(opt => opt.isCorrect);
        // Case insensitive check
        if (correctOption && response.answer.trim().toLowerCase() === correctOption.text.trim().toLowerCase()) {
            points += 50; // Correct answer bonus (60 Total)
            badges.push('✅');
            
            // Speed bonus (if answered within first 5 seconds)
            const timeElapsed = (Date.now() - activityStartTime) / 1000;
            if (timeElapsed <= 5) {
                points += 10; // Speed bonus (70 Total)
                badges.push('⚡');
            }
        }
    }
    
    return { points, badges };
};