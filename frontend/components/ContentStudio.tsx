"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rnd } from "react-rnd";
import {
  Twitter,
  Instagram,
  Linkedin,
  Download,
  Scissors,
  Type,
  Layout,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Clip {
  id: number;
  filename: string;
  url: string;
  score: number;
  transcription: any[];
}

interface ContentStudioProps {
  clips: Clip[];
  jobId: string;
}

export function ContentStudio({ clips, jobId }: ContentStudioProps) {
  const [selectedClip, setSelectedClip] = useState<Clip | null>(clips.length > 0 ? clips[0] : null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"twitter" | "instagram" | "linkedin" | "captions">(
    "twitter"
  );
  const [socialContent, setSocialContent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting] = useState(false);
  const [crop, setCrop] = useState({ x: 150, y: 0, width: 180, height: 320 });

  const transcriptionText = selectedClip?.transcription
    ? selectedClip.transcription.map((s) => s.text).join(" ")
    : "";
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (selectedClip) {
      setVideoUrl(selectedClip.url);
      handleGenerateContent();
      setSocialContent(null);
    }
  }, [selectedClip]);

  const handleGenerateContent = async () => {
    if (!selectedClip) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`${API_URL}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!response.ok) {
        throw new Error("Failed to generate content");
      }
      const data = await response.json();
      setSocialContent(data.social_post);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!videoUrl || !selectedClip) return;

    // The video is already rendered, just download it
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = `clip_${selectedClip.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Video Player with Crop Overlay */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Scissors className="w-5 h-5 text-purple-500" />
              Video Studio
            </h3>
            <div className="flex gap-2">
              <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <Layout className="w-4 h-4" />
              </button>
              <button className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <Type className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {clips.map((clip) => (
              <div
                key={clip.filename}
                className={cn(
                  "cursor-pointer p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors",
                  selectedClip?.filename === clip.filename
                    ? "bg-purple-600/50 ring-2 ring-purple-500 text-white"
                    : "text-zinc-400"
                )}
                onClick={() => setSelectedClip(clip)}
              >
                <p className="font-bold text-sm">Clip (Score: {clip.score.toFixed(1)})</p>
                <p className="text-xs truncate mt-1">{clip.transcription}</p>
              </div>
            ))}
          </div>
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 group">
            {selectedClip ? (
              <video
                key={selectedClip.filename} // Add key to force re-render on clip change
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                controls
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                Select a clip to view
              </div>
            )}

            {/* 9:16 Crop Overlay */}
            <Rnd
              default={{
                x: 150,
                y: 0,
                width: 180,
                height: 320,
              }}
              bounds="parent"
              lockAspectRatio={9 / 16}
              className="border-2 border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.5)] z-10"
              onDragStop={(e, d) => setCrop((prev) => ({ ...prev, x: d.x, y: d.y }))}
              onResizeStop={(e, direction, ref, delta, position) => {
                setCrop({
                  width: parseInt(ref.style.width),
                  height: parseInt(ref.style.height),
                  ...position,
                });
              }}
            >
              <div className="w-full h-full relative">
                <div className="absolute top-2 left-2 bg-purple-500 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  9:16 Crop • {crop.width}x{crop.height} @ {crop.x},{crop.y}
                </div>
              </div>
            </Rnd>
          </div>
          <p className="text-xs text-zinc-500 text-center">
            Drag and resize the box to select your 9:16 clip area
          </p>
        </div>

        {/* Right: AI Content Tabs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Content Studio
          </h3>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/10 overflow-x-auto">
              {(["twitter", "instagram", "linkedin", "captions"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 min-w-[100px] py-4 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    activeTab === tab
                      ? "bg-white/5 text-white border-b-2 border-purple-500"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {tab === "twitter" && <Twitter className="w-4 h-4" />}
                  {tab === "instagram" && <Instagram className="w-4 h-4" />}
                  {tab === "linkedin" && <Linkedin className="w-4 h-4" />}
                  {tab === "captions" && <Type className="w-4 h-4" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6 h-[400px] overflow-y-auto">
              {activeTab === "captions" ? (
                <textarea
                  className="w-full h-full bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-zinc-300 focus:border-purple-500 outline-none resize-none transition-colors"
                  value={transcriptionText || "Select a clip to see the transcription."}
                  readOnly
                />
              ) : isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm">Generating viral content...</p>
                </div>
              ) : socialContent ? (
                <motion.div
                  key={activeTab} // Add key to re-trigger animation on tab change
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <textarea
                    className="w-full h-64 bg-transparent whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed outline-none resize-none"
                    defaultValue={socialContent}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(socialContent)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    Copy to Clipboard
                  </button>
                </motion.div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  Failed to generate content.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || !selectedClip}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3",
              isExporting || !selectedClip
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_30px_rgba(147,51,234,0.3)]"
            )}
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Rendering Video...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Export & Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
