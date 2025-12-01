import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { FileUpload } from './components/FileUpload';
import { WordList } from './components/WordList';
import { ActionArea } from './components/ActionArea';
import { PDFPreview } from './components/PDFPreview';
import { PasswordModal } from './components/PasswordModal';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [clientId] = useState(() => Math.random().toString(36).substring(7));
  const wsRef = useRef<WebSocket | null>(null);

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

  // Password Protection State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const checkEncryption = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/check_encryption`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.encrypted) {
        setPendingFile(file);
        setShowPasswordModal(true);
      } else {
        setFile(file);
        setStatus('idle');
        setProgress(0);
        setMessage('');
      }
    } catch (e) {
      console.error(e);
      alert("Error checking file encryption");
    }
  };

  const handleDecryptSubmit = async (password: string) => {
    if (!pendingFile) return;

    setDecrypting(true);
    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('password', password);

    try {
      const res = await fetch(`${API_URL}/api/decrypt`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Decryption failed');
      }

      const blob = await res.blob();
      const decryptedFile = new File([blob], pendingFile.name, { type: 'application/pdf' });

      setFile(decryptedFile);
      setShowPasswordModal(false);
      setPendingFile(null);
      setStatus('idle');
      setProgress(0);
      setMessage('');
    } catch (e: any) {
      alert(e.message || "Incorrect password or decryption error");
    } finally {
      setDecrypting(false);
    }
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

      setDownloadUrl(`${API_URL}/api/download?temp_dir=${encodeURIComponent(data.temp_dir)}&filename=${encodeURIComponent(data.filename)}`);

    } catch (e) {
      console.error(e);
      setStatus('error');
      setMessage('Error starting redaction.');
    }
  };

  const handleDownloadClick = () => {
    setTimeout(() => {
      setFile(null);
      setWords([]);
      setStatus('idle');
      setProgress(0);
      setMessage('');
      setDownloadUrl('');
    }, 1000);
  };

  const fileUrl = React.useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return '';
  }, [file]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 pt-10">
      <TitleBar isFocused={isFocused} />

      <div className="max-w-7xl mx-auto p-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            PDF Mask
          </h1>
          <p className="text-slate-400">Securely redact sensitive information from your PDFs.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <FileUpload
              file={file}
              onFileSelect={checkEncryption}
              onClearFile={() => {
                setFile(null);
                setWords([]);
                setStatus('idle');
                setProgress(0);
                setMessage('');
              }}
            />

            <WordList
              words={words}
              onAddWord={(word) => setWords([...words, word])}
              onRemoveWord={(index) => setWords(words.filter((_, i) => i !== index))}
              onClearWords={() => setWords([])}
            />

            <ActionArea
              status={status}
              progress={progress}
              message={message}
              downloadUrl={downloadUrl}
              canStart={!!file && words.length > 0}
              onStart={handleRedact}
              onDownload={handleDownloadClick}
              onRetry={() => setStatus('idle')}
            />
          </div>

          <PDFPreview fileUrl={fileUrl} hasFile={!!file} />
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPendingFile(null);
          }}
          onSubmit={handleDecryptSubmit}
          isDecrypting={decrypting}
        />
      </div>
    </div>
  );
}

export default App;
