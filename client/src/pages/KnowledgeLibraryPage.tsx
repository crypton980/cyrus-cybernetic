import { useCallback, useEffect, useRef, useState } from "react";
import {
  Book,
  BookOpen,
  Search,
  Upload,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Database,
  Shield,
  Wrench,
  FileText,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  ZapOff,
  Zap,
  Hash,
} from "lucide-react";
import { Link } from "wouter";

interface LibraryDocument {
  id: string;
  originalName: string;
  category: string;
  documentType: string;
  summary: string | null;
  keyConcepts: string[] | null;
  isActive: number;
  mimetype: string | null;
  size: number | null;
  indexedAt: string;
  lastAccessed: string;
  accessCount: number;
}

interface SearchResult {
  doc: LibraryDocument;
  excerpt: string;
  score: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  legal: <Shield className="w-3.5 h-3.5" />,
  constitution: <Book className="w-3.5 h-3.5" />,
  military: <Shield className="w-3.5 h-3.5" />,
  engineering: <Wrench className="w-3.5 h-3.5" />,
  medical: <FileText className="w-3.5 h-3.5" />,
  general: <BookOpen className="w-3.5 h-3.5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  constitution: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  military: "bg-red-500/20 text-red-300 border-red-500/30",
  engineering: "bg-green-500/20 text-green-300 border-green-500/30",
  medical: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const CATEGORY_ACTIVE_BORDER: Record<string, string> = {
  legal: "border-amber-500/60 bg-amber-500/10",
  constitution: "border-blue-500/60 bg-blue-500/10",
  military: "border-red-500/60 bg-red-500/10",
  engineering: "border-green-500/60 bg-green-500/10",
  medical: "border-purple-500/60 bg-purple-500/10",
  general: "border-slate-500/60 bg-slate-500/10",
  all: "border-white/30 bg-white/5",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function timeAgo(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

const ALL_CATEGORIES = ["all", "legal", "constitution", "military", "engineering", "medical", "general"] as const;
const SEARCH_DEBOUNCE_MS = 350;

export function KnowledgeLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [bulkIndexing, setBulkIndexing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ indexed: number; skipped: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeInactive: "true" });
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      const res = await fetch(`/api/knowledge/library?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load library");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // Live search with debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (selectedCategory !== "all") params.set("category", selectedCategory);
        const res = await fetch(`/api/knowledge/library/search?${params}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err: any) {
        showToast("error", err.message || "Search failed");
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, selectedCategory]);

  const handleBulkIndex = async () => {
    setBulkIndexing(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/knowledge/library/bulk-index", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk index failed");
      setBulkResult(data);
      showToast(
        "success",
        `Indexed ${data.indexed} new document(s). Skipped ${data.skipped} already indexed.`,
      );
      void fetchDocuments();
    } catch (err: any) {
      showToast("error", err.message || "Bulk indexing failed");
    } finally {
      setBulkIndexing(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      const res = await fetch("/api/knowledge/library/index", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      showToast(
        "success",
        data.alreadyIndexed
          ? `"${file.name}" was already in the library.`
          : `"${file.name}" indexed successfully as ${data.document?.category || uploadCategory}.`,
      );
      void fetchDocuments();
    } catch (err: any) {
      showToast("error", err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (doc: LibraryDocument) => {
    const newActive = !doc.isActive;
    try {
      const res = await fetch(`/api/knowledge/library/${doc.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("success", `"${doc.originalName}" ${newActive ? "activated" : "deactivated"}.`);
      void fetchDocuments();
    } catch (err: any) {
      showToast("error", err.message || "Toggle failed");
    }
  };

  const handleDelete = async (doc: LibraryDocument) => {
    if (!window.confirm(`Remove "${doc.originalName}" from the knowledge library?`)) return;
    try {
      const res = await fetch(`/api/knowledge/library/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      showToast("success", `"${doc.originalName}" removed from library.`);
      void fetchDocuments();
      setSearchResults((prev) => prev?.filter((r) => r.doc.id !== doc.id) ?? null);
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
    } catch (err: any) {
      showToast("error", err.message || "Delete failed");
    }
  };

  // Drag-and-drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUploadFile(file);
  };

  // Derived data
  const displayDocs: LibraryDocument[] =
    searchResults !== null ? searchResults.map((r) => r.doc) : documents;

  const activeDocs = documents.filter((d) => d.isActive);
  const inactiveDocs = documents.filter((d) => !d.isActive);

  const categoryCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    const cat = doc.category || "general";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const totalSize = documents.reduce((s, d) => s + (d.size || 0), 0);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-900 text-white"
      ref={dropZoneRef}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[60] bg-blue-900/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-blue-400/70 pointer-events-none">
          <Upload className="w-16 h-16 text-blue-300 mb-4" />
          <p className="text-2xl font-bold text-blue-200">Drop to index document</p>
          <p className="text-blue-300/70 mt-1 text-sm">PDF, DOCX, TXT, MD, RTF supported</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border backdrop-blur-sm ${
            toast.kind === "success"
              ? "bg-green-900/90 border-green-500/40 text-green-200"
              : "bg-red-900/90 border-red-500/40 text-red-200"
          }`}
        >
          {toast.kind === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.odt,.pptx,.xlsx,.csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUploadFile(file);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/modules" className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Knowledge Library</h1>
              <p className="text-xs text-white/40">
                {activeDocs.length} active · {documents.length} total · {formatBytes(totalSize)}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkIndex}
              disabled={bulkIndexing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 transition-all text-sm font-medium disabled:opacity-50 shadow-sm"
            >
              {bulkIndexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              <span className="hidden sm:inline">{bulkIndexing ? "Indexing…" : "Index All Uploads"}</span>
            </button>
            <button
              onClick={() => setShowUploadPanel((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shadow-sm ${
                showUploadPanel
                  ? "bg-blue-600/40 border-blue-400/50 text-blue-200"
                  : "bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/40"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Add Document</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Documents", value: activeDocs.length, icon: <Zap className="w-4 h-4 text-green-400" />, color: "border-green-500/20 bg-green-500/5" },
            { label: "Inactive", value: inactiveDocs.length, icon: <ZapOff className="w-4 h-4 text-slate-400" />, color: "border-slate-500/20 bg-slate-500/5" },
            { label: "Categories", value: Object.keys(categoryCounts).length, icon: <Tag className="w-4 h-4 text-purple-400" />, color: "border-purple-500/20 bg-purple-500/5" },
            { label: "Total Size", value: formatBytes(totalSize), icon: <Hash className="w-4 h-4 text-blue-400" />, color: "border-blue-500/20 bg-blue-500/5" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border p-3 flex items-center gap-3 ${stat.color}`}>
              <div className="shrink-0">{stat.icon}</div>
              <div>
                <p className="text-lg font-bold leading-none">{stat.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Upload panel (collapsible) */}
        {showUploadPanel && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-950/30 p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-200 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Add a Document to the Library
            </p>
            <div>
              <p className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Select category for this upload:</p>
              <div className="flex gap-2 flex-wrap">
                {(["general", "legal", "constitution", "military", "engineering", "medical"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      uploadCategory === cat
                        ? CATEGORY_COLORS[cat]
                        : "border-white/10 text-white/40 hover:text-white/70"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {CATEGORY_ICONS[cat]}
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blue-400/30 rounded-xl p-8 cursor-pointer hover:border-blue-400/60 hover:bg-blue-500/5 transition-all"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-blue-400/60" />
              )}
              <p className="text-sm text-white/50">{uploading ? "Indexing…" : "Click to select a file or drag & drop anywhere"}</p>
              <p className="text-xs text-white/30">PDF · DOCX · TXT · MD · RTF · ODT · PPTX · XLSX · CSV</p>
            </div>
          </div>
        )}

        {/* Bulk index result */}
        {bulkResult && (
          <div className="rounded-xl border border-green-500/20 bg-green-900/10 p-4 text-sm text-green-300 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Bulk Index Complete</p>
              <p className="text-green-300/80">
                ✅ {bulkResult.indexed} new document(s) indexed &nbsp;·&nbsp; ⏭️ {bulkResult.skipped} already indexed
              </p>
              {bulkResult.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-amber-300 text-xs">{bulkResult.errors.length} warning(s)</summary>
                  <ul className="mt-1 space-y-0.5 text-amber-200/80">
                    {bulkResult.errors.map((e, i) => (
                      <li key={i} className="font-mono text-xs">• {e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <button onClick={() => setBulkResult(null)} className="text-white/30 hover:text-white/70"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by keyword, concept, or topic…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap">
          {ALL_CATEGORIES.map((cat) => {
            const count = cat === "all" ? documents.length : (categoryCounts[cat] || 0);
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSearchQuery(""); setSearchResults(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  isActive
                    ? CATEGORY_ACTIVE_BORDER[cat]
                    : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                }`}
              >
                {cat !== "all" && CATEGORY_ICONS[cat]}
                <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20" : "bg-white/10"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Document list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-white/30">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>{searchQuery ? "Searching…" : "Loading library…"}</span>
          </div>
        ) : displayDocs.length === 0 ? (
          <div className="text-center py-24 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Database className="w-8 h-8 text-white/20" />
            </div>
            {searchQuery ? (
              <>
                <p className="text-white/40 text-lg">No documents match <em>"{searchQuery}"</em></p>
                <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-blue-400 text-sm hover:text-blue-300 underline">Clear search</button>
              </>
            ) : (
              <>
                <p className="text-white/40 text-lg font-medium">No documents indexed yet</p>
                <p className="text-white/25 text-sm max-w-sm mx-auto">
                  Use <strong className="text-white/40">Index All Uploads</strong> to scan every previously uploaded file, or drag & drop a document anywhere on this page.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleBulkIndex}
                    disabled={bulkIndexing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 transition-all text-sm font-medium"
                  >
                    <Layers className="w-4 h-4" />
                    {bulkIndexing ? "Indexing…" : "Index All Uploads"}
                  </button>
                  <button
                    onClick={() => { setShowUploadPanel(true); fileInputRef.current?.click(); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/40 transition-all text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    Add Document
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults !== null && (
              <p className="text-xs text-white/40 pl-1">
                {searchResults.length} result(s) for <em className="text-white/60">"{searchQuery}"</em>
              </p>
            )}
            {displayDocs.map((doc) => {
              const isExpanded = expandedId === doc.id;
              const searchResult = searchResults?.find((r) => r.doc.id === doc.id);
              const catColor = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.general;

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border transition-all ${
                    doc.isActive
                      ? "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                      : "bg-white/[0.01] border-white/5 opacity-40"
                  }`}
                >
                  <div className="p-3.5 flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${doc.isActive ? "bg-green-400" : "bg-slate-600"}`} />

                    {/* Category badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold shrink-0 mt-0.5 ${catColor}`}>
                      {CATEGORY_ICONS[doc.category] || <BookOpen className="w-3 h-3" />}
                      <span className="hidden sm:inline">{doc.category}</span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <button
                        className="text-left w-full"
                        onClick={() => setPreviewDoc(previewDoc?.id === doc.id ? null : doc)}
                      >
                        <p className="font-semibold text-white text-sm truncate hover:text-blue-300 transition-colors">{doc.originalName}</p>
                      </button>
                      <p className="text-[11px] text-white/35 mt-0.5">
                        {formatBytes(doc.size)} · {timeAgo(doc.indexedAt)} · {doc.accessCount} reference{doc.accessCount !== 1 ? "s" : ""}
                      </p>
                      {doc.summary && !searchResult?.excerpt && (
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{doc.summary}</p>
                      )}
                      {searchResult?.excerpt && (
                        <p className="text-xs text-blue-200/80 mt-1.5 line-clamp-3 border-l-2 border-blue-500/50 pl-2.5 italic">
                          {searchResult.excerpt}
                        </p>
                      )}
                      {doc.keyConcepts && doc.keyConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.keyConcepts.slice(0, 6).map((kw) => (
                            <button
                              key={kw}
                              onClick={() => setSearchQuery(kw)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70 transition-colors"
                            >
                              {kw}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                        title="Expand key concepts"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => void handleToggle(doc)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title={doc.isActive ? "Deactivate (hide from CYRUS)" : "Activate (make available to CYRUS)"}
                      >
                        {doc.isActive ? (
                          <Eye className="w-4 h-4 text-green-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-white/30" />
                        )}
                      </button>
                      <button
                        onClick={() => void handleDelete(doc)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                        title="Remove from library"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded all-concepts panel */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-3 space-y-2">
                      <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">All Key Concepts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(doc.keyConcepts || []).map((kw) => (
                          <button
                            key={kw}
                            onClick={() => setSearchQuery(kw)}
                            className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/55 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-slate-900 border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-semibold shrink-0 ${CATEGORY_COLORS[previewDoc.category] || CATEGORY_COLORS.general}`}>
                  {CATEGORY_ICONS[previewDoc.category] || <BookOpen className="w-3 h-3" />}
                  {previewDoc.category}
                </div>
                <p className="font-semibold text-white truncate">{previewDoc.originalName}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-white/40 hover:text-white ml-2 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-sm font-bold">{formatBytes(previewDoc.size)}</p>
                  <p className="text-[10px] text-white/40">Size</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-sm font-bold">{previewDoc.accessCount}</p>
                  <p className="text-[10px] text-white/40">AI References</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-sm font-bold">{timeAgo(previewDoc.indexedAt)}</p>
                  <p className="text-[10px] text-white/40">Indexed</p>
                </div>
              </div>
              {previewDoc.summary && (
                <div>
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Summary</p>
                  <p className="text-sm text-white/70 leading-relaxed">{previewDoc.summary}</p>
                </div>
              )}
              {previewDoc.keyConcepts && previewDoc.keyConcepts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Key Concepts ({previewDoc.keyConcepts.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewDoc.keyConcepts.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => { setPreviewDoc(null); setSearchQuery(kw); }}
                        className="text-xs px-2 py-1 rounded-full bg-white/8 text-white/60 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <div className={`w-2 h-2 rounded-full ${previewDoc.isActive ? "bg-green-400" : "bg-slate-500"}`} />
                <span className="text-xs text-white/50">{previewDoc.isActive ? "Active — CYRUS can reference this document" : "Inactive — hidden from CYRUS"}</span>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => { void handleToggle(previewDoc); setPreviewDoc(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                  previewDoc.isActive
                    ? "border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                    : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                }`}
              >
                {previewDoc.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {previewDoc.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => { void handleDelete(previewDoc); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

