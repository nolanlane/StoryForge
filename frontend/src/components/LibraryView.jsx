import React from 'react';
import { Trash2 } from 'lucide-react';

export const LibraryView = ({ userEmail, stories, onOpen, onDelete, onSequel, onBack, isWorking }) => (
  <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8">
    <div className="flex items-center justify-between mb-6">
      <div>
        <button onClick={onBack} className="text-xs font-bold text-slate-400 hover:text-purple-600 mb-2 uppercase tracking-wider">
          ← Back
        </button>
        <h2 className="text-3xl font-serif font-bold text-slate-900">Your Library</h2>
        <p className="text-sm text-slate-500 mt-1">Signed in as <span className="font-semibold text-slate-700">{userEmail}</span></p>
      </div>
    </div>

    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {stories.length === 0 ? (
        <div className="p-10 text-center text-slate-500">No saved stories yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {stories.map((s) => (
            <div key={s.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <div className="font-serif font-bold text-slate-900 truncate">{s.title || "Untitled"}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {s.genre || ""}{s.tone ? ` • ${s.tone}` : ""}{s.createdAt ? ` • ${new Date(s.createdAt).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-start sm:justify-end">
                <button
                  onClick={() => onOpen(s.id)}
                  disabled={isWorking}
                  className="px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  Open
                </button>
                <button
                  onClick={() => onSequel(s.id)}
                  disabled={isWorking}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  Sequel
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  disabled={isWorking}
                  aria-label="Delete story"
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
