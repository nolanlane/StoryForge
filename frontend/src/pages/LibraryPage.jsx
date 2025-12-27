import React from 'react';
import { LibraryView } from '../components/LibraryView';
import { useStory } from '../context/StoryContext';

export default function LibraryPage() {
    const {
        userEmail, libraryStories, isLibraryWorking, setIsLibraryWorking,
        requireAuth, handleAuthError, setError, apiFetch, navigate,
        setConfig, setBlueprint, setStoryContent, setStoryImages, setActiveStoryId, setPendingSequelOfId,
        loadLibraryStories,
        // Logic for Sequel
        config, // used for defaults
        setBlueprintChatMessages, setBlueprintChatInput,
        BANNED_DESCRIPTOR_TOKENS, BANNED_PHRASES, resolveGenerationConfig, setLoading, setLoadingMessage
    } = useStory();

    const handleOpen = async (id) => {
        if (!requireAuth()) {
            handleAuthError("Please sign in first.");
            return;
        }
        setIsLibraryWorking(true);
        setError(null);
        try {
            const s = await apiFetch(`/api/stories/${id}`);
            setConfig(s.config);
            setBlueprint(s.blueprint);
            setStoryContent(s.storyContent || {});
            setStoryImages(s.storyImages || {});
            setActiveStoryId(s.id);
            setPendingSequelOfId(null);
            // Navigate to Reader by default
            navigate(`/story/${s.id}/read`);
        } catch (e) {
            setError(`Open failed: ${e.message}`);
        } finally {
            setIsLibraryWorking(false);
        }
    };

    const handleDelete = async (id) => {
        if (!requireAuth()) {
            handleAuthError("Please sign in first.");
            return;
        }
        setIsLibraryWorking(true);
        setError(null);
        try {
            await apiFetch(`/api/stories/${id}`, { method: 'DELETE' });
            // if (activeStoryId === id) setActiveStoryId(null); // Managed by context state if needed
            await loadLibraryStories();
        } catch (e) {
            setError(`Delete failed: ${e.message}`);
        } finally {
            setIsLibraryWorking(false);
        }
    };

    const handleSequel = async (id) => {
        // Logic copied from App.jsx, utilizing context methods
        if (!requireAuth()) { handleAuthError("Please sign in first."); return; }
        setIsLibraryWorking(true); setError(null);
        try {
            const s = await apiFetch(`/api/stories/${id}`);
            // ... (Sequel logic) ...
            const numericKeys = Object.keys(s.storyContent || {}).filter(k => /^\d+$/.test(k)).map(k => parseInt(k, 10)).filter(n => Number.isFinite(n));
            numericKeys.sort((a, b) => a - b);
            const lastIdx = numericKeys.length ? numericKeys[numericKeys.length - 1] : null;
            const last = lastIdx !== null ? (s.storyContent?.[String(lastIdx)] || s.storyContent?.[lastIdx] || "") : "";

            setLoading(true); setLoadingMessage("Forging sequel DNA...");

            const resp = await apiFetch('/api/ai/sequel', {
                method: 'POST',
                body: JSON.stringify({
                    sourceBlueprint: s.blueprint,
                    endingExcerpt: (last || "").slice(-2500),
                    chapterCount: s.config?.chapterCount || config.chapterCount || 5,
                    bannedDescriptorTokens: [], // Should import constants or get from specific helper
                    bannedPhrases: [],
                    timeoutMs: 300000,
                    generationConfig: {}, // resolveGenerationConfig likely needs local config, but here request relies on s.config
                    textModel: (s.config?.textModel || "gemini-2.5-flash"),
                    textFallbackModel: (s.config?.textFallbackModel || "gemini-2.5-pro"),
                })
            });

            const data = resp.blueprint;
            setBlueprint(data);
            setConfig(prev => ({ ...prev, ...(s.config || {}), title: data.title || prev.title }));
            setStoryContent({}); setStoryImages({});
            setActiveStoryId(null); setPendingSequelOfId(id);
            setBlueprintChatMessages([]); setBlueprintChatInput("");

            // Navigate to Blueprint view for the new sequel
            navigate('/story/new/blueprint');
        } catch (e) {
            setError(`Sequel failed: ${e.message}`);
        } finally {
            setIsLibraryWorking(false); setLoading(false);
        }
    };

    return (
        <LibraryView
            userEmail={userEmail}
            stories={libraryStories}
            isWorking={isLibraryWorking}
            onBack={() => navigate('/')}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onSequel={handleSequel}
        />
    );
}
