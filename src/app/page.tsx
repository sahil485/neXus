"use client";

import { useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Users, 
  Sparkles, 
  MessageSquare,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";

// X Logo SVG Component
function XLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Animated connection lines for background
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Main gradient blobs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#1d9bf0]/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#1d9bf0]/3 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

// Inner component that uses useSearchParams
function LandingPageContent() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  const features = [
    {
      icon: Users,
      title: "3° Network Mapping",
      description: "Discover connections up to 3 degrees away in your X network.",
    },
    {
      icon: Search,
      title: "Semantic Search",
      description: "Find people using natural language. AI understands context.",
    },
    {
      icon: Sparkles,
      title: "AI Insights",
      description: "Get intelligent summaries of profiles and interests.",
    },
    {
      icon: MessageSquare,
      title: "Smart Intros",
      description: "Generate personalized introduction messages.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <AnimatedBackground />

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <XLogo className="w-5 h-5 text-black" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Nexus</span>
          </motion.div>
          
          <motion.div 
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Button 
              onClick={login}
              className="bg-white text-black font-bold hover:bg-white/90 transition-all duration-200 rounded-full px-6"
            >
              Sign in
            </Button>
          </motion.div>
        </div>
      </nav>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto px-6 mt-4"
        >
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            Authentication failed. Please try again.
          </div>
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 text-[#1d9bf0] text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              AI-Powered Network Discovery
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Explore your{" "}
            <span className="text-[#1d9bf0]">extended network</span>{" "}
            on X
          </motion.h1>

          <motion.p
            className="text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Discover hidden connections up to 3 degrees away. Search with natural language. 
            Get AI-crafted introductions that open doors.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button
              size="lg"
              onClick={login}
              className="bg-white text-black font-bold text-lg px-8 py-6 rounded-full hover:bg-white/90 transition-all duration-200 group"
            >
              <XLogo className="w-5 h-5 mr-2" />
              Sign in with X
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex justify-center gap-12 sm:gap-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { value: "3°", label: "Connection Depth" },
              { value: "AI", label: "Powered Search" },
              { value: "∞", label: "Possibilities" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-[#1d9bf0]">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <motion.div
          className="grid sm:grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-[#1d9bf0]/30 hover:bg-white/[0.04] transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div className="w-12 h-12 rounded-full bg-[#1d9bf0]/10 flex items-center justify-center mb-4 group-hover:bg-[#1d9bf0]/20 transition-colors">
                <feature.icon className="w-6 h-6 text-[#1d9bf0]" />
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-[#1d9bf0] transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-gray-400">Three simple steps to expand your network</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Connect",
              description: "Sign in securely with your X account using OAuth 2.0",
              icon: Shield,
            },
            {
              step: "02",
              title: "Index",
              description: "We analyze your network and their connections with AI",
              icon: TrendingUp,
            },
            {
              step: "03",
              title: "Discover",
              description: "Search naturally and get AI-crafted introductions",
              icon: Sparkles,
            },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              className="relative text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 mb-4">
                <item.icon className="w-7 h-7 text-[#1d9bf0]" />
              </div>
              <div className="text-xs font-mono text-[#1d9bf0] mb-2">{item.step}</div>
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d9bf0]/20 to-[#1d9bf0]/5 border border-[#1d9bf0]/20 p-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to expand your network?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Join professionals using Nexus to discover meaningful connections and opportunities on X.
          </p>
          <Button
            size="lg"
            onClick={login}
            className="bg-white text-black font-bold text-lg px-10 py-6 rounded-full hover:bg-white/90 transition-all duration-200"
          >
            <XLogo className="w-5 h-5 mr-2" />
            Get started with X
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <XLogo className="w-4 h-4 text-black" />
              </div>
              <span className="font-bold">Nexus</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 Nexus. Built with AI for better connections.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
    </div>
  );
}

// Main export with Suspense wrapper
export default function LandingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LandingPageContent />
    </Suspense>
  );
}
