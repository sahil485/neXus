"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Search,
  Users,
  Loader2,
  RefreshCw,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchBar } from "@/components/SearchBar";
import { ProfileCard, type Profile } from "@/components/ProfileCard";
import { IntroModal } from "@/components/IntroModal";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { XLogo } from "@/components/ui/logos";

const navItems = [
  { icon: Home, label: "Home", href: "/dashboard", active: true },
  { icon: Users, label: "Network", href: "/network", active: false },
];

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [bridgeProfile, setBridgeProfile] = useState<Profile | null>(null);
  const [isIntroModalOpen, setIsIntroModalOpen] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [isCachedResult, setIsCachedResult] = useState(false);

  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsDemo(params.get("demo") === "true");
  }, []);

  useEffect(() => {
    if (!authLoading && !user && !isDemo) {
      router.push("/");
    }
  }, [authLoading, user, isDemo, router]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setHasSearched(true);
    setSearchResults([]);
    setSkeletonCount(0);
    setIsCachedResult(false);
    
    try {
      // Use streaming search for dynamic results
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, stream: true }),
      });
      
      if (!response.ok) throw new Error("Search failed");
      
      // Check if results are from cache
      const cacheHit = response.headers.get('X-Cache-Hit') === 'true';
      if (cacheHit) {
        console.log('✅ Dashboard search results loaded from cache (instant!)');
        setIsCachedResult(true);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "skeleton") {
                // Show skeleton placeholders
                setSkeletonCount(data.count);
                setIsSearching(false);
              } else if (data.type === "profile") {
                // Verified profile - add to list
                setSearchResults(prev => [...prev, data.profile]);
                // Reduce skeleton count as real profiles come in
                setSkeletonCount(prev => Math.max(0, prev - 1));
              } else if (data.type === "done") {
                // All done - hide remaining skeletons
                setSkeletonCount(0);
                setIsSearching(false);
                // Check if marked as cached in done message
                if (data.cached) {
                  setIsCachedResult(true);
                }
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      setIsSearching(false);
      setSkeletonCount(0);
    }
  };

  const handleStartIndexing = async () => {
    if (!user?.username) return;
    setIsIndexing(true);
    setIndexProgress(0);
    setIndexProgress(10);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to start indexing");
      }
      
      const data = await response.json();
      console.log("Scraping job started:", data);
      
      const progressInterval = setInterval(() => {
        setIndexProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);
      
      setTimeout(() => {
        clearInterval(progressInterval);
        setIndexProgress(100);
        setTimeout(() => setIsIndexing(false), 2000);
      }, 5000);
      
    } catch (error) {
      console.error("Indexing error:", error);
      setIsIndexing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    );
  }

  const displayUser = user || {
    name: "Demo User",
    username: "demouser",
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo",
  };

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] flex justify-center">
      {/* Left Sidebar */}
      <header className="hidden sm:flex flex-col items-end w-[88px] xl:w-[275px] h-screen sticky top-0 px-2">
        <div className="w-full xl:w-[251px] flex flex-col h-full pb-4">
          <div className="py-2 xl:px-0">
            <div className="w-[50px] h-[50px] flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors">
              <XLogo className="w-[30px] h-[30px]" />
            </div>
          </div>

          <nav className="mt-2 space-y-1 mb-4 flex-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="group flex items-center xl:gap-5 p-3 w-fit xl:w-full hover:bg-white/10 rounded-full transition-colors"
              >
                <item.icon className={`w-[26px] h-[26px] ${item.active ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
                <span className={`hidden xl:block text-xl ${item.active ? "font-bold" : "font-normal"}`}>
                  {item.label}
                </span>
              </a>
            ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-3 w-full hover:bg-white/10 rounded-full transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={displayUser.profile_image_url} />
                  <AvatarFallback>{displayUser.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="hidden xl:block flex-1 text-left leading-5">
                  <div className="font-bold text-[15px] truncate">{displayUser.name}</div>
                  <div className="text-[#71767b] text-[15px] truncate">@{displayUser.username}</div>
                </div>
                <MoreHorizontal className="hidden xl:block w-4 h-4 text-[#e7e9ea]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] bg-black border-[#2f3336] text-[#e7e9ea] shadow-[0_0_15px_rgba(255,255,255,0.1)] rounded-xl py-3">
              <DropdownMenuItem 
                className="py-3 px-4 font-bold text-[15px] hover:bg-white/5 cursor-pointer"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out @{displayUser.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[600px] border-x border-[#2f3336] min-h-screen relative">
        <div className="sticky top-0 z-50 bg-black/65 backdrop-blur-md border-b border-[#2f3336]">
          <div className="px-4 h-[53px] flex items-center justify-between">
            <h1 className="text-xl font-bold">Home</h1>
            <button 
              onClick={handleStartIndexing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              disabled={isIndexing}
            >
              {isIndexing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-[#2f3336]">
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </div>

        {hasSearched && (
          <div className="pb-20">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-2 border-[#1d9bf0]/20 border-t-[#1d9bf0] animate-spin" />
                  <Search className="w-6 h-6 text-[#1d9bf0] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[#71767b] text-[14px] mt-4">Searching your network...</p>
              </div>
            ) : (
              <>
                {/* Verified Results */}
                <AnimatePresence mode="popLayout">
                  {searchResults.map((profile, i) => (
                    <motion.div 
                      key={profile.id} 
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ 
                        duration: 0.4, 
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                      className="border-b border-[#2f3336] hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <div className="p-4">
                        <ProfileCard
                          profile={profile}
                          onGenerateIntro={async (p) => {
                            console.log('Profile clicked:', p);
                            console.log('Profile degree:', p.degree);

                            let fetchedBridge = null;

                            // For 2nd degree connections, fetch a bridge profile from the database FIRST
                            if (p.degree === 2) {
                              console.log('Fetching bridge profile for 2nd degree connection...');
                              try {
                                const url = `/api/network/bridge?target=${p.x_user_id}`;
                                console.log('Fetching from:', url);
                                const response = await fetch(url);
                                console.log('Bridge API response status:', response.status);
                                if (response.ok) {
                                  const data = await response.json();
                                  console.log('Bridge profile data:', data);
                                  fetchedBridge = data.bridge || null;
                                  console.log('Fetched bridge profile:', fetchedBridge);
                                } else {
                                  const errorText = await response.text();
                                  console.error('Failed to fetch bridge profile:', response.status, errorText);
                                }
                              } catch (error) {
                                console.error("Bridge profile fetch error:", error);
                              }
                            } else {
                              console.log('1st degree connection, no bridge needed');
                            }

                            // THEN set states and open modal
                            setSelectedProfile(p);
                            setBridgeProfile(fetchedBridge);
                            console.log('Opening modal with bridge:', fetchedBridge);
                            setIsIntroModalOpen(true);
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Skeleton Loaders */}
                {skeletonCount > 0 && (
                  <>
                    {Array.from({ length: skeletonCount }).map((_, i) => (
                      <div key={`skeleton-${i}`} className="border-b border-[#2f3336] p-4">
                        <div className="flex gap-3 animate-pulse">
                          <div className="w-12 h-12 bg-[#2f3336] rounded-full" />
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 bg-[#2f3336] rounded w-32" />
                              <div className="h-5 bg-[#2f3336] rounded w-10" />
                            </div>
                            <div className="h-3 bg-[#2f3336] rounded w-24" />
                            <div className="h-4 bg-[#2f3336] rounded w-full" />
                            <div className="h-4 bg-[#2f3336] rounded w-3/4" />
                            <div className="flex gap-4">
                              <div className="h-3 bg-[#2f3336] rounded w-20" />
                              <div className="h-3 bg-[#2f3336] rounded w-20" />
                            </div>
                            <div className="h-10 bg-[#1d9bf0]/10 rounded-lg w-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                {/* No Results */}
                {searchResults.length === 0 && skeletonCount === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 px-8 text-center"
                  >
                    <Search className="w-12 h-12 text-[#71767b] mb-4" />
                    <h3 className="text-xl font-bold mb-2">No matching profiles</h3>
                    <p className="text-[#71767b] text-[15px]">
                      No one in your network matches this search
                    </p>
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <IntroModal
        isOpen={isIntroModalOpen}
        onClose={() => {
          setIsIntroModalOpen(false);
          setSelectedProfile(null);
          setBridgeProfile(null);
        }}
        profile={selectedProfile}
        bridgeProfile={bridgeProfile || undefined}
        currentUser={displayUser}
      />
    </div>
  );
}
