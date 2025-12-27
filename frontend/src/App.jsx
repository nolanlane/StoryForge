import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { StoryProvider, useStory } from './context/StoryContext';

import LoginPage from './pages/LoginPage';
import LibraryPage from './pages/LibraryPage';
import HomePage from './pages/HomePage';
import StoryPage from './pages/StoryPage';

function AppContent() {
  const { error, setError, isChapterToolsWorking, chapterToolsMessage } = useStory();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-purple-100 selection:text-purple-900">
      {error && (
        <div role="alert" aria-live="assertive" className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 bg-red-50 text-red-600 px-4 py-3 rounded-xl border border-red-200 shadow-xl flex items-center gap-3 animate-in slide-in-from-top-2 max-w-[calc(100vw-2rem)] sm:w-[420px] break-words">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
          <button aria-label="Dismiss error" onClick={() => setError(null)} className="ml-2 hover:bg-red-100 p-1 rounded-full"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}

      {isChapterToolsWorking && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-40 bg-white text-slate-700 px-4 py-3 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:w-[420px]">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          <p className="text-sm font-medium">{chapterToolsMessage || "Working..."}</p>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/story/:id/:mode" element={<StoryPage />} />
        <Route path="/story/:id" element={<StoryPage />} /> {/* Default mode handled in component */}
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <StoryProvider>
      <AppContent />
    </StoryProvider>
  );
}
