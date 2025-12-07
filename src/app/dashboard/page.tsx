"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Search,
  Bell,
  Mail,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  Filter,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchBar } from "@/components/SearchBar";
import { ProfileCard, type Profile } from "@/components/ProfileCard";
import { IntroModal } from "@/components/IntroModal";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

// X Logo SVG Component
function XLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Mock data
const mockProfiles: Profile[] = [
  {
    id: "1",
    x_user_id: "123456",
    username: "sarahtech",
    name: "Sarah Chen",
    bio: "Building safe AI @ Anthropic. Stanford CS PhD. Previously Google Brain.",
    followers_count: 45200,
    following_count: 892,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    degree: 1,
    matchReason: "Works on AI safety",
    topics: ["AI Safety", "ML", "Research"],
  },
  {
    id: "2",
    x_user_id: "234567",
    username: "vcmark",
    name: "Mark Thompson",
    bio: "GP @ Sequoia. Investing in AI-native companies. 2x Founder.",
    followers_count: 128000,
    following_count: 1240,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mark",
    degree: 2,
    matchReason: "Investing in AI startups",
    relevantTweet: "The next decade belongs to AI-native companies.",
    topics: ["VC", "Startups", "AI"],
  },
  {
    id: "3",
    x_user_id: "345678",
    username: "designerjess",
    name: "Jessica Wu",
    bio: "Head of Design @ Figma. Making tools for everyone.",
    followers_count: 89300,
    following_count: 567,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=jessica",
    degree: 1,
    matchReason: "Design community",
    topics: ["Design", "Product"],
  },
];

const navItems = [
  { icon: Home, label: "Home", active: false },
  { icon: Search, label: "Explore", active: false },
  { icon: Bell, label: "Notifications", active: false },
  { icon: Mail, label: "Messages", active: false },
  { icon: Sparkles, label: "Nexus", active: true },
  { icon: User, label: "Profile", active: false },
  { icon: MoreHorizontal, label: "More", active: false },
];

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isIntroModalOpen, setIsIntroModalOpen] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("for-you");

  // Demo mode check
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
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSearchResults(mockProfiles);
    setIsSearching(false);
  };

  const handleStartIndexing = async () => {
    setIsIndexing(true);
    setIndexProgress(0);
    const interval = setInterval(() => {
      setIndexProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsIndexing(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
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
          {/* Logo */}
          <div className="py-2 xl:px-0">
            <div className="w-[50px] h-[50px] flex items-center justify-center hover:bg-white/10 rounded-full cursor-pointer transition-colors">
              <XLogo className="w-[30px] h-[30px]" />
            </div>
          </div>

          {/* Nav Items */}
          <nav className="mt-2 space-y-1 mb-4 flex-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href="#"
                className="group flex items-center xl:gap-5 p-3 w-fit xl:w-full hover:bg-white/10 rounded-full transition-colors"
              >
                <item.icon className={`w-[26px] h-[26px] ${item.active ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
                <span className={`hidden xl:block text-xl ${item.active ? "font-bold" : "font-normal"}`}>
                  {item.label}
                </span>
              </a>
            ))}
            
            {/* Post Button */}
            <button className="mt-4 w-[50px] h-[50px] xl:w-full xl:h-[52px] bg-[#1d9bf0] hover:bg-[#1a8cd8] rounded-full flex items-center justify-center transition-colors shadow-md">
              <div className="xl:hidden">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                  <path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.03C7.29 12.61 6 17.331 6 22h2c0-1.007.07-2.012.19-3H12c4.1 0 7.48-3.082 7.94-7.054C22.79 10.147 23.17 6.359 23 3zm-7 8h-1.5v2H16c.63-.016 1.2-.08 1.72-.188C16.95 15.24 14.68 17 12 17H8.55c.57-2.512 1.57-4.851 3-6.78 2.16-2.912 5.29-4.911 9.45-5.187C20.95 8.079 19.9 11 16 11zM4 9V6H1V4h3V1h2v3h3v2H6v3H4z" />
                </svg>
              </div>
              <span className="hidden xl:block text-white font-bold text-[17px]">Post</span>
            </button>
          </nav>

          {/* User Menu */}
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
              <DropdownMenuItem className="py-3 px-4 font-bold text-[15px] hover:bg-white/5 cursor-pointer">
                Add an existing account
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="py-3 px-4 font-bold text-[15px] hover:bg-white/5 cursor-pointer"
                onClick={logout}
              >
                Log out @{displayUser.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[600px] border-x border-[#2f3336] min-h-screen relative">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-black/65 backdrop-blur-md border-b border-[#2f3336]">
          <div className="px-4 h-[53px] flex items-center justify-between">
            <h1 className="text-xl font-bold">Nexus Search</h1>
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-[#2f3336]">
            <button 
              onClick={() => setActiveTab("for-you")}
              className="flex-1 h-[53px] hover:bg-white/10 transition-colors relative flex items-center justify-center"
            >
              <span className={`font-medium text-[15px] ${activeTab === "for-you" ? "font-bold text-[#e7e9ea]" : "text-[#71767b]"}`}>
                For you
                {activeTab === "for-you" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[56px] h-[4px] bg-[#1d9bf0] rounded-full" />
                )}
              </span>
            </button>
            <button 
              onClick={() => setActiveTab("trending")}
              className="flex-1 h-[53px] hover:bg-white/10 transition-colors relative flex items-center justify-center"
            >
              <span className={`font-medium text-[15px] ${activeTab === "trending" ? "font-bold text-[#e7e9ea]" : "text-[#71767b]"}`}>
                Trending
                {activeTab === "trending" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70px] h-[4px] bg-[#1d9bf0] rounded-full" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Indexing Banner */}
        <AnimatePresence>
          {isIndexing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-[#2f3336] bg-[#1d9bf0]/10 overflow-hidden"
            >
              <div className="px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 text-[#1d9bf0] animate-spin" />
                  <span className="text-[13px] text-[#1d9bf0] font-bold">Indexing Network...</span>
                </div>
                <Progress value={indexProgress} className="h-1 bg-[#1d9bf0]/20" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Input Area */}
        <div className="p-4 border-b border-[#2f3336]">
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
          
          {!hasSearched && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {[
                  "AI Founders",
                  "VCs in SF",
                  "Design Systems",
                  "Crypto Devs",
                  "Climate Tech",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSearch(tag)}
                    className="px-4 py-1.5 rounded-full border border-[#2f3336] text-[#1d9bf0] text-[14px] font-bold hover:bg-[#1d9bf0]/10 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {hasSearched ? (
          <div className="pb-20">
            {isSearching ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
              </div>
            ) : (
              searchResults.map((profile, i) => (
                <div key={profile.id} className="border-b border-[#2f3336] hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="p-4">
                    <ProfileCard 
                      profile={profile} 
                      onGenerateIntro={(p) => {
                        setSelectedProfile(p);
                        setIsIntroModalOpen(true);
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-[300px]">
              <h2 className="text-[31px] font-extrabold mb-2 leading-9">Find anyone in your network</h2>
              <p className="text-[#71767b] text-[15px] mb-8">
                Search for "Designers at Airbnb" or "Investors interested in AI" to unlock hidden connections.
              </p>
              <Button 
                onClick={handleStartIndexing}
                disabled={isIndexing}
                className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold rounded-full px-8 py-6 text-[17px]"
              >
                {isIndexing ? "Indexing..." : "Sync Network"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
      <aside className="hidden lg:block w-[350px] pl-8 py-3 h-screen sticky top-0">
        {/* Search Box */}
        <div className="sticky top-0 bg-black pb-3 z-10">
          <div className="group relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71767b] group-focus-within:text-[#1d9bf0]">
              <Search className="w-[18px] h-[18px]" />
            </div>
            <input
              placeholder="Search"
              className="w-full bg-[#202327] text-[#e7e9ea] placeholder:text-[#71767b] rounded-full py-2.5 pl-12 pr-4 outline-none border border-transparent focus:bg-black focus:border-[#1d9bf0]"
            />
          </div>
        </div>

        {/* Premium Box */}
        <div className="bg-[#16181c] rounded-2xl p-4 mb-4 border border-transparent">
          <h2 className="font-extrabold text-[20px] mb-2 leading-6">Subscribe to Premium</h2>
          <p className="text-[15px] leading-5 text-[#e7e9ea] mb-3">
            Subscribe to unlock new features and if eligible, receive a share of ads revenue.
          </p>
          <button className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold rounded-full px-4 py-1.5 transition-colors">
            Subscribe
          </button>
        </div>

        {/* Trends */}
        <div className="bg-[#16181c] rounded-2xl pt-3 mb-4 border border-transparent">
          <h2 className="font-extrabold text-[20px] px-4 mb-3">Trends for you</h2>
          {[
            { category: "Technology · Trending", name: "#AI", posts: "500K posts" },
            { category: "Business · Trending", name: "Nvidia", posts: "120K posts" },
            { category: "Politics · Trending", name: "Election", posts: "2M posts" },
          ].map((trend) => (
            <div key={trend.name} className="px-4 py-3 hover:bg-white/[0.03] cursor-pointer transition-colors relative">
              <div className="flex justify-between text-[#71767b] text-[13px]">
                <span>{trend.category}</span>
                <MoreHorizontal className="w-[18px] h-[18px] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full" />
              </div>
              <div className="font-bold text-[15px] my-0.5">{trend.name}</div>
              <div className="text-[#71767b] text-[13px]">{trend.posts}</div>
            </div>
          ))}
          <div className="p-4 text-[#1d9bf0] text-[15px] hover:bg-white/[0.03] rounded-b-2xl cursor-pointer transition-colors">
            Show more
          </div>
        </div>
      </aside>

      <IntroModal
        isOpen={isIntroModalOpen}
        onClose={() => setIsIntroModalOpen(false)}
        profile={selectedProfile}
        currentUser={displayUser}
      />
    </div>
  );
}
