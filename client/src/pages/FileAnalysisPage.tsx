import { useEffect, useRef, useState } from "react";
import { useFileAnalysis } from "../hooks/useFileAnalysis.js";
import { CyrusHumanoid } from "../components/CyrusHumanoid.js";
import {
  FileUp,
  FileText,
  Search,
  FileCheck,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowLeft,
  Sparkles,
  Shield,
  Brain,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

interface ModuleStatus {
  bridgeReachable: boolean;
  documentsModuleAvailable: boolean;
  legalEndpoint: string;
  templates: string[];
  statistics: {
    total_processed?: number;
    cache_size?: number;
    knowledge_base_size?: number;
    templates_available?: number;
    interface_syncs?: number;
  } | null;
  error?: string;
}

export function FileAnalysisPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualRefInputRef = useRef<HTMLInputElement>(null);
  const splitPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneScrollRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState("report");
  const [docContent, setDocContent] = useState("");
  const [docAudience, setDocAudience] = useState("official");
  const [targetPages, setTargetPages] = useState(12);
  const [wordsPerPage, setWordsPerPage] = useState(280);
  const [includeImages, setIncludeImages] = useState(true);
  const [imageStyle, setImageStyle] = useState<"realistic_3d" | "graphical" | "schematic">("graphical");
  const [visualPrompt, setVisualPrompt] = useState("");
  const [visualReferenceFile, setVisualReferenceFile] = useState<File | null>(null);
  const [docPreviewMode, setDocPreviewMode] = useState<"layout" | "source">("layout");
  const [jurisdiction, setJurisdiction] = useState("Botswana");
  const [strictLegalReview, setStrictLegalReview] = useState(true);
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus | null>(null);
  const [moduleStatusLoading, setModuleStatusLoading] = useState(false);
  const [leftPanePercent, setLeftPanePercent] = useState(42);
  const [draggingDivider, setDraggingDivider] = useState(false);
  const [copySummaryState, setCopySummaryState] = useState<"idle" | "copied" | "failed">("idle");
  const [isWideScreen, setIsWideScreen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );

  const {
    currentFile,
    lastReport,
    currentJob,
    currentDocgenJob,
    generatedDocument,
    docgenJobs,
    savedReports,
    fullPipeline,
    loadReport,
    generateDocument,
    cancelDocumentGeneration,
    resumeDocumentGeneration,
    generateVisual,
    openDocgenJob,
    isProcessing,
    isGenerating,
    isGeneratingVisual,
    clearResults,
  } = useFileAnalysis();

  const analysisError = fullPipeline.error instanceof Error ? fullPipeline.error.message : null;
  const docGenerationError =
    generateDocument.error instanceof Error ? generateDocument.error.message : null;
  const resumeGenerationError =
    resumeDocumentGeneration.error instanceof Error ? resumeDocumentGeneration.error.message : null;
  const visualGenerationError =
    generateVisual.error instanceof Error ? generateVisual.error.message : null;

  const openSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!draggingDivider) return;

    const onMouseMove = (event: MouseEvent) => {
      if (!splitPaneRef.current) return;
      const rect = splitPaneRef.current.getBoundingClientRect();
      const rawPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedPercent = Math.max(30, Math.min(62, rawPercent));
      setLeftPanePercent(clampedPercent);
    };

    const onMouseUp = () => {
      setDraggingDivider(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [draggingDivider]);

  useEffect(() => {
    const onResize = () => setIsWideScreen(window.innerWidth >= 1280);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadModuleStatus = async () => {
      setModuleStatusLoading(true);
      try {
        const res = await fetch("/api/files/module-status");
        const data = await res.json();
        if (!ignore) {
          setModuleStatus(data as ModuleStatus);
        }
      } catch (error) {
        if (!ignore) {
          setModuleStatus({
            bridgeReachable: false,
            documentsModuleAvailable: false,
            legalEndpoint: "/legal/analyze",
            templates: [],
            statistics: null,
            error: error instanceof Error ? error.message : "Failed to load module status",
          });
        }
      } finally {
        if (!ignore) {
          setModuleStatusLoading(false);
        }
      }
    };

    void loadModuleStatus();
    return () => {
      ignore = true;
    };
  }, []);

  const copySummaryToClipboard = async () => {
    if (!lastReport?.analysis.summary) return;
    try {
      await navigator.clipboard.writeText(lastReport.analysis.summary);
      setCopySummaryState("copied");
    } catch {
      setCopySummaryState("failed");
    }
  };

  useEffect(() => {
    if (copySummaryState === "idle") return;
    const timer = window.setTimeout(() => setCopySummaryState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [copySummaryState]);

  const resetPaneWidth = () => setLeftPanePercent(42);

  const adjustPaneWidth = (delta: number) => {
    setLeftPanePercent((prev) => Math.max(30, Math.min(62, prev + delta)));
  };

  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isWideScreen) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      adjustPaneWidth(-2);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      adjustPaneWidth(2);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setLeftPanePercent(30);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setLeftPanePercent(62);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetPaneWidth();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fullPipeline.mutate({ file, jurisdiction, strictLegalReview });
    // Allow selecting the same file again to trigger a new analysis run.
    e.target.value = "";
  };

  const handleGenerateDoc = () => {
    if (!docContent.trim()) return;
    generateDocument.mutate({
      docType,
      content: docContent,
      audience: docAudience,
      targetPages,
      wordsPerPage,
      includeImages,
      imageStyle,
    });
  };

  const handleGenerateExecutiveBrief = () => {
    if (!lastReport) return;

    const decisionLines = (lastReport.analysis.decisionActions || []).map((item) => {
      return `- Action: ${item.action}; Owner: ${item.owner}; Deadline: ${item.deadline}; Obligation: ${item.obligation}`;
    });

    const executiveInput = [
      `Document Type: ${lastReport.analysis.documentType || "unknown"}`,
      `Summary: ${lastReport.analysis.summary || "N/A"}`,
      `Interpretation: ${lastReport.analysis.interpretation || "N/A"}`,
      `Executive Brief: ${lastReport.analysis.executiveBrief || "N/A"}`,
      "Decision and Action Items:",
      decisionLines.length > 0 ? decisionLines.join("\n") : "- None extracted",
    ].join("\n\n");

    generateDocument.mutate({
      docType: "brief",
      content: executiveInput,
      audience: "executive",
    });
  };

  const handleGenerateVisual = () => {
    if (!visualPrompt.trim() && !docContent.trim()) return;
    generateVisual.mutate({
      prompt: visualPrompt.trim() || docContent.trim(),
      style: imageStyle,
      mode: visualReferenceFile ? "edit" : "generate",
      referenceFile: visualReferenceFile,
    });
  };

  const handleOpenPrintPreview = () => {
    const html = generatedDocument?.htmlRendered;
    if (!html) return;
    const previewWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!previewWindow) return;
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case "high":
        return "text-red-400 bg-red-500/20 border-red-500/30";
      case "medium":
        return "text-amber-400 bg-amber-500/20 border-amber-500/30";
      default:
        return "text-emerald-400 bg-emerald-500/20 border-emerald-500/30";
    }
  };

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative h-full p-4 md:p-6">
        <div className="h-full w-full max-w-[1600px] mx-auto flex flex-col min-h-0">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                      Document Intelligence
                    </h1>
                    <p className="text-gray-400 text-sm">Analysis & Generation Engine</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Processing Ready</span>
              </div>
              <button
                onClick={clearResults}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Search className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-gray-400">Detection</span>
              </div>
              <p className="text-lg font-bold text-purple-400">Active</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-gray-400">Analysis</span>
              </div>
              <p className="text-lg font-bold text-blue-400">Ready</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs text-gray-400">Risk Scan</span>
              </div>
              <p className="text-lg font-bold text-amber-400">Enabled</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-gray-400">Generator</span>
              </div>
              <p className="text-lg font-bold text-green-400">Online</p>
            </div>
          </div>

          <div ref={splitPaneRef} className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
            <div
              className="space-y-6 overflow-y-auto pr-1 scrollbar-thin min-h-0"
              style={isWideScreen ? { width: `calc(${leftPanePercent}% - 12px)` } : undefined}
            >
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <FileUp className="w-4 h-4 text-white" />
                  </div>
                  <span>Upload & Analyze</span>
                </h2>

                <input
                  ref={fileInputRef}
                  type="file"
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full h-44 border-2 border-dashed border-gray-700/50 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-10 h-10 text-purple-400 animate-spin" />
                      <span className="text-gray-400">Processing document...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                        <FileUp className="w-6 h-6 text-gray-500 group-hover:text-purple-400 transition-colors" />
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-300">
                        Click to upload file for analysis
                      </span>
                      <span className="text-xs text-gray-500">
                        PDF, DOCX, TXT, Images
                      </span>
                    </>
                  )}
                </button>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Jurisdiction Context</label>
                    <select
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      className="w-full bg-gray-800/50 text-white px-3 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    >
                      <option value="Botswana">Botswana</option>
                      <option value="Global">Global</option>
                      <option value="South Africa">South Africa</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="European Union">European Union</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-700/50 bg-gray-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={strictLegalReview}
                        onChange={(e) => setStrictLegalReview(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cyan-500"
                      />
                      <span className="text-sm text-gray-200">Strict Legal Review Mode</span>
                    </label>
                  </div>
                </div>

                {currentFile && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl flex items-center gap-3 border border-gray-700/50">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{currentFile.name}</p>
                      <p className="text-xs text-gray-400">
                        {(currentFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-cyan-200 uppercase tracking-wider">Documents Module Integration</p>
                      <p className="text-sm text-cyan-100">
                        Existing documents UI refined to use the new legal analysis and bridge developments.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setModuleStatusLoading(true);
                        try {
                          const res = await fetch("/api/files/module-status");
                          const data = await res.json();
                          setModuleStatus(data as ModuleStatus);
                        } finally {
                          setModuleStatusLoading(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white"
                    >
                      {moduleStatusLoading ? "Refreshing..." : "Refresh Status"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-3">
                      <p className="text-xs text-cyan-200/80">Bridge</p>
                      <p className="text-sm font-medium text-white mt-1">
                        {moduleStatus?.bridgeReachable ? "Reachable" : "Unavailable"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-3">
                      <p className="text-xs text-cyan-200/80">Documents Module</p>
                      <p className="text-sm font-medium text-white mt-1">
                        {moduleStatus?.documentsModuleAvailable ? "Integrated" : "Not detected"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-3">
                      <p className="text-xs text-cyan-200/80">Legal Endpoint</p>
                      <p className="text-sm font-medium text-white mt-1">{moduleStatus?.legalEndpoint || "/legal/analyze"}</p>
                    </div>
                    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-3">
                      <p className="text-xs text-cyan-200/80">Templates Available</p>
                      <p className="text-sm font-medium text-white mt-1">
                        {moduleStatus?.statistics?.templates_available ?? moduleStatus?.templates?.length ?? 0}
                      </p>
                    </div>
                  </div>
                  {moduleStatus?.templates && moduleStatus.templates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {moduleStatus.templates.map((template) => (
                        <span
                          key={template}
                          className="px-2.5 py-1 text-xs rounded-full bg-cyan-900/50 border border-cyan-700/40 text-cyan-100"
                        >
                          {template}
                        </span>
                      ))}
                    </div>
                  )}
                  {moduleStatus?.error && (
                    <p className="text-xs text-amber-300">Status note: {moduleStatus.error}</p>
                  )}
                </div>

                {analysisError && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <p className="text-sm text-red-300">Analysis failed: {analysisError}</p>
                  </div>
                )}

                {currentJob && (
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-blue-100 font-medium">{currentJob.stageLabel}</p>
                        <p className="text-xs text-blue-200/80">Job {currentJob.id.slice(0, 8)} • {currentJob.status}</p>
                      </div>
                      <span className="text-sm text-blue-200 font-semibold">{currentJob.progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${Math.max(4, currentJob.progress)}%` }}
                      />
                    </div>
                    {currentJob.error && (
                      <p className="text-sm text-red-300">{currentJob.error}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-700 rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4 text-white" />
                  </div>
                  <span>Recent Analyses</span>
                </h2>

                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                  {savedReports.length === 0 && (
                    <p className="text-sm text-gray-400">No saved analyses yet.</p>
                  )}

                  {savedReports.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => loadReport.mutate(job.id)}
                      className="w-full text-left p-3 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-cyan-500/40 hover:bg-gray-800/70 transition-all"
                    >
                      <p className="text-sm font-medium text-white truncate">{job.originalName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : new Date(job.updatedAt).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span>Generate Document</span>
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Document Type</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                      >
                        <option value="report">Report</option>
                        <option value="brief">Brief</option>
                        <option value="memo">Memo</option>
                        <option value="letter">Letter</option>
                        <option value="summary">Summary</option>
                        <option value="book">Book</option>
                        <option value="short_story">Short Story</option>
                        <option value="document">Formal Document</option>
                        <option value="legal">Legal Document</option>
                        <option value="technical">Technical Doc</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Target Audience</label>
                      <select
                        value={docAudience}
                        onChange={(e) => setDocAudience(e.target.value)}
                        className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                      >
                        <option value="official">Official</option>
                        <option value="executive">Executive</option>
                        <option value="technical">Technical</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Target Pages (up to 400)</label>
                      <input
                        type="number"
                        min={1}
                        max={400}
                        value={targetPages}
                        onChange={(e) => setTargetPages(Math.max(1, Math.min(400, Number(e.target.value || 1))))}
                        className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Words Per Page</label>
                      <input
                        type="number"
                        min={180}
                        max={420}
                        value={wordsPerPage}
                        onChange={(e) => setWordsPerPage(Math.max(180, Math.min(420, Number(e.target.value || 280))))}
                        className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-end">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-700/50 bg-gray-800/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeImages}
                        onChange={(e) => setIncludeImages(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-500"
                      />
                      <span className="text-sm text-gray-200">Generate Visual Attachments</span>
                    </label>
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">Visual Style</label>
                      <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value as "realistic_3d" | "graphical" | "schematic")}
                        className="w-full bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                        disabled={!includeImages}
                      >
                        <option value="graphical">Graphical Illustration</option>
                        <option value="realistic_3d">Realistic 3D</option>
                        <option value="schematic">Schematic / Drafting</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Enter content or notes for document generation..."
                    className="w-full h-28 bg-gray-800/50 text-white p-4 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50 placeholder-gray-500"
                  />

                  <button
                    onClick={handleGenerateDoc}
                    disabled={!docContent.trim() || isGenerating}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Generate Document
                  </button>

                  {currentDocgenJob && (
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-emerald-100 font-medium">{currentDocgenJob.stage}</p>
                          <p className="text-xs text-emerald-200/80">
                            Long-form generation job {currentDocgenJob.id.slice(0, 8)} • {currentDocgenJob.status}
                          </p>
                          {(currentDocgenJob.recoveredFromDisk || currentDocgenJob.resumedFromJobId) && (
                            <p className="text-[11px] text-emerald-200/70 mt-1">
                              {currentDocgenJob.recoveredFromDisk ? "Recovered after restart" : ""}
                              {currentDocgenJob.recoveredFromDisk && currentDocgenJob.resumedFromJobId ? " • " : ""}
                              {currentDocgenJob.resumedFromJobId ? `Resumed from ${currentDocgenJob.resumedFromJobId.slice(0, 8)}` : ""}
                            </p>
                          )}
                        </div>
                        {!['completed', 'failed', 'canceled'].includes(currentDocgenJob.status) && (
                          <button
                            onClick={() => cancelDocumentGeneration.mutate(currentDocgenJob.id)}
                            disabled={cancelDocumentGeneration.isPending}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-600/80 hover:bg-red-500 text-white disabled:opacity-50"
                          >
                            {cancelDocumentGeneration.isPending ? "Canceling..." : "Cancel"}
                          </button>
                        )}
                        {['failed', 'canceled'].includes(currentDocgenJob.status) && (
                          <button
                            onClick={() => resumeDocumentGeneration.mutate(currentDocgenJob.id)}
                            disabled={resumeDocumentGeneration.isPending}
                            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white disabled:opacity-50"
                          >
                            {resumeDocumentGeneration.isPending ? "Resuming..." : "Resume"}
                          </button>
                        )}
                        {currentDocgenJob.status === "completed" && (
                          <button
                            onClick={() => void openDocgenJob(currentDocgenJob.id)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white"
                          >
                            Open Result
                          </button>
                        )}
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                          style={{ width: `${Math.max(4, currentDocgenJob.progress)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-200/80">
                        <span>{currentDocgenJob.progress}%</span>
                        <span>{currentDocgenJob.error || "Large generation is running asynchronously."}</span>
                      </div>
                    </div>
                  )}

                  {docgenJobs.length > 0 && (
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Recent Generation Jobs</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                        {docgenJobs.slice(0, 8).map((job) => (
                          <div
                            key={job.id}
                            className="rounded-lg border border-gray-700/40 bg-gray-900/30 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{job.stage}</p>
                              <p className="text-[11px] text-gray-400">
                                {job.id.slice(0, 8)} • {job.status} • {job.progress}%
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => void openDocgenJob(job.id)}
                                className="px-2.5 py-1 text-[11px] rounded-md bg-gray-700/70 hover:bg-gray-600/70 text-white"
                              >
                                Open
                              </button>
                              {['failed', 'canceled'].includes(job.status) && (
                                <button
                                  onClick={() => resumeDocumentGeneration.mutate(job.id)}
                                  disabled={resumeDocumentGeneration.isPending}
                                  className="px-2.5 py-1 text-[11px] rounded-md bg-amber-600/80 hover:bg-amber-500 text-white disabled:opacity-50"
                                >
                                  Resume
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(docGenerationError || resumeGenerationError) && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-sm text-red-300">Document generation failed: {resumeGenerationError || docGenerationError}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span>Visual Lab (3D / Graphic / Schematic)</span>
                </h2>

                <input
                  ref={visualRefInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setVisualReferenceFile(file);
                  }}
                />

                <div className="space-y-3">
                  <textarea
                    value={visualPrompt}
                    onChange={(e) => setVisualPrompt(e.target.value)}
                    placeholder="Describe the visual you want (or leave blank to use the document content context)"
                    className="w-full h-24 bg-gray-800/50 text-white p-4 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-gray-700/50 placeholder-gray-500"
                  />

                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      onClick={() => visualRefInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-gray-800/70 hover:bg-gray-700 text-sm text-gray-200 border border-gray-700/50"
                    >
                      {visualReferenceFile ? "Change Reference" : "Upload Reference Image"}
                    </button>
                    {visualReferenceFile && (
                      <span className="text-xs text-gray-400">{visualReferenceFile.name}</span>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateVisual}
                    disabled={isGeneratingVisual || (!visualPrompt.trim() && !docContent.trim())}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGeneratingVisual ? "Generating Visual..." : "Generate / Illustrate / Draft"}
                  </button>

                  {visualGenerationError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <p className="text-sm text-red-300">Visual generation failed: {visualGenerationError}</p>
                    </div>
                  )}

                  {generateVisual.data && (
                    <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 space-y-2">
                      <p className="text-xs text-cyan-200 uppercase tracking-wider">Latest Visual</p>
                      {(generateVisual.data.url || generateVisual.data.b64_json) && (
                        <img
                          src={generateVisual.data.url || `data:image/png;base64,${generateVisual.data.b64_json}`}
                          alt="Generated visual"
                          className="w-full rounded-lg border border-cyan-800/50"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize analysis panes"
              aria-valuemin={30}
              aria-valuemax={62}
              aria-valuenow={Math.round(leftPanePercent)}
              tabIndex={0}
              className="hidden xl:flex w-3 shrink-0 items-center justify-center group cursor-col-resize"
              onMouseDown={() => setDraggingDivider(true)}
              onDoubleClick={resetPaneWidth}
              onKeyDown={handleDividerKeyDown}
            >
              <div className="h-full w-px bg-gray-700/60 group-hover:bg-cyan-500/70 transition-colors" />
            </div>

            <div
              ref={rightPaneScrollRef}
              className="space-y-6 overflow-y-auto pr-1 scrollbar-thin min-h-0"
              style={isWideScreen ? { width: `calc(${100 - leftPanePercent}% - 12px)` } : undefined}
            >
              {lastReport && (
                <>
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Search className="w-5 h-5 text-purple-400" />
                      Detection Results
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <p className="text-xs text-gray-400 mb-1">File Type</p>
                        <p className="font-medium text-purple-400">
                          {lastReport.detection.detectedMime || "Unknown"}
                        </p>
                      </div>
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <p className="text-xs text-gray-400 mb-1">File Size</p>
                        <p className="font-medium text-blue-400">
                          {(lastReport.detection.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    {lastReport.analysis.documentType && (
                      <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <p className="text-xs text-purple-200 mb-2 uppercase tracking-wider">Document Type Classifier</p>
                        <p className="text-sm text-purple-100">
                          Type: <span className="font-semibold uppercase">{lastReport.analysis.documentType}</span>
                        </p>
                        {lastReport.analysis.documentTypeConfidence && (
                          <p className="text-sm text-purple-200 mt-1">
                            Confidence: {lastReport.analysis.documentTypeConfidence}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-400" />
                      Analysis Report
                    </h3>

                    <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#11131b]/90 border border-gray-800/60 p-2 backdrop-blur-sm">
                      {[
                        ["summary", "Summary"],
                        ["knowledge", "Knowledge Lens"],
                        ["entities", "Entities"],
                        ["citations", "Citations"],
                        ["interpretation", "Interpretation"],
                        ["findings", "Findings"],
                        ["actions", "Actions"],
                        ["executive-brief", "Executive Brief"],
                        ["recommendations", "Recommendations"],
                        ["issues", "Issues"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => openSection(id)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-gray-800/70 hover:bg-cyan-600/30 text-gray-200 transition-all"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={resetPaneWidth}
                        className="hidden xl:inline-flex px-3 py-1.5 text-xs rounded-lg bg-gray-800/70 hover:bg-violet-600/30 text-gray-200 transition-all"
                      >
                        Reset Split
                      </button>
                      <button
                        onClick={() => rightPaneScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-800/70 hover:bg-blue-600/30 text-gray-200 transition-all"
                      >
                        Top
                      </button>
                      <button
                        onClick={() => {
                          if (!rightPaneScrollRef.current) return;
                          rightPaneScrollRef.current.scrollTo({
                            top: rightPaneScrollRef.current.scrollHeight,
                            behavior: "smooth",
                          });
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-800/70 hover:bg-blue-600/30 text-gray-200 transition-all"
                      >
                        Bottom
                      </button>
                      <button
                        onClick={copySummaryToClipboard}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-800/70 hover:bg-emerald-600/30 text-gray-200 transition-all"
                      >
                        {copySummaryState === "copied"
                          ? "Copied"
                          : copySummaryState === "failed"
                            ? "Copy Failed"
                            : "Copy Summary"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <p id="summary" className="text-sm text-gray-300 leading-relaxed scroll-mt-20">
                        {lastReport.analysis.summary}
                      </p>

                      {lastReport.analysis.interpretation && (
                        <div id="interpretation" className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl scroll-mt-20">
                          <p className="text-xs text-indigo-300 mb-2 uppercase tracking-wider">Interpretation</p>
                          <p className="text-sm text-indigo-100 leading-relaxed">
                            {lastReport.analysis.interpretation}
                          </p>
                        </div>
                      )}

                      {lastReport.analysis.riskLevel && (
                        <div
                          className={`p-4 rounded-xl border ${getRiskColor(lastReport.analysis.riskLevel)}`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-medium">
                              Risk Level: {lastReport.analysis.riskLevel.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.confidence && (
                        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
                          <span className="text-sm text-blue-200 font-medium">
                            Confidence: {lastReport.analysis.confidence}
                          </span>
                        </div>
                      )}

                      {(lastReport.analysis.capabilitySummary || (lastReport.analysis.knowledgeApplied && lastReport.analysis.knowledgeApplied.length > 0)) && (
                        <div id="knowledge" className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 space-y-3 scroll-mt-20">
                          <p className="text-xs text-cyan-200 uppercase tracking-wider">Knowledge And Capability Lens</p>
                          {lastReport.analysis.capabilitySummary && (
                            <p className="text-sm text-cyan-100 leading-relaxed">{lastReport.analysis.capabilitySummary}</p>
                          )}
                          {lastReport.analysis.knowledgeApplied && lastReport.analysis.knowledgeApplied.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {lastReport.analysis.knowledgeApplied.map((item, index) => (
                                <span
                                  key={`${item}-${index}`}
                                  className="px-2.5 py-1 text-xs rounded-full bg-cyan-900/50 border border-cyan-700/50 text-cyan-100"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                          {(lastReport.analysis.jurisdictionApplied || typeof lastReport.analysis.strictLegalReview === "boolean") && (
                            <div className="pt-2 border-t border-cyan-800/40">
                              <p className="text-xs text-cyan-100">
                                Jurisdiction: {lastReport.analysis.jurisdictionApplied || "Global/Unspecified"}
                              </p>
                              <p className="text-xs text-cyan-100 mt-1">
                                Strict legal review: {lastReport.analysis.strictLegalReview ? "Enabled" : "Disabled"}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {lastReport.analysis.citationAnchors && lastReport.analysis.citationAnchors.length > 0 && (
                        <div id="citations" className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/10 space-y-3 scroll-mt-20">
                          <p className="text-xs text-violet-200 uppercase tracking-wider">Citation Anchors</p>
                          <div className="space-y-2">
                            {lastReport.analysis.citationAnchors.map((citation, index) => (
                              <div key={`${citation.clause}-${index}`} className="p-3 rounded-lg bg-violet-900/30 border border-violet-700/40">
                                <p className="text-xs text-violet-200 font-semibold">{citation.clause}</p>
                                <p className="text-sm text-violet-100 mt-1">"{citation.excerpt}"</p>
                                <p className="text-xs text-violet-200 mt-2">{citation.rationale}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.entities && lastReport.analysis.entities.length > 0 && (
                        <div id="entities" className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-3 scroll-mt-20">
                          <p className="text-xs text-sky-200 uppercase tracking-wider">Extracted Entities</p>
                          <div className="flex flex-wrap gap-2">
                            {lastReport.analysis.entities.map((entity, index) => (
                              <span
                                key={`${entity.type}-${entity.value}-${index}`}
                                className="px-2.5 py-1.5 text-xs rounded-full bg-sky-950/40 border border-sky-700/40 text-sky-100"
                              >
                                <span className="font-semibold uppercase mr-1">{entity.type}:</span>
                                {entity.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.keyFindings?.length > 0 && (
                        <div id="findings" className="scroll-mt-20">
                          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Key Findings</p>
                          <div className="space-y-2">
                            {lastReport.analysis.keyFindings.map((finding: string, i: number) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg"
                              >
                                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-300">{finding}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.decisionActions && lastReport.analysis.decisionActions.length > 0 && (
                        <div id="actions" className="scroll-mt-20">
                          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Decision / Action Extractor</p>
                          <div className="space-y-2">
                            {lastReport.analysis.decisionActions.map((item, i: number) => (
                              <div
                                key={i}
                                className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg"
                              >
                                <p className="text-sm text-cyan-100 font-medium">{item.action}</p>
                                <p className="text-xs text-cyan-200 mt-1">Owner: {item.owner}</p>
                                <p className="text-xs text-cyan-200">Deadline: {item.deadline}</p>
                                <p className="text-xs text-cyan-200">Obligation: {item.obligation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.executiveBrief && (
                        <div id="executive-brief" className="p-4 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl space-y-3 scroll-mt-20">
                          <p className="text-xs text-fuchsia-200 uppercase tracking-wider">Executive Brief</p>
                          <p className="text-sm text-fuchsia-100 leading-relaxed">
                            {lastReport.analysis.executiveBrief}
                          </p>
                          <button
                            onClick={handleGenerateExecutiveBrief}
                            disabled={isGenerating}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            One-Click Executive Brief
                          </button>
                        </div>
                      )}

                      {lastReport.analysis.recommendations && lastReport.analysis.recommendations.length > 0 && (
                        <div id="recommendations" className="scroll-mt-20">
                          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Recommendations</p>
                          <div className="space-y-2">
                            {lastReport.analysis.recommendations.map((rec: string, i: number) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                              >
                                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-emerald-200">{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {lastReport.analysis.issues && lastReport.analysis.issues.length > 0 && (
                        <div id="issues" className="scroll-mt-20">
                          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Issues / Gaps</p>
                          <div className="space-y-2">
                            {lastReport.analysis.issues.map((issue: string, i: number) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
                              >
                                <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-amber-100">{issue}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {generatedDocument && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-green-400" />
                      Generated Document
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDocPreviewMode("layout")}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${docPreviewMode === "layout" ? "bg-cyan-600 text-white" : "bg-gray-800/70 text-gray-300 hover:bg-gray-700/70"}`}
                      >
                        Layout
                      </button>
                      <button
                        onClick={() => setDocPreviewMode("source")}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-all ${docPreviewMode === "source" ? "bg-cyan-600 text-white" : "bg-gray-800/70 text-gray-300 hover:bg-gray-700/70"}`}
                      >
                        Source
                      </button>
                      <button
                        onClick={handleOpenPrintPreview}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                        title="Open print preview"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="text-xs text-cyan-200 uppercase tracking-wider mb-1">Document Title</p>
                    <p className="text-lg font-semibold text-white">{generatedDocument.title || "Untitled Document"}</p>
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
                      <p className="text-xs text-gray-400">Word Count</p>
                      <p className="text-sm text-white font-semibold">{generatedDocument.wordCount || 0}</p>
                    </div>
                    <div className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
                      <p className="text-xs text-gray-400">Estimated Pages</p>
                      <p className="text-sm text-white font-semibold">{generatedDocument.estimatedPages || 0}</p>
                    </div>
                    <div className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
                      <p className="text-xs text-gray-400">Target Pages</p>
                      <p className="text-sm text-white font-semibold">{generatedDocument.targetPages || targetPages}</p>
                    </div>
                  </div>

                  {Array.isArray(generatedDocument.outline) && generatedDocument.outline.length > 0 && (
                    <div className="mb-4 rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Document Breakdown</p>
                      <div className="space-y-2">
                        {generatedDocument.outline.map((item: any, index: number) => (
                          <div key={`${item.title}-${index}`} className="rounded-lg border border-gray-700/40 bg-gray-900/30 p-3">
                            <p className="text-sm text-white font-medium">{item.title}</p>
                            <p className="text-xs text-gray-400 mt-1">{item.level} • {item.purpose}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Array.isArray(generatedDocument.pullQuotes) && generatedDocument.pullQuotes.length > 0 && (
                      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
                        <p className="text-xs text-fuchsia-200 uppercase tracking-wider mb-3">Pull Quotes</p>
                        <div className="space-y-3">
                          {generatedDocument.pullQuotes.map((quote: any, index: number) => (
                            <div key={`${quote.sectionTitle}-${index}`} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-950/20 p-3">
                              <p className="text-sm italic text-fuchsia-100">"{quote.quote}"</p>
                              <p className="text-xs text-fuchsia-200/80 mt-2">{quote.sectionTitle} • {quote.placement}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(generatedDocument.graphicsPlan) && generatedDocument.graphicsPlan.length > 0 && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <p className="text-xs text-amber-200 uppercase tracking-wider mb-3">Graphics And Imagery Plan</p>
                        <div className="space-y-3">
                          {generatedDocument.graphicsPlan.map((item: any, index: number) => (
                            <div key={`${item.sectionTitle}-${index}`} className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3">
                              <p className="text-sm text-amber-100 font-medium">{item.assetType} • {item.sectionTitle}</p>
                              <p className="text-xs text-amber-200/80 mt-1">{item.placement}</p>
                              <p className="text-xs text-amber-100 mt-2">{item.brief}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {Array.isArray(generatedDocument.dataVisuals) && generatedDocument.dataVisuals.length > 0 && (
                    <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <p className="text-xs text-emerald-200 uppercase tracking-wider mb-3">Tables, Graphs, Charts And Pictography</p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {generatedDocument.dataVisuals.map((item: any) => (
                          <div key={item.id} className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-emerald-100 font-medium">{item.title}</p>
                              <span className="text-[10px] uppercase tracking-wider text-emerald-200/80">{String(item.kind).replace(/_/g, " ")}</span>
                            </div>
                            <p className="text-xs text-emerald-200/80">{item.sectionTitle} • {item.placement}</p>
                            <p className="text-xs text-emerald-100">{item.rationale}</p>
                            {Array.isArray(item.columns) && Array.isArray(item.rows) && item.columns.length > 0 && item.rows.length > 0 && (
                              <div className="overflow-x-auto rounded-md border border-emerald-500/10">
                                <table className="w-full text-xs text-left text-emerald-50">
                                  <thead className="bg-emerald-500/10">
                                    <tr>
                                      {item.columns.map((column: string) => (
                                        <th key={column} className="px-2 py-1.5 font-medium">{column}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.rows.slice(0, 4).map((row: string[], rowIndex: number) => (
                                      <tr key={`${item.id}-${rowIndex}`} className="border-t border-emerald-500/10">
                                        {row.map((cell: string, cellIndex: number) => (
                                          <td key={`${item.id}-${rowIndex}-${cellIndex}`} className="px-2 py-1.5 text-emerald-100/90">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {Array.isArray(item.labels) && Array.isArray(item.values) && item.labels.length > 0 && item.values.length > 0 && (
                              <div className="space-y-1">
                                {item.labels.map((label: string, index: number) => (
                                  <div key={`${item.id}-${label}-${index}`} className="flex items-center justify-between text-xs text-emerald-100/90 gap-3">
                                    <span className="truncate">{label}</span>
                                    <span>{item.values[index]}{item.unit || ""}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-[11px] text-emerald-200/70">Reference: {item.sourceReference}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(generatedDocument.layoutPlan) && generatedDocument.layoutPlan.length > 0 && (
                    <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                      <p className="text-xs text-blue-200 uppercase tracking-wider mb-3">Layout Blueprint</p>
                      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                        {generatedDocument.layoutPlan.map((block: any, index: number) => (
                          <div key={`${block.title}-${index}`} className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-blue-100 font-medium">{block.title}</p>
                              <span className="text-[10px] uppercase tracking-wider text-blue-200/80">{block.kind}</span>
                            </div>
                            <p className="text-xs text-blue-200/80 mt-1">{block.placement}</p>
                            <p className="text-xs text-blue-100 mt-2">{block.notes}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docPreviewMode === "layout" && generatedDocument.htmlRendered ? (
                    <div className="bg-gray-800/50 rounded-xl h-[70vh] overflow-hidden border border-gray-700/50">
                      <iframe
                        title="Document layout preview"
                        srcDoc={generatedDocument.htmlRendered}
                        className="w-full h-full bg-white"
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-800/50 rounded-xl p-4 h-[70vh] overflow-y-auto scrollbar-thin border border-gray-700/50">
                      <pre className="text-sm whitespace-pre-wrap font-mono text-gray-300">
                        {generatedDocument.rendered}
                      </pre>
                    </div>
                  )}

                  {Array.isArray(generatedDocument.attachments) && generatedDocument.attachments.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Generated Visual Attachments</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {generatedDocument.attachments.map((asset: any) => (
                          <div key={asset.id} className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-3 space-y-2">
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-900/60 border border-gray-700/50">
                              {(asset.url || asset.dataUrl) && (
                                <img
                                  src={asset.url || asset.dataUrl}
                                  alt={asset.caption || "Generated visual"}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <p className="text-sm text-gray-200 font-medium">{asset.caption || "Visual"}</p>
                            <p className="text-xs text-gray-400">{asset.sectionTitle || "General"} • {asset.style}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!lastReport && !generatedDocument && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    CYRUS Document AI
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Ask CYRUS to help analyze documents, summarize content, or generate reports.
                  </p>
                  <CyrusHumanoid
                    module="documents"
                    context={`User is analyzing documents. ${currentFile ? `Current file: ${currentFile.name}` : "No file uploaded"}`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
