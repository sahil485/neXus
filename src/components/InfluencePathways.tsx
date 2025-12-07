"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

interface BridgeScore {
  bridge_user_id: string;
  bridge_username: string;
  bridge_name: string;
  bridge_profile_image: string;
  overall_score: number;
  success_probability: number;
  topic_alignment: number;
  influence_score: number;
  engagement_quality: number;
  reason: string;
  suggested_approach: string;
}

interface PathwayData {
  target_user_id: string;
  target_username: string;
  target_name: string;
  target_bio: string;
  bridges: BridgeScore[];
  total_bridges_found: number;
}

interface InfluencePathwaysProps {
  yourUserId: string;
  targetUserId: string;
  targetName: string;
  onClose?: () => void;
}

export default function InfluencePathways({ 
  yourUserId, 
  targetUserId, 
  targetName,
  onClose 
}: InfluencePathwaysProps) {
  const [pathways, setPathways] = useState<PathwayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBridge, setSelectedBridge] = useState<BridgeScore | null>(null);

  // Fetch pathways on mount
  useState(() => {
    fetchPathways();
  });

  const fetchPathways = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/pathways/pathways/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x_user_id: yourUserId,
          target_user_id: targetUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pathways: ${response.statusText}`);
      }

      const data = await response.json();
      setPathways(data);
      
      // Auto-select best bridge
      if (data.bridges && data.bridges.length > 0) {
        setSelectedBridge(data.bridges[0]);
      }
    } catch (error) {
      console.error('Error fetching pathways:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (score >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#1d9bf0] animate-spin" />
      </div>
    );
  }

  if (!pathways || pathways.bridges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-8">
        <Users className="w-12 h-12 text-[#71767b] mb-4" />
        <h3 className="text-xl font-bold mb-2">No Direct Path Found</h3>
        <p className="text-[#71767b] text-[15px]">
          No mutual connections found between you and {targetName}.
          Try exploring their network or grow your own connections.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-[#e7e9ea]">
      {/* Header */}
      <div className="p-6 border-b border-[#2f3336]">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-5 h-5 text-[#1d9bf0]" />
          <h2 className="text-xl font-bold">Influence Pathways</h2>
        </div>
        <p className="text-[#71767b] text-sm">
          {pathways.total_bridges_found} way{pathways.total_bridges_found !== 1 ? 's' : ''} to reach{' '}
          <span className="text-[#e7e9ea] font-bold">@{pathways.target_username}</span>
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Bridge List */}
        <div className="w-2/5 border-r border-[#2f3336] overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-bold text-[#71767b] uppercase tracking-wider mb-3">
              Ranked Bridges
            </h3>
            <div className="space-y-2">
              {pathways.bridges.map((bridge, index) => (
                <motion.button
                  key={bridge.bridge_user_id}
                  onClick={() => setSelectedBridge(bridge)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`w-full p-3 rounded-xl transition-all text-left ${
                    selectedBridge?.bridge_user_id === bridge.bridge_user_id
                      ? 'bg-[#1d9bf0]/10 border border-[#1d9bf0]/30'
                      : 'bg-[#16181c] hover:bg-[#1d1f23] border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={bridge.bridge_profile_image} />
                      <AvatarFallback>{bridge.bridge_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-sm truncate">{bridge.bridge_name}</span>
                        {index === 0 && (
                          <Badge className="bg-[#1d9bf0] text-white text-xs px-2 py-0">
                            Best
                          </Badge>
                        )}
                      </div>
                      <p className="text-[#71767b] text-xs mb-2">@{bridge.bridge_username}</p>
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${getScoreColor(bridge.success_probability)}`}>
                          {Math.round(bridge.success_probability)}% success
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Bridge Details */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedBridge && (
              <motion.div
                key={selectedBridge.bridge_user_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6"
              >
                {/* Bridge Profile */}
                <div className="flex items-start gap-4 mb-6">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedBridge.bridge_profile_image} />
                    <AvatarFallback>{selectedBridge.bridge_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{selectedBridge.bridge_name}</h3>
                    <p className="text-[#71767b]">@{selectedBridge.bridge_username}</p>
                  </div>
                </div>

                {/* Success Probability */}
                <div className="bg-[#1d9bf0]/10 border border-[#1d9bf0]/30 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-[#71767b]">Success Probability</span>
                    <span className={`text-2xl font-bold ${getScoreColor(selectedBridge.success_probability)}`}>
                      {Math.round(selectedBridge.success_probability)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#16181c] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedBridge.success_probability}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-[#1d9bf0] to-[#00ba7c]"
                    />
                  </div>
                </div>

                {/* Why This Works */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-[#71767b] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Why This Works
                  </h4>
                  <p className="text-[15px] leading-relaxed">{selectedBridge.reason}</p>
                </div>

                {/* Score Breakdown */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-[#71767b] uppercase tracking-wider mb-3">
                    Score Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Topic Alignment</span>
                        <span className={`text-sm font-bold ${getScoreColor(selectedBridge.topic_alignment)}`}>
                          {Math.round(selectedBridge.topic_alignment)}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#16181c] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#1d9bf0]" 
                          style={{ width: `${selectedBridge.topic_alignment}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Influence Score</span>
                        <span className={`text-sm font-bold ${getScoreColor(selectedBridge.influence_score)}`}>
                          {Math.round(selectedBridge.influence_score)}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#16181c] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#00ba7c]" 
                          style={{ width: `${selectedBridge.influence_score}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Engagement Quality</span>
                        <span className={`text-sm font-bold ${getScoreColor(selectedBridge.engagement_quality)}`}>
                          {Math.round(selectedBridge.engagement_quality)}/100
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#16181c] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#f91880]" 
                          style={{ width: `${selectedBridge.engagement_quality}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggested Approach */}
                <div className="bg-[#16181c] rounded-xl p-4">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1d9bf0]" />
                    Suggested Approach
                  </h4>
                  <p className="text-[15px] text-[#71767b] italic leading-relaxed mb-4">
                    "{selectedBridge.suggested_approach}"
                  </p>
                  <a 
                    href={`https://x.com/${selectedBridge.bridge_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold h-[40px] rounded-full transition-colors"
                  >
                    Send Message
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
