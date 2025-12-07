"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  MessageSquare,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Filter,
  ChevronDown,
  Loader2,
  Search,
  Zap,
  Home,
  Bell,
  Mail,
  Bookmark,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
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

// Mock data for demo
const mockProfiles: Profile[] = [
  {
    id: "1",
    x_user_id: "123456",
    username: "sarahtech",
    name: "Sarah Chen",
    bio: "Building the future of AI @ Anthropic. Previously Google Brain. Stanford CS PhD. Passionate about safe AI development and research.",
    followers_count: 45200,
    following_count: 892,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    degree: 1,
    matchReason: "Works on AI safety, similar to your interests",
    topics: ["AI Safety", "Machine Learning", "Research"],
  },
  {
    id: "2",
    x_user_id: "234567",
    username: "vcmark",
    name: "Mark Thompson",
    bio: "General Partner @ Sequoia Capital. Investing in ambitious founders building transformative companies. Previously founder (2x exit).",
    followers_count: 128000,
    following_count: 1240,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=mark",
    degree: 2,
    matchReason: "Actively investing in AI startups",
    relevantTweet: "Just led our largest AI investment ever. The next decade belongs to AI-native companies.",
    topics: ["VC", "Startups", "AI Investment"],
  },
  {
    id: "3",
    x_user_id: "345678",
    username: "designerjess",
    name: "Jessica Wu",
    bio: "Head of Design @ Figma. Previously Airbnb, IDEO. Making design tools for everyone. Design systems enthusiast.",
    followers_count: 89300,
    following_count: 567,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=jessica",
    degree: 1,
    matchReason: "Connected through design community",
    topics: ["Design", "Product", "Design Systems"],
  },
  {
    id: "4",
    x_user_id: "456789",
    username: "cryptoalex",
    name: "Alex Rivera",
    bio: "Co-founder @ DeFi Protocol. Building decentralized financial infrastructure. Ex-Goldman Sachs. Stanford MBA.",
    followers_count: 67800,
    following_count: 2100,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    degree: 3,
    matchReason: "Mentioned blockchain + AI intersection",
    topics: ["DeFi", "Crypto", "Fintech"],
  },
  {
    id: "5",
    x_user_id: "567890",
    username: "climatefounder",
    name: "Emma Green",
    bio: "CEO @ CleanTech Ventures. Fighting climate change with technology. YC W21. Forbes 30 Under 30.",
    followers_count: 34500,
    following_count: 890,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
    degree: 2,
    matchReason: "Climate tech focus aligns with sustainability interests",
    relevantTweet: "Climate tech is having its moment. We need more builders in this space.",
    topics: ["Climate Tech", "Sustainability", "Startups"],
  },
  {
    id: "6",
    x_user_id: "678901",
    username: "neuroscientist",
    name: "Dr. James Park",
    bio: "Neuroscience researcher @ MIT. Studying brain-computer interfaces. Passionate about the intersection of neuroscience and AI.",
    followers_count: 23100,
    following_count: 445,
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
    degree: 2,
    matchReason: "Research overlaps with AI and neuroscience",
    topics: ["Neuroscience", "BCI", "AI Research"],
  },
];

const mockStats = {
  totalConnections: 2847,
  firstDegree: 342,
  secondDegree: 1205,
  thirdDegree: 1300,
  tweetsIndexed: 14280,
  profilesAnalyzed: 892,
};

const navItems = [
  { icon: Home, label: "Home", active: true },
  { icon: Search, label: "Explore", active: false },
  { icon: Bell, label: "Notifications", active: false },
  { icon: Mail, label: "Messages", active: false },
  { icon: Bookmark, label: "Bookmarks", active: false },
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
  const [filters, setFilters] = useState({
    degrees: [1, 2, 3] as number[],
    minFollowers: 0,
  });

  // Check demo mode from URL
  const [isDemo, setIsDemo] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsDemo(params.get("demo") === "true");
  }, []);

  // Redirect if not authenticated and not in demo mode
  useEffect(() => {
    if (!authLoading && !user && !isDemo) {
      router.push("/");
    }
  }, [authLoading, user, isDemo, router]);

  // Simulate search
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchQuery(query);
    setHasSearched(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Filter mock profiles based on query (in real app, this would be semantic search)
    const results = mockProfiles.filter((profile) =>
      filters.degrees.includes(profile.degree)
    );
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleGenerateIntro = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsIntroModalOpen(true);
  };

  const handleStartIndexing = async () => {
    setIsIndexing(true);
    setIndexProgress(0);

    // Simulate indexing progress
    const interval = setInterval(() => {
      setIndexProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsIndexing(false);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);
  };

  const toggleDegreeFilter = (degree: number) => {
    setFilters((prev) => ({
      ...prev,
      degrees: prev.degrees.includes(degree)
        ? prev.degrees.filter((d) => d !== degree)
        : [...prev.degrees, degree],
    }));
  };

  // Show loading state
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
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-[275px] h-screen sticky top-0 border-r border-white/10 px-3 py-4">
          {/* Logo */}
          <div className="px-3 mb-4">
            <div className="w-12 h-12 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer">
              <XLogo className="w-7 h-7" />
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`flex items-center gap-4 w-full px-4 py-3 rounded-full hover:bg-white/10 transition-colors ${
                  item.active ? "font-bold" : ""
                }`}
              >
                <item.icon className={`w-6 h-6 ${item.active ? "" : "opacity-80"}`} />
                <span className="text-xl">{item.label}</span>
              </button>
            ))}
            
            {/* Nexus-specific nav */}
            <div className="pt-4 mt-4 border-t border-white/10">
              <button className="flex items-center gap-4 w-full px-4 py-3 rounded-full bg-[#1d9bf0]/10 text-[#1d9bf0] font-bold">
                <Sparkles className="w-6 h-6" />
                <span className="text-xl">Nexus Search</span>
              </button>
            </div>
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-3 rounded-full hover:bg-white/10 transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={displayUser.profile_image_url} />
                  <AvatarFallback>{displayUser.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left hidden xl:block">
                  <div className="font-bold text-sm truncate">{displayUser.name}</div>
                  <div className="text-gray-500 text-sm">@{displayUser.username}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 hidden xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-black border-white/20">
              <DropdownMenuLabel className="text-gray-400">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="hover:bg-white/10 cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="hover:bg-white/10 cursor-pointer text-red-400"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen border-r border-white/10 max-w-[600px]">
          {/* Header */}
          <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/10">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Nexus</h1>
                <p className="text-sm text-gray-500">AI-powered network search</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 hover:bg-white/10 rounded-full"
                onClick={handleStartIndexing}
                disabled={isIndexing}
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Indexing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            {/* Indexing progress bar */}
            <AnimatePresence>
              {isIndexing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-3 border-t border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <Zap className="w-4 h-4 text-[#1d9bf0] animate-pulse" />
                    <div className="flex-1">
                      <Progress value={indexProgress} className="h-1" />
                    </div>
                    <span className="text-sm font-mono text-[#1d9bf0]">
                      {Math.round(indexProgress)}%
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          {/* Search Section */}
          <div className="p-4 border-b border-white/10">
            <SearchBar onSearch={handleSearch} isLoading={isSearching} />
          </div>

          {/* Filters */}
          {hasSearched && (
            <motion.div
              className="px-4 py-3 border-b border-white/10 flex items-center justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-sm text-gray-500">
                {searchResults.length} results for &ldquo;{searchQuery}&rdquo;
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-white/20 hover:bg-white/10 rounded-full">
                    <Filter className="w-4 h-4" />
                    Filter
                    <Badge variant="secondary" className="ml-1 text-xs bg-[#1d9bf0]/20 text-[#1d9bf0]">
                      {filters.degrees.length}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-black border-white/20">
                  <DropdownMenuLabel className="text-gray-400">Connection Degree</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {[1, 2, 3].map((degree) => (
                    <DropdownMenuCheckboxItem
                      key={degree}
                      checked={filters.degrees.includes(degree)}
                      onCheckedChange={() => toggleDegreeFilter(degree)}
                      className="hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          degree === 1 ? "bg-[#1d9bf0]" : degree === 2 ? "bg-[#00ba7c]" : "bg-[#f91880]"
                        }`} />
                        {degree === 1 ? "1st" : degree === 2 ? "2nd" : "3rd"} Degree
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}

          {/* Results */}
          <AnimatePresence mode="wait">
            {isSearching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-[#1d9bf0] animate-spin" />
                  <Sparkles className="w-5 h-5 text-[#1d9bf0] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500">Searching your network with AI...</p>
              </motion.div>
            ) : hasSearched ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-white/10"
              >
                {searchResults.map((profile, index) => (
                  <div key={profile.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <ProfileCard
                      profile={profile}
                      onGenerateIntro={handleGenerateIntro}
                      index={index}
                    />
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center px-8"
              >
                <div className="w-16 h-16 rounded-full bg-[#1d9bf0]/10 flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-[#1d9bf0]" />
                </div>
                <h3 className="text-xl font-bold mb-2">Search your network</h3>
                <p className="text-gray-500 max-w-sm">
                  Use natural language to find people. Try &ldquo;VCs investing in AI&rdquo; or &ldquo;Designers at startups&rdquo;.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Sidebar - Stats */}
        <aside className="hidden xl:block w-[350px] h-screen sticky top-0 p-4">
          <div className="space-y-4">
            {/* Network stats */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-4">
              <h3 className="font-bold mb-4">Your Network</h3>
              <div className="space-y-3">
                <StatRow
                  icon={Users}
                  label="Total Connections"
                  value={mockStats.totalConnections.toLocaleString()}
                  color="text-[#1d9bf0]"
                />
                <StatRow
                  icon={MessageSquare}
                  label="Tweets Indexed"
                  value={mockStats.tweetsIndexed.toLocaleString()}
                  color="text-[#00ba7c]"
                />
                <StatRow
                  icon={Sparkles}
                  label="Profiles Analyzed"
                  value={mockStats.profilesAnalyzed.toLocaleString()}
                  color="text-[#f91880]"
                />
                <StatRow
                  icon={TrendingUp}
                  label="Network Growth"
                  value="+12%"
                  color="text-[#ffd400]"
                />
              </div>
            </div>

            {/* Degree breakdown */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-4">
              <h3 className="font-bold mb-4">Connection Degrees</h3>
              <div className="space-y-3">
                <DegreeBar
                  label="1st Degree"
                  value={mockStats.firstDegree}
                  total={mockStats.totalConnections}
                  color="bg-[#1d9bf0]"
                />
                <DegreeBar
                  label="2nd Degree"
                  value={mockStats.secondDegree}
                  total={mockStats.totalConnections}
                  color="bg-[#00ba7c]"
                />
                <DegreeBar
                  label="3rd Degree"
                  value={mockStats.thirdDegree}
                  total={mockStats.totalConnections}
                  color="bg-[#f91880]"
                />
              </div>
            </div>

            {/* Demo mode notice */}
            {isDemo && (
              <div className="rounded-2xl bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 p-4">
                <div className="flex items-center gap-2 text-[#1d9bf0] text-sm font-medium mb-2">
                  <Zap className="w-4 h-4" />
                  Demo Mode
                </div>
                <p className="text-sm text-gray-400">
                  You&apos;re viewing sample data. Sign in with X to see your real network.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Intro Modal */}
      <IntroModal
        isOpen={isIntroModalOpen}
        onClose={() => setIsIntroModalOpen(false)}
        profile={selectedProfile}
        currentUser={displayUser}
      />
    </div>
  );
}

// Stat Row Component
function StatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// Degree Bar Component
function DegreeBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = (value / total) * 100;
  
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-medium">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
