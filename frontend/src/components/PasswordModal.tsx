import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (password: string) => void;
    isDecrypting: boolean;
    error: string | null;
    description?: string;
    filename?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onSubmit, isDecrypting, error, description, filename }) => {
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(password);
        setPassword('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4"
                    >
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-4">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Encrypted PDF</h2>
                            {filename && (
                                <p className="text-indigo-300 font-medium mt-1 mb-1 text-center break-all">
                                    {filename}
                                </p>
                            )}
                            <p className="text-slate-400 text-center mt-2">
                                {description || "This file is password protected. Please enter the password to continue."}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 focus:outline-none transition-colors text-white ${error
                                        ? 'border-red-500 focus:border-red-500'
                                        : 'border-slate-700 focus:border-indigo-500'
                                        }`}
                                    autoFocus
                                />
                                {error && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-red-400 text-sm text-center"
                                    >
                                        {error}
                                    </motion.p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        setPassword('');
                                    }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password || isDecrypting}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDecrypting ? 'Decrypting...' : 'Unlock'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
