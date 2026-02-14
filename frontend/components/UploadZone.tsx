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
      await handleFile(files[0]);
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
      const response = await fetch(`${API_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, license_key: LICENSE_KEY || "DEV-1234" }),
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

  const handleFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(pct);
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
      form.append("license_key", LICENSE_KEY || "DEV-1234");
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
          if (updatedJob.status === "completed" || updatedJob.status === "failed") {
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
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
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
              <button
                onClick={() => setJob(null)}
                className="mt-4 px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
