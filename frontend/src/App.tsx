import React, { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { FileUpload } from './components/FileUpload';
import { WordList } from './components/WordList';
import { ActionArea } from './components/ActionArea';
import { PDFPreview } from './components/PDFPreview';
import { PasswordModal } from './components/PasswordModal';
import { SettingsModal } from './components/SettingsModal';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'encrypted' | 'decrypted' | 'uploading' | 'processing' | 'done' | 'error';
  password?: string;
  tempDir?: string;
  outputFilename?: string;
  error?: string;
}

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'processing' | 'done' | 'cancelling'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(''); // For single file
  const [clientId] = useState(() => Math.random().toString(36).substring(7));
  const wsRef = useRef<WebSocket | null>(null);

  // Config State
  const [showSettings, setShowSettings] = useState(false);
  const [configWords, setConfigWords] = useState<string[]>([]);
  const [configPasswords, setConfigPasswords] = useState<string[]>([]);

  // Load config on mount
  useEffect(() => {
    fetch(`${API_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        setConfigWords(data.words || []);
        setConfigPasswords(data.passwords || []);
        // Initialize words with default config if empty
        if (data.words && data.words.length > 0) {
          setWords(data.words);
        }
      })
      .catch(err => console.error("Error loading config:", err));
  }, []);

  const handleSaveConfig = async (newWords: string[], newPasswords: string[]) => {
    try {
      await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: newWords, passwords: newPasswords })
      });
      setConfigWords(newWords);
      setConfigPasswords(newPasswords);

      // Update current words: add new defaults
      setWords(prev => {
        const uniqueWords = new Set([...prev, ...newWords]);
        return Array.from(uniqueWords);
      });

    } catch (e) {
      console.error("Error saving config:", e);
      alert("Failed to save settings");
    }
  };

  // Focus state for TitleBar
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

  // WebSocket Connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(`${WS_URL}/ws/${clientId}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.message === "Cancelled") {
          setGlobalStatus('idle');
          setProgress(0);
          setMessage('');
          return;
        }

        setProgress(data.percentage);
        setMessage(data.message);

        // Note: Individual file status updates might be better handled via specific messages
        // For now, we use global progress
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [clientId]);

  // Password Protection State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDescription, setPasswordDescription] = useState<string | undefined>(undefined);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const checkEncryption = async (file: File, id: string) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/check_encryption`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.encrypted) {
        if (data.auto_password) {
          console.log(`Auto-decrypting ${file.name} with saved password...`);
          await handleDecryptSubmit(data.auto_password, id, file);
        } else {
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'encrypted' } : f));
          // If this is the first encrypted file found, prompt immediately? 
          // Or wait until user clicks? Let's prompt immediately for better UX.
          if (!showPasswordModal && !pendingFileId) {
            setPendingFileId(id);
            setPasswordError(null);
            setPasswordDescription("This document is password protected, and no matching password was found in your saved settings.");
            setShowPasswordModal(true);
          }
        }
      } else {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'pending' } : f));
      }
    } catch (e) {
      console.error(e);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Check failed' } : f));
    }
  };

  const handleFilesSelect = async (newFiles: File[]) => {
    const newFileItems: FileItem[] = newFiles.map(f => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFileItems]);
    setGlobalStatus('idle');
    setProgress(0);
    setMessage('');
    setDownloadUrl('');

    // Reset words to config defaults if list is empty
    if (words.length === 0 && configWords.length > 0) {
      setWords(configWords);
    }

    // Check encryption for all new files
    for (const item of newFileItems) {
      await checkEncryption(item.file, item.id);
    }
  };

  const handleDecryptSubmit = async (password: string, idOverride?: string, fileOverride?: File) => {
    const id = idOverride || pendingFileId;
    if (!id) return;

    const fileItem = files.find(f => f.id === id);
    const fileToDecrypt = fileOverride || fileItem?.file;

    if (!fileToDecrypt) return;

    setDecrypting(true);
    setPasswordError(null);
    const formData = new FormData();
    formData.append('file', fileToDecrypt);
    formData.append('password', password);

    try {
      const res = await fetch(`${API_URL}/api/decrypt`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        if (!idOverride) { // Only show error in modal if it's a manual attempt
          setPasswordError(err.error || 'Decryption failed');
        }
        return;
      }

      const blob = await res.blob();
      const decryptedFile = new File([blob], fileToDecrypt.name, { type: 'application/pdf' });

      setFiles(prev => prev.map(f => f.id === id ? { ...f, file: decryptedFile, status: 'decrypted', password } : f));

      if (!idOverride) {
        setShowPasswordModal(false);
        setPendingFileId(null);
        setPasswordError(null);
        setPasswordDescription(undefined);

        // Check if there are other encrypted files pending
        const nextEncrypted = files.find(f => f.status === 'encrypted' && f.id !== id);
        if (nextEncrypted) {
          setTimeout(() => {
            setPendingFileId(nextEncrypted.id);
            setPasswordDescription("This document is password protected, and no matching password was found in your saved settings.");
            setShowPasswordModal(true);
          }, 300);
        }
      }

    } catch (e: any) {
      if (!idOverride) {
        setPasswordError(e.message || "Incorrect password or decryption error");
      }
    } finally {
      setDecrypting(false);
    }
  };

  const [batchProgress, setBatchProgress] = useState('');

  const handleRedact = async () => {
    if (files.length === 0 || words.length === 0) return;

    setGlobalStatus('processing');
    setMessage('Starting batch processing...');
    setBatchProgress('');

    // Process sequentially
    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];
      if (fileItem.status === 'error') continue;

      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'uploading' } : f));

      // Update batch progress string
      const batchMsg = `Processing file ${i + 1} of ${files.length}: ${fileItem.file.name}`;
      setBatchProgress(batchMsg);
      setMessage('Initializing...'); // Reset message for new file

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('words', words.join(','));
      formData.append('client_id', clientId);

      try {
        // This fetch is now synchronous on the backend (waits for completion)
        const res = await fetch(`${API_URL}/api/redact`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Processing failed');

        const data = await res.json();

        setFiles(prev => prev.map(f => f.id === fileItem.id ? {
          ...f,
          status: 'done',
          tempDir: data.temp_dir,
          outputFilename: data.filename
        } : f));

        if (files.length === 1) {
          setDownloadUrl(`${API_URL}/api/download?temp_dir=${encodeURIComponent(data.temp_dir)}&filename=${encodeURIComponent(data.filename)}`);
        }

      } catch (e) {
        console.error(e);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: 'Failed' } : f));
      }
    }

    setGlobalStatus('done');
    setMessage('All files processed.');
    setBatchProgress('');
  };

  const handleBatchOutput = async () => {
    try {
      const filesToZip = files
        .filter(f => f.status === 'done' && f.tempDir && f.outputFilename)
        .map(f => ({
          temp_dir: f.tempDir,
          filename: f.outputFilename
        }));

      if (filesToZip.length === 0) {
        alert("No processed files to download.");
        return;
      }

      const res = await fetch(`${API_URL}/api/batch_zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filesToZip)
      });

      if (!res.ok) throw new Error('Failed to create ZIP');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "redacted_batch.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reset
      setTimeout(() => {
        setFiles([]);
        setWords(configWords);
        setGlobalStatus('idle');
        setProgress(0);
        setMessage('');
        setBatchProgress('');
        setDownloadUrl('');
      }, 1000);

    } catch (e: any) {
      console.error("Error saving batch:", e);
      alert(`Failed to download files: ${e.message || e}`);
    }
  };

  const handleDownloadClick = () => {
    if (files.length > 1) {
      handleBatchOutput();
    } else {
      // Single file download handled by ActionArea link, just reset state after delay
      setTimeout(() => {
        setFiles([]);
        setWords(configWords);
        setGlobalStatus('idle');
        setProgress(0);
        setMessage('');
        setBatchProgress('');
        setDownloadUrl('');
      }, 1000);
    }
  };

  const handleCancel = async () => {
    if (globalStatus !== 'processing') return;

    setGlobalStatus('cancelling');
    setMessage('Cancelling...');
    setBatchProgress('');

    const formData = new FormData();
    formData.append('client_id', clientId);

    try {
      await fetch(`${API_URL}/api/cancel`, {
        method: 'POST',
        body: formData
      });
    } catch (e) {
      console.error("Error cancelling:", e);
      setGlobalStatus('idle');
    }
  };

  const currentFile = files[previewIndex];
  const fileUrl = React.useMemo(() => {
    if (currentFile?.file) return URL.createObjectURL(currentFile.file);
    return '';
  }, [currentFile]);

  const isLocked = globalStatus === 'processing' || globalStatus === 'cancelling';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 pt-10">
      <TitleBar isFocused={isFocused} />

      <div className="max-w-7xl mx-auto p-8">
        <header className="mb-12 text-center relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            PDF Mask
          </h1>
          <p className="text-slate-400">Securely redact sensitive information from your PDFs.</p>

          <button
            onClick={() => setShowSettings(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded-xl transition-all"
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <FileUpload
              files={files.map(f => f.file)}
              onFilesSelect={handleFilesSelect}
              onClearFiles={() => {
                setFiles([]);
                setWords(configWords);
                setGlobalStatus('idle');
                setProgress(0);
                setMessage('');
                setBatchProgress('');
              }}
              disabled={isLocked}
            />

            <WordList
              words={words}
              defaultWords={configWords}
              onAddWord={(word) => setWords([...words, word])}
              onRemoveWord={(index) => setWords(words.filter((_, i) => i !== index))}
              onClearWords={() => setWords([])}
              disabled={isLocked}
            />

            <ActionArea
              status={globalStatus === 'processing' ? 'processing' : globalStatus === 'done' ? 'done' : 'idle'} // Map to expected status
              progress={progress}
              message={message}
              batchProgress={batchProgress}
              downloadUrl={files.length === 1 ? downloadUrl : undefined}
              canStart={files.length > 0 && words.length > 0 && !files.some(f => f.status === 'encrypted')}
              onStart={handleRedact}
              onDownload={handleDownloadClick}
              onRetry={() => setGlobalStatus('idle')}
              onCancel={handleCancel}
              isBatch={files.length > 1}
            />
          </div>

          <PDFPreview
            fileUrl={fileUrl}
            hasFile={!!currentFile}
            currentIndex={previewIndex}
            totalFiles={files.length}
            onPrev={() => setPreviewIndex(i => Math.max(0, i - 1))}
            onNext={() => setPreviewIndex(i => Math.min(files.length - 1, i + 1))}
            fileName={currentFile?.file.name}
          />
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPendingFileId(null);
            setPasswordError(null);
            setPasswordDescription(undefined);
          }}
          onSubmit={(pwd) => handleDecryptSubmit(pwd)}
          isDecrypting={decrypting}
          error={passwordError}
          description={passwordDescription}
          filename={files.find(f => f.id === pendingFileId)?.file.name}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveConfig}
          initialWords={configWords}
          initialPasswords={configPasswords}
        />
      </div>
    </div>
  );
}

export default App;
