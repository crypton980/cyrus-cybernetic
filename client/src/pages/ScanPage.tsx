import { useState, useRef } from "react";
import { useScan } from "../hooks/useScan";
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
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Scan & Translate</h1>
            <p className="text-gray-400">QR codes, OCR, Vision analysis, Translation</p>
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
                <Camera className="w-5 h-5 text-blue-400" />
                Image Scan
              </h2>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-contain bg-gray-800 rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-600 rounded-full"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500 transition-colors"
                >
                  <Camera className="w-8 h-8 text-gray-500" />
                  <span className="text-gray-400">Click to upload image</span>
                </button>
              )}

              <div className="grid grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => handleScan("qr")}
                  disabled={!imagePreview || isScanning}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  QR
                </button>
                <button
                  onClick={() => handleScan("ocr")}
                  disabled={!imagePreview || isScanning}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  OCR
                </button>
                <button
                  onClick={() => handleScan("vision")}
                  disabled={!imagePreview || isScanning}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Vision
                </button>
              </div>

              {isScanning && (
                <div className="flex items-center justify-center gap-2 mt-4 text-blue-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Scanning...
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Languages className="w-5 h-5 text-green-400" />
                Translate Text
              </h2>

              <textarea
                value={translateText}
                onChange={(e) => setTranslateText(e.target.value)}
                placeholder="Enter text to translate..."
                className="w-full h-24 bg-gray-800 text-white p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex gap-2 mt-3">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
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

          <div className="space-y-4">
            {lastResult && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">
                    {lastResult.type.toUpperCase()} Result
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      lastResult.success ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {lastResult.success ? "Success" : "Failed"}
                  </span>
                </div>

                {lastResult.text && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap">{lastResult.text}</p>
                      <button
                        onClick={() => copyToClipboard(lastResult.text!)}
                        className="p-1 text-gray-400 hover:text-white"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {lastResult.detectedLanguage && (
                  <p className="text-sm text-gray-400">
                    Detected Language: {lastResult.detectedLanguage}
                  </p>
                )}

                {lastResult.confidence && (
                  <p className="text-sm text-gray-400">
                    Confidence: {(lastResult.confidence * 100).toFixed(1)}%
                  </p>
                )}

                {lastResult.riskNotes && lastResult.riskNotes.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Risk Notes</span>
                    </div>
                    <ul className="text-sm text-yellow-200 list-disc list-inside">
                      {lastResult.riskNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {lastTranslation && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <h3 className="font-semibold mb-3">Translation Result</h3>
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">
                      Original ({lastTranslation.detectedLanguage})
                    </p>
                    <p className="text-sm">{lastTranslation.originalText}</p>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-blue-400 mb-1">
                          {lastTranslation.targetLanguage}
                        </p>
                        <p className="text-sm">{lastTranslation.translatedText}</p>
                      </div>
                      <button
                        onClick={() =>
                          copyToClipboard(lastTranslation.translatedText)
                        }
                        className="p-1 text-gray-400 hover:text-white"
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
      </div>
    </div>
  );
}
