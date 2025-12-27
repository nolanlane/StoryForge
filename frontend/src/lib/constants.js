export const PDF_LIB_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

export const STORAGE_KEYS = {
  authToken: 'storyforge.authToken',
  chapterGuidance: 'storyforge.chapterGuidance',
  imageGuidance: 'storyforge.imageGuidance'
};

export const TEXT_MODELS = [
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Balanced price/perf, fast multimodal text."
  },
  {
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "High-quality reasoning, long context."
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Cost-optimized flash variant."
  },
  {
    value: "gemini-3-pro",
    label: "Gemini 3 Pro (preview)",
    description: "Preview; advanced reasoning, long context."
  },
  {
    value: "gemini-3-flash",
    label: "Gemini 3 Flash (preview)",
    description: "Preview; speed-focused multimodal."
  },
  {
    value: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "Previous-gen fast model."
  },
  {
    value: "gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash (001)",
    description: "Stable 2.0 Flash variant."
  },
  {
    value: "gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash (experimental)",
    description: "Experimental 2.0 Flash."
  },
];

export const IMAGE_MODELS = [
  {
    value: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    description: "Stable image+text generation."
  },
  {
    value: "gemini-2.5-flash-image-preview",
    label: "Gemini 2.5 Flash Image Preview",
    description: "Deprecated preview of 2.5 Flash Image."
  },
  {
    value: "gemini-2.0-flash-preview-image-generation",
    label: "Gemini 2.0 Flash Preview Image Generation",
    description: "Preview image model (2.0 generation)."
  },
];

export const GENERATION_MODES = [
  {
    value: "balanced",
    label: "Balanced",
    generationConfig: { temperature: 0.85, topP: 0.95, topK: 64, maxOutputTokens: 4096 },
    description: "Default balance of creativity and control."
  },
  {
    value: "brainstorm",
    label: "Brainstorm",
    generationConfig: { temperature: 1.05, topP: 0.98, topK: 64, maxOutputTokens: 4096 },
    description: "More exploratory, higher variety."
  },
  {
    value: "canon-safe",
    label: "Canon-Safe",
    generationConfig: { temperature: 0.65, topP: 0.9, topK: 40, maxOutputTokens: 4096 },
    description: "Tighter output to preserve continuity."
  },
];

export const IMAGE_STYLE_PRESETS = [
  { value: "", label: "Auto (use story DNA)" },
  { value: "cinematic", label: "Cinematic" },
  { value: "painterly", label: "Painterly" },
  { value: "comic", label: "Comic / Graphic" },
  { value: "noir", label: "Noir" },
  { value: "watercolor", label: "Watercolor" },
];

export const BANNED_PHRASES = [
  "shiver down his spine", "shivers down her spine", "a testament to", "in a dance of",
  "the tapestry of", "unbeknownst to", "eyes went wide", "let out a breath",
  "palpable", "neon-soaked", "cacophony", "labyrinthine", "azure", "orbs",
  "camaraderie", "unspoken understanding", "intertwined", "symphony of",
  "game of cat and mouse", "loomed", "piercing blue", "emerald green",
  "with a heavy heart", "steeled himself", "steeled herself", "voice barely above a whisper",
  "the calm before the storm", "a silence that screamed", "fate had other plans",
  "a grim reminder", "barely audible", "sent shivers", "to no avail"
];

export const BANNED_NAMES = [
  "Elara", "Kael", "Zephyr", "Aria", "Lyra", "Orion", "Luna", "Nyx",
  "Elias", "Felix", "Silas", "Rowan", "Finn", "Jasper", "Nova", "Atlas",
  "Zara", "Kai", "Leo", "Maya", "Elena", "Adrian", "Julian", "Caleb", "Ivy",
  "Ignis", "Aeris", "Terra", "Sol", "Thorne", "Ash", "Raven", "Storm",
  "Xylo", "Drax", "Thrax", "Kylos"
];

export const BANNED_DESCRIPTOR_TOKENS = [
  "geometric", "angular", "triangular", "polygon", "fractal", "kaleidoscopic",
  "crystalline", "prismatic", "orbs", "neon-soaked", "labyrinthine"
];

export const NAMING_VIBES = [
  "Phonetically sharp and percussive",
  "Flowing, vowel-heavy, and lyrical",
  "Archaic roots with modern spellings",
  "Nature-adjacent but not literal",
  "Utilitarian and short",
  "Complex and rhythmic"
];

export const CHAPTER_GUIDANCE_TEMPLATES = [
  { value: "", label: "Custom guidance..." },
  { value: "Increase tension and stakes. End on a cliffhanger.", label: "Increase Tension" },
  { value: "Focus on dialogue. Reveal character through conversation.", label: "Dialogue-Heavy" },
  { value: "Add an action sequence. Keep the pacing fast.", label: "Action Sequence" },
  { value: "Slow, introspective. Focus on internal conflict and reflection.", label: "Introspective" },
  { value: "Introduce a twist or revelation. Subvert expectations.", label: "Plot Twist" },
  { value: "Build atmosphere and mood. Use sensory details.", label: "Atmospheric" },
  { value: "Advance the romance subplot. Show vulnerability.", label: "Romance Focus" },
  { value: "Tighten prose. Cut metaphors. Be direct and punchy.", label: "Tighten Prose" }
];

export const IMAGE_GUIDANCE_TEMPLATES = [
  { value: "", label: "Custom visual guidance..." },
  { value: "Wide establishing shot. Show the environment and scale.", label: "Wide Shot" },
  { value: "Close-up on character's face. Capture emotion.", label: "Close-Up" },
  { value: "Dynamic action pose. Mid-motion, high energy.", label: "Action Pose" },
  { value: "Moody lighting. Dramatic shadows and contrast.", label: "Dramatic Lighting" },
  { value: "Two characters facing each other. Tension in body language.", label: "Confrontation" },
  { value: "Over-the-shoulder perspective. Show what character sees.", label: "POV Shot" },
  { value: "Silhouette against dramatic background. Iconic composition.", label: "Silhouette" },
  { value: "Environmental storytelling. Details that hint at backstory.", label: "Environmental" }
];
