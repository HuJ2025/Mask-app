import React, { useState } from 'react';
import { Shield, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordListProps {
    words: string[];
    onAddWord: (word: string) => void;
    onRemoveWord: (index: number) => void;
    onClearWords: () => void;
}

export const WordList: React.FC<WordListProps> = ({ words, onAddWord, onRemoveWord, onClearWords }) => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onAddWord(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield size={20} className="text-indigo-400" />
                    Words to Redact
                </h2>
                {words.length > 0 && (
                    <button
                        onClick={onClearWords}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-700/50"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="e.g. names, addresses, or specific phrases..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-colors"
                >
                    <Plus size={24} />
                </button>
            </form>

            <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
                <AnimatePresence>
                    {words.map((word, index) => (
                        <motion.span
                            key={`${word}-${index}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-sm group"
                        >
                            {word}
                            <button
                                onClick={() => onRemoveWord(index)}
                                className="text-slate-400 hover:text-red-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </motion.span>
                    ))}
                    {words.length === 0 && (
                        <p className="text-slate-500 text-sm italic w-full text-center py-8">
                            No words added yet. Add words or phrases to redact them from the document.
                        </p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
