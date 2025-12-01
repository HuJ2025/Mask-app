import React from 'react';
import { CheckCircle, AlertCircle, Download } from 'lucide-react';
import { motion } from 'framer-motion';

interface ActionAreaProps {
    status: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
    progress: number;
    message: string;
    downloadUrl: string;
    canStart: boolean;
    onStart: () => void;
    onDownload: () => void;
    onRetry: () => void;
}

export const ActionArea: React.FC<ActionAreaProps> = ({
    status,
    progress,
    message,
    downloadUrl,
    canStart,
    onStart,
    onDownload,
    onRetry
}) => {
    return (
        <div className="flex flex-col items-center gap-6">
            {status === 'idle' && (
                <button
                    onClick={onStart}
                    disabled={!canStart}
                    className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                >
                    Start Redaction
                </button>
            )}

            {(status === 'uploading' || status === 'processing') && (
                <div className="w-full bg-slate-800/50 rounded-2xl p-6 border border-white/5 text-center">
                    <div className="mb-4 flex justify-between text-sm font-medium text-slate-400">
                        <span>{message}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>
            )}

            {status === 'done' && (
                <div className="w-full bg-green-500/10 rounded-2xl p-6 border border-green-500/20 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-green-500/20 p-3 rounded-full">
                            <CheckCircle size={32} className="text-green-400" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-green-400 mb-2">Redaction Complete!</h3>
                    <p className="text-slate-400 mb-6">Your file is ready for download.</p>
                    <a
                        href={downloadUrl}
                        download
                        onClick={onDownload}
                        className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-500/20"
                    >
                        <Download size={20} />
                        Download PDF
                    </a>
                </div>
            )}

            {status === 'error' && (
                <div className="w-full bg-red-500/10 rounded-2xl p-6 border border-red-500/20 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-red-500/20 p-3 rounded-full">
                            <AlertCircle size={32} className="text-red-400" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-red-400 mb-2">Error</h3>
                    <p className="text-slate-400">{message}</p>
                    <button
                        onClick={onRetry}
                        className="mt-4 text-sm text-slate-400 hover:text-white underline"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
};
