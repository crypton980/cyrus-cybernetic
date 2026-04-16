import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScanTranslate } from "@/hooks/useScanTranslate";

export default function ScanTranslate() {
  const {
    file,
    setFile,
    targetLanguage,
    setTargetLanguage,
    mode,
    setMode,
    report,
    loading,
    analyze,
  } = useScanTranslate();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Scan & Translate</h1>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-200" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Language</Label>
                <Input value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} />
              </div>
              <div>
                <Label>Mode</Label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="business">Business</option>
                  <option value="casual">Casual</option>
                  <option value="legal">Legal/Policy</option>
                  <option value="technical">Technical/Scientific</option>
                  <option value="military">Military/Intelligence</option>
                </select>
              </div>
            </div>
            <Button onClick={analyze} disabled={loading}>{loading ? "Processing..." : "Analyze"}</Button>
          </CardContent>
        </Card>

        {report && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Scan Report — Confidence: {report.confidence}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>Type: {report.scanType}</div>
              <div>Detected Language: {report.detectedLanguage} ({Math.round(report.languageConfidence * 100)}%)</div>
              <div className="text-slate-300">Source: {report.sourceDescription}</div>
              {report.qrPayload && <div className="text-slate-300">QR Payload: {report.qrPayload}</div>}
              {report.originalText && <div className="text-slate-300">Original: {report.originalText.slice(0, 800)}</div>}
              {report.translation && <div className="text-slate-300">Translation: {report.translation.slice(0, 800)}</div>}
              {report.interpretation && <div className="text-slate-300">Interpretation: {report.interpretation}</div>}
              {report.keyFindings?.length > 0 && (
                <div>
                  <div className="font-semibold">Key Findings</div>
                  <ul className="list-disc ml-5">
                    {report.keyFindings.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              {report.risks?.length > 0 && (
                <div>
                  <div className="font-semibold text-amber-300">Risks</div>
                  <ul className="list-disc ml-5">
                    {report.risks.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              {report.ambiguities?.length > 0 && (
                <div>
                  <div className="font-semibold text-amber-400">Ambiguities</div>
                  <ul className="list-disc ml-5">
                    {report.ambiguities.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              <div className="text-xs text-slate-400">Warnings: {(report.warnings || []).join("; ") || "—"}</div>
              <div className="text-xs text-slate-400">Attempted: {(report.attempted || []).join(", ") || "—"}</div>
              <div className="text-xs text-slate-400">Next Steps: {(report.nextSteps || []).join("; ") || "—"}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

