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
  legal: <Shield className="w-4 h-4" />,
  constitution: <Book className="w-4 h-4" />,
  military: <Shield className="w-4 h-4" />,
  engineering: <Wrench className="w-4 h-4" />,
  medical: <FileText className="w-4 h-4" />,
  general: <BookOpen className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  constitution: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  military: "bg-red-500/20 text-red-300 border-red-500/30",
  engineering: "bg-green-500/20 text-green-300 border-green-500/30",
  medical: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
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

export function KnowledgeLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
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
  };

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

  const handleUpload = async (file: File) => {
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
          : `"${file.name}" indexed successfully.`,
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
      showToast("success", `Document ${newActive ? "activated" : "deactivated"}.`);
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
      if (searchResults) {
        setSearchResults((prev) => prev?.filter((r) => r.doc.id !== doc.id) || null);
      }
    } catch (err: any) {
      showToast("error", err.message || "Delete failed");
    }
  };

  const displayDocs: LibraryDocument[] =
    searchResults !== null ? searchResults.map((r) => r.doc) : documents;

  const categories = [
    "all",
    "legal",
    "constitution",
    "military",
    "engineering",
    "medical",
    "general",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-900 text-white">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border ${
            toast.kind === "success"
              ? "bg-green-900/90 border-green-500/40 text-green-200"
              : "bg-red-900/90 border-red-500/40 text-red-200"
          }`}
        >
          {toast.kind === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
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
          if (file) void handleUpload(file);
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Knowledge Library</h1>
              <p className="text-xs text-white/50">
                {documents.filter((d) => d.isActive).length} active document(s) available for CYRUS
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkIndex}
              disabled={bulkIndexing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:bg-purple-600/50 transition-colors text-sm font-medium disabled:opacity-60"
            >
              {bulkIndexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {bulkIndexing ? "Indexing…" : "Index All Uploads"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-300 hover:bg-blue-600/50 transition-colors text-sm font-medium disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading…" : "Add Document"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Bulk index result */}
        {bulkResult && (
          <div className="rounded-xl border border-green-500/30 bg-green-900/20 p-4 text-sm text-green-300 space-y-1">
            <p className="font-semibold">Bulk Index Complete</p>
            <p>
              ✅ Indexed: <strong>{bulkResult.indexed}</strong> &nbsp; ⏭️ Skipped: <strong>{bulkResult.skipped}</strong>
            </p>
            {bulkResult.errors.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-amber-300">{bulkResult.errors.length} warning(s)</summary>
                <ul className="mt-1 space-y-0.5 text-amber-200/80">
                  {bulkResult.errors.map((e, i) => (
                    <li key={i} className="font-mono text-xs">• {e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Search + Category filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              placeholder="Search documents… (press Enter)"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSearchResults(null);
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchResults(null);
                setSearchQuery("");
              }}
              className="px-3 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/30 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Upload category picker (shown when uploading) */}
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Tag className="w-4 h-4" />
          <span>New upload category:</span>
          <div className="flex gap-2 flex-wrap">
            {["general", "legal", "constitution", "military", "engineering", "medical"].map((cat) => (
              <button
                key={cat}
                onClick={() => setUploadCategory(cat)}
                className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  uploadCategory === cat
                    ? CATEGORY_COLORS[cat] || "bg-blue-600/30 border-blue-500/30 text-blue-300"
                    : "border-white/10 text-white/40 hover:text-white/70"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading library…</span>
          </div>
        ) : displayDocs.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Database className="w-12 h-12 text-white/20 mx-auto" />
            <p className="text-white/40 text-lg">No documents in the library yet.</p>
            <p className="text-white/30 text-sm">
              Click <strong>"Index All Uploads"</strong> to scan all previously uploaded files, or use{" "}
              <strong>"Add Document"</strong> to index a specific file.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchResults !== null && (
              <p className="text-sm text-white/50 pl-1">
                {searchResults.length} result(s) for <em>"{searchQuery}"</em>
              </p>
            )}
            {displayDocs.map((doc) => {
              const isExpanded = expandedId === doc.id;
              const searchResult = searchResults?.find((r) => r.doc.id === doc.id);
              const catColor = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.general;

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border transition-colors ${
                    doc.isActive
                      ? "bg-white/5 border-white/10 hover:border-white/20"
                      : "bg-white/2 border-white/5 opacity-50"
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    {/* Category badge */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold shrink-0 ${catColor}`}
                    >
                      {CATEGORY_ICONS[doc.category] || <BookOpen className="w-3 h-3" />}
                      {doc.category}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{doc.originalName}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {formatBytes(doc.size)} · Indexed {timeAgo(doc.indexedAt)} · {doc.accessCount} queries
                      </p>
                      {doc.summary && (
                        <p className="text-xs text-white/60 mt-1 line-clamp-2">{doc.summary}</p>
                      )}
                      {searchResult?.excerpt && (
                        <p className="text-xs text-blue-300/80 mt-1 line-clamp-3 italic border-l-2 border-blue-500/40 pl-2">
                          {searchResult.excerpt}
                        </p>
                      )}
                      {doc.keyConcepts && doc.keyConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.keyConcepts.slice(0, 8).map((kw) => (
                            <span
                              key={kw}
                              className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title="Show concepts"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => void handleToggle(doc)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title={doc.isActive ? "Deactivate" : "Activate"}
                      >
                        {doc.isActive ? (
                          <Eye className="w-4 h-4 text-green-400" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => void handleDelete(doc)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                        title="Remove from library"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded key concepts panel */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-4 py-3 text-xs text-white/50 space-y-1">
                      <p className="font-semibold text-white/70">All Key Concepts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(doc.keyConcepts || []).map((kw) => (
                          <span key={kw} className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                            {kw}
                          </span>
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
    </div>
  );
}
