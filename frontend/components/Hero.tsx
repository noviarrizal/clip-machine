'use client';

import { motion } from 'framer-motion';
import { Zap, Video, Share2 } from 'lucide-react';

export function Hero() {
  return (
    <div className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-1/4 w-[400px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-purple-400 mb-6">
            <Zap className="w-4 h-4" />
            AI-Powered Video Content Studio
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            Turn One Video Into <br />
            <span className="text-purple-500">Viral Content</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Upload your video, transcribe it for free, and generate Twitter threads, 
            IG captions, and short-form clips with auto-captions in seconds.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-8 text-zinc-500"
        >
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            <span>Smart Cropping</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <span>Fast Transcription</span>
          </div>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            <span>Multi-Platform Export</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
