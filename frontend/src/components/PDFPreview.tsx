import React from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface PDFPreviewProps {
    fileUrl: string;
    hasFile: boolean;
    currentIndex?: number;
    totalFiles?: number;
    onPrev?: () => void;
    onNext?: () => void;
    fileName?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
    fileUrl,
    hasFile,
    currentIndex = 0,
    totalFiles = 0,
    onPrev,
    onNext,
    fileName
}) => {
    return (
        <div className="bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[600px] sticky top-24">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                    <FileText size={18} />
                    Document Preview
                </h2>

                {totalFiles > 1 && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                            {currentIndex + 1} / {totalFiles}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={onPrev}
                                disabled={currentIndex === 0}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={onNext}
                                disabled={currentIndex === totalFiles - 1}
                                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {fileName && (
                <div className="px-4 py-2 bg-slate-900/30 border-b border-white/5 text-xs text-slate-400 truncate text-center">
                    {fileName}
                </div>
            )}

            <div className="flex-1 bg-slate-900 relative">
                {hasFile ? (
                    <iframe
                        src={fileUrl}
                        className="w-full h-full border-0"
                        title="PDF Preview"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p>Upload a PDF to preview it here</p>
                    </div>
                )}
            </div>
        </div>
    );
};
