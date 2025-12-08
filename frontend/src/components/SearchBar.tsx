"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GrokLogo } from "@/components/ui/logos";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const exampleQueries = [
  "Find investors in AI startups",
  "People working on climate tech",
  "Designers at tech companies",
  "VCs who invest in B2B SaaS",
  "Engineers at OpenAI or Anthropic",
  "Founders in the fintech space",
];

export function SearchBar({ onSearch, isLoading = false, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % exampleQueries.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={`relative flex items-center transition-all duration-200 rounded-full ${
            isFocused
              ? "bg-transparent ring-1 ring-[#1d9bf0]"
              : "bg-white/5"
          }`}
        >
          {/* Grok Logo Icon */}
          <div className="flex items-center justify-center w-12 h-12">
            <GrokLogo className={`w-5 h-5 transition-colors ${isFocused ? "text-[#1d9bf0]" : "text-gray-500"}`} />
          </div>

          {/* Input */}
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              // Delay hiding suggestions to allow click
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder={placeholder || exampleQueries[currentPlaceholder]}
            className="flex-1 h-12 border-0 bg-transparent text-[15px] placeholder:text-gray-600 focus-visible:ring-0 focus-visible:ring-offset-0 pr-2"
            disabled={isLoading}
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="mr-2 p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && !query && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 py-2 rounded-2xl bg-black border border-white/20 shadow-xl"
          >
            <div className="space-y-0.5">
              {exampleQueries.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-2.5 text-left text-[15px] hover:bg-white/5 transition-colors flex items-center gap-3 group"
                >
                  <Search className="w-4 h-4 text-gray-600 group-hover:text-[#1d9bf0] transition-colors" />
                  <span className="group-hover:text-[#1d9bf0] transition-colors">{suggestion}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
