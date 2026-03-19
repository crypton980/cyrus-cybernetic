import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export interface ScanResult {
  success: boolean;
  type: "qr" | "ocr" | "vision";
  text?: string;
  detectedLanguage?: string;
  translation?: string;
  interpretation?: string;
  riskNotes?: string[];
  confidence?: number;
  error?: string;
}

export interface TranslateResult {
  originalText: string;
  detectedLanguage: string;
  targetLanguage: string;
  translatedText: string;
  confidence: number;
}

export function useScan() {
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [lastTranslation, setLastTranslation] = useState<TranslateResult | null>(null);

  const scanQR = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await fetch("/api/scan/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      if (!res.ok) throw new Error("QR scan failed");
      const result = await res.json();
      setLastResult({ ...result, type: "qr" });
      return result;
    },
  });

  const scanOCR = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await fetch("/api/scan/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      if (!res.ok) throw new Error("OCR scan failed");
      const result = await res.json();
      setLastResult({ ...result, type: "ocr" });
      return result;
    },
  });

  const scanVision = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await fetch("/api/scan/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      if (!res.ok) throw new Error("Vision scan failed");
      const result = await res.json();
      setLastResult({ ...result, type: "vision" });
      return result;
    },
  });

  const detectLanguage = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/scan/detect-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Language detection failed");
      return res.json();
    },
  });

  const translate = useMutation({
    mutationFn: async ({
      text,
      targetLanguage,
    }: {
      text: string;
      targetLanguage: string;
    }) => {
      const res = await fetch("/api/scan/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const result = await res.json();
      setLastTranslation(result);
      return result;
    },
  });

  const interpret = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/scan/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Interpretation failed");
      return res.json();
    },
  });

  const generateReport = useMutation({
    mutationFn: async (scanResult: ScanResult) => {
      const res = await fetch("/api/scan/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanResult),
      });
      if (!res.ok) throw new Error("Report generation failed");
      return res.json();
    },
  });

  return {
    lastResult,
    lastTranslation,
    scanQR,
    scanOCR,
    scanVision,
    detectLanguage,
    translate,
    interpret,
    generateReport,
    isScanning: scanQR.isPending || scanOCR.isPending || scanVision.isPending,
    isTranslating: translate.isPending,
    clearResults: () => {
      setLastResult(null);
      setLastTranslation(null);
    },
  };
}
