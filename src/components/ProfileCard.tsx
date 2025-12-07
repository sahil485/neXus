"use client";

import { useState } from "react";
import { 
  MessageSquare, 
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="w-10 h-10 hover:opacity-90 cursor-pointer transition-opacity">
          <AvatarImage src={profile.profile_image_url} alt={profile.name} />
          <AvatarFallback className="bg-[#333] text-white font-bold">
            {profile.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="group cursor-pointer">
            <div className="flex items-center gap-1">
              <span className="font-bold text-[15px] text-[#e7e9ea] group-hover:underline truncate">
                {profile.name}
              </span>
              {profile.degree && (profile.degree === 1 || profile.degree === 2) && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-bold px-2 py-0 ${
                    profile.degree === 1 ? "bg-[#1d9bf0] text-white" : "bg-[#00ba7c] text-white"
                  }`}
                >
                  {profile.degree === 1 ? "1st" : "2nd"}
                </Badge>
              )}
              <span className="text-[#71767b] text-[15px] truncate">@{profile.username}</span>
            </div>
          </div>
          <button className="text-[#71767b] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 p-2 -mr-2 rounded-full transition-colors">
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Bio / Content */}
        <div className="mt-0.5 text-[15px] text-[#e7e9ea] whitespace-pre-wrap leading-5">
          {profile.bio}
        </div>

        {/* Nexus Insight (Match Reason) */}
        {profile.matchReason && (
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[#71767b]">
            <Sparkles className="w-4 h-4 text-[#1d9bf0]" />
            <span className="font-medium text-[#1d9bf0]">Nexus Insight:</span>
            <span>{profile.matchReason}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between mt-3 max-w-[425px]">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onGenerateIntro(profile);
            }}
            className="group flex items-center gap-2 text-[#71767b] hover:text-[#1d9bf0] transition-colors"
          >
            <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 transition-colors -ml-2">
              <MessageSquare className="w-[18px] h-[18px]" />
            </div>
            <span className="text-[13px] group-hover:text-[#1d9bf0]">Intro</span>
          </button>

          {/* Follow Button (Right aligned) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFollowing(!isFollowing);
            }}
            className={`
              h-[32px] px-4 rounded-full font-bold text-[14px] transition-colors border
              ${isFollowing 
                ? "bg-transparent text-[#e7e9ea] border-[#536471] hover:border-[#f4212e] hover:text-[#f4212e] hover:bg-[#f4212e]/10 group" 
                : "bg-[#eff3f4] text-[#0f1419] border-transparent hover:bg-[#d7dbdc]"
              }
            `}
          >
            {isFollowing ? (
              <span className="group-hover:hidden">Following</span>
            ) : (
              "Follow"
            )}
            {isFollowing && <span className="hidden group-hover:block">Unfollow</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
