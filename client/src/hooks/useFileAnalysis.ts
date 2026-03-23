import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

async function getApiError(response: Response, fallback: string): Promise<Error> {
  let detail = fallback;
  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.error || parsed?.detail || parsed?.details || parsed?.message || fallback;
      } catch {
        detail = raw;
      }
    }
  } catch {
    detail = fallback;
  }
  return new Error(detail);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface DocgenJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  progress: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  recoveredFromDisk?: boolean;
  resumedFromJobId?: string;
  result?: GeneratedDocument;
}

export interface DataVisualSpec {
  id: string;
  kind: "table" | "bar_chart" | "line_chart" | "pie_chart" | "pictograph";
  title: string;
  sectionTitle: string;
  placement: string;
  rationale: string;
  sourceReference: string;
  unit?: string;
  icon?: string;
  labels?: string[];
  values?: number[];
  columns?: string[];
  rows?: string[][];
}

export interface GeneratedDocument {
  docType: string;
  audience: string;
  title: string;
  confidence: "High" | "Medium" | "Low";
  assumptions: string[];
  missing: string[];
  sections: Array<{ title: string; content: string }>;
  outline: Array<{ level: string; title: string; purpose: string }>;
  pullQuotes: Array<{ quote: string; sectionTitle: string; placement: string }>;
  layoutPlan: Array<{ kind: string; title: string; placement: string; notes: string }>;
  graphicsPlan: Array<{ sectionTitle: string; assetType: string; placement: string; brief: string }>;
  dataVisuals: DataVisualSpec[];
  rendered: string;
  htmlRendered: string;
  wordCount: number;
  estimatedPages: number;
  targetPages?: number;
  attachments?: Array<{
    id: string;
    kind: "image";
    style: "realistic_3d" | "graphical" | "schematic";
    sectionTitle?: string;
    caption: string;
    prompt: string;
    url?: string;
    dataUrl?: string;
  }>;
}

export interface FileDetectionResult {
  declaredMime?: string;
  detectedMime?: string;
  ext?: string;
  size: number;
  sha256: string;
}

export interface ExtractionResult {
  text?: string;
  metadata?: Record<string, any>;
  pages?: number;
  images?: string[];
  tables?: any[];
  error?: string;
}

export interface AnalysisResult {
  summary: string;
  keyFindings: string[];
  issues?: string[];
  interpretation?: string;
  confidence?: "High" | "Medium" | "Low";
  documentType?: string;
  documentTypeConfidence?: "High" | "Medium" | "Low";
  decisionActions?: Array<{
    action: string;
    owner: string;
    deadline: string;
    obligation: string;
  }>;
  executiveBrief?: string;
  knowledgeApplied?: string[];
  capabilitySummary?: string;
  jurisdictionApplied?: string;
  strictLegalReview?: boolean;
  citationAnchors?: Array<{
    clause: string;
    excerpt: string;
    rationale: string;
  }>;
  entities: { type: string; value: string }[];
  sentiment?: string;
  topics?: string[];
  riskLevel?: "low" | "medium" | "high";
  recommendations?: string[];
}

export interface FileAnalysisJob {
  id: string;
  originalName: string;
  status: "queued" | "reading" | "extracting" | "analyzing" | "synthesizing" | "completed" | "failed";
  progress: number;
  stageLabel: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  result?: FileReport;
}

export interface FileReport {
  detection: FileDetectionResult;
  extraction: ExtractionResult;
  analysis: AnalysisResult;
  generatedAt: string;
}

export function useFileAnalysis() {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [lastReport, setLastReport] = useState<FileReport | null>(null);
  const [currentJob, setCurrentJob] = useState<FileAnalysisJob | null>(null);
  const [currentDocgenJob, setCurrentDocgenJob] = useState<DocgenJob | null>(null);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [docgenJobs, setDocgenJobs] = useState<DocgenJob[]>([]);
  const [savedReports, setSavedReports] = useState<FileAnalysisJob[]>([]);

  const upsertDocgenJob = (job: DocgenJob) => {
    setDocgenJobs((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === job.id);
      if (existingIndex === -1) {
        return [job, ...previous].slice(0, 12);
      }
      const next = [...previous];
      next[existingIndex] = job;
      return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    });
  };

  const loadSavedReports = async () => {
    try {
      const res = await fetch("/api/files/analysis-reports");
      if (!res.ok) return;
      const data = await res.json();
      setSavedReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch {
      // Best-effort only.
    }
  };

  const loadDocgenJobs = async () => {
    try {
      const res = await fetch("/api/docgen/jobs");
      if (!res.ok) return;
      const data = await res.json();
      setDocgenJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch {
      // Best-effort only.
    }
  };

  const syncDocgenJob = async (jobId: string): Promise<DocgenJob> => {
    const res = await fetch(`/api/docgen/jobs/${jobId}`);
    if (!res.ok) throw await getApiError(res, "Failed to load generation job");
    const job = (await res.json()) as DocgenJob;
    setCurrentDocgenJob(job);
    upsertDocgenJob(job);
    if (job.status === "completed" && job.result) {
      setGeneratedDocument(job.result);
    }
    return job;
  };

  const waitForDocgenCompletion = async (jobId: string): Promise<GeneratedDocument> => {
    for (let i = 0; i < 500; i += 1) {
      await sleep(3000);
      const job = await syncDocgenJob(jobId);
      if (job.status === "completed" && job.result) {
        return job.result;
      }
      if (job.status === "failed") {
        throw new Error(job.error || "Document generation job failed");
      }
      if (job.status === "canceled") {
        throw new Error(job.error || "Document generation canceled");
      }
    }

    throw new Error("Long-form generation is still running. Please retry in a moment.");
  };

  useEffect(() => {
    void loadSavedReports();
    void loadDocgenJobs();
  }, []);

  useEffect(() => {
    if (!currentJob || currentJob.status === "completed" || currentJob.status === "failed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/files/analysis-jobs/${currentJob.id}`);
        if (!res.ok) return;
        const job = (await res.json()) as FileAnalysisJob;
        setCurrentJob(job);
        if (job.status === "completed" && job.result) {
          setLastReport(job.result);
          void loadSavedReports();
        }
      } catch {
        // Ignore transient poll errors.
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentJob]);

  useEffect(() => {
    if (!currentDocgenJob || !["queued", "running"].includes(currentDocgenJob.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncDocgenJob(currentDocgenJob.id).catch(() => {
        // Ignore transient poll errors.
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentDocgenJob]);

  const detectFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/detect", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await getApiError(res, "File detection failed");
      return res.json();
    },
  });

  const extractFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/extract", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await getApiError(res, "File extraction failed");
      return res.json();
    },
  });

  const analyzeFile = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await getApiError(res, "File analysis failed");
      return res.json();
    },
  });

  const fullPipeline = useMutation({
    mutationFn: async ({
      file,
      jurisdiction,
      strictLegalReview,
      guidancePrompt,
    }: {
      file?: File;
      jurisdiction?: string;
      strictLegalReview?: boolean;
      guidancePrompt?: string;
    }) => {
      if (file) setCurrentFile(file);
      setLastReport(null);
      const formData = new FormData();
      if (file) formData.append("file", file);
      if (jurisdiction) {
        formData.append("jurisdiction", jurisdiction);
      }
      formData.append("strictLegalReview", String(Boolean(strictLegalReview)));
      if (guidancePrompt) {
        formData.append("guidancePrompt", guidancePrompt);
      }
      const res = await fetch("/api/files/full-analysis-async", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await getApiError(res, "Full analysis failed");
      const payload = await res.json();
      const job = payload?.job as FileAnalysisJob | undefined;
      if (!job) {
        throw new Error("Analysis job was not created");
      }
      setCurrentJob(job);
      return job;
    },
  });

  const loadReport = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/files/analysis-jobs/${jobId}`);
      if (!res.ok) throw await getApiError(res, "Failed to load report");
      const job = (await res.json()) as FileAnalysisJob;
      setCurrentJob(job);
      if (job.result) {
        setLastReport(job.result);
      }
      return job;
    },
  });

  const generateDocument = useMutation({
    mutationFn: async ({
      docType,
      content,
      audience,
      targetPages,
      wordsPerPage,
      includeImages,
      imageStyle,
    }: {
      docType: string;
      content: string;
      audience?: string;
      targetPages?: number;
      wordsPerPage?: number;
      includeImages?: boolean;
      imageStyle?: "realistic_3d" | "graphical" | "schematic";
    }) => {
      setGeneratedDocument(null);
      const payload = {
        docType,
        content,
        audience,
        targetPages,
        wordsPerPage,
        includeImages,
        imageStyle,
      };

      // Large generations can exceed normal request timeouts; use async job polling.
      if ((targetPages || 1) >= 80) {
        const startRes = await fetch("/api/docgen/generate-async", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!startRes.ok) throw await getApiError(startRes, "Async document generation failed to start");
        const started = await startRes.json();
        const startedJob = started?.job as DocgenJob | undefined;
        const jobId = startedJob?.id as string | undefined;
        if (!jobId) throw new Error("Generation job id not returned");
        setCurrentDocgenJob(startedJob || null);
        if (startedJob) {
          upsertDocgenJob(startedJob);
        }
        const result = await waitForDocgenCompletion(jobId);
        await loadDocgenJobs();
        return result;
      }

      setCurrentDocgenJob(null);
      const res = await fetch("/api/docgen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await getApiError(res, "Document generation failed");
      const doc = (await res.json()) as GeneratedDocument;
      setGeneratedDocument(doc);
      await loadDocgenJobs();
      return doc;
    },
    onSuccess: (doc) => {
      setGeneratedDocument(doc as GeneratedDocument);
    },
  });

  const cancelDocumentGeneration = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/docgen/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw await getApiError(res, "Failed to cancel generation job");
      return res.json();
    },
    onSuccess: (payload) => {
      if (payload?.job) {
        setCurrentDocgenJob(payload.job as DocgenJob);
        upsertDocgenJob(payload.job as DocgenJob);
      }
    },
  });

  const resumeDocumentGeneration = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/docgen/jobs/${jobId}/resume`, {
        method: "POST",
      });
      if (!res.ok) throw await getApiError(res, "Failed to resume generation job");
      const payload = await res.json();
      const resumedJob = payload?.job as DocgenJob | undefined;
      if (!resumedJob?.id) throw new Error("Resume job id not returned");
      setCurrentDocgenJob(resumedJob);
      upsertDocgenJob(resumedJob);
      const result = await waitForDocgenCompletion(resumedJob.id);
      await loadDocgenJobs();
      return result;
    },
    onSuccess: (doc) => {
      setGeneratedDocument(doc as GeneratedDocument);
    },
  });

  const openDocgenJob = async (jobId: string) => {
    const job = await syncDocgenJob(jobId);
    if (job.result) {
      setGeneratedDocument(job.result);
    }
    return job;
  };

  const generateVisual = useMutation({
    mutationFn: async ({
      prompt,
      style,
      mode,
      referenceFile,
    }: {
      prompt: string;
      style: "realistic_3d" | "graphical" | "schematic";
      mode?: "generate" | "edit";
      referenceFile?: File | null;
    }) => {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("style", style);
      formData.append("mode", mode || (referenceFile ? "edit" : "generate"));
      if (referenceFile) {
        formData.append("reference", referenceFile);
      }
      const res = await fetch("/api/docgen/visualize", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw await getApiError(res, "Visual generation failed");
      return res.json();
    },
  });

  return {
    currentFile,
    lastReport,
    currentJob,
    currentDocgenJob,
    generatedDocument,
    docgenJobs,
    savedReports,
    detectFile,
    extractFile,
    analyzeFile,
    fullPipeline,
    loadReport,
    generateDocument,
    cancelDocumentGeneration,
    resumeDocumentGeneration,
    generateVisual,
    openDocgenJob,
    refreshDocgenJobs: loadDocgenJobs,
    isProcessing:
      detectFile.isPending ||
      extractFile.isPending ||
      analyzeFile.isPending ||
      fullPipeline.isPending ||
      (currentJob ? !["completed", "failed"].includes(currentJob.status) : false),
    isGenerating: generateDocument.isPending,
    isGeneratingVisual: generateVisual.isPending,
    clearResults: () => {
      setCurrentFile(null);
      setLastReport(null);
      setCurrentJob(null);
      setCurrentDocgenJob(null);
      setGeneratedDocument(null);
    },
  };
}
