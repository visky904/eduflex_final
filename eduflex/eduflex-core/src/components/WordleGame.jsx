import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export const WordleGame = ({ word, onGameEnd, roomCode, studentId }) => {
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
      if (onGameEnd) {
          onGameEnd(guess);
      }
    } else if (newGuesses.length >= 6) {
      setGameOver(true);
      setMessage(`❌ Out of attempts! The word was ${word}`);
      status = "lost";
    }

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
        <div className="text-center animate-fade-in w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Guess the Word</h2>
            
            {/* Previous Guesses Grid */}
            <div className="space-y-2 mb-6">
                {guesses.map((guess, i) => (
                    <div key={i} className="flex justify-center space-x-1">
                        {guess.map((g, j) => (
                            <div key={j} className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-900 text-xl font-bold ${g.color} rounded border border-gray-300`}>
                                {g.letter}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Input Area - VISIBLE TEXT */}
            {!gameOver ? (
                <form onSubmit={handleSubmit} className="flex gap-2 justify-center">
                    <input
                        type="text" 
                        maxLength="5"
                        className="w-40 p-3 border-2 border-gray-400 rounded-lg text-center text-2xl tracking-widest uppercase focus:ring-2 focus:ring-teal-500 transition"
                        placeholder="GUESS"
                        value={currentGuess}
                        onChange={(e) => setCurrentGuess(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                        autoFocus
                    />
                    <button type="submit" className="px-6 py-3 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 shadow-md">
                        Submit
                    </button>
                </form>
            ) : (
                <p className="mt-4 text-xl font-semibold text-gray-700 bg-gray-100 p-3 rounded-lg">{message}</p>
            )}
        </div>
    );
};