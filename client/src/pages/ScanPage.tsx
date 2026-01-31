import { useState, useRef } from "react";
import { useScan } from "../hooks/useScan";
import { CyrusAssistant } from "../components/CyrusAssistant";
import {
  Camera,
  QrCode,
  FileText,
  Eye,
  Languages,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Scan,
  Sparkles,
  Globe,
  ArrowLeft,
  Zap,
  Brain,
} from "lucide-react";
import { Link } from "wouter";

export function ScanPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [translateText, setTranslateText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [copied, setCopied] = useState(false);

  const {
    lastResult,
    lastTranslation,
    scanQR,
    scanOCR,
    scanVision,
    translate,
    isScanning,
    isTranslating,
    clearResults,
  } = useScan();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = (type: "qr" | "ocr" | "vision") => {
    if (!imagePreview) return;
    const base64Data = imagePreview.split(",")[1];
    if (type === "qr") scanQR.mutate(base64Data);
    else if (type === "ocr") scanOCR.mutate(base64Data);
    else scanVision.mutate(base64Data);
  };

  const handleTranslate = () => {
    if (!translateText.trim()) return;
    translate.mutate({ text: translateText, targetLanguage: targetLang });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "ar", name: "Arabic" },
    { code: "pt", name: "Portuguese" },
    { code: "ru", name: "Russian" },
    { code: "hi", name: "Hindi" },
    { code: "sw", name: "Swahili" },
    { code: "zu", name: "Zulu" },
    { code: "tn", name: "Setswana" },
  ];

  const visionContext = lastResult 
    ? `Last scan result: ${lastResult.type} - ${lastResult.text || 'No text detected'}` 
    : imagePreview 
      ? "User has uploaded an image for scanning"
      : "No image uploaded yet";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href="/">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                      CYRUS Vision
                    </h1>
                    <p className="text-gray-400 text-sm">Optical Analysis & Translation</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">AI Ready</span>
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
                  <QrCode className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs text-gray-400">QR Scanner</span>
              </div>
              <p className="text-lg font-bold text-purple-400">Active</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-gray-400">OCR Engine</span>
              </div>
              <p className="text-lg font-bold text-blue-400">Ready</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-xs text-gray-400">Vision AI</span>
              </div>
              <p className="text-lg font-bold text-cyan-400">Online</p>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Globe className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-gray-400">Languages</span>
              </div>
              <p className="text-lg font-bold text-green-400">196+</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                    <span>Image Scanner</span>
                  </h2>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-contain bg-gray-800/50 rounded-xl border border-gray-700/50"
                      />
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-all opacity-0 group-hover:opacity-100"
                      >
                        <span className="text-white text-sm">×</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 border-2 border-dashed border-gray-700/50 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group"
                    >
                      <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-all">
                        <Camera className="w-6 h-6 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-300">Click to upload image</span>
                    </button>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button
                      onClick={() => handleScan("qr")}
                      disabled={!imagePreview || isScanning}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="text-sm font-medium">QR</span>
                    </button>
                    <button
                      onClick={() => handleScan("ocr")}
                      disabled={!imagePreview || isScanning}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-medium">OCR</span>
                    </button>
                    <button
                      onClick={() => handleScan("vision")}
                      disabled={!imagePreview || isScanning}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">Vision</span>
                    </button>
                  </div>

                  {isScanning && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-cyan-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Analyzing image...</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                      <Languages className="w-4 h-4 text-white" />
                    </div>
                    <span>Universal Translator</span>
                  </h2>

                  <textarea
                    value={translateText}
                    onChange={(e) => setTranslateText(e.target.value)}
                    placeholder="Enter text to translate..."
                    className="w-full h-28 bg-gray-800/50 text-white p-4 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50 placeholder-gray-500"
                  />

                  <div className="flex gap-2 mt-4">
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="flex-1 bg-gray-800/50 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 border border-gray-700/50"
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleTranslate}
                      disabled={!translateText.trim() || isTranslating}
                      className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 font-medium"
                    >
                      {isTranslating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        "Translate"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {lastResult && (
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Scan className="w-5 h-5 text-cyan-400" />
                        {lastResult.type.toUpperCase()} Result
                      </h3>
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          lastResult.success 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {lastResult.success ? "Success" : "Failed"}
                      </span>
                    </div>

                    {lastResult.text && (
                      <div className="bg-gray-800/50 rounded-xl p-4 mb-4 border border-gray-700/50">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm whitespace-pre-wrap text-gray-200">{lastResult.text}</p>
                          <button
                            onClick={() => copyToClipboard(lastResult.text!)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      {lastResult.detectedLanguage && (
                        <p className="text-gray-400">
                          <span className="text-gray-500">Language:</span> {lastResult.detectedLanguage}
                        </p>
                      )}
                      {lastResult.confidence && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Confidence:</span>
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                              style={{ width: `${lastResult.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-cyan-400">{(lastResult.confidence * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                    {lastResult.riskNotes && lastResult.riskNotes.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium text-sm">Risk Notes</span>
                        </div>
                        <ul className="text-sm text-amber-200/80 space-y-1">
                          {lastResult.riskNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-amber-400">•</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {lastTranslation && (
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-green-400" />
                      Translation Result
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Original ({lastTranslation.detectedLanguage})
                        </p>
                        <p className="text-sm text-gray-200">{lastTranslation.originalText}</p>
                      </div>
                      <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-xs text-green-400 mb-2 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {lastTranslation.targetLanguage}
                            </p>
                            <p className="text-sm text-green-100">{lastTranslation.translatedText}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(lastTranslation.translatedText)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span>CYRUS Vision AI</span>
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Ask CYRUS to help analyze images, interpret scan results, or translate content.
                </p>
                <CyrusAssistant 
                  module="vision" 
                  context={visionContext}
                />
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5">
                <h3 className="font-semibold mb-4 text-sm text-gray-400">Capabilities</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <QrCode className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">QR/Barcode</p>
                      <p className="text-xs text-gray-500">Instant decode</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">OCR Engine</p>
                      <p className="text-xs text-gray-500">Text extraction</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <Eye className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Vision AI</p>
                      <p className="text-xs text-gray-500">Scene analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <Globe className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Translation</p>
                      <p className="text-xs text-gray-500">196+ languages</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
