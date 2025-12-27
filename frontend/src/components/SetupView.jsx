import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, User, Sparkles, Dices, Loader2, Ban, Feather, Cpu, Image as ImageIcon, Shield, Compass, Palette, ChevronDown, ChevronUp, Wand2, Save, FolderOpen, Trash2 } from 'lucide-react';
import { TEXT_MODELS, IMAGE_MODELS, GENERATION_MODES, IMAGE_STYLE_PRESETS } from '../lib/constants';

export const SetupView = ({ config, setConfig, generateBlueprint, onRollDice, userEmail, onOpenAuth, onOpenLibrary, onLogout, listConfigPresets, getConfigPreset, createConfigPreset, updateConfigPreset, deleteConfigPreset }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presets, setPresets] = useState([]);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isPresetWorking, setIsPresetWorking] = useState(false);
  const [presetError, setPresetError] = useState(null);

  const selectedTextModel = useMemo(
    () => TEXT_MODELS.find((m) => m.value === config.textModel) || TEXT_MODELS[0],
    [config.textModel]
  );
  const selectedFallbackModel = useMemo(
    () => TEXT_MODELS.find((m) => m.value === config.textFallbackModel) || null,
    [config.textFallbackModel]
  );
  const selectedImageModel = useMemo(
    () => IMAGE_MODELS.find((m) => m.value === config.imagenModel) || IMAGE_MODELS[0],
    [config.imagenModel]
  );
  const selectedGenMode = useMemo(
    () => GENERATION_MODES.find((m) => m.value === config.generationMode) || GENERATION_MODES[0],
    [config.generationMode]
  );
  const selectedImageStyle = useMemo(
    () => IMAGE_STYLE_PRESETS.find((m) => m.value === config.imageStylePreset) || IMAGE_STYLE_PRESETS[0],
    [config.imageStylePreset]
  );

  useEffect(() => {
    if (userEmail && listConfigPresets) {
      loadPresets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, listConfigPresets]);

  const loadPresets = async () => {
    if (!listConfigPresets) return;
    try {
      const data = await listConfigPresets();
      setPresets(data || []);
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  };

  const handleSavePreset = async () => {
    if (!userEmail) {
      onOpenAuth();
      return;
    }
    if (!presetName.trim()) {
      setPresetError('Preset name is required');
      return;
    }
    setIsPresetWorking(true);
    setPresetError(null);
    try {
      const savedConfig = { ...config };
      delete savedConfig.title;
      delete savedConfig.prompt;
      await createConfigPreset(presetName.trim(), savedConfig);
      setPresetName('');
      setShowPresetDialog(false);
      await loadPresets();
    } catch (e) {
      setPresetError(e.message || 'Failed to save preset');
    } finally {
      setIsPresetWorking(false);
    }
  };

  const handleLoadPreset = async (presetId) => {
    if (!userEmail) {
      onOpenAuth();
      return;
    }
    setIsPresetWorking(true);
    try {
      const preset = await getConfigPreset(presetId);
      setConfig(prev => ({
        ...prev,
        ...preset.config,
        title: prev.title,
        prompt: prev.prompt
      }));
    } catch (e) {
      console.error('Failed to load preset:', e);
    } finally {
      setIsPresetWorking(false);
    }
  };

  const handleDeletePreset = async (presetId) => {
    if (!confirm('Delete this preset?')) return;
    setIsPresetWorking(true);
    try {
      await deleteConfigPreset(presetId);
      await loadPresets();
    } catch (e) {
      console.error('Failed to delete preset:', e);
    } finally {
      setIsPresetWorking(false);
    }
  };

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
    <main className="max-w-2xl mx-auto py-8 px-4 sm:py-12 sm:px-6 animate-in slide-in-from-bottom-4">
      <header className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-slate-900 tracking-tight flex items-center justify-center gap-4">
          <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600" />
          StoryForge
        </h1>
        <p className="text-slate-500 mt-3 text-lg">Hardened AI Narrative Engine</p>
      </header>

      <section className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8 space-y-6">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <User className="w-3 h-3" />
            {userEmail ? `Signed in: ${userEmail}` : 'Not signed in'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {userEmail ? (
              <>
                <button
                  onClick={() => setShowPresetDialog(true)}
                  disabled={isPresetWorking}
                  className="text-xs font-bold text-green-600 hover:text-green-700 hover:bg-green-50 px-3 py-1.5 rounded transition-colors focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 flex items-center gap-1"
                  title="Save current setup as preset"
                >
                  <Save className="w-3 h-3" /> Save Preset
                </button>
                <button
                  onClick={onOpenLibrary}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded transition-colors focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  Library
                </button>
                <button
                  onClick={onLogout}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded transition-colors focus:ring-2 focus:ring-slate-200 outline-none"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={onOpenAuth}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded transition-colors focus:ring-2 focus:ring-purple-500 outline-none"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Config Presets Section */}
        {userEmail && presets.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-2">
              <FolderOpen className="w-3 h-3" /> Load Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <button
                    onClick={() => handleLoadPreset(preset.id)}
                    disabled={isPresetWorking}
                    className="flex-1 text-left text-sm font-medium text-slate-700 hover:text-purple-600 transition-colors disabled:opacity-50"
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    disabled={isPresetWorking}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Title (Optional) */}
        <div className="space-y-2">
          <label htmlFor="setup-title" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Story Title (Optional)</label>
          <input
            id="setup-title"
            value={config.title}
            onChange={(e) => setConfig({...config, title: e.target.value})}
            placeholder="Leave blank to auto-generate from concept"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
          />
        </div>

        {/* Genre & Tone */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="disable-genre-tone"
              checked={config.disableGenreTone || false}
              onChange={(e) => setConfig({...config, disableGenreTone: e.target.checked})}
              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
            />
            <label htmlFor="disable-genre-tone" className="text-sm font-medium text-slate-700">
              Disable genre/tone guidance (let AI decide)
            </label>
          </div>
          
          {!config.disableGenreTone && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="setup-genre" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Genre</label>
                <div className="relative">
                  <select
                    id="setup-genre"
                    value={config.genre}
                    onChange={(e) => setConfig({...config, genre: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium appearance-none"
                  >
                    <optgroup label="Classic">
                      <option>Science Fiction</option>
                      <option>High Fantasy</option>
                      <option>Mystery / Detective</option>
                      <option>Thriller / Suspense</option>
                      <option>Horror</option>
                      <option>Historical Fiction</option>
                      <option>Romance</option>
                      <option>Erotica</option>
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
                    <optgroup label="Adult">
                      <option>Dark Romance</option>
                      <option>Erotic Fantasy</option>
                      <option>Erotic Thriller</option>
                      <option>Paranormal Romance (Explicit)</option>
                      <option>Contemporary Erotica</option>
                    </optgroup>
                  </select>
                  {/* Custom arrow could go here if appearance-none is used completely */}
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="setup-tone" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tone</label>
                <select
                  id="setup-tone"
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
                    <option>Raw & Visceral</option>
                    <option>Intimate & Character-Driven</option>
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
                  <optgroup label="Adult">
                    <option>Sensual & Erotic</option>
                    <option>Provocative & Taboo-Breaking</option>
                    <option>Passionate & Intense</option>
                    <option>Steamy & Explicit</option>
                  </optgroup>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="space-y-2">
          <div className="flex justify-between items-end mb-2">
            <label htmlFor="setup-concept" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-purple-500" /> Story Concept
            </label>
            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 hover:bg-purple-50 px-2 py-1 rounded transition-colors disabled:opacity-50 focus:ring-2 focus:ring-purple-500 outline-none"
              title="Generate a random concept based on Genre/Tone"
              aria-label="Generate Random Concept"
            >
              {isRolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Dices className="w-3 h-3" />}
              {isRolling ? "Generating..." : "Roll Dice"}
            </button>
          </div>
          <textarea
            id="setup-concept"
            value={config.prompt}
            onChange={(e) => setConfig({...config, prompt: e.target.value})}
            placeholder="Describe your idea or roll the dice for inspiration..."
            className="w-full p-4 h-32 max-h-60 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none overflow-auto font-serif text-lg transition-all"
          />
        </div>

        {/* Core Story Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
           <div className="space-y-2">
             <label htmlFor="setup-length" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Length</label>
             <select
                id="setup-length"
                value={config.chapterCount}
                onChange={(e) => setConfig({...config, chapterCount: parseInt(e.target.value)})}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
             >
               <option value="3">Short Story (3 Ch)</option>
               <option value="5">Novella (5 Ch)</option>
               <option value="8">Full Arc (8 Ch)</option>
               <option value="10">Novel (10 Ch)</option>
             </select>
           </div>
           <div className="space-y-2">
             <label htmlFor="setup-avoid" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Ban className="w-3 h-3 text-red-400" /> Avoid
             </label>
             <input
                id="setup-avoid"
                value={config.avoid}
                onChange={(e) => setConfig({...config, avoid: e.target.value})}
                placeholder="Tropes to kill..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
             />
           </div>
        </div>

        {/* Writing & Art Style */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="writing-style" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Feather className="w-3 h-3 text-purple-500" /> Writing Style
            </label>
            <input
              id="writing-style"
              value={config.writingStyle}
              onChange={(e) => setConfig({...config, writingStyle: e.target.value})}
              placeholder="E.g., Clean, cinematic, character-first (show, don't tell)"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="art-style" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-3 h-3 text-indigo-500" /> Art Style
            </label>
            <input
              id="art-style"
              value={config.artStyle}
              onChange={(e) => setConfig({...config, artStyle: e.target.value})}
              placeholder="E.g., Cinematic lighting, highly detailed, natural texture"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Creativity Directive */}
        <div className="space-y-2">
          <label htmlFor="creativity" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-amber-500" /> Creativity Directive
          </label>
          <input
            id="creativity"
            value={config.creativity}
            onChange={(e) => setConfig({...config, creativity: e.target.value})}
            placeholder="E.g., Surprising ideas, plain language"
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Advanced Section Toggle */}
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all text-left group"
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-3 h-3 text-purple-500" />
            Advanced Configuration
          </span>
          {advancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
        </button>

        {advancedOpen && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
            {/* Guidance + Steering */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2" htmlFor="gen-mode">
              <Compass className="w-3 h-3 text-emerald-500" /> Generation Mode
            </label>
            <select
              id="gen-mode"
              value={config.generationMode}
              onChange={(e) => setConfig({ ...config, generationMode: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              {GENERATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">{selectedGenMode?.description}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2" htmlFor="steering-note">
              <Wand2 className="w-3 h-3 text-purple-500" /> Steering Note (next scenes)
            </label>
            <textarea
              id="steering-note"
              value={config.steeringNote}
              onChange={(e) => setConfig({ ...config, steeringNote: e.target.value })}
              placeholder="E.g., Next scene: the detective confronts the mayor; keep it tense but understated."
              className="w-full p-3 h-24 max-h-48 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none overflow-auto"
            />
          </div>
            </div>

            {/* Model Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Cpu className="w-3 h-3 text-purple-500" />
              Text Model
            </div>
            <select
              value={config.textModel}
              onChange={(e) => setConfig({ ...config, textModel: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              {TEXT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">{selectedTextModel?.description}</p>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">
              <Shield className="w-3 h-3 text-slate-500" />
              Fallback Model
            </div>
            <select
              value={config.textFallbackModel || ""}
              onChange={(e) => setConfig({ ...config, textFallbackModel: e.target.value || "" })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              <option value="">None (disable fallback)</option>
              {TEXT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
              {config.textFallbackModel ? (selectedFallbackModel?.description || "Fallback model for resiliency.") : "No fallback — requests will fail if the primary model is unavailable."}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <ImageIcon className="w-3 h-3 text-indigo-500" />
              Image Model
            </div>
            <select
              value={config.imagenModel}
              onChange={(e) => setConfig({ ...config, imagenModel: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">{selectedImageModel?.description}</p>

            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pt-2" htmlFor="image-style">
              <ImageIcon className="w-3 h-3 text-indigo-400" /> Image Style Preset
            </label>
            <select
              id="image-style"
              value={config.imageStylePreset}
              onChange={(e) => setConfig({ ...config, imageStylePreset: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium"
            >
              {IMAGE_STYLE_PRESETS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">{selectedImageStyle?.label || "Auto"}</p>
          </div>
            </div>
          </div>
        )}

        <button
          onClick={generateBlueprint}
          className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center justify-center gap-3 mt-4 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 outline-none"
        >
          <Feather className="w-5 h-5" />
          Forge Narrative
        </button>

      </section>

      {/* Save Preset Dialog */}
      {showPresetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-serif font-bold text-slate-900">Save Configuration Preset</h3>
            <p className="text-sm text-slate-600">Save your current setup configuration (models, settings, genre, tone, etc.) as a reusable preset.</p>
            
            <div className="space-y-2">
              <label htmlFor="preset-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Preset Name
              </label>
              <input
                id="preset-name"
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., My Sci-Fi Setup"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
                autoFocus
              />
            </div>

            {presetError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {presetError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPresetDialog(false);
                  setPresetName('');
                  setPresetError(null);
                }}
                disabled={isPresetWorking}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={isPresetWorking || !presetName.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPresetWorking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
