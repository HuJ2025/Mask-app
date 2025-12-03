import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Settings, Key, Type, Mail, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailSettings {
    smtp_server: string;
    smtp_port: number;
    sender_email: string;
    sender_password: string;
    default_recipient: string;
}

interface GeneralSettings {
    save_path: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (words: string[], passwords: string[], emailSettings: EmailSettings, generalSettings: GeneralSettings) => Promise<void>;
    initialWords: string[];
    initialPasswords: string[];
    initialEmailSettings?: EmailSettings;
    initialGeneralSettings?: GeneralSettings;
}

export function SettingsModal({ isOpen, onClose, onSave, initialWords, initialPasswords, initialEmailSettings, initialGeneralSettings }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'words' | 'passwords' | 'email'>('general');
    const [words, setWords] = useState<string[]>([]);
    const [passwords, setPasswords] = useState<string[]>([]);
    const [emailSettings, setEmailSettings] = useState<EmailSettings>({
        smtp_server: '',
        smtp_port: 587,
        sender_email: '',
        sender_password: '',
        default_recipient: ''
    });
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
        save_path: 'DEBUG: Fail to load save path'
    });
    const [newWord, setNewWord] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setWords(initialWords);
            setPasswords(initialPasswords);
            if (initialEmailSettings) {
                setEmailSettings(initialEmailSettings);
            }
            if (initialGeneralSettings) {
                setGeneralSettings(initialGeneralSettings);
            }
            console.log("SettingsModal: initialWords", initialWords);
            console.log("SettingsModal: initialPasswords", initialPasswords);
            console.log("SettingsModal: initialEmailSettings", initialEmailSettings);
            console.log("SettingsModal: initialGeneralSettings", initialGeneralSettings);
        }
    }, [isOpen, initialWords, initialPasswords, initialEmailSettings, initialGeneralSettings]);

    const handleAddWord = (e: React.FormEvent) => {
        e.preventDefault();
        if (newWord.trim() && !words.includes(newWord.trim())) {
            setWords([...words, newWord.trim()]);
            setNewWord('');
        }
    };

    const handleAddPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.trim() && !passwords.includes(newPassword.trim())) {
            setPasswords([...passwords, newPassword.trim()]);
            setNewPassword('');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave(words, passwords, emailSettings, generalSettings);
        setSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Settings className="w-6 h-6 text-indigo-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-800">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'general'
                                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Folder className="w-4 h-4" />
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('words')}
                            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'words'
                                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Type className="w-4 h-4" />
                            Default Words
                        </button>
                        <button
                            onClick={() => setActiveTab('passwords')}
                            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'passwords'
                                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Key className="w-4 h-4" />
                            Saved Passwords
                        </button>
                        <button
                            onClick={() => setActiveTab('email')}
                            className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'email'
                                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            <Mail className="w-4 h-4" />
                            Email
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 h-[400px] overflow-y-auto custom-scrollbar">
                        {activeTab === 'words' ? (
                            <div className="space-y-6">
                                <p className="text-sm text-slate-400">
                                    These words will be automatically added to the redaction list when you upload a file.
                                </p>

                                <form onSubmit={handleAddWord} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        placeholder="Add a default word..."
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newWord.trim()}
                                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Add
                                    </button>
                                </form>

                                <div className="space-y-2">
                                    {words.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                                            No default words configured
                                        </div>
                                    ) : (
                                        words.map((word, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl group hover:border-slate-700 transition-colors"
                                            >
                                                <span className="text-slate-200">{word}</span>
                                                <button
                                                    onClick={() => setWords(words.filter((_, i) => i !== index))}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'passwords' ? (
                            <div className="space-y-6">
                                <p className="text-sm text-slate-400">
                                    These passwords will be tried automatically when you upload an encrypted PDF.
                                </p>

                                <form onSubmit={handleAddPassword} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Add a password..."
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newPassword.trim()}
                                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Add
                                    </button>
                                </form>

                                <div className="space-y-2">
                                    {passwords.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                                            No passwords saved
                                        </div>
                                    ) : (
                                        passwords.map((pwd, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl group hover:border-slate-700 transition-colors"
                                            >
                                                <span className="text-slate-200 font-mono">{pwd}</span>
                                                <button
                                                    onClick={() => setPasswords(passwords.filter((_, i) => i !== index))}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'email' ? (
                            <div className="space-y-6">
                                <p className="text-sm text-slate-400">
                                    Configure your email settings for sending processed files.
                                </p>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">SMTP Server</label>
                                            <input
                                                type="text"
                                                value={emailSettings.smtp_server}
                                                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_server: e.target.value })}
                                                placeholder="smtp.example.com"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">SMTP Port</label>
                                            <input
                                                type="number"
                                                value={emailSettings.smtp_port}
                                                onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 0 })}
                                                placeholder="587"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Sender Email</label>
                                        <input
                                            type="email"
                                            value={emailSettings.sender_email}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, sender_email: e.target.value })}
                                            placeholder="you@example.com"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Sender Password</label>
                                        <input
                                            type="password"
                                            value={emailSettings.sender_password}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, sender_password: e.target.value })}
                                            placeholder="App password or email password"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Default Recipient</label>
                                        <input
                                            type="email"
                                            value={emailSettings.default_recipient}
                                            onChange={(e) => setEmailSettings({ ...emailSettings, default_recipient: e.target.value })}
                                            placeholder="recipient@example.com"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <p className="text-sm text-slate-400">
                                    Configure general application settings.
                                </p>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Default Save Path</label>
                                        <input
                                            type="text"
                                            value={generalSettings.save_path}
                                            onChange={(e) => setGeneralSettings({ ...generalSettings, save_path: e.target.value })}
                                            placeholder="/path/to/save/folder"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                        />
                                        <p className="text-xs text-slate-500">
                                            Processed files will be saved here. A timestamped subfolder will be created for each batch.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            {saving ? (
                                <>Saving...</>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
