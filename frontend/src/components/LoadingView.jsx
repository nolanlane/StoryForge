import React from 'react';
import { Wand2, StopCircle } from 'lucide-react';

export const LoadingView = ({ loadingMessage, onAbort }) => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in">
    <div className="relative">
      <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
      <Wand2 className="w-16 h-16 text-purple-600 relative z-10 animate-bounce" />
    </div>
    <h2 className="mt-8 text-2xl font-serif font-bold text-slate-800">Forging Story</h2>
    <p className="text-slate-500 mt-2 italic">{loadingMessage}</p>

    <button
      onClick={onAbort}
      className="mt-8 flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
    >
      <StopCircle className="w-4 h-4" /> Stop Generation
    </button>
  </div>
);
