// --- Sound Effects ---
export const playSound = (type) => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'success':
                oscillator.frequency.value = 800;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
            case 'click':
                oscillator.frequency.value = 400;
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'error':
                oscillator.frequency.value = 200;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'notification':
                oscillator.frequency.value = 600;
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            default:
                oscillator.frequency.value = 500;
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
        }
    } catch (e) {
        // Silently fail if audio not supported
    }
};

// --- Generate Room Code ---
export const generateRoomCode = () => {
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
const PROFANITY_LIST = ['darn', 'heck', 'fuck', 'shit'];

export const filterProfanity = (text) => {
    if (typeof text !== 'string') return text;
    let filteredText = text;
    PROFANITY_LIST.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filteredText = filteredText.replace(regex, '***');
    });
    return filteredText;
};
