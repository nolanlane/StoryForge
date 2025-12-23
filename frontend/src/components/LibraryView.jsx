import React from 'react';
import { Trash2 } from 'lucide-react';

export const LibraryView = ({ userEmail, stories, onOpen, onDelete, onSequel, onBack, isWorking }) => (
  <main className="max-w-4xl mx-auto py-8 px-4 sm:py-12 sm:px-6 animate-in fade-in slide-in-from-bottom-8">
    <header className="flex items-center justify-between mb-8">
      <div>
        <button
          onClick={onBack}
          className="text-xs font-bold text-slate-500 hover:text-purple-600 mb-2 uppercase tracking-wider transition-colors"
          disabled={isWorking}
        >
          ← Back
        </button>
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">Your Library</h2>
        <p className="text-sm text-slate-500 mt-2">Signed in as <span className="font-semibold text-slate-700">{userEmail}</span></p>
      </div>
    </header>

    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" aria-label="Story List">
      {stories.length === 0 ? (
        <div className="p-12 text-center text-slate-500">No saved stories yet. Start a new one!</div>
      ) : (
        <ul className="divide-y divide-slate-100 m-0 p-0 list-none">
          {stories.map((s) => (
            <li key={s.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 hover:bg-slate-50/50 transition-colors">
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-slate-900 truncate text-lg">{s.title || "Untitled"}</h3>
                <div className="text-xs text-slate-500 mt-1">
                  {s.genre || ""}{s.tone ? ` • ${s.tone}` : ""}{s.createdAt ? ` • ${new Date(s.createdAt).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-start sm:justify-end">
                <button
                  onClick={() => onOpen(s.id)}
                  disabled={isWorking}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors focus:ring-2 focus:ring-slate-900 outline-none"
                >
                  Open
                </button>
                <button
                  onClick={() => onSequel(s.id)}
                  disabled={isWorking}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors focus:ring-2 focus:ring-purple-600 outline-none"
                >
                  Sequel
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  disabled={isWorking}
                  aria-label={`Delete ${s.title}`}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  </main>
);
