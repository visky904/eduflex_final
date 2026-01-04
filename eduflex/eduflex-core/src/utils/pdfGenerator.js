// --- PDF Generation Function ---
export const generatePDF = (report) => {
    if (!report) return;

    // Create a new window for PDF generation
    const printWindow = window.open('', '_blank');

    // Build the HTML content using the shared builder
    const htmlContent = buildReportHTML(report);

    // Write the HTML content to the new window
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = function () {
        printWindow.focus();
        printWindow.print();
    };
};

// ---- SHARED HTML BUILDER ----
function buildReportHTML(report) {
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Session Report - ${report.roomCode}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    max-width: 900px;
                    margin: 0 auto;
                    color: #333;
                }
                h1 {
                    color: #4f46e5;
                    border-bottom: 3px solid #4f46e5;
                    padding-bottom: 10px;
                    margin-bottom: 30px;
                }
                h2 {
                    color: #6366f1;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 8px;
                }
                h3 {
                    color: #7c3aed;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .info-item {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #4f46e5;
                }
                .info-label {
                    font-weight: bold;
                    color: #6b7280;
                    font-size: 12px;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .info-value {
                    font-size: 18px;
                    color: #111827;
                    font-weight: 600;
                }
                .participants {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 15px 0;
                }
                .participant-tag {
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                th {
                    background: #f3f4f6;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #d1d5db;
                }
                td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #e5e7eb;
                }
                .correct {
                    color: #059669;
                    font-weight: bold;
                }
                .incorrect {
                    color: #dc2626;
                    font-weight: bold;
                }
                .response-box {
                    background: #f9fafb;
                    padding: 12px;
                    margin: 8px 0;
                    border-radius: 6px;
                    border-left: 3px solid #4f46e5;
                }
                .timestamp {
                    color: #6b7280;
                    font-size: 12px;
                    font-style: italic;
                }
                .stats-highlight {
                    background: #fef3c7;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #f59e0b;
                }
                @media print {
                    body { padding: 20px; }
                    h1 { page-break-after: avoid; }
                    h2 { page-break-after: avoid; }
                    table { page-break-inside: avoid; }
                    .response-box { page-break-inside: avoid; }
                }
                
                /* Combined Report Specific Styles */
                .activity-header {
                    background: #eef2ff;
                    padding: 18px;
                    border-left: 5px solid #4f46e5;
                    margin-bottom: 20px;
                    border-radius: 6px;
                }
                .title-card {
                    background: #eef2ff;
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    margin-bottom: 40px;
                    border-left: 6px solid #4f46e5;
                }
                .title-card h1 {
                    border-bottom: none;
                    margin-bottom: 5px;
                }
                .generated-info {
                    font-size: 14px;
                    color: #52525b;
                }
                hr {
                    margin: 40px 0;
                    border: none;
                    border-top: 2px dashed #cbd5e1;
                }
                .page-break {
                    page-break-before: always;
                }
            </style>
        </head>
        <body>
            <h1>📊 EduFlex Session Report</h1>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Session Topic</div>
                    <div class="info-value">${report.topic}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Room Code</div>
                    <div class="info-value">${report.roomCode}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Activity Type</div>
                    <div class="info-value">${report.activityType}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Date & Time</div>
                    <div class="info-value">${report.timestamp}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Total Participants</div>
                    <div class="info-value">${report.totalParticipants}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Total Responses</div>
                    <div class="info-value">${report.analysis.totalResponses || report.totalParticipants}</div>
                </div>
            </div>
            
            <h2>👥 Participants</h2>
            <div class="participants">
                ${report.participants.map(name => `<span class="participant-tag">${name}</span>`).join('')}
            </div>

            ${generateActivitySection(report)}

            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280;">
                <p>Generated by EduFlex | ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;
    return html;
}

// ---- DETAILED ACTIVITY SECTION GENERATOR (USED BY BOTH) ----
function generateActivitySection(report) {
    let content = '';

    const type = report.activityType ? report.activityType.toLowerCase() : '';

    if (type === 'mcq') {
        content = `
            <h2>📈 MCQ Analysis</h2>
            
            <div class="stats-highlight">
                <h3>Question: ${report.analysis.question}</h3>
                <p><strong>Correct Answer:</strong> ${report.analysis.correctAnswer}</p>
                <p><strong>Accuracy:</strong> ${report.analysis.accuracy}</p>
            </div>
            
            <h3>Answer Distribution</h3>
            <table>
                <thead>
                    <tr>
                        <th>Answer Option</th>
                        <th>Number of Students</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.analysis.answerDistribution).map(([answer, count]) => `
                        <tr>
                            <td>${answer}</td>
                            <td>${count}</td>
                            <td>${((count / report.analysis.totalResponses) * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h3>Individual Student Answers</h3>
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Answer</th>
                        <th>Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.analysis.studentAnswers?.map(sa => `
                        <tr>
                            <td>${sa.name}</td>
                            <td>${sa.answer}</td>
                            <td class="${sa.isCorrect ? 'correct' : 'incorrect'}">
                                ${sa.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else if (type === 'wordcloud') {
        content = `
            <h2>☁️ Wordcloud Analysis</h2>
            
            <div class="stats-highlight">
                <p><strong>Total Words Submitted:</strong> ${report.analysis.totalWords}</p>
            </div>
            
            <h3>Top 10 Most Frequent Words</h3>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Word</th>
                        <th>Frequency</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.analysis.topWords?.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td><strong>${item.word}</strong></td>
                            <td>${item.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h3>All Student Responses</h3>
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Submitted Word(s)</th>
                    </tr>
                </thead>
                <tbody>
                    ${(report.analysis.allResponses || report.analysis.responses)?.map(res => `
                        <tr>
                            <td>${res.name}</td>
                            <td>${res.text || res.answer || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="2">No responses available.</td></tr>'}
                </tbody>
            </table>
        `;
    } else if (type === 'qa' || type === 'q&a') {
        content = `
            <h2>💬 Q&A Responses</h2>
            
            <div class="stats-highlight">
                <h3>Question: ${report.analysis.question}</h3>
                <p><strong>Total Responses:</strong> ${report.analysis.totalResponses}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Response</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${(report.analysis.responses || [])?.map(res => `
                        <tr>
                            <td>${res.name}</td>
                            <td>${res.answer || '-'}</td>
                            <td class="timestamp">${res.timestamp || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="3">No responses.</td></tr>'}
                </tbody>
            </table>
        `;
    } else if (type === 'reviews') {
        content = `
            <h2>⭐ Reviews Analysis</h2>
            
            <div class="stats-highlight">
                <h3>Question: ${report.analysis.question}</h3>
                <p><strong>Average Rating:</strong> ${report.analysis.averageRating} / 5.0</p>
                <p><strong>Total Responses:</strong> ${report.analysis.totalResponses}</p>
            </div>
            
            <h3>Rating Distribution</h3>
            <table>
                <thead>
                    <tr>
                        <th>Rating</th>
                        <th>Number of Students</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.analysis.distribution).sort((a, b) => b[0] - a[0]).map(([rating, count]) => `
                        <tr>
                            <td>${'⭐'.repeat(parseInt(rating))}</td>
                            <td>${count}</td>
                            <td>${((count / report.analysis.totalResponses) * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h3>Individual Ratings</h3>
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Rating</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${(report.analysis.individualRatings || [])?.map(r => `
                        <tr>
                            <td>${r.name}</td>
                            <td>${'⭐'.repeat(r.rating || 0)}</td>
                            <td>${r.rating}/5</td>
                        </tr>
                    `).join('') || '<tr><td colspan="3">No ratings.</td></tr>'}
                </tbody>
            </table>
        `;
    } else if (type === 'feedback') {
        content = `
            <h2>💭 Feedback Responses</h2>
            
            <div class="stats-highlight">
                <h3>Prompt: ${report.analysis.prompt}</h3>
                <p><strong>Total Feedback:</strong> ${report.analysis.totalResponses}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Feedback</th>
                        <th>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    ${(report.analysis.feedback || report.analysis.responses || [])?.map(f => `
                        <tr>
                            <td>${f.name}</td>
                            <td>${f.text || f.answer || '-'}</td>
                            <td class="timestamp">${f.timestamp || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="3">No feedback.</td></tr>'}
                </tbody>
            </table>
        `;
    }

    return content;
}

// ---- COMBINED REPORT FUNCTION ----
export const generateCombinedPDF = (allReports) => {
    if (!allReports?.length) return;

    const win = window.open('', '_blank');

    const styles = `
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 40px;
                max-width: 900px;
                margin: 0 auto;
                color: #333;
            }
            h1 {
                color: #4f46e5;
                border-bottom: 4px solid #4f46e5;
                padding-bottom: 12px;
                margin-bottom: 30px;
                font-size: 32px;
                text-align: center;
            }
            h2 {
                color: #6366f1;
                margin-top: 30px;
                margin-bottom: 15px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 6px;
            }
            h3 {
                color: #7c3aed;
                margin-top: 18px;
            }
            .activity-header {
                background: #eef2ff;
                padding: 18px;
                border-left: 5px solid #4f46e5;
                margin-bottom: 20px;
                border-radius: 6px;
            }
            .activity-meta {
                font-size: 14px;
                color: #4b5563;
                margin-top: 6px;
            }
            hr {
                margin: 40px 0;
                border: none;
                border-top: 2px dashed #cbd5e1;
            }
            .page-break {
                page-break-before: always;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 30px;
            }
            .info-item {
                background: #f9fafb;
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #4f46e5;
            }
            .info-label {
                font-weight: bold;
                color: #6b7280;
                font-size: 12px;
                text-transform: uppercase;
                margin-bottom: 5px;
            }
            .info-value {
                font-size: 18px;
                color: #111827;
                font-weight: 600;
            }
            .participants {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin: 15px 0;
            }
            .participant-tag {
                background: #dbeafe;
                color: #1e40af;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 14px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            th {
                background: #f3f4f6;
                padding: 10px;
                text-align: left;
                font-weight: 600;
                border-bottom: 2px solid #d1d5db;
            }
            td {
                padding: 9px 10px;
                border-bottom: 1px solid #e5e7eb;
            }
            .correct { color: #059669; font-weight: bold; }
            .incorrect { color: #dc2626; font-weight: bold; }
            .response-box {
                background: #f9fafb;
                padding: 12px;
                margin: 10px 0;
                border-radius: 6px;
                border-left: 3px solid #4f46e5;
            }
            .stats-highlight {
                background: #fef3c7;
                padding: 18px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #f59e0b;
            }
            .title-card {
                background: #eef2ff;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                margin-bottom: 40px;
                border-left: 6px solid #4f46e5;
            }
            .title-card h1 {
                border-bottom: none;
                margin-bottom: 5px;
            }
            .generated-info {
                font-size: 14px;
                color: #52525b;
            }
        </style>
    `;

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Combined Report</title>
            ${styles}
        </head>
        <body>
            <div class="title-card">
                <h1>📘 Combined Session Report</h1>
                <p class="generated-info"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <hr>
    `);

    [...allReports].forEach((report, i) => {
        const activityHTML = generateActivitySection(report);
        const participantHTML = `
            <h2>👥 Participants</h2>
            <div class="participants">
                ${report.participants.map(name => `<span class="participant-tag">${name}</span>`).join('')}
            </div>
        `;

        const infoGridHTML = `
            <div class="info-grid">
                <div class="info-item"><div class="info-label">Session Topic</div><div class="info-value">${report.topic}</div></div>
                <div class="info-item"><div class="info-label">Room Code</div><div class="info-value">${report.roomCode}</div></div>
                <div class="info-item"><div class="info-label">Activity Type</div><div class="info-value">${report.activityType}</div></div>
                <div class="info-item"><div class="info-label">Date & Time</div><div class="info-value">${report.timestamp}</div></div>
                <div class="info-item"><div class="info-label">Total Participants</div><div class="info-value">${report.totalParticipants}</div></div>
                <div class="info-item"><div class="info-label">Total Responses</div><div class="info-value">${report.analysis.totalResponses || report.totalParticipants}</div></div>
            </div>
        `;

        win.document.write(`
            ${i > 0 ? `<div class='page-break'></div>` : ""}

            <div class="activity-header">
                <h2>Activity ${i + 1}: ${report.activityType.toUpperCase()}</h2>
            </div>
            
            ${infoGridHTML}
            ${participantHTML}
            ${activityHTML}
        `);
    });

    win.document.write(`
        </body></html>
    `);

    win.document.close();

    win.onload = () => {
        win.focus();
        win.print();
    };
};
