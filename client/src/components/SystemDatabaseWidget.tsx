/**
 * SystemDatabaseWidget
 *
 * A reusable collapsible panel that can be placed in any module page.
 * Features:
 * - Upload records (facial, fingerprint, iris, barcode, QR code, reference, documents, images, text)
 * - Deep multi-strategy search (FTS + fuzzy + exact + AI re-ranking)
 * - Facial image matching via camera or file
 * - Browse with cursor-based pagination
 * - Stats banner showing record counts by type
 * - Verify record integrity by ID
 * - Bulk upload via JSON
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Database,
  Upload,
  Search,
  Camera,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Trash2,
  Loader2,
  Eye,
  Fingerprint,
  QrCode,
  FileText,
  Tag,
  BarChart2,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

type RecordType =
  | "face"
  | "fingerprint"
  | "iris"
  | "barcode"
  | "qrcode"
  | "reference"
  | "document"
  | "image"
  | "text";

interface DBRecord {
  id: string;
  recordType: RecordType;
  label: string;
  value: string;
  imageData?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string;
  sourceModule?: string;
  isDeleted?: number;
  createdAt: string;
  updatedAt?: string;
}

/** Result from the deep-search engine (server returns `{ record, score, matchReason, strategy }`) */
interface DeepSearchMatch {
  record: DBRecord;
  score: number;
  matchReason: string;
  strategy: "fts" | "fuzzy" | "exact" | "ai";
}

/** Result from face search (`{ knownFaceId, label, confidence, reason }`) */
interface FaceMatch {
  knownFaceId: string;
  label: string;
  confidence: number;
  reason?: string;
}

interface DBStats {
  total: number;
  active: number;
  deleted: number;
  byType: Record<string, number>;
  byModule: Record<string, number>;
  error?: string;
}

const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  face: "Face",
  fingerprint: "Fingerprint",
  iris: "Iris Scan",
  barcode: "Barcode",
  qrcode: "QR Code",
  reference: "Reference No.",
  document: "Document",
  image: "Image",
  text: "Text / Info",
};

const RECORD_TYPE_ICONS: Record<RecordType, React.ReactNode> = {
  face: <Eye className="w-3.5 h-3.5" />,
  fingerprint: <Fingerprint className="w-3.5 h-3.5" />,
  iris: <Eye className="w-3.5 h-3.5 text-purple-400" />,
  barcode: <Tag className="w-3.5 h-3.5" />,
  qrcode: <QrCode className="w-3.5 h-3.5" />,
  reference: <FileText className="w-3.5 h-3.5" />,
  document: <FileText className="w-3.5 h-3.5 text-blue-400" />,
  image: <Camera className="w-3.5 h-3.5" />,
  text: <FileText className="w-3.5 h-3.5 text-gray-400" />,
};

interface SystemDatabaseWidgetProps {
  /** Which module is embedding this widget — used to tag uploads */
  sourceModule: string;
  /** If true, the widget starts expanded */
  defaultOpen?: boolean;
}

export function SystemDatabaseWidget({ sourceModule, defaultOpen = false }: SystemDatabaseWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<"upload" | "search" | "browse" | "stats">("upload");

  // ── Stats ────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DBStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // ── Upload state ────────────────────────────────────────────────────────
  const [uploadType, setUploadType] = useState<RecordType>("face");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadValue, setUploadValue] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Search state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"" | RecordType>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DeepSearchMatch[] | FaceMatch[]>([]);
  const [searchMode, setSearchMode] = useState<"text" | "face">("text");
  const [faceSearchImage, setFaceSearchImage] = useState<string | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  // ── Verify state ─────────────────────────────────────────────────────────
  const [verifyId, setVerifyId] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; integrityOk?: boolean; details: string } | null>(null);

  // ── Browse state ────────────────────────────────────────────────────────
  const [browseRecords, setBrowseRecords] = useState<DBRecord[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<"" | RecordType>("");
  const [browseCursor, setBrowseCursor] = useState<string | null>(null);
  const [browseHasMore, setBrowseHasMore] = useState(false);

  // ── Camera ───────────────────────────────────────────────────────────────
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"upload" | "search">("upload");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchFileRef = useRef<HTMLInputElement>(null);

  // ── Camera helpers ────────────────────────────────────────────────────────
  const openCamera = useCallback(async (mode: "upload" | "search") => {
    setCameraMode(mode);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraOpen(false);
    }
  }, []);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  const captureFromCamera = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (cameraMode === "upload") {
      setUploadImage(dataUrl);
    } else {
      setFaceSearchImage(dataUrl);
    }
    closeCamera();
  }, [cameraMode, closeCamera]);

  // ── File read helper ──────────────────────────────────────────────────────
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });

  // ── Stats ────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch("/api/sysdb/stats");
      if (!res.ok) throw new Error("Stats unavailable");
      setStats(await res.json());
    } catch {
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "stats" && !stats) void loadStats();
  }, [isOpen, activeTab, stats, loadStats]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadLabel.trim()) {
      setUploadResult({ ok: false, message: "Label is required" });
      return;
    }
    setIsUploading(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/sysdb/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: uploadType,
          label: uploadLabel.trim(),
          value: uploadValue.trim(),
          imageData: uploadImage || undefined,
          tags: uploadTags.trim(),
          sourceModule,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      setUploadResult({ ok: true, message: `${RECORD_TYPE_LABELS[uploadType]} record "${uploadLabel}" saved to system database` });
      setUploadLabel("");
      setUploadValue("");
      setUploadTags("");
      setUploadImage(null);
      // Refresh stats if visible
      if (activeTab === "stats") void loadStats();
    } catch (err: any) {
      setUploadResult({ ok: false, message: err?.message || "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Deep Text Search ──────────────────────────────────────────────────────
  const handleTextSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    setSearchDone(false);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim(), limit: "20" });
      if (searchType) params.set("type", searchType);
      const res = await fetch(`/api/sysdb/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.matches || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  // ── Face Search ───────────────────────────────────────────────────────────
  const handleFaceSearch = async () => {
    if (!faceSearchImage) return;
    setIsSearching(true);
    setSearchResults([]);
    setSearchDone(false);
    try {
      const res = await fetch("/api/sysdb/search/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: faceSearchImage }),
      });
      if (!res.ok) throw new Error("Face search failed");
      const data = await res.json();
      setSearchResults(data.matches || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setSearchDone(true);
    }
  };

  // ── Verify record ─────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!verifyId.trim()) return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/sysdb/verify/${encodeURIComponent(verifyId.trim())}`);
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult({ valid: false, details: "Verification request failed" });
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Browse (cursor-based pagination) ─────────────────────────────────────
  const loadBrowse = useCallback(async (append = false) => {
    setIsBrowsing(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (browseFilter) params.set("type", browseFilter);
      if (append && browseCursor) params.set("cursor", browseCursor);
      const res = await fetch(`/api/sysdb/records?${params}`);
      if (!res.ok) throw new Error("Browse failed");
      const data = await res.json();
      const newRecords: DBRecord[] = data.records || [];
      setBrowseRecords((prev) => append ? [...prev, ...newRecords] : newRecords);
      setBrowseHasMore(data.pagination?.hasMore ?? false);
      setBrowseCursor(data.pagination?.nextCursor ?? null);
    } catch {
      if (!append) setBrowseRecords([]);
    } finally {
      setIsBrowsing(false);
    }
  }, [browseFilter, browseCursor]);

  const deleteRecord = async (id: string) => {
    try {
      await fetch(`/api/sysdb/records/${id}`, { method: "DELETE" });
      setBrowseRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
      {/* Header — click to toggle */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-lg flex items-center justify-center">
            <Database className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">System Database</span>
          <span className="text-xs text-gray-500 hidden sm:inline">· deep search · upload · browse · verify</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-gray-800/50 p-4 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-800/40 rounded-lg p-1">
            {(["upload", "search", "browse", "stats"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "browse") { setBrowseCursor(null); void loadBrowse(false); }
                  if (tab === "stats") void loadStats();
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-cyan-600/80 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── UPLOAD TAB ─────────────────────────────────────────────── */}
          {activeTab === "upload" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Record Type</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as RecordType)}
                    className="w-full bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  >
                    {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((t) => (
                      <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Label / Name *</label>
                  <input
                    type="text"
                    value={uploadLabel}
                    onChange={(e) => setUploadLabel(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Value / Reference</label>
                <input
                  type="text"
                  value={uploadValue}
                  onChange={(e) => setUploadValue(e.target.value)}
                  placeholder="Reference number, barcode value, QR text, etc."
                  className="w-full bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="e.g. staff, engineering, level-3"
                  className="w-full bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                />
              </div>

              {/* Image attachment */}
              {["face", "fingerprint", "iris", "image"].includes(uploadType) && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 block">Image Data</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void openCamera("upload")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/70 text-xs text-gray-200 rounded-lg border border-gray-700/50 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/70 text-xs text-gray-200 rounded-lg border border-gray-700/50 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload File
                    </button>
                    {uploadImage && (
                      <button onClick={() => setUploadImage(null)} className="p-1.5 text-gray-500 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {uploadImage && (
                    <img src={uploadImage} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-700/50 object-cover" />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadImage(await readFileAsDataUrl(file));
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={isUploading || !uploadLabel.trim()}
                className="w-full py-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Save to System Database
              </button>

              {uploadResult && (
                <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${uploadResult.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
                  {uploadResult.ok ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {uploadResult.message}
                </div>
              )}
            </div>
          )}

          {/* ── SEARCH TAB ─────────────────────────────────────────────── */}
          {activeTab === "search" && (
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-gray-800/30 rounded-lg p-1">
                <button
                  onClick={() => setSearchMode("text")}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${searchMode === "text" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Text / Reference / Barcode / QR
                </button>
                <button
                  onClick={() => setSearchMode("face")}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors ${searchMode === "face" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  Facial Matching
                </button>
              </div>

              {searchMode === "text" && (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleTextSearch()}
                      placeholder="Search label, value, reference, barcode…"
                      className="flex-1 bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                    />
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as "" | RecordType)}
                      className="bg-gray-800/60 text-white text-xs px-2 py-2 rounded-lg border border-gray-700/50 focus:outline-none"
                    >
                      <option value="">All types</option>
                      {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((t) => (
                        <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => void handleTextSearch()}
                      disabled={isSearching || !searchQuery.trim()}
                      className="p-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg disabled:opacity-40"
                    >
                      {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </>
              )}

              {searchMode === "face" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Capture or upload a face image to search the database</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void openCamera("search")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/70 text-xs text-gray-200 rounded-lg border border-gray-700/50"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture
                    </button>
                    <button
                      onClick={() => searchFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700/70 text-xs text-gray-200 rounded-lg border border-gray-700/50"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload
                    </button>
                    {faceSearchImage && (
                      <button
                        onClick={() => void handleFaceSearch()}
                        disabled={isSearching}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-xs rounded-lg disabled:opacity-40"
                      >
                        {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Match Face
                      </button>
                    )}
                  </div>
                  {faceSearchImage && (
                    <img src={faceSearchImage} alt="Probe" className="h-20 w-auto rounded-lg border border-gray-700/50 object-cover" />
                  )}
                  <input
                    ref={searchFileRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setFaceSearchImage(await readFileAsDataUrl(file));
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                  {searchResults.map((result: any, idx) => {
                    // DeepSearchMatch: { record, score, matchReason, strategy }
                    // FaceMatch: { knownFaceId, label, confidence, reason }
                    const isDeep = result.record !== undefined;
                    const rec: DBRecord | null = isDeep ? result.record : null;
                    const displayLabel = rec?.label || result.label || "Unknown";
                    const displayValue = rec?.value || "";
                    const displayType = rec?.recordType || result.recordType || "";
                    const score = isDeep ? result.score : result.confidence;
                    const reason = isDeep ? result.matchReason : result.reason;
                    const strategy = isDeep ? result.strategy : "ai";
                    const strategyColors: Record<string, string> = {
                      fts: "text-blue-400", fuzzy: "text-amber-400", exact: "text-emerald-400", ai: "text-purple-400"
                    };
                    return (
                      <div key={rec?.id || result.knownFaceId || idx} className="p-2.5 bg-gray-800/40 rounded-lg border border-gray-700/40">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {displayType && (
                            <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                              {RECORD_TYPE_ICONS[displayType as RecordType]}
                              {RECORD_TYPE_LABELS[displayType as RecordType] || displayType}
                            </span>
                          )}
                          {score !== undefined && (
                            <span className="text-[10px] text-emerald-400">{Math.round(score * 100)}% relevance</span>
                          )}
                          {strategy && (
                            <span className={`text-[10px] ${strategyColors[strategy] || "text-gray-400"}`}>
                              [{strategy}]
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-white">{displayLabel}</p>
                        {displayValue && <p className="text-[11px] text-gray-400 truncate">{displayValue}</p>}
                        {reason && <p className="text-[10px] text-gray-500 italic mt-0.5">{reason}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {!isSearching && searchDone && searchResults.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">No matching records found</p>
              )}

              {/* Inline Verify section within search */}
              <div className="pt-2 border-t border-gray-800/30">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> Verify a record by ID
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyId}
                    onChange={(e) => setVerifyId(e.target.value)}
                    placeholder="Paste record UUID…"
                    className="flex-1 bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                  />
                  <button
                    onClick={() => void handleVerify()}
                    disabled={isVerifying || !verifyId.trim()}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg disabled:opacity-40"
                  >
                    {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {verifyResult && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs border flex items-start gap-2 ${verifyResult.valid ? (verifyResult.integrityOk !== false ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-amber-500/10 border-amber-500/20 text-amber-300") : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                    {verifyResult.valid
                      ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                    {verifyResult.details}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BROWSE TAB ─────────────────────────────────────────────── */}
          {activeTab === "browse" && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <select
                  value={browseFilter}
                  onChange={(e) => { setBrowseFilter(e.target.value as "" | RecordType); setBrowseCursor(null); }}
                  className="flex-1 bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none"
                >
                  <option value="">All types</option>
                  {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((t) => (
                    <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setBrowseCursor(null); void loadBrowse(false); }}
                  disabled={isBrowsing}
                  className="p-2 bg-gray-800/60 hover:bg-gray-700 rounded-lg text-gray-300 disabled:opacity-40"
                  title="Refresh"
                >
                  {isBrowsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                {browseRecords.length === 0 && !isBrowsing && (
                  <p className="text-xs text-gray-500 text-center py-3">No records found. Upload some to get started.</p>
                )}
                {browseRecords.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-2 p-2 bg-gray-800/30 rounded-lg border border-gray-700/30 group">
                    <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0">
                      {RECORD_TYPE_ICONS[rec.recordType as RecordType]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{rec.label}</p>
                      {rec.value && <p className="text-[10px] text-gray-400 truncate">{rec.value}</p>}
                      <p className="text-[10px] text-gray-600">{RECORD_TYPE_LABELS[rec.recordType as RecordType]} · {rec.sourceModule}</p>
                    </div>
                    <button
                      onClick={() => void deleteRecord(rec.id)}
                      className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete record"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Load more (cursor pagination) */}
              {browseHasMore && (
                <button
                  onClick={() => void loadBrowse(true)}
                  disabled={isBrowsing}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-700/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isBrowsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  Load more
                </button>
              )}
            </div>
          )}

          {/* ── STATS TAB ──────────────────────────────────────────────── */}
          {activeTab === "stats" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5" /> Database overview
                </p>
                <button onClick={() => void loadStats()} disabled={isLoadingStats} className="p-1 text-gray-500 hover:text-white">
                  {isLoadingStats ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </button>
              </div>

              {!stats && !isLoadingStats && (
                <p className="text-xs text-gray-500 text-center py-4">Click refresh to load statistics</p>
              )}

              {stats && !stats.error && (
                <>
                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Total", value: stats.total, color: "text-cyan-400" },
                      { label: "Active", value: stats.active, color: "text-emerald-400" },
                      { label: "Deleted", value: stats.deleted, color: "text-red-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-800/40 rounded-lg p-2 text-center">
                        <p className={`text-sm font-bold ${color}`}>{value.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* By type */}
                  {Object.keys(stats.byType || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">By Record Type</p>
                      <div className="space-y-1">
                        {Object.entries(stats.byType).sort(([, a], [, b]) => b - a).map(([type, count]) => {
                          const pct = stats.active > 0 ? Math.round((count / stats.active) * 100) : 0;
                          return (
                            <div key={type} className="flex items-center gap-2">
                              <span className="flex items-center gap-1 w-24 shrink-0 text-[10px] text-gray-400">
                                {RECORD_TYPE_ICONS[type as RecordType]}
                                {RECORD_TYPE_LABELS[type as RecordType] || type}
                              </span>
                              <div className="flex-1 bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 w-8 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* By module */}
                  {Object.keys(stats.byModule || {}).length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider">By Module</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(stats.byModule).sort(([, a], [, b]) => b - a).map(([mod, count]) => (
                          <span key={mod} className="text-[10px] bg-gray-800/50 text-gray-400 px-2 py-0.5 rounded-full">
                            {mod}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {stats?.error && (
                <p className="text-xs text-red-400 text-center py-2">{stats.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Camera overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden w-full max-w-sm">
            <div className="flex items-center justify-between p-3 border-b border-gray-800">
              <span className="text-sm font-medium text-white">Camera Capture</span>
              <button onClick={closeCamera} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="p-3 flex gap-2">
              <button
                onClick={captureFromCamera}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Capture
              </button>
              <button onClick={closeCamera} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
