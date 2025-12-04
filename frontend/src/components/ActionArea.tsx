import React from 'react';
import { Play, FolderOpen, RefreshCw, XCircle, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

interface ActionAreaProps {
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelling';
    progress: number;
    message: string;
    batchProgress?: string;
    canStart: boolean;
    onStart: () => void;
    onOpenFolder: () => void;
    onOpenSaveDir: () => void;
    onEmail: () => void;
    onRetry: () => void;
    onCancel: () => void;
    isBatch?: boolean;
}

export const ActionArea: React.FC<ActionAreaProps> = ({
    status,
    progress,
    message,
    batchProgress,
    canStart,
    onStart,
    onOpenFolder,
    onOpenSaveDir,
    onEmail,
    onRetry,
    onCancel,
    isBatch = false
}) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            {status === 'idle' && (
                <div className="space-y-3">
                    <button
                        onClick={onStart}
                        disabled={!canStart}
                        className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Play size={24} fill="currentColor" />
                        Start Redact
                    </button>
                    <button
                        onClick={onOpenSaveDir}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <FolderOpen size={20} />
                        Open Output Folder
                    </button>
                </div>
            )}

            {(status === 'uploading' || status === 'processing' || status === 'cancelling') && (
                <div className="space-y-4">
                    {batchProgress && (
                        <div className="text-indigo-400 font-medium text-center mb-2">
                            {batchProgress}
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                        <span>{message}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full ${status === 'cancelling' ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    {status !== 'cancelling' && (
                        <button
                            onClick={onCancel}
                            className="w-full mt-4 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <XCircle size={20} />
                            Cancel
                        </button>
                    )}
                </div>
            )}

            {status === 'done' && (
                <div className="space-y-4">
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-center font-medium">
                        <div>{isBatch ? "Batch Processing Complete!" : "Redaction Complete!"}</div>
                        <div className="text-sm mt-1 opacity-90">{message}</div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button
                                onClick={onOpenFolder}
                                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                title="Open Folder"
                            >
                                <FolderOpen size={20} />
                                <span>Open Folder</span>
                            </button>
                            <button
                                onClick={onEmail}
                                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                title="Send via Email"
                            >
                                <Mail size={20} />
                                <span>Send via Email</span>
                            </button>
                        </div>
                        <button
                            onClick={onRetry}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Start Over
                        </button>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center font-medium">
                        {message || "An error occurred"}
                    </div>
                    <button
                        onClick={onRetry}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={20} />
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};
