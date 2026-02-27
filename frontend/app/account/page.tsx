"use client";
import { useEffect, useState } from "react";

type Item = { job_id: string; status: string; created_at?: string; url?: string; meta?: any };

export default function AccountPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string>("");
  const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;

  useEffect(() => {
    const run = async () => {
      setError("");
      try {
        if (!token) {
          setError("Please sign in to view your jobs.");
          return;
        }
        const res = await fetch(`${API_URL}/me/jobs`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.detail || "Failed to load jobs");
          return;
        }
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        setError("Network error");
      }
    };
    run();
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-white mb-4">Your Jobs</h1>
        {error && <div className="mb-4 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((it) => (
            <div key={it.job_id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-white font-medium">{it.url || it.job_id}</div>
                <span className="px-2 py-0.5 rounded-full text-xs border border-white/10 bg-white/5 text-zinc-300">{it.status}</span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                {it.created_at ? new Date(it.created_at).toLocaleString() : ""}
                {it.meta && it.meta.duration ? ` • ${Math.floor(Number(it.meta.duration))}s` : ""}
              </div>
              <div className="mt-4 flex gap-2">
                <a href={`/?job_id=${encodeURIComponent(it.job_id)}`} className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-700">Open</a>
              </div>
            </div>
          ))}
          {items.length === 0 && !error && (
            <div className="text-zinc-400">No jobs yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}

