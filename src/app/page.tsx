"use client";

import { useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// X Logo SVG Component
function XLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <XLogo className="w-16 h-16 text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      {/* Left side - Logo (Large) */}
      <div className="hidden md:flex flex-1 items-center justify-center p-8">
        <XLogo className="w-[300px] h-[300px] lg:w-[380px] lg:h-[380px]" />
      </div>

      {/* Right side - Login Content */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-12 lg:px-16 py-12">
        <div className="md:hidden mb-12">
          <XLogo className="w-12 h-12" />
        </div>

        <div className="max-w-[600px] w-full">
          <h1 className="text-[40px] md:text-[64px] font-extrabold tracking-tight mb-12 leading-tight">
            Happening now
          </h1>

          <h2 className="text-[23px] md:text-[31px] font-bold mb-8">
            Join Nexus today.
          </h2>

          <div className="w-[300px] space-y-4">
            <Button
              onClick={login}
              className="w-full h-[40px] rounded-full bg-white text-black hover:bg-[#e6e6e6] font-bold text-[15px] border border-transparent transition-colors flex items-center justify-center gap-2"
            >
              <XLogo className="w-4 h-4" />
              Sign in with X
            </Button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[#2f3336]"></div>
              <span className="flex-shrink-0 mx-2 text-[#e7e9ea] text-[15px]">or</span>
              <div className="flex-grow border-t border-[#2f3336]"></div>
            </div>

            <Button
              onClick={login}
              className="w-full h-[40px] rounded-full bg-[#1d9bf0] text-white hover:bg-[#1a8cd8] font-bold text-[15px] border border-transparent transition-colors"
            >
              Create account
            </Button>

            <p className="text-[11px] text-[#71767b] leading-4 mt-2">
              By signing up, you agree to the Terms of Service and Privacy Policy, including Cookie Use.
            </p>

            <div className="mt-12">
              <h3 className="text-[17px] font-bold mb-4">Already have an account?</h3>
              <Button
                onClick={login}
                variant="outline"
                className="w-full h-[40px] rounded-full bg-transparent text-[#1d9bf0] border border-[#536471] hover:bg-[#1d9bf0]/10 font-bold text-[15px] transition-colors"
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full p-4 bg-black hidden xl:block">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-[#71767b]">
          <a href="#" className="hover:underline">About</a>
          <a href="#" className="hover:underline">Download the X app</a>
          <a href="#" className="hover:underline">Help Center</a>
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Cookie Policy</a>
          <a href="#" className="hover:underline">Accessibility</a>
          <a href="#" className="hover:underline">Ads info</a>
          <a href="#" className="hover:underline">Blog</a>
          <a href="#" className="hover:underline">Status</a>
          <a href="#" className="hover:underline">Careers</a>
          <a href="#" className="hover:underline">Brand Resources</a>
          <a href="#" className="hover:underline">Advertising</a>
          <a href="#" className="hover:underline">Marketing</a>
          <a href="#" className="hover:underline">X for Business</a>
          <a href="#" className="hover:underline">Developers</a>
          <a href="#" className="hover:underline">Directory</a>
          <a href="#" className="hover:underline">Settings</a>
          <span>© 2024 Nexus for X</span>
        </div>
      </footer>
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <XLogo className="w-16 h-16 text-white animate-pulse" />
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
