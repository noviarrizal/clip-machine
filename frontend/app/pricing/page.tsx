"use client";

import { useEffect, useState } from "react";

export default function PricingPage() {
  const plans = [
    { name: "Free", price: "$0", features: ["3 jobs/day", "Basic captions", "Platform posts"], cta: "Get Started" },
    { name: "Pro", price: "$19/mo", features: ["100 jobs/month", "Priority rendering", "Advanced captions", "Smart crop"], cta: "Upgrade" },
    { name: "Creator", price: "$49/mo", features: ["Unlimited jobs", "Brand presets", "Team access", "API access"], cta: "Upgrade" },
  ];
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [quota, setQuota] = useState<{ plan?: string; limit?: number; used?: number; remaining?: number } | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
  const [licenseKey, setLicenseKey] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('LICENSE_KEY') || '';
    return '';
  });
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        if (token) {
          const res = await fetch(`${api}/me/quota`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const data = await res.json();
            setQuota(data);
          }
        } else if (licenseKey) {
          const res = await fetch(`${api}/me/quota?license_key=${encodeURIComponent(licenseKey)}`);
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
  }, [licenseKey]);
  return (
    <main className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500/30">
      <div className="container mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-white mb-6">Pricing</h1>
        <p className="text-zinc-400 mb-10">Choose a plan that scales with your content.</p>
        {!token && (
          <div className="mb-6">
            <div className="flex gap-2">
              <input value={licenseKey} onChange={(e)=>setLicenseKey(e.target.value)} placeholder="Enter license key to view usage" className="flex-1 px-3 py-2 rounded bg-white/5 border border-white/10 text-white outline-none" />
              <button onClick={()=>{ if (typeof window !== 'undefined') localStorage.setItem('LICENSE_KEY', licenseKey); }} className="px-4 py-2 rounded bg-white/10 text-white hover:bg-white/20">Save</button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Saved license key will be used for uploads if you are not signed in.</p>
          </div>
        )}
        {quota && typeof quota.used === 'number' && typeof quota.limit === 'number' && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-zinc-300 mb-2">
              <span>Your usage today</span>
              <span>{quota.used}/{quota.limit}</span>
            </div>
            <div className="h-2 bg-white/10 rounded">
              <div className="h-2 bg-purple-600 rounded" style={{ width: `${Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100))}%` }} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.name} className="bg白/5 border border白/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-2">{p.name}</h2>
              <p className="text-3xl font-bold text-white mb-4">{p.price}</p>
              <ul className="space-y-2 text-zinc-300 text-sm mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    {f}
                  </li>
                ))}
              </ul>
              {p.name === 'Free' ? (
                <a href="/auth" className="w-full inline-block text-center px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">{p.cta}</a>
              ) : p.name === 'Pro' ? (
                <a href={(process.env.NEXT_PUBLIC_STRIPE_PRO_URL||"/auth")} className="w-full inline-block text-center px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">{p.cta}</a>
              ) : (
                <a href={(process.env.NEXT_PUBLIC_STRIPE_CREATOR_URL||"/auth")} className="w-full inline-block text-center px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">{p.cta}</a>
              )}
            </div>
          ))}
        </div>
        <div className="mt-10 text-zinc-400 text-sm">
          <p>* Free users are limited to 3 jobs/day. Signed-in users bypass the license key requirement.</p>
        </div>
      </div>
    </main>
  );
}
