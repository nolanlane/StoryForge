import React, { useState } from 'react';
import { BookOpen, Save, Download, Loader2 } from 'lucide-react';

const renderMarkdown = (text) => {
  if (!text) return <p className="text-slate-400 italic text-center">Content missing...</p>;

  // Split by double newlines for paragraphs to ensure cleaner reading flow
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((para, idx) => {
    // Simple inline parsing for bold (**text**) and italic (*text*)
    const parts = para.split(/(\*\*.*?\*\*|\*.*?\*)/g);

    return (
      <p key={idx} className="mb-6 leading-relaxed text-lg text-slate-800">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
          } else if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
          }
          return part;
        })}
      </p>
    );
  });
};

export const ReaderView = ({ config, setView, exportPDF, isExporting, blueprint, storyImages, storyContent, onAbort }) => {
  const [activeChapter, setActiveChapter] = useState(0);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Toolbar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
         <div className="flex items-center gap-4">
            <BookOpen className="w-6 h-6 text-purple-600" />
            <h1 className="font-serif font-bold text-slate-800 truncate max-w-md">{config.title}</h1>
         </div>
         <div className="flex items-center gap-3">
            {config.onSave && (
              <button
                onClick={config.onSave}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-slate-200"
              >
                <Save className="w-4 h-4" /> Save
              </button>
            )}
            <button
              onClick={() => { onAbort(); setView('setup'); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              New Story
            </button>
            <button
              onClick={exportPDF}
              disabled={isExporting}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? "Compiling..." : "Export PDF"}
            </button>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto hidden md:block p-4 space-y-1">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Table of Contents</div>
              {blueprint.chapters.map((chap, i) => (
                  <button
                      key={i}
                      onClick={() => setActiveChapter(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeChapter === i ? 'bg-white shadow-sm text-purple-700 ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/50'
                      }`}
                  >
                      <span className="opacity-50 mr-2">{i+1}.</span> {chap.title}
                  </button>
              ))}
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-white/50 relative">
              <div className="max-w-3xl mx-auto py-12 px-8 min-h-full bg-white shadow-sm my-0 md:my-8 rounded-none md:rounded-xl border-x border-slate-100">

                  {/* Chapter Header Image */}
                  {storyImages[activeChapter] ? (
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-8 shadow-inner bg-slate-100 bg-black/5">
                          <img
                            src={storyImages[activeChapter]}
                            className="w-full h-full object-contain"
                            alt={`Illustration for Chapter ${activeChapter + 1}`}
                          />
                      </div>
                  ) : (
                      <div className="w-full h-12 mb-8" />
                  )}

                  <div className="text-center mb-10">
                      <span className="text-xs font-bold text-purple-600 uppercase tracking-[0.2em] mb-2 block">Chapter {activeChapter + 1}</span>
                      <h2 className="text-4xl font-serif font-bold text-slate-900">{blueprint.chapters[activeChapter].title}</h2>
                  </div>

                  <div className="prose prose-lg prose-slate font-serif mx-auto">
                       {renderMarkdown(storyContent[activeChapter])}
                  </div>

                  {/* Footer Nav */}
                  <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-400">
                      <button
                          disabled={activeChapter === 0}
                          onClick={() => setActiveChapter(c => c-1)}
                          className="hover:text-purple-600 disabled:opacity-20 flex items-center gap-1"
                      >
                          ← Previous
                      </button>
                      <button
                          disabled={activeChapter === blueprint.chapters.length - 1}
                          onClick={() => setActiveChapter(c => c+1)}
                          className="hover:text-purple-600 disabled:opacity-20 flex items-center gap-1"
                      >
                          Next →
                      </button>
                  </div>

              </div>
          </main>
      </div>
    </div>
  );
};
