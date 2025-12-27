import React from 'react';
import { SetupView } from '../components/SetupView';
import { useStory } from '../context/StoryContext';

export default function HomePage() {
    const {
        config, setConfig, generateBlueprint, generateRandomPrompt,
        userEmail, requireAuth, handleAuthError, loadLibraryStories,
        setIsLibraryWorking, setError, setView, logout,
        listConfigPresets, getConfigPreset, createConfigPreset, updateConfigPreset, deleteConfigPreset,
        navigate
    } = useStory();

    const handleOpenLibrary = async () => {
        if (!requireAuth()) {
            handleAuthError("Please sign in first.");
            return;
        }
        setIsLibraryWorking(true);
        loadLibraryStories()
            .then(() => navigate('/library'))
            .catch((e) => setError(`Load library failed: ${e.message}`))
            .finally(() => setIsLibraryWorking(false));
    };

    return (
        <SetupView
            config={config}
            setConfig={setConfig}
            generateBlueprint={generateBlueprint}
            onRollDice={() => generateRandomPrompt(config.genre, config.tone)}
            userEmail={userEmail}
            onOpenAuth={() => navigate('/login')}
            onOpenLibrary={handleOpenLibrary}
            onLogout={logout}
            listConfigPresets={listConfigPresets}
            getConfigPreset={getConfigPreset}
            createConfigPreset={createConfigPreset}
            updateConfigPreset={updateConfigPreset}
            deleteConfigPreset={deleteConfigPreset}
        />
    );
}
