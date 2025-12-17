import React from 'react';
import { User } from 'lucide-react';

export const AuthView = ({ email, setEmail, password, setPassword, onLogin, onSignup, onBack, isWorking }) => (
  <div className="max-w-md mx-auto py-12 px-4 animate-in slide-in-from-bottom-4">
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-3">
            <User className="w-5 h-5 text-purple-600" /> Login
          </h2>
          <p className="text-sm text-slate-500 mt-2">Sign in to use AI generation and sync your library.</p>
        </div>
        <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">Back</button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          type="password"
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onLogin}
          disabled={isWorking}
          className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold transition-all disabled:opacity-50"
        >
          Sign in
        </button>
        <button
          onClick={onSignup}
          disabled={isWorking}
          className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold transition-all border border-slate-200 disabled:opacity-50"
        >
          Sign up
        </button>
      </div>
    </div>
  </div>
);
