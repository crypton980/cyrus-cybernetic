import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFileAnalysis } from "@/hooks/useFileAnalysis";

export default function FileAnalysis() {
  const { file, setFile, report, loading, analyze } = useFileAnalysis();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">File Analysis</h1>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-200"
            />
            <Button onClick={analyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </Button>
          </CardContent>
        </Card>

        {report && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle>{report.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <div>Success: {String(report.success)}</div>
              <div>Doc Type: {report.docType}</div>
              <div>Confidence: {report.confidence}</div>
              <div>Source: {report.sourceDescription}</div>
              <div className="text-slate-300">Summary: {report.extractedSummary || "—"}</div>
              {report.ocrText && <div className="text-slate-300">OCR: {report.ocrText.slice(0, 500)}</div>}
              {report.transcript && <div className="text-slate-300">Transcript: {report.transcript.slice(0, 500)}</div>}
              <div>
                <div className="font-semibold">Key Findings</div>
                <ul className="list-disc ml-5">
                  {(report.keyFindings || []).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold">Issues</div>
                <ul className="list-disc ml-5">
                  {(report.issues || []).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold">Recommendations</div>
                <ul className="list-disc ml-5">
                  {(report.recommendations || []).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div className="text-slate-300">Interpretation: {report.interpretation}</div>
              <div className="text-slate-400 text-xs">Attempted: {(report.attempted || []).join(", ") || "—"}</div>
              <div className="text-slate-400 text-xs">Warnings: {(report.warnings || []).join(", ") || "—"}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

