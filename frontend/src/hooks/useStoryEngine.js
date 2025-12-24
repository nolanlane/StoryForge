import { useRef, useCallback } from 'react';

export function useStoryEngine(apiFetch, requireAuth) {
  const abortControllerRef = useRef(null);

  const callGeminiText = useCallback(async (systemPrompt, userPrompt, jsonMode = false, customTimeout, generationConfig) => {
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
          generationConfig
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

  const callImagen = useCallback(async (prompt) => {
    try {
      if (!requireAuth()) return null;
      const timeoutMs = 45000;
      const result = await apiFetch('/api/ai/imagen', {
        method: 'POST',
        body: JSON.stringify({ prompt, timeoutMs }),
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
    stopGeneration,
    startGeneration,
    abortControllerRef
  };
}
