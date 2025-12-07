"use client";

import {
  MessageSquare,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { XLogo } from "@/components/ui/logos";

export interface Profile {
  id: string;
  x_user_id: string;
  username: string;
  name: string;
  bio: string;
  summary?: string;
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

export function ProfileCard({ profile, onGenerateIntro }: ProfileCardProps) {
  const profileUrl = `https://x.com/${profile.username}`;

  return (
    <div className="flex gap-3">
      {/* Avatar - clickable */}
      <a 
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0"
      >
        <Avatar className="w-12 h-12 hover:opacity-80 cursor-pointer transition-opacity">
          <AvatarImage src={profile.profile_image_url} alt={profile.name} />
          <AvatarFallback className="bg-[#333] text-white font-bold">
            {profile.name?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </a>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <a 
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[15px] text-[#e7e9ea] hover:underline truncate"
          >
            {profile.name}
          </a>
          {profile.degree && (profile.degree === 1 || profile.degree === 2) && (
            <Badge 
              variant="secondary" 
              className={`text-xs font-bold px-2 py-0 shrink-0 ${
                profile.degree === 1 ? "bg-[#1d9bf0] text-white" : "bg-[#00ba7c] text-white"
              }`}
            >
              {profile.degree === 1 ? "1st" : "2nd"}
            </Badge>
          )}
        </div>
        
        {/* Username */}
        <a 
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#71767b] text-[15px] hover:underline"
        >
          @{profile.username}
        </a>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-2 text-[15px] text-[#e7e9ea] line-clamp-2">
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-2 text-[13px] text-[#71767b]">
          <span><strong className="text-[#e7e9ea]">{formatCount(profile.followers_count)}</strong> followers</span>
          <span><strong className="text-[#e7e9ea]">{formatCount(profile.following_count)}</strong> following</span>
        </div>

        {/* Match Reason / Insight */}
        {profile.matchReason && (
          <div className="mt-3 flex items-start gap-2 text-[13px] p-2 rounded-lg bg-[#1d9bf0]/10 border border-[#1d9bf0]/20">
            <Sparkles className="w-4 h-4 text-[#1d9bf0] shrink-0 mt-0.5" />
            <span className="text-[#e7e9ea]">{profile.matchReason}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 mt-3">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onGenerateIntro(profile);
            }}
            className="flex items-center gap-2 text-[#71767b] hover:text-[#1d9bf0] transition-colors px-3 py-1.5 rounded-full hover:bg-[#1d9bf0]/10"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[13px] font-medium">Generate Intro</span>
          </button>
          
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white text-black opacity-100 hover:bg-white/90 transition-colors px-4 py-1.5 rounded-full font-bold"
          >
            <span className="text-[13px] text-black">View on</span>
            <XLogo className="w-3.5 h-3.5 text-black" />
          </a>
        </div>
      </div>
    </div>
  );
}
