import React from 'react';
import { AuthView } from '../components/AuthView';
import { useStory } from '../context/StoryContext';

export default function LoginPage() {
    const {
        authEmail, setAuthEmail,
        authPassword, setAuthPassword,
        isAuthWorking, setIsAuthWorking,
        setAuthToken, setUserEmail, setView, setError,
        apiFetch, navigate,
        // Actions are usually local in App.jsx but we can implement them here or use context if exposed
    } = useStory();

    // We need to implement handleLogin/Signup here or expose them from context
    // Context didn't expose handleLogin/Signup directly, just the primitives.
    // So we implement the logic here using context primitives.

    const handleLogin = async () => {
        setIsAuthWorking(true);
        setError(null);
        try {
            const emailTrim = (authEmail || '').trim();
            const pw = authPassword || '';
            if (!emailTrim) throw new Error('Please enter an email.');
            if (!pw) throw new Error('Please enter a password.');
            if (new TextEncoder().encode(pw).length > 72) throw new Error('Password is too long (max 72 bytes).');

            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: emailTrim, password: pw }),
                skipAuth: true
            });

            setAuthToken(res.access_token);
            // LocalStorage handled by hook? Check hook. Usually yes.
            // Hook likely handles it.

            const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${res.access_token}` } }).then(r => r.json());
            setUserEmail(me.email || "");
            setAuthPassword("");
            navigate('/');
        } catch (e) {
            setError(`Login failed: ${e.message}`);
        } finally {
            setIsAuthWorking(false);
        }
    };

    const handleSignup = async () => {
        setIsAuthWorking(true);
        setError(null);
        try {
            const emailTrim = (authEmail || '').trim();
            const pw = authPassword || '';
            if (!emailTrim) throw new Error('Please enter an email.');
            if (!pw) throw new Error('Please enter a password.');
            if (pw.length < 8) throw new Error('Password must be at least 8 characters.');
            if (new TextEncoder().encode(pw).length > 72) throw new Error('Password is too long (max 72 bytes).');

            const res = await apiFetch('/api/auth/signup', {
                method: 'POST',
                body: JSON.stringify({ email: emailTrim, password: pw }),
                skipAuth: true
            });

            setAuthToken(res.access_token);
            const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${res.access_token}` } }).then(r => r.json());
            setUserEmail(me.email || "");
            setAuthPassword("");
            navigate('/');
        } catch (e) {
            setError(`Signup failed: ${e.message}`);
        } finally {
            setIsAuthWorking(false);
        }
    };

    return (
        <AuthView
            email={authEmail}
            setEmail={setAuthEmail}
            password={authPassword}
            setPassword={setAuthPassword}
            isWorking={isAuthWorking}
            onBack={() => navigate('/')}
            onLogin={handleLogin}
            onSignup={handleSignup}
        />
    );
}
