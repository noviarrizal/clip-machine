"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Job } from "@/app/page"; // Import the Job interface

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const LICENSE_KEY = process.env.NEXT_PUBLIC_LICENSE_KEY || "";

interface UploadZoneProps {
  setJob: React.Dispatch<React.SetStateAction<Job | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  job: Job | null;
}

export function UploadZone({ setJob, setIsLoading, isLoading, job }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [queue, setQueue] = useState<{ name: string; status: 'queued'|'uploading'|'done'|'error'; progress?: number; error?: string }[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    } else {
      const url = e.dataTransfer.getData("text/uri-list");
      if (url) {
        await handleUrl(url);
      }
    }
  }, []);

  const handleUrl = async (url: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Check quota before starting
      const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
      const dynamicKey = typeof window !== 'undefined' ? (localStorage.getItem('LICENSE_KEY') || LICENSE_KEY || 'DEV-1234') : (LICENSE_KEY || 'DEV-1234');
      const quotaRes = await fetch(`${API_URL}/me/quota${token ? '' : `?license_key=${encodeURIComponent(dynamicKey)}`}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (quotaRes.ok) {
        const q = await quotaRes.json();
        if ((q.remaining ?? 0) <= 0) {
          setError("You've reached your daily limit. See Pricing for options.");
          setIsLoading(false);
          setShowUpgrade(true);
          return;
        }
      }
      const response = await fetch(`${API_URL}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(token ? { url } : { url, license_key: dynamicKey }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to start job");
      }
      const newJob = await response.json();
      setJob(newJob);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('video/')) return 'Unsupported file type';
    const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 500);
    if (file.size > maxMb * 1024 * 1024) return `File too large (>${maxMb}MB)`;
    return null;
  };

  const handleFiles = async (files: FileList) => {
    const list = Array.from(files);
    const initial = list.map(f => ({ name: f.name, status: 'queued' as const }));
    setQueue(prev => [...prev, ...initial]);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const errMsg = validateFile(f);
      if (errMsg) {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', error: errMsg } : q));
        continue;
      }
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading', progress: 0 } : q));
      await handleFile(f, (pct) => {
        setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: pct } : q));
      });
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done' } : q));
    }
  };

  const handleFile = async (file: File, onProgress?: (pct: number) => void) => {
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/upload`);
      const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // Quota check for file uploads
      (async () => {
        try {
          const dynamicKey = typeof window !== 'undefined' ? (localStorage.getItem('LICENSE_KEY') || LICENSE_KEY || 'DEV-1234') : (LICENSE_KEY || 'DEV-1234');
          const quotaRes = await fetch(`${API_URL}/me/quota${token ? '' : `?license_key=${encodeURIComponent(dynamicKey)}`}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (quotaRes.ok) {
            const q = await quotaRes.json();
            if ((q.remaining ?? 0) <= 0) {
              setError("You've reached your daily limit. See Pricing for options.");
              setIsLoading(false);
              setShowUpgrade(true);
              resolve();
              return;
            }
          }
        } catch {}
      })();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
          onProgress?.(pct);
        }
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const newJob = JSON.parse(xhr.responseText);
              setJob(newJob);
              setUploadProgress(null);
            } else {
              const err = JSON.parse(xhr.responseText || '{}');
              setError(err.detail || "Failed to start job");
            }
          } catch {
            setError("Upload failed");
          } finally {
            setIsLoading(false);
            resolve();
          }
        }
      };
      const form = new FormData();
      const dynamicKey = typeof window !== 'undefined' ? (localStorage.getItem('LICENSE_KEY') || LICENSE_KEY || 'DEV-1234') : (LICENSE_KEY || 'DEV-1234');
      if (!token) form.append("license_key", dynamicKey);
      form.append("file", file);
      xhr.send(form);
    });
  };

  useEffect(() => {
    if (job && (job.status === "processing" || job.status === "pending")) {
      const es = new EventSource(`${API_URL}/events/${job.job_id}`);
      es.onmessage = (ev) => {
        try {
          const updatedJob = JSON.parse(ev.data);
          setJob(updatedJob);
          if (updatedJob.status === "completed" || updatedJob.status === "failed" || updatedJob.status === "canceled") {
            setIsLoading(false);
            es.close();
          }
        } catch {
        }
      };
      es.onerror = () => {
        es.close();
      };
      return () => es.close();
    }
  }, [job, setJob, setIsLoading]);

  const handleCancel = async () => {
    if (!job) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
      await fetch(`${API_URL}/jobs/${job.job_id}/cancel`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {}
  };

  const handleRetry = async () => {
    if (!job) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('AUTH_TOKEN') : null;
      const res = await fetch(`${API_URL}/jobs/${job.job_id}/retry`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return;
      setIsLoading(true);
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pb-20">
      <div className="mb-4 flex gap-2">
        <input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste a YouTube/TikTok/X link"
          className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-purple-500"
        />
        <button
          onClick={() => inputUrl && handleUrl(inputUrl)}
          className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
        >
          Process
        </button>
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
          Upload File
        </button>
        {uploadProgress !== null && (
          <div className="flex items-center gap-2 w-48">
            <div className="h-2 flex-1 bg-white/10 rounded">
              <div className="h-2 bg-purple-600 rounded" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-xs text-zinc-400">{uploadProgress}%</span>
          </div>
        )}
      </div>
      {!(typeof window !== 'undefined' && localStorage.getItem('AUTH_TOKEN')) && !(typeof window !== 'undefined' && localStorage.getItem('LICENSE_KEY')) && !LICENSE_KEY && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          License key missing. Set NEXT_PUBLIC_LICENSE_KEY to enable processing.
        </div>
      )}
      {queue.length > 0 && (
        <div className="mb-4 space-y-1">
          {queue.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-xs text-zinc-400">
              <span className="truncate max-w-[60%]">{item.name}</span>
              <span>
                {item.status === 'queued' && 'Queued'}
                {item.status === 'uploading' && `${item.progress ?? 0}%`}
                {item.status === 'done' && 'Uploaded'}
                {item.status === 'error' && `Error: ${item.error}`}
              </span>
            </div>
          ))}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className={cn(
          "relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-12 text-center",
          isDragging
            ? "border-purple-500 bg-purple-500/5"
            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <AnimatePresence mode="wait">
          {!job && !isLoading && !error && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">Drop your video</h3>
              <p className="text-zinc-400">We'll download and process it for you.</p>
              <a href="/pricing" className="inline-block text-xs text-purple-400 hover:text-purple-300">View Pricing</a>
            </motion.div>
          )}

          {(isLoading || (job && (job.status === "pending" || job.status === "processing"))) && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white">Processing Video...</h3>
              <p className="text-zinc-400">This can take a few minutes depending on the length.</p>
              {job && (
                <button onClick={handleCancel} className="mt-2 px-6 py-2 bg-white/10 text-white rounded-full hover:bg-white/20">
                  Cancel
                </button>
              )}
            </motion.div>
          )}

          {job && job.status === "failed" && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">Processing Failed</h3>
              <p className="text-zinc-400 max-w-sm mx-auto">
                {job.error || "An unknown error occurred."}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setJob(null)}
                  className="mt-4 px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleRetry}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
                >
                  Retry Job
                </button>
              </div>
            </motion.div>
          )}

          {job && job.status === "canceled" && (
            <motion.div
              key="canceled"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h3 className="text-xl font-semibold text-white">Processing Canceled</h3>
              <p className="text-zinc-400 max-w-sm mx-auto">You can retry the job or upload a new video.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setJob(null)}
                  className="mt-4 px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors"
                >
                  New Upload
                </button>
                <button
                  onClick={handleRetry}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
                >
                  Retry Job
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {showUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Daily limit reached</h3>
              <button onClick={()=>setShowUpgrade(false)} className="text-zinc-400">✕</button>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Upgrade to continue processing more clips today.</p>
            <div className="space-y-3">
              <a href="/pricing" className="block w-full px-4 py-2 rounded bg-white/5 border border-white/10 text-white text-center">View Pricing</a>
              <a href={(process.env.NEXT_PUBLIC_STRIPE_PRO_URL||"/pricing")} className="block w-full px-4 py-2 rounded bg-purple-600 text-white text-center hover:bg-purple-700">Upgrade to Pro</a>
              <a href={(process.env.NEXT_PUBLIC_STRIPE_CREATOR_URL||"/pricing")} className="block w-full px-4 py-2 rounded bg-white text-black text-center hover:bg-zinc-200">Upgrade to Creator</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
