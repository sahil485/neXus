"use client";

import { useState } from "react";
import { 
  MessageSquare, 
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
              {/* Verified Badge (optional) */}
              {/* <svg viewBox="0 0 24 24" aria-label="Verified account" className="w-[18px] h-[18px] text-[#1d9bf0] fill-current"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.238 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" /></g></svg> */}
              <span className="text-[#71767b] text-[15px] truncate">@{profile.username}</span>
              <span className="text-[#71767b] text-[15px] px-1">·</span>
              <span className="text-[#71767b] text-[15px] hover:underline">2h</span>
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
