'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import { Twitter, Instagram, Linkedin, Download, Scissors, Type, Layout, Save, Check, Edit3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSocialContent } from '@/app/actions/generate-content';
import { renderVideo } from '@/lib/ffmpeg';

interface ContentStudioProps {
  videoFile: File;
  transcription: { text: string; segments: any[] };
}

export function ContentStudio({ videoFile, transcription }: ContentStudioProps) {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'twitter' | 'instagram' | 'linkedin' | 'captions'>('twitter');
  const [socialContent, setSocialContent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [crop, setCrop] = useState({ x: 150, y: 0, width: 180, height: 320 });
  const [segments, setSegments] = useState(transcription.segments);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    handleGenerateContent();
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    try {
      const content = await generateSocialContent(transcription.text);
      setSocialContent(content);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!videoRef.current) return;
    
    setIsExporting(true);
    try {
      const videoRes = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      };
      const displayRes = {
        width: videoRef.current.clientWidth,
        height: videoRef.current.clientHeight
      };

      const blob = await renderVideo(videoFile, crop, videoRes, displayRes, segments);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clipflow-${Date.now()}.mp4`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. This can happen with very large videos in the browser.');
    } finally {
      setIsExporting(false);
    }
  };

  const updateSegment = (index: number, text: string) => {
    const newSegments = [...segments];
    newSegments[index].text = text;
    setSegments(newSegments);
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
          
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 group">
            <video 
              ref={videoRef}
              src={videoUrl} 
              className="w-full h-full object-contain"
              controls
            />
            
            {/* 9:16 Crop Overlay */}
            <Rnd
              default={{
                x: 150,
                y: 0,
                width: 180,
                height: 320,
              }}
              bounds="parent"
              lockAspectRatio={9/16}
              className="border-2 border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.5)] z-10"
              onDragStop={(e, d) => setCrop(prev => ({ ...prev, x: d.x, y: d.y }))}
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
                  9:16 Crop
                </div>
              </div>
            </Rnd>
          </div>
          <p className="text-xs text-zinc-500 text-center">Drag and resize the box to select your 9:16 clip area</p>
        </div>

        {/* Right: AI Content Tabs */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Content Studio
          </h3>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/10 overflow-x-auto">
              {(['twitter', 'instagram', 'linkedin', 'captions'] as const).map((tab) => (
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
                  {tab === 'twitter' && <Twitter className="w-4 h-4" />}
                  {tab === 'instagram' && <Instagram className="w-4 h-4" />}
                  {tab === 'linkedin' && <Linkedin className="w-4 h-4" />}
                  {tab === 'captions' && <Type className="w-4 h-4" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6 h-[400px] overflow-y-auto">
              {activeTab === 'captions' ? (
                <div className="space-y-4">
                  {segments.map((segment, i) => (
                    <div key={i} className="flex gap-3 group">
                      <span className="text-[10px] text-zinc-600 mt-2 font-mono w-12">
                        {segment.start.toFixed(1)}s
                      </span>
                      <textarea
                        value={segment.text}
                        onChange={(e) => updateSegment(i, e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-zinc-300 focus:border-purple-500 outline-none resize-none h-16 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              ) : isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm">Generating viral content...</p>
                </div>
              ) : socialContent ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="whitespace-pre-wrap text-zinc-300 text-sm leading-relaxed">
                    {socialContent[activeTab]}
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(socialContent[activeTab])}
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
            disabled={isExporting}
            className={cn(
              "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3",
              isExporting 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_30px_rgba(147,51,234,0.3)]"
            )}
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rendering Video...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export Cropped Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
