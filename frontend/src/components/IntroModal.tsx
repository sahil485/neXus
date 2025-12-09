"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { XLogo, GrokLogo } from "@/components/ui/logos";
import type { Profile } from "./ProfileCard";

interface IntroModalProps {
  numMutuals?: number;
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  bridgeProfiles?: Profile[];
  currentUser?: {
    name: string;
    username: string;
    profile_image_url?: string;
  };
  onRegenerate?: () => void;
  isLoading?: boolean;
}

const MAX_CHARS = 280;

export function IntroModal({
  isOpen,
  onClose,
  profile,
  bridgeProfiles = [],
  currentUser,
  onRegenerate,
  isLoading = false,
  numMutuals,
}: IntroModalProps) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBridgeProfile, setSelectedBridgeProfile] = useState<Profile | undefined>(
    bridgeProfiles.length > 0 ? bridgeProfiles[0] : undefined
  );
  const [messageType, setMessageType] = useState<"direct" | "mutual">(
    profile?.degree === 2 && bridgeProfiles.length > 0 ? "mutual" : "direct"
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update selected bridge when bridgeProfiles changes
  useEffect(() => {
    if (bridgeProfiles.length > 0) {
      setSelectedBridgeProfile(bridgeProfiles[0]);
      setMessageType("mutual");
    } else {
      setSelectedBridgeProfile(undefined);
    }
  }, [bridgeProfiles]);

  // Generate intro with Grok when modal opens
  const generateIntro = async () => {
    if (!profile) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // For "Use Mutual", use the simple template message - no AI call needed
    if (messageType === "mutual" && selectedBridgeProfile) {
      setIsGenerating(false);
      setMessage(generateSampleIntro(profile, currentUser, selectedBridgeProfile));
      return;
    }

    // For "Message Directly", use AI to generate personalized message
    setIsGenerating(true);
    setError(null);

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/generate-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          bridgeProfile: null, // Always null for direct messages
          currentUser
        }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error("Failed to generate");

      const data = await response.json();

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setMessage(data.message);
      }
    } catch (e: any) {
      // Don't show error if request was aborted
      if (e.name === 'AbortError') {
        console.log("Request cancelled");
        return;
      }
      console.error("Error generating intro:", e);
      setError("Failed to generate intro. Please try again.");
      // Fallback to sample
      setMessage(generateSampleIntro(profile, currentUser, undefined));
    } finally {
      if (!abortController.signal.aborted) {
        setIsGenerating(false);
      }
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && profile) {
      generateIntro();
    }

    // Cleanup: abort request when component unmounts or modal closes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, profile, messageType, selectedBridgeProfile]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    generateIntro();
    onRegenerate?.();
  };

  const handleOpenDM = () => {
    const targetProfile = messageType === "mutual" && selectedBridgeProfile ? selectedBridgeProfile : profile;
    if (targetProfile) {
      window.open(
        `https://twitter.com/messages/compose?recipient_id=${targetProfile.x_user_id}&text=${encodeURIComponent(message)}`,
        "_blank"
      );
    }
  };

  const charCount = message.length;
  const isOverLimit = charCount > MAX_CHARS;
  const charPercentage = Math.min((charCount / MAX_CHARS) * 100, 100);

  if (!profile) return null;

  const degreeConfig = {
    1: { label: "1st", bgColor: "bg-[#1d9bf0]" },
    2: { label: "2nd", bgColor: "bg-[#00ba7c]" },
    3: { label: "3rd", bgColor: "bg-[#f91880]" },
  };

  const degree = degreeConfig[profile.degree];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-black border-white/20 p-0 overflow-hidden" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <DialogTitle className="font-bold text-base">New Message</DialogTitle>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-2 pb-4 space-y-4">
          {/* Message type selector for 2nd degree connections */}
          {profile.degree === 2 && bridgeProfiles.length > 0 && (
            <div className="flex gap-2 p-1 bg-[#16181c] rounded-lg">
              <button
                onClick={() => setMessageType("mutual")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  messageType === "mutual"
                    ? "bg-[#1d9bf0] text-white"
                    : "text-[#71767b] hover:text-[#e7e9ea]"
                }`}
              >
                Use Mutual
              </button>
              <button
                onClick={() => setMessageType("direct")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  messageType === "direct"
                    ? "bg-[#1d9bf0] text-white"
                    : "text-[#71767b] hover:text-[#e7e9ea]"
                }`}
              >
                Message Directly
              </button>
            </div>
          )}

          {/* Profile preview */}
          <div className="space-y-3">
            {/* Target profile */}
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={profile.profile_image_url} alt={profile.name} />
                <AvatarFallback className="bg-gray-800 text-white font-bold">
                  {profile.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{profile.name}</span>
                  <Badge
                    variant="secondary"
                    className={`${degree.bgColor} text-white text-xs font-bold px-2 py-0`}
                  >
                    {degree.label}
                  </Badge>
                </div>
                <span className="text-sm text-gray-500">@{profile.username}</span>
              </div>
            </div>

            {/* Bridge profile (via) with bracket connector */}
            {messageType === "mutual" && selectedBridgeProfile && bridgeProfiles.length > 0 && (
              <div className="relative flex items-center gap-3 pl-8">
                {/* 90 degree bracket connector */}
                <div className="absolute left-0 top-[-12px] bottom-[calc(50%)] w-6 border-l-2 border-b-2 border-[#1d9bf0] rounded-bl-lg"></div>

                <span className="text-xs text-gray-500 font-medium">via</span>

                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedBridgeProfile.profile_image_url} alt={selectedBridgeProfile.name} />
                  <AvatarFallback className="bg-gray-800 text-white font-bold">
                    {selectedBridgeProfile.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {bridgeProfiles.length > 1 ? (
                    <select
                      value={selectedBridgeProfile.x_user_id}
                      onChange={(e) => {
                        const selected = bridgeProfiles.find(b => b.x_user_id === e.target.value);
                        if (selected) {
                          setSelectedBridgeProfile(selected);
                        }
                      }}
                      className="font-bold text-sm text-[#1d9bf0] bg-transparent border-none outline-none cursor-pointer hover:underline appearance-none pr-4"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231d9bf0' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right center',
                        backgroundSize: '12px',
                      }}
                    >
                      {bridgeProfiles.map((bridge) => (
                        <option key={bridge.x_user_id} value={bridge.x_user_id} className="bg-[#16181c] text-[#e7e9ea]">
                          {bridge.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="font-bold text-sm truncate text-[#1d9bf0]">{selectedBridgeProfile.name}</div>
                  )}
                  <div className="text-xs text-gray-500">@{selectedBridgeProfile.username}</div>
                </div>
              </div>
            )}
          </div>

          {/* Message editor */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-40 flex items-center justify-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <svg fill="currentColor" fillRule="evenodd" height="48" width="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="text-[#1d9bf0]">
                      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"></path>
                    </svg>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message..."
                    className={`min-h-40 resize-none bg-transparent border-0 focus-visible:ring-0 text-[17px] leading-relaxed placeholder:text-gray-600 ${
                      isOverLimit ? "text-red-500" : ""
                    }`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Character count indicator */}
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6">
                <svg className="w-6 h-6 -rotate-90">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-white/10"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${charPercentage * 0.628} 100`}
                    className={isOverLimit ? "text-red-500" : charCount > 260 ? "text-yellow-500" : "text-[#1d9bf0]"}
                  />
                </svg>
              </div>
              <span
                className={`text-xs font-mono ${
                  isOverLimit ? "text-red-500" : "text-gray-500"
                }`}
              >
                {MAX_CHARS - charCount}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full"
              onClick={handleRegenerate}
              disabled={isGenerating}
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`rounded-full transition-all duration-300 ${
                copied
                  ? "text-green-500 hover:bg-green-500/10"
                  : "text-gray-400 hover:bg-white/10"
              }`}
              onClick={handleCopy}
              disabled={isGenerating || !message}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          <Button
            className="bg-white text-black font-bold rounded-full hover:bg-white/90 transition-colors px-5"
            onClick={handleOpenDM}
            disabled={isGenerating || !message || isOverLimit}
          >
            <p>Send on</p>
            <XLogo className="w-4 h-4 ml-0" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Sample intro generator (for demo purposes)
function generateSampleIntro(
  profile: Profile,
  currentUser?: { name: string; username: string },
  bridgeProfile?: Profile
): string {
  if (bridgeProfile) {
    // Message for mutual connection introduction - asking the bridge to introduce you
    return `Hey ${bridgeProfile.name.split(" ")[0]}, how's everything going? I saw you're connected with ${profile.name.split(" ")[0]} and was hoping you could introduce me. Thanks!`;
  } else {
    // Direct message to the target profile
    return `Hey ${profile.name.split(" ")[0]}! 👋 I came across your profile through our mutual network and love your work. Would love to connect and learn more about your journey!`;
  }
}
