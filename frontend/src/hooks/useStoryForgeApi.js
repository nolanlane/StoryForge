import { useCallback, useState } from 'react';
import { fetchSafe } from '../lib/utils';
import { STORAGE_KEYS } from '../lib/constants';

export function useStoryForgeApi() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(STORAGE_KEYS.authToken) || "");
  const [userEmail, setUserEmail] = useState("");

  const apiFetch = useCallback(async (path, options = {}) => {
    const { skipAuth, timeoutMs, ...fetchOptions } = options;
    const headers = { ...(fetchOptions.headers || {}) };
    if (!skipAuth && authToken) headers.Authorization = `Bearer ${authToken}`;
    if (!headers['Content-Type'] && fetchOptions.body) headers['Content-Type'] = 'application/json';

    const res = await fetchSafe(
      path,
      {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal
      },
      timeoutMs || 90000
    );

    if (!res.ok) {
      if (res.status === 401 && !skipAuth) {
        setAuthToken("");
        localStorage.removeItem(STORAGE_KEYS.authToken);
        setUserEmail("");
        throw new Error("Please sign in first.");
      }
      const errData = await res.json().catch(() => ({}));
      let msg = `API Error: ${res.status}`;
      if (Array.isArray(errData.detail)) {
        msg = errData.detail
          .map((d) => {
            const loc = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
            return loc ? `${loc}: ${d.msg}` : d.msg;
          })
          .join(' | ');
      } else if (typeof errData.detail === 'string') {
        msg = errData.detail;
      } else if (errData.error?.message) {
        msg = errData.error.message;
      }
      throw new Error(msg);
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }, [authToken]);

  const requireAuth = useCallback(() => {
    return !!authToken;
  }, [authToken]);

  const logout = useCallback(() => {
    setAuthToken("");
    localStorage.removeItem(STORAGE_KEYS.authToken);
    setUserEmail("");
  }, []);

  const storyDoctor = useCallback((blueprint, options = {}) => {
    const {
      timeoutMs,
      generationConfig,
      textModel,
      textFallbackModel
    } = options || {};
    return apiFetch('/api/ai/analyze_blueprint', {
      method: 'POST',
      body: JSON.stringify({
        blueprint,
        timeoutMs,
        generationConfig,
        textModel,
        textFallbackModel
      })
    });
  }, [apiFetch]);

  const listConfigPresets = useCallback(() => {
    return apiFetch('/api/config-presets');
  }, [apiFetch]);

  const getConfigPreset = useCallback((presetId) => {
    return apiFetch(`/api/config-presets/${presetId}`);
  }, [apiFetch]);

  const createConfigPreset = useCallback((name, config) => {
    return apiFetch('/api/config-presets', {
      method: 'POST',
      body: JSON.stringify({ name, config })
    });
  }, [apiFetch]);

  const updateConfigPreset = useCallback((presetId, name, config) => {
    return apiFetch(`/api/config-presets/${presetId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, config })
    });
  }, [apiFetch]);

  const deleteConfigPreset = useCallback((presetId) => {
    return apiFetch(`/api/config-presets/${presetId}`, {
      method: 'DELETE'
    });
  }, [apiFetch]);

  return {
    authToken,
    setAuthToken,
    userEmail,
    setUserEmail,
    apiFetch,
    requireAuth,
    logout,
    storyDoctor,
    listConfigPresets,
    getConfigPreset,
    createConfigPreset,
    updateConfigPreset,
    deleteConfigPreset
  };
}
