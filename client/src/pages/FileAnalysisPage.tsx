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
} from "lucide-react";

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
        return "text-red-400 bg-red-900/30 border-red-600";
      case "medium":
        return "text-yellow-400 bg-yellow-900/30 border-yellow-600";
      default:
        return "text-green-400 bg-green-900/30 border-green-600";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">File Analysis</h1>
            <p className="text-gray-400">
              Detect, extract, analyze documents & generate reports
            </p>
          </div>
          <button
            onClick={clearResults}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-400" />
                Upload & Analyze
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
                className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                    <span className="text-gray-400">Processing...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-8 h-8 text-gray-500" />
                    <span className="text-gray-400">
                      Click to upload file for analysis
                    </span>
                    <span className="text-xs text-gray-500">
                      PDF, DOCX, TXT, Images
                    </span>
                  </>
                )}
              </button>

              {currentFile && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(currentFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-green-400" />
                Generate Document
              </h2>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="text-sm text-gray-400 block mb-1">
                      Audience
                    </label>
                    <select
                      value={docAudience}
                      onChange={(e) => setDocAudience(e.target.value)}
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full h-24 bg-gray-800 text-white p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={handleGenerateDoc}
                  disabled={!docContent.trim() || isGenerating}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4" />
                  )}
                  Generate
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {lastReport && (
              <>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Search className="w-5 h-5 text-purple-400" />
                    Detection
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-800 rounded-lg p-2">
                      <p className="text-gray-400">Type</p>
                      <p className="font-medium">
                        {lastReport.detection.detectedMime || "Unknown"}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-2">
                      <p className="text-gray-400">Size</p>
                      <p className="font-medium">
                        {(lastReport.detection.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Analysis
                  </h3>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-300">
                      {lastReport.analysis.summary}
                    </p>

                    {lastReport.analysis.riskLevel && (
                      <div
                        className={`p-3 rounded-lg border ${getRiskColor(
                          lastReport.analysis.riskLevel
                        )}`}
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
                        <p className="text-sm text-gray-400 mb-2">Key Findings:</p>
                        <ul className="space-y-1">
                          {lastReport.analysis.keyFindings.map((finding, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lastReport.analysis.recommendations?.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-2">
                          Recommendations:
                        </p>
                        <ul className="space-y-1">
                          {lastReport.analysis.recommendations.map((rec, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-green-300"
                            >
                              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {generateDocument.data && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Generated Document</h3>
                  <button className="p-2 text-gray-400 hover:text-white">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-auto">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {generateDocument.data.rendered}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <CyrusAssistant 
        module="documents" 
        context={`User is analyzing documents. ${currentFile ? `Current file: ${currentFile.name}` : "No file uploaded"}`}
        compact={true}
      />
    </div>
  );
}
