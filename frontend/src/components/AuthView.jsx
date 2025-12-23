import React from 'react';
import { User, ArrowLeft } from 'lucide-react';

export const AuthView = ({ email, setEmail, password, setPassword, onLogin, onSignup, onBack, isWorking }) => (
  <main className="max-w-md mx-auto py-12 px-4 animate-in slide-in-from-bottom-4 min-h-screen flex items-center justify-center">
    <form
      className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isWorking) onLogin();
      }}
      aria-labelledby="auth-heading"
    >
      <header className="flex items-start justify-between gap-6">
        <div>
          <h2 id="auth-heading" className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-3">
            <User className="w-5 h-5 text-purple-600" aria-hidden="true" /> Login
          </h2>
          <p className="text-sm text-slate-500 mt-2">Sign in to use AI generation and sync your library.</p>
        </div>
        <button
            type="button"
            onClick={onBack}
            disabled={isWorking}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50 flex items-center gap-1"
            aria-label="Back to Setup"
        >
            <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </header>

      <div className="space-y-2">
        <label htmlFor="auth-email" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email</label>
        <input
          id="auth-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
          inputMode="email"
          disabled={isWorking}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50 focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="auth-password" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Password</label>
        <input
          id="auth-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          type="password"
          autoComplete="current-password"
          disabled={isWorking}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50 focus:ring-2 focus:ring-purple-500 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="submit"
          disabled={isWorking}
          className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50 focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 outline-none"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={onSignup}
          disabled={isWorking}
          className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold transition-all border border-slate-200 disabled:opacity-50 focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 outline-none"
        >
          Sign up
        </button>
      </div>
    </form>
  </main>
);
