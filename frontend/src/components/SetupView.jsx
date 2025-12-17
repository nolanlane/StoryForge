import React, { useState } from 'react';
import { BookOpen, User, Sparkles, Dices, Loader2, Ban, Feather } from 'lucide-react';

export const SetupView = ({ config, setConfig, generateBlueprint, onRollDice, userEmail, onOpenAuth, onOpenLibrary, onLogout }) => {
  const [isRolling, setIsRolling] = useState(false);

  const handleRollDice = async () => {
    if (!userEmail) {
      onOpenAuth();
      return;
    }
    setIsRolling(true);
    try {
      await onRollDice();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-in slide-in-from-bottom-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-serif font-bold text-slate-900 tracking-tight flex items-center justify-center gap-4">
          <BookOpen className="w-10 h-10 text-purple-600" />
          StoryForge
        </h1>
        <p className="text-slate-500 mt-3 text-lg">Hardened AI Narrative Engine</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <User className="w-3 h-3" />
            {userEmail ? `Signed in: ${userEmail}` : 'Not signed in'}
          </div>
          <div className="flex items-center gap-2">
            {userEmail ? (
              <>
                <button
                  onClick={onOpenLibrary}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
                >
                  Library
                </button>
                <button
                  onClick={onLogout}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-2 py-1 rounded transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Genre & Tone */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Genre</label>
            <select
              value={config.genre}
              onChange={(e) => setConfig({...config, genre: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              <optgroup label="Classic">
                <option>Science Fiction</option>
                <option>High Fantasy</option>
                <option>Mystery / Detective</option>
                <option>Thriller / Suspense</option>
                <option>Horror</option>
                <option>Historical Fiction</option>
                <option>Romance</option>
                <option>Literary Fiction</option>
                <option>Adventure</option>
                <option>Western</option>
              </optgroup>
              <optgroup label="Speculative & Niche">
                <option>Cyberpunk</option>
                <option>Steampunk</option>
                <option>Solarpunk</option>
                <option>Space Opera</option>
                <option>Urban Fantasy</option>
                <option>Magical Realism</option>
                <option>Dystopian / Post-Apocalyptic</option>
                <option>Gothic Horror</option>
                <option>Eldritch / Cosmic Horror</option>
                <option>Weird West</option>
                <option>Alt-History</option>
                <option>Satire</option>
              </optgroup>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tone</label>
            <select
              value={config.tone}
              onChange={(e) => setConfig({...config, tone: e.target.value})}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              <optgroup label="Atmosphere">
                <option>Gritty & Realistic</option>
                <option>Dark & Oppressive</option>
                <option>Lighthearted & Whimsical</option>
                <option>Cozy & Heartwarming</option>
                <option>Gothic & Atmospheric</option>
                <option>Surreal & Dreamlike</option>
              </optgroup>
              <optgroup label="Pacing & Emotion">
                <option>Fast-Paced & Action-Heavy</option>
                <option>Suspenseful & Tense</option>
                <option>Emotional & Melancholic</option>
                <option>Romantic & Sweeping</option>
                <option>Philosophical & Introspective</option>
                <option>Satirical & Witty</option>
                <option>Hopeful & Optimistic</option>
                <option>Psychedelic & Bizarre</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-2">
          <div className="flex justify-between items-end mb-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-purple-500" /> Story Concept
            </label>
            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
              title="Generate a random concept based on Genre/Tone"
            >
              {isRolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dices className="w-3 h-3" />}
              {isRolling ? "Generating..." : "Roll Dice"}
            </button>
          </div>
          <textarea
            value={config.prompt}
            onChange={(e) => setConfig({...config, prompt: e.target.value})}
            placeholder="Describe your idea or roll the dice for inspiration..."
            className="w-full p-4 h-32 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none font-serif text-lg transition-all"
          />
        </div>

        {/* Advanced Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
           <div className="space-y-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Length</label>
             <select
                value={config.chapterCount}
                onChange={(e) => setConfig({...config, chapterCount: parseInt(e.target.value)})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
             >
               <option value="3">Short Story (3 Ch)</option>
               <option value="5">Novella (5 Ch)</option>
               <option value="8">Full Arc (8 Ch)</option>
               <option value="10">Novel (10 Ch)</option>
             </select>
           </div>
           <div className="space-y-2">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Ban className="w-3 h-3 text-red-400" /> Avoid
             </label>
             <input
                value={config.avoid}
                onChange={(e) => setConfig({...config, avoid: e.target.value})}
                placeholder="Tropes to kill..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
             />
           </div>
        </div>

        <button
          onClick={generateBlueprint}
          className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3 mt-4"
        >
          <Feather className="w-5 h-5" />
          Forge Narrative
        </button>

      </div>
    </div>
  );
};
