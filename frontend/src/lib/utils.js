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
  // Step 1: Clean markdown wrappers
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  
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
  
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error("JSON missing 'chapters' array");
    }
    return parsed;
  } catch (e) {
    console.error("JSON Parse Error after repair:", e.message);
    console.error("Repaired JSON:", jsonStr.substring(0, 500));
    throw new Error("The Architect failed to draft a valid blueprint. Please try again.");
  }
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
  
  // 1. Fix common string issues by rebuilding the JSON character by character
  let result = '';
  let inString = false;
  let escaped = false;
  let braceStack = [];
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1] || '';
    
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
      // Check for unescaped quotes inside strings (common AI error)
      if (inString) {
        // Look ahead to see if this is a real string end or a mistake
        const afterQuote = str.substring(i + 1).trimStart();
        const isRealEnd = /^[,}\]:]/.test(afterQuote) || afterQuote.length === 0;
        
        if (!isRealEnd && !/^\s*"/.test(afterQuote)) {
          // This quote is probably inside the string - escape it
          result += '\\"';
          continue;
        }
      }
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      // Handle problematic characters inside strings
      if (char === '\n' || char === '\r') {
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
  
  // 2. Close any unclosed strings
  if (inString) {
    result += '"';
  }
  
  // 3. Remove trailing commas before closing braces/brackets
  result = result.replace(/,(\s*[}\]])/g, '$1');
  
  // 4. Close any unclosed braces/brackets
  while (braceStack.length > 0) {
    const opener = braceStack.pop();
    result += opener === '{' ? '}' : ']';
  }
  
  // 5. Fix incomplete key-value pairs at the end (common truncation issue)
  // Pattern: "key": followed by end or closing brace without value
  result = result.replace(/"([^"]+)":\s*([}\]])/g, '"$1": null$2');
  result = result.replace(/"([^"]+)":\s*$/g, '"$1": null');
  
  // 6. Fix missing values after colons
  result = result.replace(/:\s*,/g, ': null,');
  result = result.replace(/:\s*}/g, ': null}');
  
  // 7. Fix double commas
  result = result.replace(/,\s*,/g, ',');
  
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
