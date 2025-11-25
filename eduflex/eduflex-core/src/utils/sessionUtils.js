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

       case 'wordle':
    report.analysis = {
        totalPlayers: responses.length,
        won: responses.filter(r => r.status === "won").length,
        lost: responses.filter(r => r.status === "lost").length,
        attempting: responses.filter(r => r.status === "attempting").length,
        attemptsPerPlayer: responses.map(r => ({
            name: r.studentName || 'Anonymous',
            attempts: r.attempts,
            lastGuess: r.lastGuess,
            status: r.status,
            timestamp: r.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
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
                    const rating = r.answer.length;
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
                    rating: r.answer.length
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
        if (correctOption && response.answer === correctOption.text) {
            points += 20; // Correct answer bonus
            badges.push('✅');
            
            // Speed bonus (if answered within first 10 seconds)
            const timeElapsed = (Date.now() - activityStartTime) / 1000;
            if (timeElapsed <= 10) {
                points += 10;
                badges.push('⚡');
            }
        }
    }
    
    return { points, badges };
};
