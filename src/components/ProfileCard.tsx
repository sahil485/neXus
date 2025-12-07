"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  MessageSquare, 
  ExternalLink,
  Sparkles,
  Quote,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Profile {
  id: string;
  x_user_id: string;
  username: string;
  name: string;
  bio: string;
  followers_count: number;
  following_count: number;
  profile_image_url: string;
  degree: 1 | 2 | 3;
  relevantTweet?: string;
  matchReason?: string;
  topics?: string[];
}

interface ProfileCardProps {
  profile: Profile;
  onGenerateIntro: (profile: Profile) => void;
  index?: number;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + "K";
  }
  return count.toString();
}

// X Logo SVG Component
function XLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ProfileCard({ profile, onGenerateIntro, index = 0 }: ProfileCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const degreeConfig = {
    1: { 
      label: "1st", 
      bgColor: "bg-[#1d9bf0]",
      textColor: "text-[#1d9bf0]",
      description: "Direct connection"
    },
    2: { 
      label: "2nd", 
      bgColor: "bg-[#00ba7c]",
      textColor: "text-[#00ba7c]",
      description: "Friend of friend"
    },
    3: { 
      label: "3rd", 
      bgColor: "bg-[#f91880]",
      textColor: "text-[#f91880]",
      description: "Extended network"
    },
  };

  const degree = degreeConfig[profile.degree];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full"
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar className="w-12 h-12">
            <AvatarImage src={profile.profile_image_url} alt={profile.name} />
            <AvatarFallback className="bg-gray-800 text-white font-bold">
              {profile.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-bold hover:underline cursor-pointer truncate">
                {profile.name}
              </span>
              <span className="text-gray-500 truncate">@{profile.username}</span>
              <span className="text-gray-500">·</span>
              <Badge 
                variant="secondary" 
                className={`${degree.bgColor} text-white text-xs font-bold px-2 py-0`}
              >
                {degree.label}
              </Badge>
            </div>
            <button className="p-2 -m-2 rounded-full hover:bg-[#1d9bf0]/10 text-gray-500 hover:text-[#1d9bf0] transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Bio */}
          <p className="text-[15px] leading-normal mt-1 text-gray-100">
            {profile.bio || "No bio available"}
          </p>

          {/* Match reason */}
          {profile.matchReason && (
            <div className="mt-2 flex items-start gap-2 text-sm">
              <Sparkles className={`w-4 h-4 ${degree.textColor} mt-0.5 flex-shrink-0`} />
              <span className="text-gray-400">
                <span className={`${degree.textColor} font-medium`}>Match: </span>
                {profile.matchReason}
              </span>
            </div>
          )}

          {/* Relevant tweet */}
          {profile.relevantTweet && (
            <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/10">
              <div className="flex items-start gap-2 text-sm">
                <Quote className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-gray-300 italic line-clamp-2">
                  &ldquo;{profile.relevantTweet}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Topics */}
          {profile.topics && profile.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.topics.slice(0, 4).map((topic) => (
                <span
                  key={topic}
                  className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400 hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] transition-colors cursor-pointer"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Stats & Actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span><strong className="text-white">{formatCount(profile.followers_count)}</strong> followers</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onGenerateIntro(profile)}
                className="bg-white text-black font-bold rounded-full hover:bg-white/90 transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                Intro
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 hover:bg-white/10 rounded-full"
                asChild
              >
                <a
                  href={`https://x.com/${profile.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <XLogo className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
