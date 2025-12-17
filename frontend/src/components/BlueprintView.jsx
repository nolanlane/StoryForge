import React from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

export const BlueprintView = ({ config, setConfig, blueprint, storyImages, setView, startDrafting, onAbort, chatMessages, chatInput, setChatInput, onSendChat, isChatWorking }) => (
  <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-8">

    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <button
          onClick={() => { onAbort(); setView('setup'); }}
          className="text-xs font-bold text-slate-400 hover:text-purple-600 mb-2 uppercase tracking-wider"
        >
          ← Restart
        </button>
        <h2 className="text-3xl font-serif font-bold text-slate-900">Blueprint Generated</h2>
      </div>
      <button
          onClick={startDrafting}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
      >
          Start Production <ChevronRight className="w-4 h-4" />
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* Left Col: Visuals & Meta */}
      <div className="lg:col-span-1 space-y-6">
          {/* Cover Preview */}
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
              {storyImages.cover ? (
                  <img src={storyImages.cover} className="w-full aspect-[2/3] object-cover rounded-lg" alt={blueprint?.title ? `Cover for ${blueprint.title}` : "Cover"} />
              ) : (
                  <div className="w-full aspect-[2/3] bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">Generating Cover...</div>
              )}
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Visual DNA</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{blueprint.visual_dna}</p>
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Central Conflict</h3>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{blueprint.central_conflict_engine}</p>
              </div>
               <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Structure</h3>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{blueprint.narrative_structure}</p>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Story DNA Workshop</h3>
              {isChatWorking && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            <div className="h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-sm text-slate-500">Ask for changes like: “Make the protagonist older, cut metaphors, and make Chapter 2 a tense negotiation instead of a chase.”</div>
              ) : (
                chatMessages.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div className={
                      m.role === 'user'
                        ? 'inline-block bg-purple-600 text-white px-3 py-2 rounded-2xl rounded-br-md text-sm max-w-[85%]'
                        : 'inline-block bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-2xl rounded-bl-md text-sm max-w-[85%]'
                    }>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <form
                className="flex-1 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!isChatWorking && chatInput.trim()) onSendChat();
                }}
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Request a DNA rewrite…"
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  disabled={isChatWorking}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isChatWorking && chatInput.trim()) onSendChat();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isChatWorking || !chatInput.trim()}
                  className="px-4 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold disabled:opacity-50"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>
      </div>

      {/* Right Col: Outline */}
      <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">{blueprint.title}</h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-6 font-serif italic">{blueprint.synopsis}</p>

              <div className="space-y-6">
                  {blueprint.chapters.map((chap, i) => (
                      <div key={i} className="flex gap-4 group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                              {i + 1}
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-900">{chap.title}</h4>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{chap.summary}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Cast</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Array.isArray(blueprint.characters) ? blueprint.characters : []).map((char, i) => {
                      const parts = char.split(':');
                      const name = parts[0].trim();
                      const desc = parts.slice(1).join(':').trim(); // Join back in case description has colons
                      return (
                          <div key={i} className="text-sm">
                              <span className="block font-bold text-slate-800">{name}</span>
                              <span className="text-slate-500">{desc}</span>
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>

    </div>
  </div>
);
