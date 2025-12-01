import React from 'react';
import { FileText } from 'lucide-react';

interface PDFPreviewProps {
    fileUrl: string;
    hasFile: boolean;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ fileUrl, hasFile }) => {
    return (
        <div className="bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[600px] sticky top-24">
            <div className="p-4 border-b border-white/5 bg-slate-900/50">
                <h2 className="font-semibold text-slate-300 flex items-center gap-2">
                    <FileText size={18} />
                    Document Preview
                </h2>
            </div>
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
