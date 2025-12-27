import { useRef, useCallback } from 'react';
import { readStream } from '../lib/utils';

export function useStoryEngine(apiFetch, requireAuth) {
  const abortControllerRef = useRef(null);

  const callGeminiText = useCallback(async (systemPrompt, userPrompt, jsonMode = false, customTimeout, generationConfig, textModel, textFallbackModel) => {
    try {
      if (!requireAuth()) return "";
      const timeoutMs = customTimeout || 180000;
      const result = await apiFetch('/api/ai/text', {
        method: 'POST',
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          jsonMode,
          timeoutMs,
          generationConfig,
          textModel,
          textFallbackModel,
        }),
        timeoutMs,
        signal: abortControllerRef.current?.signal
      });
      return result?.text || "";
    } catch (err) {
      if (err.name === 'AbortError') console.log("Generation aborted by user.");
      else throw err;
    }
  }, [apiFetch, requireAuth]);

  const callImagen = useCallback(async (prompt, imagenModel) => {
    try {
      if (!requireAuth()) return null;
      const timeoutMs = 45000;
      const result = await apiFetch('/api/ai/imagen', {
        method: 'POST',
        body: JSON.stringify({ prompt, timeoutMs, imagenModel }),
        timeoutMs,
        signal: abortControllerRef.current?.signal
      });
      return result?.dataUrl || null;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn("Image generation failed:", err);
      }
      return null;
    }
  }, [apiFetch, requireAuth]);

  const callAiChapter = useCallback(async (blueprint, chapterIndex, previousChapterText, config, customTimeout, chapterGuidance) => {
    try {
      if (!requireAuth()) return "";
      const timeoutMs = customTimeout || 180000;
      const result = await apiFetch('/api/ai/chapter', {
        method: 'POST',
        body: JSON.stringify({
          blueprint,
          chapterIndex,
          previousChapterText,
          config,
          chapterGuidance,
          timeoutMs,
          generationConfig: config?.generationConfig,
          textModel: config?.textModel,
          textFallbackModel: config?.textFallbackModel,
        }),
        timeoutMs,
        signal: abortControllerRef.current?.signal
      });
      return result?.text || "";
    } catch (err) {
      if (err.name === 'AbortError') console.log("Generation aborted by user.");
      else throw err;
    }
  }, [apiFetch, requireAuth]);

  const callAiChapterStream = useCallback(async function* (blueprint, chapterIndex, previousChapterText, config, customTimeout, chapterGuidance) {
    if (!requireAuth()) return;
    
    // We bypass apiFetch here to handle the stream directly, but we need auth headers
    const token = localStorage.getItem('storyforge.authToken'); // Or pass it in
    if (!token) throw new Error("Not authenticated");

    const timeoutMs = customTimeout || 180000;
    
    // Use the abort controller
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chapter/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          blueprint,
          chapterIndex,
          previousChapterText,
          config,
          chapterGuidance,
          timeoutMs,
          generationConfig: config?.generationConfig,
          textModel: config?.textModel,
          textFallbackModel: config?.textFallbackModel,
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stream Error: ${response.status} ${errText}`);
      }

      for await (const chunk of readStream(response)) {
        yield chunk;
      }

    } catch (err) {
      if (err.name === 'AbortError') console.log("Stream aborted.");
      else throw err;
    }
  }, [requireAuth]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const startGeneration = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  return {
    callGeminiText,
    callImagen,
    callAiChapter,
    callAiChapterStream,
    stopGeneration,
    startGeneration,
    abortControllerRef
  };
}
