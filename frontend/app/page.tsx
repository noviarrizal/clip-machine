"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Hero } from "@/components/Hero";
import { UploadZone } from "@/components/UploadZone";
import { ContentStudio } from "@/components/ContentStudio";

// Define the structure of a Clip from the backend
interface BackendClip {
  id: number;
  url: string;
  timestamp: string;
}

// Define the structure for a Job
export interface Job {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "canceled";
  clips?: BackendClip[];
  transcription?: any[];
  error?: string;
  meta?: any;
}

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const searchParams = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [profileEmail, setProfileEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('AUTH_EMAIL') || '';
    return '';
  });
  const [showMenu, setShowMenu] = useState(false);
  const [quota, setQuota] = useState<{ plan?: string; limit?: number; used?: number; remaining?: number } | null>(null);
  type Item = { job_id: string; status: string; created_at?: string; url?: string; meta?: any };
  const [recent, setRecent] = useState<Item[]>([]);
  const [hasTrialKey, setHasTrialKey] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return !!(localStorage.getItem('LICENSE_KEY') || '');
    return false;
  });
  const steps = ["Upload", "Processing", "Review", "Content", "Export"] as const;
  const currentStepIndex = (() => {
    if (!job) return 0;
    if (job.status === "pending" || job.status === "processing") return 1;
    if (job.status === "failed" || job.status === "canceled") return 0;
    if (job.status === "completed") return 3;
    return 0;
  })();

  const submitAuth = async () => {
    setAuthError('');
    const endpoint = authMode === 'signin' ? '/auth/signin' : '/auth/signup';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || 'Authentication failed');
        return;
      }
      const token = data.access_token || '';
      if (token) localStorage.setItem('AUTH_TOKEN', token);
      if (data.email) {
        localStorage.setItem('AUTH_EMAIL', data.email);
        setProfileEmail(data.email);
      }
      setShowAuth(false);
    } catch {
      setAuthError('Network error');
    }
  };

  const signOut = () => {
    localStorage.removeItem('AUTH_TOKEN');
    localStorage.removeItem('AUTH_EMAIL');
    setProfileEmail('');
    setShowMenu(false);
  };

  useEffect(() => {
    const jobId = searchParams.get('job_id');
    if (!jobId) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJob({
          job_id: data.job_id,
          status: data.status,
          clips: data.clips,
          transcription: data.transcription,
          error: data.error,
          meta: data.meta,
        });
      } catch {}
    };
    load();
  }, [searchParams]);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
    const run = async () => {
      try {
        if (!token) return;
        const res = await fetch(`${API_URL}/me/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        setRecent((data.items || []).slice(0, 5));
      } catch {}
    };
    run();
  }, [profileEmail]);

  useEffect(() => {
    const checkKey = () => {
      const k = typeof window !== 'undefined' ? localStorage.getItem('LICENSE_KEY') || '' : '';
      setHasTrialKey(!!k);
    };
    checkKey();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'LICENSE_KEY') checkKey();
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
    const fetchQuota = async () => {
      try {
        if (token) {
          const res = await fetch(`${API_URL}/me/quota`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setQuota(data);
          }
        } else {
          setQuota(null);
        }
      } catch {
        setQuota(null);
      }
    };
    fetchQuota();
    const id = setInterval(fetchQuota, 30000);
    return () => clearInterval(id);
  }, [profileEmail]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight">ClipFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Pricing
            </a>
            {profileEmail ? (
              <div className="relative">
                <button onClick={()=>setShowMenu(v=>!v)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all">
                  {profileEmail}
                  {quota && typeof quota.used === 'number' && typeof quota.limit === 'number' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-xs">
                      {quota.used}/{quota.limit}
                    </span>
                  )}
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-[#111] border border-white/10 rounded-xl p-2">
                    <a href="/account" className="block w-full text-left px-3 py-2 rounded hover:bg-white/10 text-white text-sm">Account</a>
                    <button onClick={signOut} className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-white text-sm">Sign Out</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <a href="/pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
                <a href="/auth" className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all">Sign In</a>
                {hasTrialKey && (
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white">Trial</span>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <Hero />

      <div className="container mx-auto px-6 mt-12 mb-24">
        <div className="mb-6 flex items-center justify-center gap-3">
          {steps.map((label, idx) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={
                  idx <= currentStepIndex
                    ? "px-3 py-1 rounded-full text-xs bg-purple-600 text-white"
                    : "px-3 py-1 rounded-full text-xs bg-white/5 text-zinc-400 border border-white/10"
                }
              >
                {label}
              </div>
              {idx < steps.length - 1 && <div className="w-6 h-px bg-white/10" />}
            </div>
          ))}
        </div>
        {job && job.meta && job.meta.duration && (
          <div className="flex justify-center mb-6">
            <span className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-zinc-300">Duration: {Math.floor(Number(job.meta.duration))}s</span>
          </div>
        )}
        {recent.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">Recent jobs</h3>
              <a href="/account" className="text-xs text-zinc-400 hover:text-white">View all</a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recent.map((it) => (
                <div key={it.job_id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm">{it.url || it.job_id}</div>
                    <div className="text-xs text-zinc-400">{it.created_at ? new Date(it.created_at).toLocaleString() : ''}{it.meta && it.meta.duration ? ` • ${Math.floor(Number(it.meta.duration))}s` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs border border-white/10 bg-white/5 text-zinc-300">{it.status}</span>
                    <a href={`/?job_id=${encodeURIComponent(it.job_id)}`} className="px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700">Open</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {job && job.status === "completed" ? (
          <ContentStudio
            jobId={job.job_id}
            clips={
              job.clips
                ? job.clips.map((clip) => ({
                    id: clip.id,
                    filename: clip.url.split("/").pop() || "",
                    url: clip.url,
                    score: 0,
                    transcription: job.transcription || [],
                  }))
                : []
            }
          />
        ) : (
          <UploadZone setJob={setJob} setIsLoading={setIsLoading} isLoading={isLoading} job={job} />
        )}
      </div>

      {showAuth && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</h3>
              <button onClick={() => setShowAuth(false)} className="text-zinc-400">✕</button>
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setAuthMode('signin')} className={authMode==='signin' ? 'px-3 py-1 rounded bg-white/10 text-white' : 'px-3 py-1 rounded bg-white/5 text-zinc-400'}>Sign In</button>
              <button onClick={() => setAuthMode('signup')} className={authMode==='signup' ? 'px-3 py-1 rounded bg-white/10 text-white' : 'px-3 py-1 rounded bg-white/5 text-zinc-400'}>Sign Up</button>
            </div>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="w-full mb-3 px-3 py-2 rounded bg-white/5 border border-white/10 text-white outline-none" />
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full mb-3 px-3 py-2 rounded bg-white/5 border border-white/10 text-white outline-none" />
            {authError && <p className="text-red-500 text-xs mb-2">{authError}</p>}
            <button onClick={submitAuth} className="w-full px-4 py-2 rounded bg-purple-600 text-white">{authMode==='signin' ? 'Sign In' : 'Sign Up'}</button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6 text-center text-zinc-500 text-sm">
          <p>© 2024 ClipFlow AI. Built for creators.</p>
        </div>
      </footer>
    </main>
  );
}
