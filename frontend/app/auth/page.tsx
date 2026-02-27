"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') || '' : '';
    const e = typeof window !== 'undefined' ? localStorage.getItem('AUTH_EMAIL') || '' : '';
    setToken(t);
    setProfileEmail(e);
  }, []);

  const submit = async () => {
    setError('');
    const endpoint = authMode === 'signin' ? '/auth/signin' : '/auth/signup';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Authentication failed');
        return;
      }
      const t = data.access_token || '';
      if (t) {
        localStorage.setItem('AUTH_TOKEN', t);
        setToken(t);
      }
      if (data.email) {
        localStorage.setItem('AUTH_EMAIL', data.email);
        setProfileEmail(data.email);
      }
    } catch {
      setError('Network error');
    }
  };

  const signOut = () => {
    localStorage.removeItem('AUTH_TOKEN');
    localStorage.removeItem('AUTH_EMAIL');
    setToken('');
    setProfileEmail('');
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500/30">
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6">
          {token ? (
            <div className="space-y-4">
              <h2 className="text-white text-lg font-semibold">Signed in</h2>
              <p className="text-zinc-400 text-sm">{profileEmail}</p>
              <div className="flex gap-3">
                <a href="/" className="px-4 py-2 rounded bg-white/10 text-white hover:bg-white/20">Go Home</a>
                <button onClick={signOut} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">Sign Out</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setAuthMode('signin')} className={authMode==='signin' ? 'px-3 py-1 rounded bg-white/10 text-white' : 'px-3 py-1 rounded bg-white/5 text-zinc-400'}>Sign In</button>
                <button onClick={() => setAuthMode('signup')} className={authMode==='signup' ? 'px-3 py-1 rounded bg-white/10 text-white' : 'px-3 py-1 rounded bg-white/5 text-zinc-400'}>Sign Up</button>
              </div>
              <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white outline-none" />
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white outline-none" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-3">
                <button onClick={submit} className="flex-1 px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">{authMode==='signin' ? 'Sign In' : 'Sign Up'}</button>
                <a href="/" className="px-4 py-2 rounded bg-white/10 text-white hover:bg-white/20">Cancel</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

