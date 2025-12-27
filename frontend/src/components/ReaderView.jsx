import { useState, useEffect } from 'react';
import { BookOpen, Save, Download, Loader2, RefreshCcw, Wand2, Image as ImageIcon, Menu, X, ChevronRight, Zap, Eye } from 'lucide-react';

const renderMarkdown = (text) => {
  if (!text) return <p className="text-slate-500 italic text-center">Content missing...</p>;

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
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2" htmlFor="version-select">Select a version</label>
          <select
            id="version-select"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            disabled={isWorking}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50 focus:ring-2 focus:ring-purple-500"
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
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preview</div>
              <div
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-64 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap"
                tabIndex="0"
              >
                {selected.text || ''}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => onRestore?.(selected.id)}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
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

export const ReaderView = ({
  config,
  setView,
  exportPDF,
  isExporting,
  blueprint,
  storyImages,
  storyContent,
  chapterGuidance,
  imageGuidance,
  onUpdateChapterGuidance,
  onUpdateImageGuidance,
  onAbort,
  isChapterToolsWorking,
  onGenerateChapterText,
  onRewriteChapter,
  onRegenerateIllustration,
  getChapterHistory,
  onRestoreChapterVersion,
  onGenerateAllRemaining,
  chapterGuidanceTemplates,
  imageGuidanceTemplates
}) => {
  const [activeChapter, setActiveChapter] = useState(0);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const chapters = Array.isArray(blueprint?.chapters) ? blueprint.chapters : [];

  const handleChapterChange = (index) => {
    setActiveChapter(index);
    setSelectedVersionId('');
    setMobileMenuOpen(false);
    setShowPreview(false);
  };

  const getChapterStatus = (index) => {
    const hasText = !!String(storyContent[index] || "").trim();
    const hasImage = !!storyImages[index];
    if (hasText && hasImage) return 'complete';
    if (hasText) return 'text-only';
    return 'empty';
  };

  const goToNextEmptyChapter = () => {
    const nextEmpty = chapters.findIndex((_, i) => i > activeChapter && getChapterStatus(i) === 'empty');
    if (nextEmpty !== -1) {
      handleChapterChange(nextEmpty);
    } else {
      const firstEmpty = chapters.findIndex((_, i) => getChapterStatus(i) === 'empty');
      if (firstEmpty !== -1) handleChapterChange(firstEmpty);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft' && activeChapter > 0) {
          e.preventDefault();
          handleChapterChange(activeChapter - 1);
        } else if (e.key === 'ArrowRight' && activeChapter < chapters.length - 1) {
          e.preventDefault();
          handleChapterChange(activeChapter + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChapter, chapters.length]);

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
      <header className="min-h-16 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-0 flex-shrink-0 z-20 relative">
         <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Chapter Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <BookOpen className="w-6 h-6 text-purple-600 hidden sm:block" />
            <h1 className="font-serif font-bold text-slate-800 truncate max-w-[10rem] sm:max-w-md">{config.title}</h1>
         </div>
         <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={goToNextEmptyChapter}
              disabled={chapters.every((_, i) => getChapterStatus(i) !== 'empty')}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-slate-200 disabled:opacity-50 focus:ring-2 focus:ring-purple-500 outline-none"
              title="Jump to next empty chapter (Ctrl+N)"
            >
              <ChevronRight className="w-4 h-4" /> <span className="hidden sm:inline">Next Empty</span>
            </button>
            {config.onSave && (
              <button
                onClick={config.onSave}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <Save className="w-4 h-4" /> <span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button
              onClick={() => { onAbort(); setView('setup'); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              New Story
            </button>
            <button
              onClick={exportPDF}
              disabled={isExporting}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 outline-none"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? "Compiling..." : "Export PDF"}
            </button>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          {/* Sidebar / Mobile Menu */}
          <nav
            className={`
              absolute inset-0 z-10 bg-slate-50/95 backdrop-blur-sm md:static md:w-64 md:bg-slate-50 md:border-r md:border-slate-200 md:block
              ${mobileMenuOpen ? 'block' : 'hidden'}
            `}
            aria-label="Table of Contents"
          >
              <div className="h-full overflow-y-auto p-4 space-y-1">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-2">Table of Contents</div>
                {chapters.map((chap, i) => {
                  const status = getChapterStatus(i);
                  return (
                    <button
                        key={i}
                        onClick={() => handleChapterChange(i)}
                        className={`w-full text-left px-3 py-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            activeChapter === i ? 'bg-white shadow-sm text-purple-700 ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/50'
                        }`}
                        aria-current={activeChapter === i ? 'page' : undefined}
                    >
                        <span className="opacity-50">{i+1}.</span>
                        <span className="flex-1">{chap.title}</span>
                        {status === 'complete' && <span className="w-2 h-2 rounded-full bg-green-500" title="Text + Image" />}
                        {status === 'text-only' && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Text only" />}
                        {status === 'empty' && <span className="w-2 h-2 rounded-full bg-slate-300" title="Not started" />}
                    </button>
                  );
                })}
              </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-slate-50/50 relative scroll-smooth">
              <article className="max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-8 min-h-full bg-white shadow-sm my-0 md:my-8 rounded-none md:rounded-xl border-x border-slate-100">

                  {/* Chapter Header Image */}
                  {storyImages[activeChapter] ? (
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-8 shadow-inner bg-slate-100">
                          <img
                            src={storyImages[activeChapter]}
                            className="w-full h-full object-contain"
                            alt={`Illustration for Chapter ${activeChapter + 1}`}
                          />
                      </div>
                  ) : (
                      <div className="w-full h-12 mb-8" aria-hidden="true" />
                  )}

                  <header className="text-center mb-10">
                      <span className="text-xs font-bold text-purple-600 uppercase tracking-[0.2em] mb-2 block">Chapter {activeChapter + 1}</span>
                      <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">{chapters[activeChapter]?.title || ""}</h2>
                  </header>

                  <section className="mb-10 bg-white border border-slate-200 rounded-xl p-4 space-y-4" aria-label="Chapter Tools">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chapter Tools</div>
                        <button
                          onClick={() => setShowPreview(v => !v)}
                          disabled={isChapterToolsWorking}
                          className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                          aria-expanded={showPreview}
                        >
                          <Eye className="w-3 h-3" /> {showPreview ? 'Hide' : 'Preview'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 sm:gap-2">
                        <button
                          onClick={() => onGenerateChapterText?.(activeChapter)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-slate-900 outline-none"
                          aria-label="Generate or Regenerate Text"
                        >
                          <RefreshCcw className="w-4 h-4" /> <span className="hidden sm:inline">Generate Text</span>
                        </button>
                        <button
                          onClick={() => onRegenerateIllustration?.(activeChapter)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-purple-600 outline-none"
                          aria-label="Generate or Regenerate Image"
                        >
                          <ImageIcon className="w-4 h-4" /> <span className="hidden sm:inline">Image</span>
                        </button>
                        <button
                          onClick={() => setRewriteOpen(v => !v)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-slate-200 outline-none"
                          aria-expanded={rewriteOpen}
                        >
                          <Wand2 className="w-4 h-4" /> Rewrite
                        </button>
                        <button
                          onClick={() => setHistoryOpen(v => !v)}
                          disabled={isChapterToolsWorking}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-slate-200 outline-none"
                          aria-expanded={historyOpen}
                        >
                          History
                        </button>
                        {onGenerateAllRemaining && (
                          <button
                            onClick={onGenerateAllRemaining}
                            disabled={isChapterToolsWorking || chapters.every((_, i) => getChapterStatus(i) !== 'empty')}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-purple-600 outline-none"
                          >
                            <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Generate All</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {showPreview && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-sm">
                        <div>
                          <div className="font-bold text-slate-700 mb-1">Blueprint Summary</div>
                          <p className="text-slate-600 leading-relaxed">{chapters[activeChapter]?.summary}</p>
                        </div>
                        {activeChapter > 0 && storyContent[activeChapter - 1] && (
                          <div>
                            <div className="font-bold text-slate-700 mb-1">Previous Chapter Ending</div>
                            <p className="text-slate-600 leading-relaxed italic line-clamp-3">
                              ...{String(storyContent[activeChapter - 1]).slice(-300)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block" htmlFor="chapter-guidance">Chapter guidance</label>
                          <select
                            value=""
                            onChange={(e) => e.target.value && onUpdateChapterGuidance?.(activeChapter, e.target.value)}
                            disabled={isChapterToolsWorking}
                            className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            {chapterGuidanceTemplates?.map((t, i) => (
                              <option key={i} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          id="chapter-guidance"
                          value={chapterGuidance?.[activeChapter] || ""}
                          onChange={(e) => onUpdateChapterGuidance?.(activeChapter, e.target.value)}
                          placeholder="Tone, beat focus, things to include/avoid for this chapter..."
                          disabled={isChapterToolsWorking}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all h-20 resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block" htmlFor="image-guidance">Image guidance</label>
                          <select
                            value=""
                            onChange={(e) => e.target.value && onUpdateImageGuidance?.(activeChapter, e.target.value)}
                            disabled={isChapterToolsWorking}
                            className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            {imageGuidanceTemplates?.map((t, i) => (
                              <option key={i} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          id="image-guidance"
                          value={imageGuidance?.[activeChapter] || ""}
                          onChange={(e) => onUpdateImageGuidance?.(activeChapter, e.target.value)}
                          placeholder="Describe the shot: focal moment, mood, lighting, POV..."
                          disabled={isChapterToolsWorking}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all h-20 resize-none"
                        />
                      </div>
                    </div>
                  </section>

                  {rewriteOpen && (
                      <form
                        className="mt-4 animate-in fade-in slide-in-from-top-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (isChapterToolsWorking) return;
                          const instr = rewriteInstruction.trim();
                          if (!instr) return;
                          onRewriteChapter?.(activeChapter, instr);
                        }}
                      >
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2" htmlFor="rewrite-instruction">Rewrite instruction</label>
                        <textarea
                          id="rewrite-instruction"
                          value={rewriteInstruction}
                          onChange={(e) => setRewriteInstruction(e.target.value)}
                          placeholder="Example: Make the prose tighter, cut metaphors, increase dialogue, and end on a cliffhanger."
                          disabled={isChapterToolsWorking}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none h-24 disabled:opacity-50 focus:ring-2 focus:ring-purple-500"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={isChapterToolsWorking || !rewriteInstruction.trim()}
                            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                          >
                            Apply Rewrite
                          </button>
                          <button
                            type="button"
                            disabled={isChapterToolsWorking}
                            onClick={() => { setRewriteInstruction(''); setRewriteOpen(false); }}
                            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 disabled:opacity-50 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </form>
                    )}

                    {historyOpen && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Version history</div>
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
                  </section>

                  <div className="prose prose-lg prose-slate font-serif mx-auto">
                       {renderMarkdown(storyContent[activeChapter])}
                  </div>

                  {/* Footer Nav */}
                  <nav className="mt-16 pt-8 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-500" aria-label="Chapter Navigation">
                      <button
                          disabled={activeChapter === 0}
                          onClick={() => handleChapterChange(activeChapter - 1)}
                          className="hover:text-purple-600 disabled:opacity-20 flex items-center gap-1 transition-colors px-2 py-1"
                          aria-label="Previous Chapter"
                      >
                          ← Previous
                      </button>
                      <button
                          disabled={activeChapter === chapters.length - 1}
                          onClick={() => handleChapterChange(activeChapter + 1)}
                          className="hover:text-purple-600 disabled:opacity-20 flex items-center gap-1 transition-colors px-2 py-1"
                          aria-label="Next Chapter"
                      >
                          Next →
                      </button>
                  </nav>

              </article>
          </main>
      </div>
    </div>
  );
};
