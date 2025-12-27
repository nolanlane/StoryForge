export const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.floor(Math.random()*100000)}`);

export const safeJsonParse = (raw, fallback) => {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const extractJSON = (text) => {
  try {
    let clean = text.replace(/```json/g, '').replace(/```/g, '');
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1) {
      clean = clean.substring(first, last + 1);
    }
    const parsed = JSON.parse(clean);
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
        throw new Error("JSON missing 'chapters' array");
    }
    return parsed;
  } catch (e) {
    try {
      // Attempt to repair common AI JSON errors
      let repaired = repairJSON(text);
      
      // Re-apply extraction logic on the repaired string in case repairJSON preserved garbage
      const first = repaired.indexOf('{');
      const last = repaired.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
          repaired = repaired.substring(first, last + 1);
      }
      
      const parsed = JSON.parse(repaired);
      if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
          throw new Error("JSON missing 'chapters' array");
      }
      return parsed;
    } catch (repairErr) {
      console.error("JSON Parse Error on text:", text);
      throw new Error("The Architect failed to draft a valid blueprint. Please try again.");
    }
  }
};

const repairJSON = (json) => {
  let clean = json.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // 1. Remove trailing commas before closing braces/brackets
  clean = clean.replace(/,(\s*[}\]])/g, '$1');

  // 2. Balance braces/brackets using a stack, respecting strings
  let stack = [];
  let fixed = '';
  let inString = false;
  let isEscaped = false;
  
  // Find the first { or [ to start
  const firstBrace = clean.search(/[{[]/);
  if (firstBrace === -1) return clean;
  
  const preamble = clean.substring(0, firstBrace);
  clean = clean.substring(firstBrace);

  for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      
      if (inString) {
          fixed += char;
          if (isEscaped) {
              isEscaped = false;
          } else if (char === '\\') {
              isEscaped = true;
          } else if (char === '"') {
              inString = false;
          }
          continue;
      }
      
      if (char === '"') {
          inString = true;
          fixed += char;
          continue;
      }

      if (char === '{' || char === '[') {
          stack.push(char);
          fixed += char;
      } else if (char === '}' || char === ']') {
          if (stack.length === 0) continue; // Ignore extra closers
          
          const last = stack[stack.length - 1];
          const expectedOpener = char === '}' ? '{' : '[';

          if (last === expectedOpener) {
              stack.pop();
              fixed += char;
          } else {
              // Mismatch. Check if we can find the opener deeper in stack
              // If found, close everything in between.
              let foundIdx = -1;
              for (let j = stack.length - 1; j >= 0; j--) {
                  if (stack[j] === expectedOpener) {
                      foundIdx = j;
                      break;
                  }
              }

              if (foundIdx !== -1) {
                  // Unwind stack to the match
                  while (stack.length > foundIdx + 1) {
                      const unclosed = stack.pop();
                      fixed += (unclosed === '{' ? '}' : ']');
                  }
                  stack.pop(); // Pop the expectedOpener
                  fixed += char;
              } else {
                  // Opener not found. Treat as potential typo (swap) or ignore.
                  // If we have { ] and no [ earlier, assume typo and use }
                  if (last === '{' && char === ']') {
                      fixed += '}';
                      stack.pop();
                  } else if (last === '[' && char === '}') {
                      fixed += ']';
                      stack.pop();
                  } else {
                      // True orphan, ignore
                  }
              }
          }
      } else {
          fixed += char;
      }
  }
  
  // Close any remaining open structures
  while (stack.length > 0) {
      const last = stack.pop();
      if (last === '{') fixed += '}';
      else if (last === '[') fixed += ']';
  }
  
  return preamble + fixed;
};

export const cleanImagePrompt = (basePrompt) => {
  return `${basePrompt}. NO TEXT, NO WORDS, NO TYPOGRAPHY, NO LABELS, NO WATERMARKS, NO SIGNATURES. High contrast, sharp focus, 8k.`;
};

// --- ROBUST NETWORK LAYER ---

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeoutError";
  }
}

export const fetchSafe = (url, options = {}, timeoutMs = 90000) => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    if (options.signal) {
        options.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            controller.abort();
            reject(new DOMException("Aborted by user", "AbortError"));
        });
    }

    fetch(url, { ...options, signal: controller.signal })
      .then(async (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' && !options.signal?.aborted) {
             reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
        } else {
             reject(err);
        }
      });
  });
};

export const fetchWithRetry = async (url, options, retries = 2, backoff = 1000, timeoutMs = 90000) => {
  try {
    const res = await fetchSafe(url, options, timeoutMs);

    if (!res.ok) {
      if (retries > 0 && (res.status >= 500 || res.status === 429)) {
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2, timeoutMs);
      }
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API Error: ${res.status}`);
    }
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw e;

    if (retries > 0) {
      console.log(`Retrying after error: ${e.name}`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2, timeoutMs);
    }
    throw e;
  }
};

export async function* readStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
