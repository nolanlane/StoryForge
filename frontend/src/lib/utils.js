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
  // Step 1: Clean markdown wrappers and normalize problematic characters
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
  // Normalize curly/smart quotes to straight quotes (common AI output issue)
  clean = clean
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // Curly single quotes -> straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // Curly double quotes -> straight
    .replace(/[\u2032]/g, "'")  // Prime -> apostrophe
    .replace(/[\u2033]/g, '"'); // Double prime -> quote
  
  // Step 2: Find the JSON object boundaries
  const firstBrace = clean.indexOf('{');
  if (firstBrace === -1) {
    console.error("No JSON object found in text:", text.substring(0, 200));
    throw new Error("The Architect failed to draft a valid blueprint. Please try again.");
  }
  
  // Step 3: Extract just the JSON portion using brace matching
  let jsonStr = extractJSONObject(clean, firstBrace);
  
  // Step 4: Try parsing directly first
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error("JSON missing 'chapters' array");
    }
    return parsed;
  } catch (e) {
    // Step 5: Apply repairs and try again
    console.log("Initial parse failed, attempting repair...", e.message);
  }
  
  // Step 6: Repair the JSON
  jsonStr = repairJSON(jsonStr);
  
  // Step 7: Try parsing the repaired JSON
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error("JSON missing 'chapters' array");
    }
    return parsed;
  } catch (e) {
    console.log("Repair attempt 1 failed:", e.message);
  }
  
  // Step 8: Last resort - aggressive cleanup and retry
  jsonStr = aggressiveJSONCleanup(jsonStr);
  
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error("JSON missing 'chapters' array");
    }
    return parsed;
  } catch (e) {
    console.error("JSON Parse Error after all repairs:", e.message);
    console.error("Final JSON attempt:", jsonStr.substring(0, 500));
    throw new Error("The Architect failed to draft a valid blueprint. Please try again.");
  }
};

// Aggressive cleanup for severely malformed JSON
const aggressiveJSONCleanup = (json) => {
  let str = json;
  
  // Only remove actual control characters (not valid Unicode like £)
  str = str.replace(/[\x00-\x1F\x7F]/g, (match) => {
    // Keep tabs and newlines, escape them
    if (match === '\t') return '\\t';
    if (match === '\n') return '\\n';
    if (match === '\r') return '';
    return '';
  });
  
  // Fix common structural issues
  str = str.replace(/,\s*,/g, ',');           // Double commas
  str = str.replace(/,(\s*[}\]])/g, '$1');    // Trailing commas
  
  // Try to ensure we have complete structure by counting braces
  let inString = false;
  let escaped = false;
  let braceCount = 0;
  let bracketCount = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && inString) { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }
  
  // Close unclosed strings
  if (inString) str += '"';
  
  // Add missing closing brackets/braces
  while (bracketCount > 0) { str += ']'; bracketCount--; }
  while (braceCount > 0) { str += '}'; braceCount--; }
  
  return str;
};

// Extract a JSON object starting at startIdx, handling nested braces properly
const extractJSONObject = (str, startIdx) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIdx = startIdx;
  
  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (inString) continue;
    
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  
  // If we didn't find a proper end, take everything and let repair handle it
  if (depth !== 0) {
    return str.substring(startIdx);
  }
  
  return str.substring(startIdx, endIdx + 1);
};

const repairJSON = (json) => {
  let str = json;
  
  // Step 1: Escape control characters that break JSON
  // Replace raw newlines/tabs inside what looks like string content
  str = str.replace(/\r\n/g, '\\n').replace(/\r/g, '\\n');
  
  // Step 2: Track structure and find/fix issues
  let result = '';
  let inString = false;
  let escaped = false;
  let braceStack = [];
  let lastStringStart = -1;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      result += char;
      escaped = true;
      continue;
    }
    
    if (char === '"') {
      if (!inString) {
        lastStringStart = result.length;
      }
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      // Escape literal newlines inside strings
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
      result += char;
      continue;
    }
    
    // Outside strings - track braces
    if (char === '{' || char === '[') {
      braceStack.push(char);
      result += char;
    } else if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (braceStack.length > 0 && braceStack[braceStack.length - 1] === expected) {
        braceStack.pop();
      }
      result += char;
    } else {
      result += char;
    }
  }
  
  // Step 3: Close any unclosed strings
  if (inString) {
    result += '"';
  }
  
  // Step 4: Remove trailing commas before closing braces/brackets
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  // Step 5: Fix incomplete values at end (truncation)
  // Handle: "key": "incomplete  -> "key": "incomplete"
  // Handle: "key":  -> "key": null
  result = result.replace(/"([^"]+)":\s*$/g, '"$1": null');
  result = result.replace(/:\s*,/g, ': null,');
  
  // Step 6: Close any unclosed braces/brackets
  while (braceStack.length > 0) {
    const opener = braceStack.pop();
    result += opener === '{' ? '}' : ']';
  }
  
  // Step 7: Fix double commas and trailing commas
  result = result.replace(/,\s*,/g, ',');
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  return result;
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
