"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Home,
  Users,
  Loader2,
  MoreHorizontal,
  LogOut,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import GraphVisualization from "@/components/GraphVisualization";
import { XLogo, GrokLogo } from "@/components/ui/logos";

interface NetworkProfile {
  x_user_id: string;
  username: string;
  name: string;
  bio: string;
  profile_image_url: string;
  followers_count: number;
  following_count: number;
  degree: 1 | 2;
}

const navItems = [
  { icon: Home, label: "Home", href: "/dashboard", active: false },
  { icon: Users, label: "Network", href: "/network", active: true },
];

export default function NetworkPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [edges, setEdges] = useState<{ source: string; target: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "1st" | "2nd">("all");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedProfile, setSelectedProfile] = useState<NetworkProfile | null>(null);
  const [bridgeProfile, setBridgeProfile] = useState<NetworkProfile | null>(null);
  const [topicMode, setTopicMode] = useState(false);
  const [topicData, setTopicData] = useState<{ user_id: string; topic: string; topic_confidence: number }[]>([]);
  const [topicColors, setTopicColors] = useState<{ [key: string]: string }>({});
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchNetwork();
    }
  }, [user]);

  const fetchNetwork = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/network");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
        setEdges(data.edges || []);
      }
    } catch (error) {
      console.error("Failed to fetch network:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTopicClusters = async () => {
    if (!user?.x_user_id || topicData.length > 0) return;
    
    setLoadingTopics(true);
    try {
      // Fetch topic colors first
      const colorsResponse = await fetch('http://localhost:8000/api/graph/topics/colors');
      if (colorsResponse.ok) {
        const colorsData = await colorsResponse.json();
        setTopicColors(colorsData.colors);
      }

      // Fetch topic clustering
      const response = await fetch('http://localhost:8000/api/graph/topics/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x_user_id: user.x_user_id })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTopicData(data);
      }
    } catch (error) {
      console.error('Failed to fetch topic clusters:', error);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Fetch topics when topic mode is enabled
  useEffect(() => {
    if (topicMode && user?.x_user_id && topicData.length === 0) {
      fetchTopicClusters();
    }
  }, [topicMode, user]);

  const handleNodeClick = (node: any) => {
    // Find full profile data from id
    const profile = profiles.find(p => p.x_user_id === node.id);
    if (profile) {
      setSelectedProfile(profile);
      
      // Calculate bridge for 2nd degree connections
      if (profile.degree === 2) {
        // Find an edge connecting to this profile from a 1st degree profile
        const edge = edges.find(e => 
          (e.target === profile.x_user_id || e.source === profile.x_user_id) && 
          profiles.find(p => p.x_user_id === (e.target === profile.x_user_id ? e.source : e.target))?.degree === 1
        );
        
        if (edge) {
          const bridgeId = edge.target === profile.x_user_id ? edge.source : edge.target;
          const bridge = profiles.find(p => p.x_user_id === bridgeId);
          setBridgeProfile(bridge || null);
        } else {
          setBridgeProfile(null);
        }
      } else {
        setBridgeProfile(null);
      }
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
    x_user_id: "demo-user",
    name: "Demo User",
    username: "demouser",
    profile_image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo",
  };

  const filteredProfiles = activeTab === "all" 
    ? profiles 
    : profiles.filter(p => p.degree === (activeTab === "1st" ? 1 : 2));

  const firstDegreeCount = profiles.filter(p => p.degree === 1).length;
  const secondDegreeCount = profiles.filter(p => p.degree === 2).length;

  return (
    <div className="min-h-screen bg-black text-[#e7e9ea] flex">
      {/* Left Sidebar */}
      <header className="hidden sm:flex flex-col items-end w-[88px] xl:w-[275px] h-screen sticky top-0 px-2 shrink-0">
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
             {/* ... (same dropdown) */}
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
      <main className="flex-1 min-w-0 border-x border-[#2f3336] min-h-screen">
        <div className="sticky top-0 z-50 bg-black/65 backdrop-blur-md border-b border-[#2f3336]">
          <div className="px-4 py-3 flex items-center gap-4">
            <a href="/dashboard" className="hover:bg-white/10 rounded-full p-2 -ml-2 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Your Extended Network</h1>
              <p className="text-[13px] text-[#71767b]">{profiles.length} connections</p>
            </div>
          </div>
          
          {/* View Mode Tabs */}
          <div className="flex border-b border-[#2f3336]">
            <button
              onClick={() => setViewMode("list")}
              className="flex-1 h-[53px] hover:bg-white/10 transition-colors relative flex items-center justify-center"
            >
              <span className={`font-medium text-[15px] ${viewMode === "list" ? "font-bold text-[#e7e9ea]" : "text-[#71767b]"}`}>
                List View
                {viewMode === "list" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70px] h-[4px] bg-[#1d9bf0] rounded-full" />
                )}
              </span>
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className="flex-1 h-[53px] hover:bg-white/10 transition-colors relative flex items-center justify-center"
            >
              <span className={`font-medium text-[15px] ${viewMode === "graph" ? "font-bold text-[#e7e9ea]" : "text-[#71767b]"}`}>
                Graph View
                {viewMode === "graph" && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70px] h-[4px] bg-[#1d9bf0] rounded-full" />
                )}
              </span>
            </button>
          </div>

          {/* Topic Mode Toggle for Graph View */}
          {viewMode === "graph" && (
            <div className="flex items-center justify-center p-3 border-b border-[#2f3336] bg-[#16181c]">
              <button
                onClick={() => setTopicMode(!topicMode)}
                disabled={loadingTopics}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                  topicMode 
                    ? "bg-[#1d9bf0] text-white hover:bg-[#1a8cd8]" 
                    : "bg-[#2f3336] text-[#e7e9ea] hover:bg-[#3f4346]"
                }`}
              >
                {loadingTopics ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GrokLogo className="w-4 h-4" />
                )}
                {topicMode ? "Network Pulse ON" : "Enable Network Pulse"}
              </button>
              {topicMode && (
                <span className="ml-3 text-xs text-[#71767b]">
                  Nodes colored by topic clusters
                </span>
              )}
            </div>
          )}

          {/* Sub-tabs for List View */}
          {viewMode === "list" && (
            <div className="flex border-b border-[#2f3336]">
              {[
                { id: "all", label: "All", count: profiles.length },
                { id: "1st", label: "1st Degree", count: firstDegreeCount },
                { id: "2nd", label: "2nd Degree", count: secondDegreeCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className="flex-1 h-[44px] hover:bg-white/10 transition-colors relative flex items-center justify-center"
                >
                  <span className={`text-[14px] ${activeTab === tab.id ? "font-bold text-[#e7e9ea]" : "text-[#71767b]"}`}>
                    {tab.label} <span className="ml-1 text-[12px] opacity-70">({tab.count})</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex justify-center py-20 h-[calc(100vh-120px)] items-center">
            <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
          </div>
        ) : viewMode === "list" ? (
          <div className="max-w-[600px] mx-auto">
            {filteredProfiles.length > 0 ? (
              <div>
                {filteredProfiles.map((profile, index) => (
                  <motion.div
                    key={profile.x_user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    className="border-b border-[#2f3336] hover:bg-white/[0.03] transition-colors p-4 cursor-pointer"
                    onClick={() => {
                        setSelectedProfile(profile);
                        // Trigger bridge calculation if needed
                        if (profile.degree === 2) {
                             const edge = edges.find(e => 
                              (e.target === profile.x_user_id || e.source === profile.x_user_id) && 
                              profiles.find(p => p.x_user_id === (e.target === profile.x_user_id ? e.source : e.target))?.degree === 1
                            );
                            if (edge) {
                              const bridgeId = edge.target === profile.x_user_id ? edge.source : edge.target;
                              const bridge = profiles.find(p => p.x_user_id === bridgeId);
                              setBridgeProfile(bridge || null);
                            }
                        }
                    }}
                  >
                    <div className="flex gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile.profile_image_url} />
                        <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[15px] hover:underline cursor-pointer truncate">
                            {profile.name}
                          </span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs font-bold px-2 py-0 ${
                              profile.degree === 1 ? "bg-[#1d9bf0] text-white" : "bg-[#00ba7c] text-white"
                            }`}
                          >
                            {profile.degree === 1 ? "1st" : "2nd"}
                          </Badge>
                        </div>
                        <p className="text-[#71767b] text-[15px] mb-2">@{profile.username}</p>
                        {profile.bio && (
                          <p className="text-[15px] text-[#e7e9ea] line-clamp-2">{profile.bio}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-[#71767b] text-[13px]">
                          <span><strong className="text-white">{profile.followers_count.toLocaleString()}</strong> followers</span>
                          <span><strong className="text-white">{profile.following_count.toLocaleString()}</strong> following</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <Users className="w-12 h-12 text-[#71767b] mb-4" />
                <h3 className="text-xl font-bold mb-2">No connections yet</h3>
                <p className="text-[#71767b] text-[15px] mb-6">
                  Sync your network to start exploring connections
                </p>
                <a 
                  href="/dashboard"
                  className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold rounded-full px-6 py-3 transition-colors"
                >
                  Go to Nexus Search
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[calc(100vh-106px)] w-full relative">
            <GraphVisualization 
              profiles={profiles} 
              edges={edges} 
              currentUser={displayUser}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedProfile?.x_user_id}
              topicData={topicData}
              topicColors={topicColors}
              enableTopicMode={topicMode}
            />
          </div>
        )}
      </main>

      <Sheet open={!!selectedProfile} onOpenChange={() => setSelectedProfile(null)}>
        <SheetContent className="bg-black/40 backdrop-blur-xl border-l border-white/10 text-[#e7e9ea] sm:max-w-[400px] shadow-2xl">
          {selectedProfile && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl font-bold text-[#e7e9ea]">Profile Details</SheetTitle>
                <SheetDescription className="hidden">Profile information</SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="w-24 h-24 mb-4 border-4 border-black ring-1 ring-[#2f3336]">
                    <AvatarImage src={selectedProfile.profile_image_url} />
                    <AvatarFallback>{selectedProfile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">{selectedProfile.name}</h2>
                  <p className="text-[#71767b]">@{selectedProfile.username}</p>
                  <Badge 
                    variant="secondary" 
                    className={`mt-2 ${
                      selectedProfile.degree === 1 ? "bg-[#1d9bf0] text-white" : "bg-[#00ba7c] text-white"
                    }`}
                  >
                    {selectedProfile.degree === 1 ? "1st Degree Connection" : "2nd Degree Connection"}
                  </Badge>
                </div>

                {selectedProfile.degree === 2 && bridgeProfile && (
                  <div className="bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 rounded-xl p-4">
                    <h4 className="text-[#1d9bf0] font-bold text-sm mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Introduction Path
                    </h4>
                    <p className="text-[14px] leading-relaxed">
                      Ask <span className="font-bold text-white">@{bridgeProfile.username}</span> to introduce you to <span className="font-bold text-white">@{selectedProfile.username}</span>.
                    </p>
                    <div className="flex items-center gap-2 mt-3 justify-center text-xs text-[#71767b]">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#1d9bf0]"></div> You
                      </div>
                      <div className="w-4 h-[1px] bg-[#2f3336]"></div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#00ba7c]"></div> @{bridgeProfile.username}
                      </div>
                      <div className="w-4 h-[1px] bg-[#2f3336]"></div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#71767b]"></div> @{selectedProfile.username}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-[#71767b] mb-1">Bio</h3>
                    <p className="text-[15px]">{selectedProfile.bio || "No bio available"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#16181c] p-3 rounded-xl">
                      <p className="text-xs text-[#71767b] uppercase tracking-wider mb-1">Followers</p>
                      <p className="text-lg font-bold">{selectedProfile.followers_count.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#16181c] p-3 rounded-xl">
                      <p className="text-xs text-[#71767b] uppercase tracking-wider mb-1">Following</p>
                      <p className="text-lg font-bold">{selectedProfile.following_count.toLocaleString()}</p>
                    </div>
                  </div>

                  <a
                    href={`https://x.com/${selectedProfile.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full bg-white/100 hover:bg-white/70 font-bold h-[40px] rounded-full transition-colors mt-4 text-black shadow-lg"
                  >
                    <span className="text-5 text-black">View on</span>
                    <XLogo className="w-4 h-4 ml-1 text-black" />
                  </a>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
