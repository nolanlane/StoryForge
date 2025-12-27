import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';

export const BlueprintView = ({ blueprint, storyImages, setView, startDrafting, onAbort, chatMessages, chatInput, setChatInput, onSendChat, isChatWorking, storyDoctor }) => {
  const [storyDoctorSuggestions, setStoryDoctorSuggestions] = useState(null);
  const [isDoctorWorking, setIsDoctorWorking] = useState(false);
  const [doctorError, setDoctorError] = useState(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Memoize character parsing to avoid re-parsing on every render
  const parsedCharacters = useMemo(() => 
    (Array.isArray(blueprint.characters) ? blueprint.characters : []).map(char => {
      const parts = char.split(':');
      return {
        name: parts[0].trim(),
        desc: parts.slice(1).join(':').trim()
      };
    }), [blueprint.characters]
  );

  const getStoryDoctorSuggestions = useCallback(async () => {
    if (!blueprint) return;
    setIsDoctorWorking(true);
    setStoryDoctorSuggestions(null);
    setDoctorError(null);
    try {
      const suggestions = await storyDoctor(blueprint);
      setStoryDoctorSuggestions(suggestions);
    } catch (error) {
      setDoctorError("Sorry, the Story Doctor is having trouble thinking right now. Please try again later.");
      console.error("Error getting story doctor suggestions:", error);
    } finally {
      setIsDoctorWorking(false);
    }
  }, [blueprint, storyDoctor]);

  return (
  <main className="max-w-4xl mx-auto py-6 px-4 md:py-8 md:px-6 animate-in fade-in slide-in-from-bottom-8">

    {/* Header */}
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
      <div>
        <button
          onClick={() => { onAbort(); setView('setup'); }}
          className="text-xs font-bold text-slate-500 hover:text-purple-600 mb-2 uppercase tracking-wider"
        >
          ← Restart
        </button>
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">Blueprint Generated</h2>
      </div>
      <button
          onClick={startDrafting}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-2 w-full sm:w-auto justify-center focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 outline-none"
      >
          Start Production <ChevronRight className="w-4 h-4" />
      </button>
    </header>

    {/* DNA Workshop - Full Width at Top */}
    <section className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 md:p-8 rounded-2xl shadow-lg border-2 border-purple-200 mb-6 md:mb-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h3 className="text-sm md:text-base font-bold text-purple-900 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Story DNA Workshop
        </h3>
        <div className="flex items-center gap-2">
          {isChatWorking && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          <button
            onClick={getStoryDoctorSuggestions}
            disabled={isDoctorWorking || isChatWorking}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 rounded-lg border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isDoctorWorking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Story Doctor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div
            className="h-64 overflow-y-auto rounded-lg border-2 border-purple-100 bg-white p-4 space-y-3 mb-4 scrollbar-thin scrollbar-thumb-purple-200"
            role="log"
            aria-live="polite"
            aria-busy={isChatWorking}
          >
            {chatMessages.length === 0 ? (
              <div className="text-sm text-slate-600 leading-relaxed">
                <p className="font-semibold text-purple-900 mb-2">Ask for changes like:</p>
                <p className="italic">"Make the protagonist older, cut metaphors, and make Chapter 2 a tense negotiation instead of a chase."</p>
              </div>
            ) : (
              chatMessages.map((m, idx) => (
                <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={
                    m.role === 'user'
                      ? 'inline-block bg-purple-600 text-white px-4 py-2 rounded-2xl rounded-br-md text-sm max-w-[85%]'
                      : 'inline-block bg-white border-2 border-purple-100 text-slate-700 px-4 py-2 rounded-2xl rounded-bl-md text-sm max-w-[85%]'
                  }>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2 flex-wrap mb-2">
            {['Make it darker and grittier', 'Increase romantic tension', 'Add more action scenes', 'Simplify the plot'].map(action => (
              <button
                key={action}
                onClick={() => { setChatInput(action); }}
                disabled={isChatWorking || isDoctorWorking}
                className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors disabled:opacity-50"
                type="button"
              >
                {action}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isChatWorking && chatInput.trim()) onSendChat();
            }}
          >
            <label htmlFor="dna-chat-input" className="sr-only">Request revision</label>
            <input
              id="dna-chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Request a DNA rewrite…"
              className="flex-1 p-3 bg-white border-2 border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all"
              disabled={isChatWorking || isDoctorWorking}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isChatWorking && chatInput.trim()) onSendChat();
                }
              }}
            />
            <button
              type="submit"
              disabled={isChatWorking || isDoctorWorking || !chatInput.trim()}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold disabled:opacity-50 transition-colors shadow-md"
              aria-label="Apply Changes"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="text-sm text-slate-700 bg-white border-2 border-purple-100 rounded-xl p-6">
          {doctorError ? (
            <p className="text-red-500 text-center py-12">{doctorError}</p>
          ) : storyDoctorSuggestions ? (
            <>
              <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Story Doctor's Notes
              </h4>
              <div
                className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:text-purple-900"
                dangerouslySetInnerHTML={{ __html: storyDoctorSuggestions }}
              />
            </>
          ) : (
            <div className="text-center text-slate-400 py-12">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Click "Story Doctor" for AI suggestions</p>
            </div>
          )}
        </div>
      </div>
    </section>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

      {/* Left Col: Visuals & Meta */}
      <div className="lg:col-span-1 space-y-6">
          {/* Cover Preview */}
          <section className="bg-white p-2 rounded-xl shadow-sm border border-slate-200" aria-label="Book Cover">
              {storyImages.cover ? (
                  <img src={storyImages.cover} className="w-full aspect-[2/3] object-cover rounded-lg" alt={blueprint?.title ? `Cover for ${blueprint.title}` : "Cover"} />
              ) : (
                  <div className="w-full aspect-[2/3] bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-sm">Generating Cover...</div>
              )}
          </section>

          <section className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Visual DNA</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{blueprint.visual_dna}</p>
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Central Conflict</h3>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{blueprint.central_conflict_engine}</p>
              </div>
               <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Structure</h3>
                  <p className="text-sm text-slate-700 leading-relaxed italic">{blueprint.narrative_structure}</p>
              </div>
          </section>
      </div>

      {/* Right Col: Outline */}
      <div className="lg:col-span-2 space-y-6">
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">{blueprint.title}</h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-6 font-serif italic">{blueprint.synopsis}</p>

              <ol className="space-y-6 list-none m-0 p-0">
                  {blueprint.chapters.map((chap, i) => (
                      <li key={i} className="flex gap-4 group">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                              {i + 1}
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-900 text-lg">{chap.title}</h4>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{chap.summary}</p>
                          </div>
                      </li>
                  ))}
              </ol>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cast</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parsedCharacters.map((char, i) => (
                      <div key={i} className="text-sm">
                          <span className="block font-bold text-slate-800">{char.name}</span>
                          <span className="text-slate-500">{char.desc}</span>
                      </div>
                  ))}
              </div>

              {blueprint.character_visuals && Object.keys(blueprint.character_visuals).length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Character Visuals
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(blueprint.character_visuals).map(([name, desc]) => (
                      <div key={name} className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="font-bold text-slate-700 mb-1">{name}</div>
                        <div className="text-slate-500">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </section>
      </div>

    </div>
  </main>
)};
