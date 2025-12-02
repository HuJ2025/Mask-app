import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
    file: File | null;
    onFileSelect: (file: File) => void;
    onClearFile: () => void;
    disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ file, onFileSelect, onClearFile, disabled }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: false,
        disabled: disabled
    });

    return (
        <div className="h-[200px]">
            <AnimatePresence mode="wait">
                {!file ? (
                    <motion.div
                        key="dropzone"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="h-full"
                    >
                        <div
                            {...getRootProps()}
                            className={`
                                h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
                                ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/50'}
                                ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                            `}
                        >
                            <input {...getInputProps()} />
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Upload className={`w-8 h-8 ${isDragActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                            </div>
                            <p className="text-lg font-medium text-slate-300">
                                {isDragActive ? "Drop it like it's hot!" : "Drop PDF Here"}
                            </p>
                            <p className="text-sm text-slate-500 mt-2">or click to browse</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="file-preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="h-full bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center relative group"
                    >
                        {!disabled && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClearFile();
                                }}
                                className="absolute top-4 right-4 p-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}

                        <div className="w-20 h-20 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                            <FileText size={40} className="text-indigo-400" />
                        </div>
                        <p className="text-lg font-medium text-slate-200 text-center max-w-[200px] truncate">
                            {file.name}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
