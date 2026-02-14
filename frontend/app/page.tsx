"use client";

import { useState } from "react";
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
  status: "pending" | "processing" | "completed" | "failed";
  clips?: BackendClip[];
  transcription?: any[];
  error?: string;
}

export default function Home() {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white transition-all">
              Sign In
            </button>
          </div>
        </div>
      </nav>

      <Hero />

      <div className="container mx-auto px-6 mt-12 mb-24">
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

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6 text-center text-zinc-500 text-sm">
          <p>© 2024 ClipFlow AI. Built for creators.</p>
        </div>
      </footer>
    </main>
  );
}
