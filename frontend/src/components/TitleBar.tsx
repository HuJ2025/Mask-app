import React from 'react';
import { cn } from '../lib/utils';

interface TitleBarProps {
    isFocused: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isFocused }) => {
    return (
        <div className={cn(
            "fixed top-0 left-0 right-0 h-10 z-50 drag-region flex items-center justify-center backdrop-blur-md border-b transition-all duration-300",
            isFocused
                ? "bg-slate-900/90 border-white/10 shadow-lg shadow-black/20"
                : "bg-slate-950/50 border-transparent opacity-50 grayscale"
        )}>
            <span className={cn(
                "text-xs font-medium transition-colors duration-300",
                isFocused ? "text-slate-200" : "text-slate-700"
            )}>PDF Mask</span>
        </div>
    );
};
