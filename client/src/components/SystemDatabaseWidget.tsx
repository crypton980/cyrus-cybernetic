/**
 * SystemDatabaseWidget
 *
 * A reusable collapsible panel that can be placed in any module page.
 * Features:
 * - Upload records to the system database (facial, fingerprint, iris,
 *   barcode, QR code, reference numbers, documents, images, text)
 * - Search the database by text / reference / barcode / QR / face image
 * - Camera capture support for face enrollment
 */

import { useState, useRef, useCallback } from "react";
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
  createdAt: string;
}

interface SearchMatch {
  id: string;
  recordType: string;
  label: string;
  value: string;
  confidence?: number;
  reason?: string;
  record?: DBRecord;
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
  /** If false, the widget starts collapsed */
  defaultOpen?: boolean;
}

export function SystemDatabaseWidget({ sourceModule, defaultOpen = false }: SystemDatabaseWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<"upload" | "search" | "browse">("upload");

  // Upload form state
  const [uploadType, setUploadType] = useState<RecordType>("face");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadValue, setUploadValue] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"" | RecordType>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DBRecord[] | SearchMatch[]>([]);
  const [searchMode, setSearchMode] = useState<"text" | "face">("text");
  const [faceSearchImage, setFaceSearchImage] = useState<string | null>(null);

  // Browse state
  const [browseRecords, setBrowseRecords] = useState<DBRecord[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<"" | RecordType>("");

  // Camera for face capture
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
    } catch (err: any) {
      setUploadResult({ ok: false, message: err?.message || "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Text Search ───────────────────────────────────────────────────────────
  const handleTextSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() });
      if (searchType) params.set("type", searchType);
      const res = await fetch(`/api/sysdb/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.matches || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Face Search ───────────────────────────────────────────────────────────
  const handleFaceSearch = async () => {
    if (!faceSearchImage) return;
    setIsSearching(true);
    setSearchResults([]);
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
    }
  };

  // ── Browse ────────────────────────────────────────────────────────────────
  const loadBrowse = async () => {
    setIsBrowsing(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (browseFilter) params.set("type", browseFilter);
      const res = await fetch(`/api/sysdb/records?${params}`);
      if (!res.ok) throw new Error("Browse failed");
      const data = await res.json();
      setBrowseRecords(data.records || []);
    } catch {
      setBrowseRecords([]);
    } finally {
      setIsBrowsing(false);
    }
  };

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
          <span className="text-xs text-gray-500 hidden sm:inline">· upload, search &amp; browse records</span>
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
            {(["upload", "search", "browse"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "browse") void loadBrowse();
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
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                  {searchResults.map((result: any, idx) => {
                    const rec: DBRecord = result.record || result;
                    return (
                      <div key={rec.id || idx} className="p-2.5 bg-gray-800/40 rounded-lg border border-gray-700/40">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                            {RECORD_TYPE_ICONS[rec.recordType as RecordType]}
                            {RECORD_TYPE_LABELS[rec.recordType as RecordType] || rec.recordType}
                          </span>
                          {result.confidence !== undefined && (
                            <span className="text-[10px] text-emerald-400">{Math.round(result.confidence * 100)}% match</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-white">{rec.label}</p>
                        {rec.value && <p className="text-[11px] text-gray-400 truncate">{rec.value}</p>}
                        {result.reason && <p className="text-[10px] text-gray-500 italic">{result.reason}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {isSearching === false && searchResults.length === 0 && (searchQuery || faceSearchImage) && (
                <p className="text-xs text-gray-500 text-center py-2">No matching records found</p>
              )}
            </div>
          )}

          {/* ── BROWSE TAB ─────────────────────────────────────────────── */}
          {activeTab === "browse" && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <select
                  value={browseFilter}
                  onChange={(e) => setBrowseFilter(e.target.value as "" | RecordType)}
                  className="flex-1 bg-gray-800/60 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none"
                >
                  <option value="">All types</option>
                  {(Object.keys(RECORD_TYPE_LABELS) as RecordType[]).map((t) => (
                    <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  onClick={() => void loadBrowse()}
                  disabled={isBrowsing}
                  className="p-2 bg-gray-800/60 hover:bg-gray-700 rounded-lg text-gray-300 disabled:opacity-40"
                >
                  {isBrowsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
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
                    {rec.imageData && (
                      <img src={rec.imageData} alt={rec.label} className="w-8 h-8 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{rec.label}</p>
                      {rec.value && <p className="text-[10px] text-gray-400 truncate">{rec.value}</p>}
                      <p className="text-[10px] text-gray-600">{RECORD_TYPE_LABELS[rec.recordType as RecordType]} · {rec.sourceModule}</p>
                    </div>
                    <button
                      onClick={() => void deleteRecord(rec.id)}
                      className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
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
