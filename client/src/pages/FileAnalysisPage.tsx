import { useState, useRef } from "react";
import { useFileAnalysis } from "../hooks/useFileAnalysis";
import { CyrusAssistant } from "../components/CyrusAssistant";
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

export function FileAnalysisPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("report");
  const [docContent, setDocContent] = useState("");
  const [docAudience, setDocAudience] = useState("official");

  const {
    currentFile,
    lastReport,
    fullPipeline,
    generateDocument,
    isProcessing,
    isGenerating,
    clearResults,
  } = useFileAnalysis();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fullPipeline.mutate(file);
  };

  const handleGenerateDoc = () => {
    if (!docContent.trim()) return;
    generateDocument.mutate({
      docType,
      content: docContent,
      audience: docAudience,
    });
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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <FileUp className="w-4 h-4 text-white" />
                  </div>
                  <span>Upload & Analyze</span>
                </h2>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full h-36 border-2 border-dashed border-gray-700/50 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
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
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
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
                        <option value="summary">Summary</option>
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
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {lastReport && (
                <>
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
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
                  </div>

                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-400" />
                      Analysis Report
                    </h3>

                    <div className="space-y-4">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {lastReport.analysis.summary}
                      </p>

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

                      {lastReport.analysis.keyFindings?.length > 0 && (
                        <div>
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

                      {lastReport.analysis.recommendations && lastReport.analysis.recommendations.length > 0 && (
                        <div>
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
                    </div>
                  </div>
                </>
              )}

              {generateDocument.data && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-green-400" />
                      Generated Document
                    </h3>
                    <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 max-h-64 overflow-auto border border-gray-700/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono text-gray-300">
                      {generateDocument.data.rendered}
                    </pre>
                  </div>
                </div>
              )}

              {!lastReport && !generateDocument.data && (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    CYRUS Document AI
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Ask CYRUS to help analyze documents, summarize content, or generate reports.
                  </p>
                  <CyrusAssistant 
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
