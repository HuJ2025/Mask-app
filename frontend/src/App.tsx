import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Download, Shield, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [clientId] = useState(() => Math.random().toString(36).substring(7));
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(`${WS_URL}/ws/${clientId}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.percentage);
      setMessage(data.message);

      if (data.message && data.message.startsWith("Error:")) {
        setStatus('error');
      } else if (data.percentage === 100) {
        setStatus('done');
      }
    };
    wsRef.current = ws;
    return () => {
      ws.close();
    };
  }, [clientId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setStatus('idle');
        setProgress(0);
        setMessage('');
      } else {
        alert('Please upload a PDF file.');
      }
    }
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setWords([...words, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemoveWord = (index: number) => {
    setWords(words.filter((_, i) => i !== index));
  };

  const handleRedact = async () => {
    if (!file || words.length === 0) return;

    setStatus('uploading');
    setMessage('Uploading file...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('words', words.join(','));
    formData.append('client_id', clientId);

    try {
      const res = await fetch(`${API_URL}/api/redact`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setStatus('processing');

      // We wait for WS to say 100%, but we also need the download info.
      // The API returns temp_dir and filename.
      setDownloadUrl(`${API_URL}/api/download?temp_dir=${encodeURIComponent(data.temp_dir)}&filename=${encodeURIComponent(data.filename)}`);

    } catch (e) {
      console.error(e);
      setStatus('error');
      setMessage('Error starting redaction.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setProgress(0);
      setMessage('');
    }
  };

  const handleDownloadClick = () => {
    // Reset state after a short delay to allow download to start
    setTimeout(() => {
      setFile(null);
      setWords([]);
      setStatus('idle');
      setProgress(0);
      setMessage('');
      setDownloadUrl('');
    }, 1000);
  };

  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const fileUrl = React.useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return '';
  }, [file]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 pt-10">
      {/* Draggable Title Bar */}
      <div className={cn(
        "fixed top-0 left-0 right-0 h-10 z-50 drag-region flex items-center justify-center backdrop-blur-md border-b transition-all duration-300",
        isFocused
          ? "bg-slate-900/90 border-white/10 shadow-lg shadow-black/20"
          : "bg-slate-950/50 border-transparent opacity-50 grayscale"
      )}>
        <span className={cn(
          "text-xs font-medium transition-colors duration-300",
          isFocused ? "text-slate-200" : "text-slate-700"
        )}>Redact App</span>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Redact.py
          </h1>
          <p className="text-slate-400">Securely redact sensitive information from your PDFs.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Controls */}
          <div className="space-y-8">
            {/* File Upload */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer relative group",
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
                onChange={handleFileSelect}
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
                        setFile(null);
                        setWords([]);
                        setStatus('idle');
                        setProgress(0);
                        setMessage('');
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

            {/* Words Input */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield size={20} className="text-indigo-400" />
                Words to Redact
              </h2>

              <form onSubmit={handleAddWord} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g. names, dates, or specific phrases..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-colors"
                >
                  <Plus size={24} />
                </button>
              </form>

              <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
                <AnimatePresence>
                  {words.map((word, index) => (
                    <motion.span
                      key={`${word}-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1 bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-sm group"
                    >
                      {word}
                      <button
                        onClick={() => handleRemoveWord(index)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </motion.span>
                  ))}
                  {words.length === 0 && (
                    <p className="text-slate-500 text-sm italic w-full text-center py-8">
                      No words added yet. Add words or phrases to redact them from the document.
                    </p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Action Area */}
            <div className="flex flex-col items-center gap-6">
              {status === 'idle' && (
                <button
                  onClick={handleRedact}
                  disabled={!file || words.length === 0}
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
                    onClick={handleDownloadClick}
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
                    onClick={() => setStatus('idle')}
                    className="mt-4 text-sm text-slate-400 hover:text-white underline"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: PDF Preview */}
          <div className="bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[600px] sticky top-24">
            <div className="p-4 border-b border-white/5 bg-slate-900/50">
              <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                <FileText size={18} />
                Document Preview
              </h2>
            </div>
            <div className="flex-1 bg-slate-900 relative">
              {file ? (
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
        </div>
      </div>
    </div>
  );
}

export default App;
