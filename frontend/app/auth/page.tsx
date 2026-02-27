"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  ArrowLeft,
  Loader2,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("AUTH_TOKEN") || "" : "";
    const e = typeof window !== "undefined" ? localStorage.getItem("AUTH_EMAIL") || "" : "";
    setToken(t);
    setProfileEmail(e);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setIsLoading(true);
    const endpoint = authMode === "signin" ? "/auth/signin" : "/auth/signup";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Authentication failed. Please check your credentials.");
        setIsLoading(false);
        return;
      }
      const t = data.access_token || "";
      if (t) {
        localStorage.setItem("AUTH_TOKEN", t);
        setToken(t);
      }
      if (data.email) {
        localStorage.setItem("AUTH_EMAIL", data.email);
        setProfileEmail(data.email);
      }
    } catch {
      setError("Network error. Ensure the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("AUTH_TOKEN");
    localStorage.removeItem("AUTH_EMAIL");
    setToken("");
    setProfileEmail("");
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden selection:bg-purple-500/30">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group z-10"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back to Home</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 rounded-3xl blur-xl transition-all duration-500 pointer-events-none" />

        <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Video className="w-6 h-6 text-white" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">
            {token ? "Welcome Back" : authMode === "signin" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-zinc-400 text-center text-sm mb-8">
            {token
              ? "You are currently signed in to ClipGen"
              : "Enter your details to access ClipGen"}
          </p>

          <AnimatePresence mode="wait">
            {token ? (
              <motion.div
                key="signed-in"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Signed in as</p>
                    <p className="text-sm text-zinc-400 truncate">{profileEmail}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors border border-white/5"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={signOut}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key={authMode}
                initial={{ opacity: 0, x: authMode === "signin" ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: authMode === "signin" ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={submit}
                className="space-y-5"
              >
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-400 transition-colors">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-400 transition-colors">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:from-purple-500 hover:to-blue-500 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : authMode === "signin" ? (
                    <>
                      Sign In <LogIn className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Create Account <UserPlus className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-sm">
                  <span className="text-zinc-400">
                    {authMode === "signin" ? "Don't have an account?" : "Already have an account?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === "signin" ? "signup" : "signin");
                      setError("");
                    }}
                    className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                  >
                    {authMode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}
