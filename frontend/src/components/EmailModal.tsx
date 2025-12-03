import React, { useState, useEffect } from 'react';
import { X, Mail, Send, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (recipient: string, subject: string, body: string) => Promise<void>;
    defaultRecipient: string;
    files: string[];
}

export function EmailModal({ isOpen, onClose, onSend, defaultRecipient, files }: EmailModalProps) {
    const [recipient, setRecipient] = useState(defaultRecipient);
    const [subject, setSubject] = useState('Redacted Files');
    const [body, setBody] = useState('Please find the redacted files attached.');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setRecipient(defaultRecipient);
        }
    }, [isOpen, defaultRecipient]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipient) return;

        setSending(true);
        try {
            await onSend(recipient, subject, body);
            onClose();
        } catch (error) {
            console.error("Failed to send email:", error);
            // Error handling should ideally be done in the parent or via a toast
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Mail className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-100">Send via Email</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSend} className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Recipient</label>
                            <input
                                type="email"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder="recipient@example.com"
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Email Subject"
                                required
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Body</label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Email Body"
                                rows={4}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300">Attachments ({files.length})</label>
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-900/50 transition-colors">
                                        <FileText className="w-4 h-4 text-indigo-400" />
                                        <span className="text-sm text-slate-300 truncate">{file}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={sending || !recipient}
                                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Email
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
