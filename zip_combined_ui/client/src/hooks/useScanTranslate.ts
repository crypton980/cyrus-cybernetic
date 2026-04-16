import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export interface ScanReport {
  success: boolean;
  scanType: string;
  sourceDescription: string;
  detectedLanguage: string;
  languageConfidence: number;
  translation?: string;
  originalText?: string;
  qrPayload?: string;
  interpretation?: string;
  keyFindings: string[];
  risks: string[];
  ambiguities: string[];
  confidence: string;
  warnings: string[];
  attempted: string[];
  nextSteps: string[];
}

export function useScanTranslate() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [mode, setMode] = useState("business");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!file) {
      toast({ title: "No file selected", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("targetLanguage", targetLanguage);
      form.append("mode", mode);
      const res = await fetch("/api/scan/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setReport(data);
      toast({ title: data.success ? "Scan complete" : "Partial/failed scan", description: data.scanType });
    } catch (err: any) {
      toast({ title: "Scan error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return {
    file,
    setFile,
    targetLanguage,
    setTargetLanguage,
    mode,
    setMode,
    report,
    loading,
    analyze,
  };
}

