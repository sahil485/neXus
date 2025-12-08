"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  MessageCircle,
  Loader2,
  MoreHorizontal,
  LogOut,
  Send,
  Sparkles,
  User,
  Bot,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const navItems = [
  { icon: Home, label: "Home", href: "/dashboard", active: false },
  { icon: Users, label: "Network", href: "/network", active: false },
  { icon: MessageCircle, label: "Chat", href: "/chat", active: true },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  profiles?: any[];
  timestamp: Date;
}

export default function ChatPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your network assistant. I can help you find people in your network, suggest introductions, or answer questions about your connections. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
          profiles: data.profiles,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error("Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
                <item.icon
                  className={`w-[26px] h-[26px] ${
                    item.active ? "stroke-[2.5px]" : "stroke-[2px]"
                  }`}
                />
                <span
                  className={`hidden xl:block text-xl ${
                    item.active ? "font-bold" : "font-normal"
                  }`}
                >
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
                  <AvatarFallback>
                    {displayUser.name?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:block flex-1 text-left leading-5">
                  <div className="font-bold text-[15px] truncate">
                    {displayUser.name}
                  </div>
                  <div className="text-[#71767b] text-[15px] truncate">
                    @{displayUser.username}
                  </div>
                </div>
                <MoreHorizontal className="hidden xl:block w-4 h-4 text-[#e7e9ea]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[300px] bg-black border-[#2f3336] text-[#e7e9ea] shadow-[0_0_15px_rgba(255,255,255,0.1)] rounded-xl py-3"
            >
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
      <main className="w-full max-w-[600px] border-x border-[#2f3336] min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-black/65 backdrop-blur-md border-b border-[#2f3336]">
          <div className="px-4 h-[53px] flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#1d9bf0]" />
            <h1 className="text-xl font-bold">Network Assistant</h1>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {message.role === "assistant" ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1d9bf0] to-[#00ba7c] flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={displayUser.profile_image_url} />
                        <AvatarFallback>
                          {displayUser.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`flex-1 max-w-[80%] ${
                      message.role === "user" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block p-4 rounded-2xl ${
                        message.role === "user"
                          ? "bg-[#1d9bf0] text-white rounded-br-md"
                          : "bg-[#16181c] text-[#e7e9ea] rounded-bl-md"
                      }`}
                    >
                      <p className="text-[15px] whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>

                    {/* Profile cards if returned */}
                    {message.profiles && message.profiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.profiles.slice(0, 5).map((profile: any) => (
                          <a
                            key={profile.x_user_id}
                            href={`https://x.com/${profile.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-[#16181c] rounded-xl hover:bg-[#1d1f23] transition-colors"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={profile.profile_image_url} />
                              <AvatarFallback>
                                {profile.name?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[14px] truncate">
                                {profile.name}
                              </div>
                              <div className="text-[#71767b] text-[13px] truncate">
                                @{profile.username}
                              </div>
                            </div>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                profile.degree === 1
                                  ? "bg-[#1d9bf0] text-white"
                                  : "bg-[#00ba7c] text-white"
                              }`}
                            >
                              {profile.degree === 1 ? "1st" : "2nd"}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-[#71767b] mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1d9bf0] to-[#00ba7c] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-[#16181c] p-4 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#71767b] rounded-full animate-bounce" />
                    <span
                      className="w-2 h-2 bg-[#71767b] rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 bg-[#71767b] rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-[#2f3336] bg-black p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your network..."
                rows={1}
                className="w-full bg-[#16181c] border border-[#2f3336] rounded-2xl px-4 py-3 pr-12 text-[15px] text-[#e7e9ea] placeholder-[#71767b] focus:outline-none focus:border-[#1d9bf0] resize-none"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 bg-[#1d9bf0] hover:bg-[#1a8cd8] disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </form>
          <p className="text-[11px] text-[#71767b] mt-2 text-center">
            Try: "Find AI researchers" or "Who works at startups?"
          </p>
        </div>
      </main>
    </div>
  );
}

