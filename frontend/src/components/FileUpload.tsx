import React from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface FileUploadProps {
    file: File | null;
    onFileSelect: (file: File) => void;
    onClearFile: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ file, onFileSelect, onClearFile }) => {
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === 'application/pdf') {
                onFileSelect(droppedFile);
            } else {
                alert('Please upload a PDF file.');
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={cn(
                "border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer relative group",
                file
                    ? "border-indigo-500/50 bg-indigo-500/5"
                    : "border-slate-700 hover:border-slate-500 hover:bg-slate-900/50"
            )}
            onClick={() => !file && document.getElementById('file-input')?.click()}
        >
            <input
                type="file"
                id="file-input"
                className="hidden"
                accept=".pdf"
                onChange={handleChange}
                onClick={(e) => (e.currentTarget.value = '')}
            />
            <AnimatePresence mode="wait">
                {file ? (
                    <motion.div
                        key="file"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <FileText size={48} className="text-indigo-400" />
                        <div>
                            <p className="font-medium text-lg">{file.name}</p>
                            <p className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClearFile();
                            }}
                            className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 mt-2 px-3 py-1 rounded-full hover:bg-red-500/10"
                        >
                            <X size={14} />
                            Remove file
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-4"
                    >
                        <Upload size={48} className="text-slate-600" />
                        <div>
                            <p className="font-medium text-lg text-slate-300">Drop PDF here</p>
                            <p className="text-slate-500 text-sm">or click to browse</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
