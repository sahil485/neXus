"use client";

import { useEffect, Suspense, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { NetworkBackground } from "@/components/NetworkBackground";
import { XLogo } from "@/components/ui/logos";

// Constants
const ROTATING_WORDS = ["Your Social Universe", "Your Connections", "Your Opportunities", "Your Friends"];
const INITIAL_DELAY_MS = 6000;
const FAST_CYCLE_MS = 3000;

// Animation variants for consistency
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const wordAnimation = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -40, filter: "blur(8px)" },
};

// Logo component with X icon
function Logo({ className = "", iconSize = "w-10 h-10" }: { className?: string; iconSize?: string }) {
  return (
    <span className={`text-4xl font-medium tracking-wide inline-flex items-center ${className}`}>
      <span className="mr-[-4px] scale-y-125 origin-center -translate-y-[1px]">NE</span>
      <XLogo className={`${iconSize}`} />
      <span className="ml-[-4px] scale-y-125 origin-center -translate-y-[1px]">US</span>
    </span>
  );
}

function LandingPageContent() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [wordIndex, setWordIndex] = useState(0);
  const [isCtaHovered, setIsCtaHovered] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Word rotation - 4s on first word, then fast rotation
  useEffect(() => {
    const delay = isFirstRender ? INITIAL_DELAY_MS : FAST_CYCLE_MS;
    
    const timeout = setTimeout(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
      if (isFirstRender) setIsFirstRender(false);
    }, delay);
    
    return () => clearTimeout(timeout);
  }, [wordIndex, isFirstRender]);

  // Auth redirect
  useEffect(() => {
    if (user && !isLoading) router.push("/dashboard");
  }, [user, isLoading, router]);

  const handleCtaHover = useCallback((hovered: boolean) => () => setIsCtaHovered(hovered), []);

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Logo className="text-4xl text-white" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white overflow-hidden fixed inset-0">
      <NetworkBackground />

      {/* Gradient overlays */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
        <div 
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(59,130,246,0.04) 0%, transparent 60%)" }}
        />
      </div>

      {/* Navigation */}
      <motion.nav
        {...fadeInUp}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="fixed top-0 left-0 z-50 pt-10 pl-10"
      >
        <motion.div whileHover={{ scale: 1.02 }} className="cursor-pointer">
          <Logo />
        </motion.div>
      </motion.nav>

      {/* Hero */}
      <main className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <div className="text-center">
          {/* Headlines */}
          <motion.h1
            {...fadeInUp}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-none"
          >
            Understand
          </motion.h1>

          <div className="h-14 sm:h-16 md:h-20 lg:h-24 relative w-screen max-w-none -mx-6">
            <AnimatePresence mode="wait">
              <motion.h2
                key={wordIndex}
                variants={wordAnimation}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight tracking-tight text-slate-400 absolute inset-0 flex items-center justify-center whitespace-nowrap px-6"
              >
                {ROTATING_WORDS[wordIndex]}
              </motion.h2>
            </AnimatePresence>
          </div>

          {/* Subtitle */}
          <motion.p
            {...fadeInUp}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-base sm:text-lg text-slate-500 max-w-lg mx-auto mt-6 font-light leading-relaxed"
          >
            AI-powered network intelligence for X.
            <br className="hidden sm:block" />
            Discover hidden connections and unlock your social graph.
          </motion.p>
        </div>

        {/* CTA */}
        <motion.div
          {...fadeInUp}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-10 w-full max-w-sm"
        >
          <div
            className="relative"
            onMouseEnter={handleCtaHover(true)}
            onMouseLeave={handleCtaHover(false)}
          >
            <motion.div
              animate={{
                boxShadow: isCtaHovered
                  ? "0 0 60px rgba(59,130,246,0.2), 0 0 100px rgba(139,92,246,0.1)"
                  : "0 0 30px rgba(59,130,246,0.08)",
              }}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden"
            >
              <motion.button
                onClick={login}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full px-8 py-4 flex items-center justify-center gap-3 group transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-base font-medium">Continue with </span>
                <XLogo className="w-5 h-5" />
                <svg
                  className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </motion.button>
            </motion.div>

            {/* Hover glow border */}
            <motion.div
              className="absolute -inset-px rounded-2xl pointer-events-none -z-10"
              animate={{ opacity: isCtaHovered ? 0.5 : 0 }}
              style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)",
                backgroundSize: "200% 200%",
                animation: isCtaHovered ? "gradient-shift 3s ease infinite" : "none",
              }}
            />
          </div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="flex items-center justify-center gap-8 mt-6 text-xs text-slate-600 uppercase tracking-widest"
          >
            {[
              { color: "bg-emerald-500", label: "Secure" },
              { color: "bg-blue-500", label: "AI-Powered" },
              { color: "bg-purple-500", label: "Real-time" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </main>

      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Logo className="text-4xl text-white" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LandingPageContent />
    </Suspense>
  );
}
