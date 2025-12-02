import React, { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordListProps {
    words: string[];
    onAddWord: (word: string) => void;
    onRemoveWord: (index: number) => void;
    onClearWords: () => void;
    disabled?: boolean;
}

export const WordList: React.FC<WordListProps> = ({ words, onAddWord, onRemoveWord, onClearWords, disabled }) => {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onAddWord(input.trim());
            setInput('');
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-200">Words to Redact</h2>
                {words.length > 0 && !disabled && (
                    <button
                        onClick={onClearWords}
                        className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                        <Trash2 size={14} />
                        Clear All
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="relative mb-6">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. names, addresses, or specific phrases..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                    disabled={disabled}
                />
                <button
                    type="submit"
                    disabled={!input.trim() || disabled}
                    className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-lg transition-colors"
                >
                    <Plus size={20} />
                </button>
            </form>

            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                    {words.map((word, index) => (
                        <motion.span
                            key={`${word}-${index}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-2 group"
                        >
                            {word}
                            {!disabled && (
                                <button
                                    onClick={() => onRemoveWord(index)}
                                    className="text-slate-400 hover:text-red-400 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </motion.span>
                    ))}
                </AnimatePresence>
                {words.length === 0 && (
                    <p className="text-slate-500 italic w-full text-center py-4">
                        No words added yet. Add words to start redacting.
                    </p>
                )}
            </div>
        </div>
    );
};
