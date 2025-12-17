import React, { useEffect, useState } from 'react';
import { BookOpen, Save, Download, Loader2, RefreshCcw, Wand2, Image as ImageIcon } from 'lucide-react';

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

const HistoryPanel = ({ versions, isWorking, selectedVersionId, setSelectedVersionId, onRestore }) => {
  const selected = versions.find(v => v?.id === selectedVersionId);

  return (
    <div className="mt-3">
      {versions.length === 0 ? (
        <div className="text-sm text-slate-500">No saved versions for this chapter yet.</div>
      ) : (
        <>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="version-select">Select a version</label>
          <select
            id="version-select"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            disabled={isWorking}
            className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50"
          >
            <option value="">Choose…</option>
            {versions
              .slice()
              .reverse()
              .map((v) => {
                const ts = v?.ts ? new Date(v.ts).toLocaleString() : 'Unknown time';
                const note = v?.note ? ` — ${v.note}` : '';
                return (
                  <option key={v.id} value={v.id}>
                    {ts}{note}
                  </option>
                );
              })}
          </select>

          {selected && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview</div>
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-64 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap">
                {selected.text || ''}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => onRestore?.(selected.id)}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  Restore this version
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ReaderView = ({ config, setView, exportPDF, isExporting, blueprint, storyImages, storyContent, onAbort, isChapterToolsWorking, onRegenerateChapterText, onRewriteChapter, onRegenerateIllustration, getChapterHistory, onRestoreChapterVersion }) => {
  const [activeChapter, setActiveChapter] = useState(0);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  useEffect(() => {
    setSelectedVersionId('');
  }, [activeChapter]);

  const chapters = Array.isArray(blueprint?.chapters) ? blueprint.chapters : [];

  if (!chapters.length) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">No chapters to display.</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Toolbar */}
      <header className="min-h-16 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-0 flex-shrink-0 z-10">
         <div className="flex items-center gap-4">
            <BookOpen className="w-6 h-6 text-purple-600" />
            <h1 className="font-serif font-bold text-slate-800 truncate max-w-[12rem] sm:max-w-md">{config.title}</h1>
         </div>
         <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="md:hidden">
              <label className="sr-only" htmlFor="chapter-select">Chapter</label>
              <select
                id="chapter-select"
                value={activeChapter}
                onChange={(e) => setActiveChapter(parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
              >
                {chapters.map((chap, i) => (
                  <option key={i} value={i}>{`Ch ${i + 1}: ${chap.title}`}</option>
                ))}
              </select>
            </div>
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
              {chapters.map((chap, i) => (
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
              <div className="max-w-3xl mx-auto py-8 sm:py-12 px-4 sm:px-8 min-h-full bg-white shadow-sm my-0 md:my-8 rounded-none md:rounded-xl border-x border-slate-100">

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
                      <h2 className="text-4xl font-serif font-bold text-slate-900">{chapters[activeChapter]?.title || ""}</h2>
                  </div>

                  <div className="mb-10 bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chapter Tools</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onRegenerateChapterText?.(activeChapter)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCcw className="w-4 h-4" /> Regenerate Text
                        </button>
                        <button
                          onClick={() => onRegenerateIllustration?.(activeChapter)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                          <ImageIcon className="w-4 h-4" /> Regenerate Image
                        </button>
                        <button
                          onClick={() => setRewriteOpen(v => !v)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200 disabled:opacity-50"
                        >
                          <Wand2 className="w-4 h-4" /> Rewrite
                        </button>
                        <button
                          onClick={() => setHistoryOpen(v => !v)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200 disabled:opacity-50"
                        >
                          History
                        </button>
                      </div>
                    </div>

                    {rewriteOpen && (
                      <form
                        className="mt-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (isChapterToolsWorking) return;
                          const instr = rewriteInstruction.trim();
                          if (!instr) return;
                          onRewriteChapter?.(activeChapter, instr);
                        }}
                      >
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="rewrite-instruction">Rewrite instruction</label>
                        <textarea
                          id="rewrite-instruction"
                          value={rewriteInstruction}
                          onChange={(e) => setRewriteInstruction(e.target.value)}
                          placeholder="Example: Make the prose tighter, cut metaphors, increase dialogue, and end on a cliffhanger."
                          disabled={isChapterToolsWorking}
                          className="mt-2 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none h-24 disabled:opacity-50"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={isChapterToolsWorking || !rewriteInstruction.trim()}
                            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50"
                          >
                            Apply Rewrite
                          </button>
                          <button
                            type="button"
                            disabled={isChapterToolsWorking}
                            onClick={() => { setRewriteInstruction(''); setRewriteOpen(false); }}
                            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 disabled:opacity-50"
                          >
                            Close
                          </button>
                        </div>
                      </form>
                    )}

                    {historyOpen && (
                      <div className="mt-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Version history</div>
                        <p className="text-sm text-slate-500 mt-1">Restore a previous version of this chapter.</p>

                        <HistoryPanel
                          versions={getChapterHistory ? getChapterHistory(activeChapter) : []}
                          isWorking={isChapterToolsWorking}
                          selectedVersionId={selectedVersionId}
                          setSelectedVersionId={setSelectedVersionId}
                          onRestore={(versionId) => onRestoreChapterVersion?.(activeChapter, versionId)}
                        />
                      </div>
                    )}
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
                          disabled={activeChapter === chapters.length - 1}
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
