/**
 * UniversalQueryBar — CYRUS Intelligent Search
 *
 * A global floating search bar that accepts any natural-language query,
 * routes it through the intelligent query router (internal + external),
 * and displays results with a "Navigate to Module" button.
 *
 * Features:
 * - Keyboard shortcut: Cmd/Ctrl + K to open
 * - Results split into: AI Answer | Internal | External tabs
 * - Source badges and relevance scores per result
 * - One-click navigation to the relevant module
 * - Works from any page in the app
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search,
  X,
  Loader2,
  ExternalLink,
  Database,
  Brain,
  Globe,
  ChevronRight,
  MessageSquare,
  Scan,
  FileText,
  MapPin,
  Phone,
  Monitor,
  TrendingUp,
  Plane,
  Activity,
  Zap,
  Shield,
  Microscope,
  Droplets,
  Cpu,
  Newspaper,
  BookOpen,
  AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InternalResult {
  source: string;
  id: string;
  title: string;
  excerpt: string;
  score?: number;
  matchReason?: string;
  type: string;
}

interface ExternalResult {
  source: string;
  title: string;
  url?: string;
  excerpt: string;
  publishedAt?: string;
}

interface QueryResponse {
  query: string;
  intent: string;
  module: string;
  navigateTo: string;
  moduleDescription: string;
  confidence: number;
  classificationMethod: string;
  queryType: string;
  internalResults: InternalResult[];
  externalResults: ExternalResult[];
  aiAnswer: string;
  sources: string[];
  totalFound: number;
}

// ── Module icon map ───────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ReactNode> = {
  "/": <MessageSquare className="w-4 h-4" />,
  "/modules": <Cpu className="w-4 h-4" />,
  "/scan": <Scan className="w-4 h-4" />,
  "/files": <FileText className="w-4 h-4" />,
  "/nav": <MapPin className="w-4 h-4" />,
  "/comms": <Phone className="w-4 h-4" />,
  "/device": <Monitor className="w-4 h-4" />,
  "/drone": <Plane className="w-4 h-4" />,
  "/trading": <TrendingUp className="w-4 h-4" />,
  "/medical": <Activity className="w-4 h-4" />,
  "/quantum": <Zap className="w-4 h-4" />,
  "/security": <Shield className="w-4 h-4" />,
  "/biology": <Microscope className="w-4 h-4" />,
  "/blood": <Droplets className="w-4 h-4" />,
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  "System Database": <Database className="w-3 h-3" />,
  Memory: <Brain className="w-3 h-3" />,
  Conversation: <MessageSquare className="w-3 h-3" />,
  Wikipedia: <BookOpen className="w-3 h-3" />,
  "CYRUS AI": <Brain className="w-3 h-3 text-purple-400" />,
};

function getSourceIcon(source: string): React.ReactNode {
  if (source.startsWith("News")) return <Newspaper className="w-3 h-3 text-blue-400" />;
  return SOURCE_ICONS[source] || <Globe className="w-3 h-3" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UniversalQueryBar() {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ai" | "internal" | "external">("ai");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcut (Cmd/Ctrl + K) ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  // ── Execute query ─────────────────────────────────────────────────────────
  const executeQuery = useCallback(async () => {
    const q = query.trim();
    if (!q || q.length < 2) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Query failed");
      }

      const data: QueryResponse = await res.json();
      setResult(data);

      // Auto-select the tab with the most content
      if (data.aiAnswer) setActiveTab("ai");
      else if (data.internalResults.length > 0) setActiveTab("internal");
      else if (data.externalResults.length > 0) setActiveTab("external");
    } catch (err: any) {
      setError(err?.message || "Query failed");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  const handleNavigate = useCallback(() => {
    if (!result) return;
    navigate(result.navigateTo);
    setIsOpen(false);
  }, [result, navigate]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[150] flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-700/90 to-blue-800/90 backdrop-blur-md border border-cyan-500/40 text-white text-xs font-medium rounded-full shadow-lg shadow-cyan-500/20 hover:from-cyan-600/90 hover:to-blue-700/90 transition-all group"
        title="Universal Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search Everything</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-cyan-200">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-[#111113] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-lg flex items-center justify-center shrink-0">
            <Search className="w-3.5 h-3.5 text-white" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void executeQuery();
              if (e.key === "Escape") setIsOpen(false);
            }}
            placeholder="Search databases, the web, modules… (Enter to search)"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
          ) : (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-500 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hint bar (no result yet) */}
        {!result && !error && !isLoading && (
          <div className="px-4 py-8 text-center space-y-2">
            <p className="text-xs text-gray-500">Search across internal database, memory, conversations, news, Wikipedia and more</p>
            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
              {[
                { label: "Internal DB", icon: <Database className="w-3 h-3" />, color: "text-cyan-400" },
                { label: "Memory", icon: <Brain className="w-3 h-3" />, color: "text-purple-400" },
                { label: "News", icon: <Newspaper className="w-3 h-3" />, color: "text-blue-400" },
                { label: "Wikipedia", icon: <BookOpen className="w-3 h-3" />, color: "text-green-400" },
                { label: "AI Answer", icon: <Zap className="w-3 h-3" />, color: "text-amber-400" },
              ].map(({ label, icon, color }) => (
                <span key={label} className={`flex items-center gap-1 text-[11px] ${color}`}>
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col min-h-0">
            {/* Module routing banner */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-900/30 to-blue-900/20 border-b border-gray-800/50 flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-cyan-400 shrink-0">
                  {MODULE_ICONS[result.navigateTo] || <Cpu className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white">{result.module}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{result.moduleDescription}</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                  {Math.round(result.confidence * 100)}% confident
                </span>
              </div>
              <button
                onClick={handleNavigate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg shrink-0 transition-colors"
              >
                Open Module
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Sources row */}
            {result.sources.length > 0 && (
              <div className="px-4 py-1.5 border-b border-gray-800/30 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-600 mr-1">Sources:</span>
                {result.sources.map((src) => (
                  <span key={src} className="text-[10px] text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                    {getSourceIcon(src)}
                    {src}
                  </span>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-2 border-b border-gray-800/30">
              {[
                { key: "ai" as const, label: "AI Answer", count: result.aiAnswer ? 1 : 0 },
                { key: "internal" as const, label: "Internal", count: result.internalResults.length },
                { key: "external" as const, label: "External", count: result.externalResults.length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                    activeTab === key
                      ? "bg-gray-800/60 text-white border-t border-l border-r border-gray-700/50"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1.5 text-[10px] bg-cyan-600/50 text-cyan-200 px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3 max-h-[40vh]">
              {/* AI Answer tab */}
              {activeTab === "ai" && (
                result.aiAnswer ? (
                  <div className="p-3 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[11px] font-semibold text-purple-300">CYRUS AI Answer</span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{result.aiAnswer}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No AI answer generated. Configure OPENAI_API_KEY to enable synthesis.</p>
                )
              )}

              {/* Internal results tab */}
              {activeTab === "internal" && (
                result.internalResults.length > 0 ? (
                  result.internalResults.map((item, i) => (
                    <div key={item.id || i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          {getSourceIcon(item.source)}
                          {item.source}
                        </span>
                        <span className="text-[10px] text-gray-500 capitalize">{item.type}</span>
                        {item.score !== undefined && (
                          <span className="text-[10px] text-emerald-400">{Math.round(item.score * 100)}% match</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white mb-0.5">{item.title}</p>
                      {item.excerpt && <p className="text-[11px] text-gray-400 line-clamp-3">{item.excerpt}</p>}
                      {item.matchReason && <p className="text-[10px] text-gray-600 italic mt-0.5">{item.matchReason}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No internal records found for this query.</p>
                )
              )}

              {/* External results tab */}
              {activeTab === "external" && (
                result.externalResults.length > 0 ? (
                  result.externalResults.map((item, i) => (
                    <div key={i} className="p-3 bg-gray-800/40 border border-gray-700/40 rounded-xl">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {getSourceIcon(item.source)}
                          {item.source}
                        </span>
                        {item.publishedAt && (
                          <span className="text-[10px] text-gray-600">
                            {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white mb-0.5">{item.title}</p>
                      {item.excerpt && <p className="text-[11px] text-gray-400 line-clamp-3">{item.excerpt}</p>}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open source
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">No external results found. Ensure NEWS_API_KEY is configured for news search.</p>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-800/30 flex items-center justify-between">
              <span className="text-[10px] text-gray-600">
                {result.totalFound} source{result.totalFound !== 1 ? "s" : ""} found · via {result.classificationMethod} routing
              </span>
              <button
                onClick={handleNavigate}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
              >
                Open {result.module} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
