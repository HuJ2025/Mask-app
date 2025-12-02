import React from 'react';
import { Play, Download, RefreshCw, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ActionAreaProps {
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelling';
    progress: number;
    message: string;
    downloadUrl: string;
    canStart: boolean;
    onStart: () => void;
    onDownload: () => void;
    onRetry: () => void;
    onCancel: () => void;
}

export const ActionArea: React.FC<ActionAreaProps> = ({
    status,
    progress,
    message,
    downloadUrl,
    canStart,
    onStart,
    onDownload,
    onRetry,
    onCancel
}) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            {status === 'idle' && (
                <button
                    onClick={onStart}
                    disabled={!canStart}
                    className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    <Play size={24} fill="currentColor" />
                    Start Redact
                </button>
            )}

            {(status === 'uploading' || status === 'processing' || status === 'cancelling') && (
                <div className="space-y-4">
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
                        Redaction Complete!
                    </div>
                    <div className="flex gap-4">
                        <a
                            href={downloadUrl}
                            download
                            onClick={onDownload}
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold text-center shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Download size={20} />
                            Download PDF
                        </a>
                        <button
                            onClick={onRetry}
                            className="px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                        >
                            <RefreshCw size={20} />
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
