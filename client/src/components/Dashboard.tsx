import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ObjectDetection } from "@tensorflow-models/coco-ssd";
import {
  Send,
  User,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Upload,
  X,
  Paperclip,
  Cpu,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Share2,
  Copy,
  Check,
  Radio,
  KeyRound,
  Download,
  Layers,
} from "lucide-react";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useAudioProcessing } from "@/hooks/useAudioProcessing";

interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  createdAt: string;
}

interface VisionActivityEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  severity: "info" | "active" | "alert";
}

interface KnownFaceProfile {
  id: string;
  name: string;
  role: string;
  gender?: string;
  ageRange?: string;
  description?: string;
  registeredAt?: string;
  updatedAt?: string;
  hasReferenceImage?: boolean;
  referenceImageCount?: number;
}

interface VisionMatch {
  personId: number;
  confidence: number;
  knownFaceId: string;
  name: string;
  role: string;
  matchReason: string;
}

export function Dashboard() {
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [visionActivityLog, setVisionActivityLog] = useState<VisionActivityEvent[]>([]);
  const [isRecordingVision, setIsRecordingVision] = useState(false);
  const [visionRecordingUrl, setVisionRecordingUrl] = useState<string | null>(null);
  const [visionRecordingStartedAt, setVisionRecordingStartedAt] = useState<string | null>(null);
  const [currentActivityLabels, setCurrentActivityLabels] = useState<string[]>([]);
  const [knownFaces, setKnownFaces] = useState<KnownFaceProfile[]>([]);
  const [enrollName, setEnrollName] = useState("");
  const [enrollRole, setEnrollRole] = useState("Visitor");
  const [matchSensitivity, setMatchSensitivity] = useState<"strict" | "normal" | "lenient">("normal");
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const [isMatchingFaces, setIsMatchingFaces] = useState(false);
  const [latestSearchMatch, setLatestSearchMatch] = useState<VisionMatch | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  // Multi-frame burst capture state
  const [isBurstCapturing, setIsBurstCapturing] = useState(false);
  const [burstFrameCount, setBurstFrameCount] = useState(0);
  const [burstAnalysis, setBurstAnalysis] = useState<Record<string, unknown> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [shareMenuContent, setShareMenuContent] = useState<string>("");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
    const saved = localStorage.getItem("cyrus-wakeword-enabled");
    return saved !== null ? saved === "true" : false;
  });
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem("cyrus-voice-enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [showElevenLabsModal, setShowElevenLabsModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [humanoidLiveEnabled, setHumanoidLiveEnabled] = useState(() => {
    const saved = localStorage.getItem("cyrus-humanoid-live-enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [humanoidStatus, setHumanoidStatus] = useState("Live-ready");
  const [commandInFlight, setCommandInFlight] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [elevenLabsApiKeyInput, setElevenLabsApiKeyInput] = useState(
    () => localStorage.getItem("cyrus-elevenlabs-api-key") || ""
  );
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceDbInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTranscriptRef = useRef<string>("");
  const micActiveRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const voiceEnabledRef = useRef<boolean>(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<ObjectDetection | null>(null);
  const tfModuleRef = useRef<typeof import("@tensorflow/tfjs") | null>(null);
  const cocoSsdModuleRef = useRef<typeof import("@tensorflow-models/coco-ssd") | null>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const lastVisionEventRef = useRef<{ signature: string; timestamp: number }>({ signature: "", timestamp: 0 });
  const lastPersonMotionRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const lastMatchSignatureRef = useRef<string>("");
  const lastAlarmAtRef = useRef<number>(0);
  const matchInFlightRef = useRef<boolean>(false);
  const lastHumanoidAnnouncementRef = useRef<{ signature: string; timestamp: number }>({ signature: "", timestamp: 0 });
  const lastVisionAlertSpokenRef = useRef<string>("");
  const humanoidEventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();
  
  const { playEnhancedAudio, cleanup: cleanupAudio } = useAudioProcessing();
  const wakeWordCommandRef = useRef<string | null>(null);
  
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const addVisionEvent = useCallback((title: string, detail: string, severity: VisionActivityEvent["severity"] = "info") => {
    const timestamp = new Date().toISOString();
    setVisionActivityLog((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp, title, detail, severity },
      ...prev,
    ].slice(0, 40));
  }, []);

  const fetchKnownFaces = useCallback(async () => {
    try {
      const response = await fetch("/api/vision/known-faces");
      if (!response.ok) throw new Error("Failed to fetch known faces");
      const payload = await response.json();
      setKnownFaces(Array.isArray(payload.faces) ? payload.faces : []);
    } catch (error) {
      console.error("Failed to load known faces:", error);
    }
  }, []);

  const triggerVisionAlarm = useCallback((match: VisionMatch) => {
    const now = Date.now();
    if (now - lastAlarmAtRef.current < 15000) return;
    lastAlarmAtRef.current = now;
    setAlarmActive(true);

    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.25);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.62);
      window.setTimeout(() => {
        context.close().catch(() => undefined);
      }, 900);
    } catch (error) {
      console.warn("Alarm audio unavailable:", error);
    }

    addVisionEvent(
      "Search match detected",
      `${match.name} (${match.role}) matched at ${Math.round(match.confidence * 100)}% confidence.`,
      "alert",
    );

    window.setTimeout(() => setAlarmActive(false), 8000);
  }, [addVisionEvent]);

  const captureCurrentFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }, []);

  const runLiveFaceMatch = useCallback(async () => {
    if (!cameraActive || knownFaces.length === 0) return;
    if (matchInFlightRef.current) return;
    const image = captureCurrentFrame();
    if (!image) return;

    matchInFlightRef.current = true;
    setIsMatchingFaces(true);
    try {
      const response = await fetch("/api/vision/match-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, sensitivity: matchSensitivity }),
      });
      if (!response.ok) {
        throw new Error("Face match request failed");
      }
      const payload = await response.json();
      const match: VisionMatch | null = Array.isArray(payload.matches) && payload.matches.length > 0
        ? payload.matches[0]
        : null;

      if (match) {
        setLatestSearchMatch(match);
        const signature = `${match.knownFaceId}:${match.confidence.toFixed(2)}`;
        if (signature !== lastMatchSignatureRef.current) {
          lastMatchSignatureRef.current = signature;
          triggerVisionAlarm(match);
        }
      } else {
        setLatestSearchMatch(null);
      }
    } catch (error) {
      console.error("Live face matching failed:", error);
    } finally {
      matchInFlightRef.current = false;
      setIsMatchingFaces(false);
    }
  }, [cameraActive, captureCurrentFrame, knownFaces.length, triggerVisionAlarm, matchSensitivity]);

  // Multi-frame burst capture: captures N frames over an interval and sends them
  // to the server for composite analysis (frames from different moments/angles).
  const runBurstCapture = useCallback(async (frameCount = 4, intervalMs = 400) => {
    if (!cameraActive) {
      setVisionError("Activate CYRUS Vision before burst capture");
      return;
    }
    setIsBurstCapturing(true);
    setBurstFrameCount(0);
    setBurstAnalysis(null);
    addVisionEvent("Burst Capture", `Capturing ${frameCount} frames at ${intervalMs}ms intervals…`, "active");

    const frames: string[] = [];
    for (let i = 0; i < frameCount; i++) {
      const frame = captureCurrentFrame();
      if (frame) {
        frames.push(frame);
        setBurstFrameCount(i + 1);
      }
      if (i < frameCount - 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, intervalMs));
      }
    }

    if (frames.length === 0) {
      setVisionError("No frames could be captured during burst");
      setIsBurstCapturing(false);
      return;
    }

    try {
      const resp = await fetch("/api/vision/multi-frame-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
      });
      if (!resp.ok) throw new Error("Multi-frame analysis failed");
      const payload = await resp.json();
      setBurstAnalysis(payload.analysis || null);
      const safety = (payload.analysis as any)?.safetyAssessment || "unknown";
      addVisionEvent(
        "Burst Analysis Complete",
        `${frames.length} frames analysed. Safety: ${safety}. Scene: ${(payload.analysis as any)?.compositeScene?.slice(0, 80) || "N/A"}`,
        safety === "alert" ? "alert" : safety === "caution" ? "warning" : "info",
      );
    } catch (err) {
      addVisionEvent("Burst Analysis Failed", String(err), "alert");
      setVisionError("Multi-frame analysis failed — check AI configuration");
    } finally {
      setIsBurstCapturing(false);
    }
  }, [cameraActive, captureCurrentFrame, addVisionEvent]);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!enrollName.trim()) {
      setVisionError("Enter a person name before uploading to the face database");
      if (faceDbInputRef.current) faceDbInputRef.current.value = "";
      return;
    }

    const toDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

    const compressDataUrl = (dataUrl: string) =>
      new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const maxWidth = 960;
          const scale = Math.min(1, maxWidth / image.width);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Image canvas unavailable"));
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);

          let compressed = canvas.toDataURL("image/jpeg", 0.72);
          if (compressed.length > 7_200_000) {
            compressed = canvas.toDataURL("image/jpeg", 0.55);
          }
          resolve(compressed);
        };
        image.onerror = () => reject(new Error("Failed to decode uploaded image"));
        image.src = dataUrl;
      });

    try {
      setIsRegisteringFace(true);
      const rawImage = await toDataUrl();
      const image = await compressDataUrl(rawImage);
      const faceId = `${enrollName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const response = await fetch("/api/vision/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: enrollName.trim(),
          role: enrollRole.trim() || "Visitor",
          faceId,
          image,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to register face");
      }
      const payload = await response.json();
      const imageCount = typeof payload.imageCount === "number" ? payload.imageCount : undefined;
      addVisionEvent(
        imageCount && imageCount > 1 ? "Reference shot added" : "Face profile enrolled",
        `${enrollName.trim()} stored in CYRUS search database${imageCount ? ` with ${imageCount} reference shot${imageCount > 1 ? "s" : ""}` : ""}.`,
        "active",
      );
      await fetchKnownFaces();
      setEnrollName("");
      setVisionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Face registration failed";
      setVisionError(message);
    } finally {
      setIsRegisteringFace(false);
      if (faceDbInputRef.current) faceDbInputRef.current.value = "";
    }
  }, [addVisionEvent, enrollName, enrollRole, fetchKnownFaces]);

  const stopVisionRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startVisionRecording = useCallback(() => {
    if (!streamRef.current) {
      setVisionError("Activate CYRUS Vision before starting a recording");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setVisionError("MediaRecorder is not supported in this browser");
      return;
    }

    if (visionRecordingUrl) {
      URL.revokeObjectURL(visionRecordingUrl);
      setVisionRecordingUrl(null);
    }

    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type));

    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);

    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setVisionRecordingUrl(url);
      setIsRecordingVision(false);
      setVisionRecordingStartedAt(null);
      addVisionEvent("Recording saved", `Vision capture stored locally (${Math.round(blob.size / 1024)} KB).`, "info");
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setIsRecordingVision(true);
    setVisionRecordingStartedAt(new Date().toISOString());
    addVisionEvent("Recording started", "Live vision stream recording is active.", "active");
  }, [addVisionEvent, visionRecordingUrl]);

  const toggleVisionRecording = useCallback(() => {
    if (isRecordingVision) {
      stopVisionRecording();
      return;
    }
    startVisionRecording();
  }, [isRecordingVision, startVisionRecording, stopVisionRecording]);

  const buildVisionReportText = useCallback((report: { status: string; summary: string; details: string[] }) => {
    const lines = [
      `CYRUS Vision Activity Report`,
      `Generated: ${new Date().toISOString()}`,
      `Status: ${report.status}`,
      ``,
      `Summary`,
      report.summary,
      ``,
      `Live Details`,
      ...report.details.map((detail) => `- ${detail}`),
      ``,
      `Recent Activity Log`,
      ...(visionActivityLog.length > 0
        ? visionActivityLog.slice(0, 8).map((event) => `- ${new Date(event.timestamp).toLocaleTimeString()}: ${event.title} | ${event.detail}`)
        : ["- No activity logged yet"]),
    ];
    return lines.join("\n");
  }, [visionActivityLog]);

  const downloadVisionReport = useCallback((report: { status: string; summary: string; details: string[] }) => {
    const blob = new Blob([buildVisionReportText(report)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cyrus-vision-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [buildVisionReportText]);

  // Run object detection on each video frame
  const detectObjects = useCallback(async () => {
    if (!videoRef.current || !modelRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx || video.readyState !== 4) {
      animationRef.current = requestAnimationFrame(detectObjects);
      return;
    }

    // Match canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Run COCO-SSD detection
    try {
      const predictions = await modelRef.current.detect(video);
      setDetectedObjects(predictions.map(p => ({
        class: p.class,
        score: p.score,
        bbox: p.bbox as [number, number, number, number]
      })));

      // Draw bounding boxes on canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.font = "14px Inter, sans-serif";
      ctx.fillStyle = "#00ff88";

      predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        
        // Draw bounding box
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        const label = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0, 255, 136, 0.8)";
        ctx.fillRect(x, y - 20, textWidth + 8, 20);
        
        // Draw label text
        ctx.fillStyle = "#000";
        ctx.fillText(label, x + 4, y - 6);
      });
    } catch (err) {
      console.error("Detection error:", err);
    }

    // Continue detection loop
    animationRef.current = requestAnimationFrame(detectObjects);
  }, []);

  // CYRUS Vision - Camera Control with ML
  const toggleCamera = async () => {
    if (cameraActive) {
      // Stop camera and detection
      stopVisionRecording();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setDetectedObjects([]);
      setVisionError(null);
      setCameraActive(false);
    } else {
      // Start camera with ML
      try {
        setModelLoading(true);
        setVisionError(null);

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API unavailable in this browser/environment");
        }
        
        // Load COCO-SSD model if not already loaded
        if (!modelRef.current) {
          const tf = tfModuleRef.current ?? await import("@tensorflow/tfjs");
          const cocoSsd = cocoSsdModuleRef.current ?? await import("@tensorflow-models/coco-ssd");
          tfModuleRef.current = tf;
          cocoSsdModuleRef.current = cocoSsd;
          await tf.ready();
          modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        }
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user",
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          },
          audio: false 
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;

          await new Promise<void>((resolve, reject) => {
            let done = false;
            const timeoutId = window.setTimeout(() => {
              if (done) return;
              done = true;
              reject(new Error("Timed out waiting for camera frames"));
            }, 8000);

            const finalize = () => {
              if (done) return;
              done = true;
              window.clearTimeout(timeoutId);
              resolve();
            };

            video.onloadedmetadata = finalize;
            video.oncanplay = finalize;
          });

          try {
            await video.play();
          } catch {
            // Some browsers may block autoplay despite muted; detection can still proceed if frames arrive.
          }

          setModelLoading(false);
          setCameraActive(true);
          detectObjects();
        }
      } catch (err) {
        console.error("Camera/ML error:", err);
        const message = err instanceof Error ? err.message : "Unable to start CYRUS Vision";
        setVisionError(message);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setModelLoading(false);
        setCameraActive(false);
      }
    }
  };

  // Cleanup camera and ML on unmount
  useEffect(() => {
    return () => {
      stopVisionRecording();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (visionRecordingUrl) {
        URL.revokeObjectURL(visionRecordingUrl);
      }
    };
  }, [stopVisionRecording, visionRecordingUrl]);

  useEffect(() => {
    fetchKnownFaces();
  }, [fetchKnownFaces]);

  useEffect(() => {
    if (!cameraActive) {
      setLatestSearchMatch(null);
      return;
    }

    const interval = window.setInterval(() => {
      runLiveFaceMatch();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [cameraActive, runLiveFaceMatch]);

  useEffect(() => {
    if (!cameraActive) {
      setCurrentActivityLabels([]);
      lastPersonMotionRef.current = null;
      return;
    }

    const labels = new Set(detectedObjects.map((obj) => obj.class));
    const people = detectedObjects.filter((obj) => obj.class === "person");
    const nextActivities: string[] = [];

    if (people.length > 0) {
      const center = people.reduce(
        (acc, obj) => {
          const [x, y, width, height] = obj.bbox;
          return { x: acc.x + x + width / 2, y: acc.y + y + height / 2 };
        },
        { x: 0, y: 0 },
      );
      center.x /= people.length;
      center.y /= people.length;

      const prev = lastPersonMotionRef.current;
      if (prev) {
        const delta = Math.hypot(center.x - prev.x, center.y - prev.y);
        if (delta > 28) nextActivities.push("person moving through the scene");
        else nextActivities.push("person stationary or standing in the current frame");
      } else {
        nextActivities.push("person present in the scene");
      }
      lastPersonMotionRef.current = { x: center.x, y: center.y, timestamp: Date.now() };

      const eatingObjects = ["cup", "bottle", "wine glass", "fork", "spoon", "bowl", "sandwich", "banana", "apple", "pizza", "hot dog", "donut", "cake"];
      const clothingObjects = ["backpack", "handbag", "tie", "umbrella", "suitcase"];
      const workstationObjects = ["laptop", "keyboard", "mouse", "cell phone", "tv", "remote", "book"];

      if (eatingObjects.some((item) => labels.has(item))) {
        nextActivities.push("possible eating or drinking activity detected");
      }
      if (clothingObjects.some((item) => labels.has(item))) {
        nextActivities.push("possible item handling or dressing activity detected");
      }
      if (workstationObjects.some((item) => labels.has(item))) {
        nextActivities.push("person interacting with a device or workstation");
      }
      if ((labels.has("chair") || labels.has("couch")) && nextActivities.every((entry) => !entry.includes("moving"))) {
        nextActivities.push("person may be seated in the frame");
      }
    } else {
      lastPersonMotionRef.current = null;
      if (detectedObjects.length > 0) {
        const visibleObjects = Array.from(labels).slice(0, 4).join(", ");
        nextActivities.push(`objects visible: ${visibleObjects}`);
      }
    }

    setCurrentActivityLabels(nextActivities);
  }, [cameraActive, detectedObjects]);

  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    localStorage.setItem("cyrus-voice-enabled", String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem("cyrus-humanoid-live-enabled", String(humanoidLiveEnabled));
  }, [humanoidLiveEnabled]);

  const toggleVoice = () => {
    setVoiceEnabled(prev => !prev);
  };

  const speakText = async (text: string, retryCount = 0) => {
    // Guard against overlapping calls - if already speaking, skip
    if (isSpeakingRef.current && retryCount === 0) {
      console.log("Already speaking, skipping new speakText call");
      return;
    }
    
    const maxRetries = 2;
    let textIntervalId: ReturnType<typeof setInterval> | null = null;
    
    const cleanupAndFinish = (showFullText = true) => {
      if (textIntervalId) clearInterval(textIntervalId);
      if (showFullText) setStreamingText(text);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setIsStreaming(false);
      if (micActiveRef.current) {
        setTimeout(() => startContinuousListening(), 100);
      }
    };

    const useBrowserSpeech = () => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        utterance.volume = 1.0;
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('samantha') ||
          v.name.includes('Google UK English Female')
        );
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.onend = () => cleanupAndFinish(true);
        utterance.onerror = () => cleanupAndFinish(true);
        speechSynthesis.speak(utterance);
        return true;
      }
      return false;
    };

    try {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setIsStreaming(true);
      setStreamingText("");
      
      const words = text.split(/\s+/);
      let wordIndex = 0;
      
      textIntervalId = setInterval(() => {
        if (wordIndex < words.length) {
          setStreamingText(prev => prev + (prev ? " " : "") + words[wordIndex]);
          wordIndex++;
        } else {
          if (textIntervalId) clearInterval(textIntervalId);
        }
      }, 400);

      // Try streaming TTS first
      let audioBase64 = "";
      let ttsSuccess = false;

      try {
        const response = await fetch("/api/cyrus/speak/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice: "rachel",
            voiceProfile: "warm_precise",
            elevenLabsApiKey: localStorage.getItem("cyrus-elevenlabs-api-key") || undefined,
          }),
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.audio) {
                      audioBase64 += data.audio;
                    }
                  } catch {}
                }
              }
            }
          }
          if (audioBase64.length > 0) ttsSuccess = true;
        }
      } catch (streamError) {
        console.warn("Streaming TTS failed, trying non-streaming endpoint:", streamError);
      }

      // Fallback to non-streaming TTS if streaming failed - use Blob URL for large audio
      let audioBlobUrl: string | null = null;
      if (!ttsSuccess) {
        try {
          const response = await fetch("/api/cyrus/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              voice: "rachel",
              voiceProfile: "warm_precise",
              elevenLabsApiKey: localStorage.getItem("cyrus-elevenlabs-api-key") || undefined,
            }),
          });
          
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            // Use Blob URL instead of base64 to avoid stack overflow on large audio
            const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
            audioBlobUrl = URL.createObjectURL(blob);
            ttsSuccess = true;
          }
        } catch (nonStreamError) {
          console.warn("Non-streaming TTS also failed:", nonStreamError);
        }
      }

      // Play audio if we got it with enhanced audio processing for smooth voice
      if (ttsSuccess && (audioBase64 || audioBlobUrl)) {
        let audioBlob: Blob | null = null;
        let fallbackUrl: string | null = null;
        
        try {
          if (audioBlobUrl) {
            const response = await fetch(audioBlobUrl);
            audioBlob = await response.blob();
            fallbackUrl = URL.createObjectURL(audioBlob);
            URL.revokeObjectURL(audioBlobUrl);
          } else {
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioBlob = new Blob([bytes], { type: 'audio/mp3' });
            fallbackUrl = URL.createObjectURL(audioBlob);
          }

          await playEnhancedAudio(
            audioBlob,
            {
              normalize: true,
              removeNoise: true,
              smoothTransitions: true,
              addWarmth: true,
              compressionRatio: 2.5,
            },
            () => {
              if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
              cleanupAndFinish(true);
            }
          );
        } catch (enhancedError) {
          console.warn("Enhanced audio failed, falling back to standard playback:", enhancedError);
          
          if (!fallbackUrl && audioBlob) {
            fallbackUrl = URL.createObjectURL(audioBlob);
          }
          
          const audioSrc = fallbackUrl || `data:audio/mp3;base64,${audioBase64}`;
          const audio = new Audio(audioSrc);
          
          audio.onended = () => {
            if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
            cleanupAndFinish(true);
          };
          
          audio.onerror = () => {
            console.error("Audio playback error, trying browser speech");
            if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
            if (!useBrowserSpeech()) {
              cleanupAndFinish(true);
            }
          };
          
          try {
            await audio.play();
          } catch (playError) {
            console.error("Audio play failed:", playError);
            if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
            if (!useBrowserSpeech()) {
              cleanupAndFinish(true);
            }
          }
        }
      } else {
        // No audio from TTS, try browser speech as last resort
        console.warn("No audio from TTS, using browser speech synthesis");
        if (!useBrowserSpeech()) {
          cleanupAndFinish(true);
        }
      }
    } catch (error) {
      console.error("Speech error:", error);
      if (retryCount < maxRetries) {
        console.log(`Retrying TTS (attempt ${retryCount + 2}/${maxRetries + 1})`);
        if (textIntervalId) clearInterval(textIntervalId);
        setIsSpeaking(false);
        setIsStreaming(false);
        await new Promise(r => setTimeout(r, 500));
        return speakText(text, retryCount + 1);
      }
      cleanupAndFinish(true);
    }
  };

  const speakHumanoidAnnouncement = useCallback((message: string) => {
    if (!humanoidLiveEnabled || !voiceEnabledRef.current) return;
    const signature = message.toLowerCase().trim();
    const now = Date.now();
    if (
      lastHumanoidAnnouncementRef.current.signature === signature &&
      now - lastHumanoidAnnouncementRef.current.timestamp < 7000
    ) {
      return;
    }
    lastHumanoidAnnouncementRef.current = { signature, timestamp: now };
    speakText(message);
  }, [humanoidLiveEnabled]);

  useEffect(() => {
    if (!humanoidLiveEnabled || !voiceEnabledRef.current) return;
    const latest = visionActivityLog[0];
    if (!latest) return;
    if (lastVisionAlertSpokenRef.current === latest.id) return;
    lastVisionAlertSpokenRef.current = latest.id;

    if (latest.severity === "alert") {
      speakHumanoidAnnouncement(`Alert. ${latest.title}. ${latest.detail}`);
    }
  }, [visionActivityLog, humanoidLiveEnabled, speakHumanoidAnnouncement]);

  useEffect(() => {
    if (!humanoidLiveEnabled) {
      humanoidEventSourceRef.current?.close();
      humanoidEventSourceRef.current = null;
      return;
    }

    const source = new EventSource("/api/humanoid/live/events");
    humanoidEventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || payload.type === "connected") {
          return;
        }

        const severity = payload.severity === "alert"
          ? "alert"
          : payload.severity === "active"
            ? "active"
            : "info";

        addVisionEvent(
          payload.title || "Humanoid event",
          payload.detail || "System event received.",
          severity,
        );

        if (severity === "alert") {
          speakHumanoidAnnouncement(`Alert. ${payload.title}. ${payload.detail}`);
        }
      } catch (err) {
        console.warn("Humanoid live event parse error:", err);
      }
    };

    source.onerror = () => {
      setHumanoidStatus("Live stream reconnecting");
    };

    return () => {
      source.close();
      if (humanoidEventSourceRef.current === source) {
        humanoidEventSourceRef.current = null;
      }
    };
  }, [humanoidLiveEnabled, addVisionEvent, speakHumanoidAnnouncement]);

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (currentTranscriptRef.current.trim() && recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, 1500); // Reduced from 4s to 1.5s for faster response
  };

  const startContinuousListening = () => {
    if (isSpeakingRef.current) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      currentTranscriptRef.current = "";
      resetSilenceTimer();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }
      currentTranscriptRef.current = transcript;
      setInput(transcript);
      resetSilenceTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      const finalTranscript = currentTranscriptRef.current.trim();
      if (finalTranscript && micActiveRef.current) {
        handleVoiceSubmit(finalTranscript);
      } else if (micActiveRef.current && !isSpeakingRef.current) {
        setTimeout(() => startContinuousListening(), 100); // Faster restart
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'no-speech' && micActiveRef.current) {
        setTimeout(() => startContinuousListening(), 100); // Faster restart on no-speech
      } else if (event.error !== 'aborted') {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const startListening = () => {
    setMicActive(true);
    micActiveRef.current = true;
    startContinuousListening();
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    currentTranscriptRef.current = "";
    setIsListening(false);
    setMicActive(false);
    micActiveRef.current = false;
    setInput("");
  };

  const handleVoiceSubmit = async (transcript?: string) => {
    const message = (transcript || input).trim();
    if (!message) return;
    
    setInput("");
    await processHumanoidCommand(message, "typed");
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      setMicActive(true);
      startListening();
    }
  };

  const currentUserId = localStorage.getItem("cyrus-display-name") || "anonymous";

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        await fetch("/api/cyrus/session/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUserId,
            context: {
              source: "dashboard",
              mode: "interactive",
              wakeWordEnabled,
            },
            sensors: {
              visual: cameraActive,
              audio: true,
              location: !!gpsLocation,
            },
          }),
        });
      } catch (error) {
        console.warn("Session bootstrap failed:", error);
      }
    };

    bootstrapSession();
    // Bootstrap once per identity and when core sensor context meaningfully changes.
  }, [currentUserId, cameraActive, wakeWordEnabled, gpsLocation]);
  
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations?limit=50&userId=${encodeURIComponent(currentUserId)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content, userId: currentUserId }),
      });

      // Build module context for CYRUS to understand active modules
      const moduleContext = {
        vision: {
          active: cameraActive,
          detectedObjects: cameraActive ? detectedObjects : [],
          objectCount: detectedObjects.length,
        },
        activeModules: [
          cameraActive && "CYRUS_VISION",
        ].filter(Boolean),
      };

      const inferRes = await fetch("/api/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: content,
          userId: currentUserId,
          detectedObjects: cameraActive ? detectedObjects : undefined,
          moduleContext,
        }),
      });
      const inferData = await inferRes.json();

      // If vision detected objects, store in memory
      if (cameraActive && detectedObjects.length > 0) {
        const objectSummary = detectedObjects.map(o => `${o.class} (${Math.round(o.score * 100)}%)`).join(", ");
        await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "vision_analysis",
            content: `Vision detected: ${objectSummary}`,
            importance: 7,
          }),
        });
      }

      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          role: "cyrus", 
          content: inferData.response,
          userId: currentUserId,
          detectedObjects: cameraActive ? JSON.stringify(detectedObjects) : null,
        }),
      });

      return inferData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentUserId] });
      setInput("");
      setCommandError(null);
      if (humanoidLiveEnabled) {
        setHumanoidStatus("Task completed");
      }
      if (voiceEnabledRef.current && data?.response) {
        speakText(data.response);
      }
    },
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      await fetch(`/api/conversations?userId=${encodeURIComponent(currentUserId)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentUserId] });
    },
  });

  const processHumanoidCommand = useCallback(async (rawCommand: string, source: "wakeword" | "typed" = "typed") => {
    if (commandInFlight) return;

    let command = rawCommand.trim();
    if (!command) return;

    setCommandInFlight(true);
    setCommandError(null);

    try {
      if (!humanoidLiveEnabled) {
        await sendMessage.mutateAsync(command);
        return;
      }

      setHumanoidStatus("Command received");

      command = command.replace(/^(hey|hi|hello)\s*(cyrus)?[\s,]*/i, "").trim();
      if (!command) {
        setHumanoidStatus("Awaiting command");
        return;
      }

      const normalized = command.toLowerCase();

      const executeLiveCommand = async (commandText: string) => {
        const liveUserId = localStorage.getItem("cyrus-display-name") || "DELTA UNIFORM 00";
        const storedRole = localStorage.getItem("cyrus-user-role");
        const cyrusRole = storedRole === "admin"
          ? "admin"
          : storedRole === "observer"
            ? "observer"
            : "operator";

        const userMessage = commandText;
        await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: userMessage, userId: liveUserId }),
        });

        // Gather current vision data
        const visionData = {
          detectedPeople: latestSearchMatch ? [{
            name: latestSearchMatch.name,
            role: latestSearchMatch.role,
            confidence: latestSearchMatch.confidence,
            isRecognized: true
          }] : [],
          currentActivity: currentActivityLabels,
          cameraActive,
          facialExpressions: [] // TODO: Add facial expression detection if available
        };

        const response = await fetch("/api/humanoid/live/command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cyrus-role": cyrusRole,
          },
          body: JSON.stringify({ 
            command: commandText, 
            userId: liveUserId, 
            source,
            visionData
          }),
        });

        if (!response.ok) {
          let detail = "Live humanoid command failed";
          try {
            const payload = await response.json();
            detail = payload?.error || payload?.detail || detail;
          } catch {
            // Keep default detail.
          }
          throw new Error(detail);
        }

        const payload = await response.json();
        const responseText = typeof payload?.response === "string"
          ? payload.response
          : "Task completed.";

        await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "cyrus", content: responseText, userId: liveUserId }),
        });

        queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentUserId] });
        if (voiceEnabledRef.current) {
          speakText(responseText);
        }
        setHumanoidStatus("Task completed");
      };

      if (/\b(start|activate|turn on)\b.*\b(camera|vision)\b/.test(normalized)) {
        if (!cameraActive) {
          await toggleCamera();
        }
        setHumanoidStatus("Vision active");
        addVisionEvent("Humanoid command", "CYRUS Vision activated.", "active");
        speakHumanoidAnnouncement("Vision is now active.");
        return;
      }

      if (/\b(stop|deactivate|turn off)\b.*\b(camera|vision)\b/.test(normalized)) {
        if (cameraActive) {
          await toggleCamera();
        }
        setHumanoidStatus("Vision offline");
        addVisionEvent("Humanoid command", "CYRUS Vision deactivated.", "info");
        speakHumanoidAnnouncement("Vision has been deactivated.");
        return;
      }

      if (/\b(start|begin)\b.*\b(recording|record)\b/.test(normalized)) {
        startVisionRecording();
        setHumanoidStatus("Recording vision");
        speakHumanoidAnnouncement("Vision recording started.");
        return;
      }

      if (/\b(stop|end)\b.*\b(recording|record)\b/.test(normalized)) {
        stopVisionRecording();
        setHumanoidStatus("Recording stopped");
        speakHumanoidAnnouncement("Vision recording stopped.");
        return;
      }

      if (/\b(system status|status report|report status)\b/.test(normalized)) {
        setHumanoidStatus("Gathering system status");
        await executeLiveCommand(command);
        return;
      }

      setHumanoidStatus("Executing command");
      await executeLiveCommand(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setCommandError(message);
      setHumanoidStatus("Command failed");
      addVisionEvent("Humanoid command failed", message, "alert");
    } finally {
      setCommandInFlight(false);
    }
  }, [
    commandInFlight,
    humanoidLiveEnabled,
    sendMessage,
    cameraActive,
    toggleCamera,
    addVisionEvent,
    startVisionRecording,
    stopVisionRecording,
    speakHumanoidAnnouncement,
    queryClient,
    currentUserId,
    speakText,
  ]);

  const handleWakeWordCommand = useCallback((command: string) => {
    console.log("[WakeWord] Processing command:", command);
    processHumanoidCommand(command, "wakeword");
  }, [processHumanoidCommand]);

  const {
    isListening: wakeWordListening,
    isActivated: wakeWordActivated,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
  } = useWakeWord({
    wakeWords: ["cyrus", "hey cyrus", "ok cyrus", "okay cyrus", "hi cyrus", "cyras", "sirus", "syrus"],
    silenceTimeout: 2500,
    autoRestart: true,
    onWakeWordDetected: () => {
      console.log("[CYRUS] Wake word detected! Listening for command...");
      if (humanoidLiveEnabled) {
        speakHumanoidAnnouncement("Hello.");
      }
    },
    onCommand: handleWakeWordCommand,
    onError: (error) => {
      console.error("[CYRUS] Wake word error:", error);
    },
  });

  useEffect(() => {
    localStorage.setItem("cyrus-wakeword-enabled", String(wakeWordEnabled));
    if (wakeWordEnabled) {
      startWakeWord();
    } else {
      stopWakeWord();
    }
  }, [wakeWordEnabled, startWakeWord, stopWakeWord]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMessage.isPending, commandInFlight, commandError]);

  const handleCopyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShareMessage = (content: string, role: "user" | "cyrus", msgId: string) => {
    const shareText = role === "cyrus" ? `CYRUS AI: ${content}` : content;
    setShareMenuContent(shareText);
    setShareMenuId(shareMenuId === msgId ? null : msgId);
  };

  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShareMenuId(null);
  };

  const shareToFacebook = (text: string) => {
    const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setShareMenuId(null);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setShareMenuId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !sendMessage.isPending) {
      const outgoing = input.trim();
      setInput("");
      processHumanoidCommand(outgoing, "typed");
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !sendMessage.isPending) {
        const outgoing = input.trim();
        setInput("");
        processHumanoidCommand(outgoing, "typed");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const tags = Array.from(files)
        .slice(0, 4)
        .map((file) => `[${file.name}]`)
        .join(" ");
      setInput((prev) => `${prev}${prev ? " " : ""}${tags}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setInput(prev => prev + (prev ? ' ' : '') + `[${file.name}]`);
    }
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const visionReport = useMemo(() => {
    if (latestSearchMatch) {
      return {
        status: alarmActive ? "Security alert" : "Search match",
        summary: `Search match found: ${latestSearchMatch.name} (${latestSearchMatch.role}) at ${Math.round(latestSearchMatch.confidence * 100)}% confidence.`,
        details: [
          `Database profiles: ${knownFaces.length}`,
          `Matching sensitivity: ${matchSensitivity}`,
          `Matched profile ID: ${latestSearchMatch.knownFaceId}`,
          latestSearchMatch.matchReason,
          isMatchingFaces ? "Live matcher cycle: running" : "Live matcher cycle: monitoring",
        ],
      };
    }

    if (visionError) {
      return {
        status: "Vision error",
        summary: `CYRUS Vision could not start: ${visionError}`,
        details: [
          "Check camera permissions in browser/system settings",
          "Ensure no other app is using the camera",
          "Retry camera activation",
        ],
      };
    }

    if (!cameraActive && !modelLoading) {
      return {
        status: "Vision offline",
        summary: "Camera is inactive. Activate CYRUS Vision to generate a live analysis report.",
        details: ["No active visual stream", "No objects currently tracked", `Face database profiles: ${knownFaces.length}`, `Matching sensitivity: ${matchSensitivity}`],
      };
    }

    if (modelLoading) {
      return {
        status: "Model initializing",
        summary: "CYRUS Vision AI is loading the detection model and calibrating the feed.",
        details: ["Preparing object detection model", "Waiting for camera frames", `Face database profiles: ${knownFaces.length}`, `Matching sensitivity: ${matchSensitivity}`],
      };
    }

    if (detectedObjects.length === 0) {
      return {
        status: "Scanning",
        summary: "Live stream active. No stable object detections in the current frame set.",
        details: ["Visual cortex active", "Awaiting confident detections", `Face database profiles: ${knownFaces.length}`, `Matching sensitivity: ${matchSensitivity}`],
      };
    }

    const grouped = new Map<string, { count: number; topScore: number }>();
    detectedObjects.forEach((obj) => {
      const current = grouped.get(obj.class) || { count: 0, topScore: 0 };
      current.count += 1;
      current.topScore = Math.max(current.topScore, obj.score);
      grouped.set(obj.class, current);
    });

    const ranked = Array.from(grouped.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].topScore - a[1].topScore;
      })
      .slice(0, 6);

    const top = ranked[0];
    const details = ranked.map(([name, stats]) => {
      return `${name}: ${stats.count} hit${stats.count > 1 ? "s" : ""} • confidence ${Math.round(stats.topScore * 100)}%`;
    });

    return {
      status: "Live analysis",
      summary: `Primary object: ${top[0]} at ${Math.round(top[1].topScore * 100)}% confidence. ${detectedObjects.length} detections in current scan window.`,
      details: [
        ...details,
        `Face database profiles: ${knownFaces.length}`,
        `Matching sensitivity: ${matchSensitivity}`,
        isMatchingFaces ? "Live matcher cycle: running" : "Live matcher cycle: monitoring",
      ],
    };
  }, [cameraActive, modelLoading, detectedObjects, visionError, knownFaces.length, isMatchingFaces, latestSearchMatch, alarmActive, matchSensitivity]);

  // Get GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => {
          // Use default location if GPS fails
          setGpsLocation({ lat: -24.5629, lng: 25.8486, accuracy: 60 });
        }
      );
    }
  }, []);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Main Chat Panel */}
      <div className="flex-[1.85] flex flex-col min-w-0 bg-black overflow-hidden">
        {/* Panel Header - Matching Previous App Design */}
        <div className="px-4 py-3 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
              <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">CYRUS</h2>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full opacity-60"></span>
                  <span className="w-2 h-2 bg-green-500 rounded-full opacity-40"></span>
                </div>
              </div>
              {gpsLocation && (
                <p className="text-xs text-[rgba(235,235,245,0.5)] flex items-center gap-1">
                  <span className="text-cyan-400">◉</span>
                  {gpsLocation.lat.toFixed(4)}, {gpsLocation.lng.toFixed(4)} · ±{Math.round(gpsLocation.accuracy)}m
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-[rgba(235,235,245,0.4)] hover:text-white rounded-lg hover:bg-[rgba(120,120,128,0.2)] transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
            <button className="p-2 text-[rgba(235,235,245,0.4)] hover:text-white rounded-lg hover:bg-[rgba(120,120,128,0.2)] transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              onClick={() => clearHistory.mutate()}
              className="p-2 text-[rgba(235,235,245,0.4)] hover:text-[#ff453a] rounded-lg hover:bg-[rgba(255,69,58,0.1)] transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Display - Independent Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 scrollbar-thin scrollbar-thumb-[#3a3a3c] scrollbar-track-transparent hover:scrollbar-thumb-[#48484a]" style={{ scrollBehavior: 'smooth' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-cyan-500/30 shadow-lg shadow-cyan-500/20 mb-5">
                <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to CYRUS</h3>
              <p className="text-sm text-[rgba(235,235,245,0.5)] max-w-sm">
                Autonomous quantum AI system ready. Enter a command to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto w-full">
              {sortedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`group flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "cyrus" && (
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
                      <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className={`max-w-[75%] px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-[#0a84ff] text-white rounded-2xl rounded-br-md"
                        : "bg-[#2c2c2e] text-white rounded-2xl rounded-bl-md"
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[10px] mt-2 opacity-50">
                        {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <button
                        onClick={() => handleCopyMessage(msg.content, msg.id)}
                        className="p-1.5 rounded-lg bg-[#2c2c2e] hover:bg-[#3a3a3c] transition-colors"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#30d158]" />
                        ) : (
                          <Copy className="w-3 h-3 text-[rgba(235,235,245,0.6)]" />
                        )}
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => handleShareMessage(msg.content, msg.role, msg.id)}
                          className="p-1.5 rounded-lg bg-[#2c2c2e] hover:bg-[#3a3a3c] transition-colors"
                          title="Share message"
                        >
                          <Share2 className="w-3 h-3 text-[rgba(235,235,245,0.6)]" />
                        </button>
                        {shareMenuId === msg.id && (
                          <div className="absolute bottom-full mb-2 right-0 bg-[#2c2c2e] rounded-xl shadow-xl border border-cyan-500/30 p-2 z-50 min-w-[140px]">
                            <button
                              onClick={() => shareToWhatsApp(shareMenuContent)}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-[#3a3a3c] transition-colors text-left"
                            >
                              <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              <span className="text-xs text-white">WhatsApp</span>
                            </button>
                            <button
                              onClick={() => shareToFacebook(shareMenuContent)}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-[#3a3a3c] transition-colors text-left"
                            >
                              <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              <span className="text-xs text-white">Facebook</span>
                            </button>
                            <button
                              onClick={() => copyToClipboard(shareMenuContent)}
                              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-[#3a3a3c] transition-colors text-left"
                            >
                              <Copy className="w-4 h-4 text-[rgba(235,235,245,0.6)]" />
                              <span className="text-xs text-white">Copy</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 bg-[#3a3a3c] rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-[rgba(235,235,245,0.6)]" />
                    </div>
                  )}
                </div>
              ))}
              {(sendMessage.isPending || commandInFlight) && !isStreaming && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
                    <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#2c2c2e] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-[rgba(235,235,245,0.4)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {commandError && !commandInFlight && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-red-500/30 shadow-sm shadow-red-500/20 bg-[#2c2c2e] flex items-center justify-center">
                    <X className="w-4 h-4 text-red-300" />
                  </div>
                  <div className="bg-[rgba(255,69,58,0.12)] border border-[rgba(255,69,58,0.28)] rounded-2xl rounded-bl-md px-4 py-3 max-w-[75%]">
                    <p className="text-sm leading-relaxed text-red-100">{commandError}</p>
                  </div>
                </div>
              )}
              {isStreaming && streamingText && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-cyan-500/30 shadow-sm shadow-cyan-500/20">
                    <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-[#2c2c2e] rounded-2xl rounded-bl-md px-4 py-3 max-w-[75%]">
                    <div className="flex items-center gap-2 mb-1">
                      <Volume2 className="w-3 h-3 text-[#0a84ff] animate-pulse" />
                      <span className="text-[10px] text-[#0a84ff]">Speaking...</span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">{streamingText}</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="px-4 py-2 border-t border-cyan-500/30">
          <div className="flex justify-center gap-2">
            <button
              onClick={toggleCamera}
              disabled={modelLoading}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                cameraActive
                  ? 'bg-cyan-500/22 border border-cyan-400/50 text-cyan-200'
                  : modelLoading
                    ? 'bg-cyan-500/18 border border-cyan-300/35 text-cyan-100'
                    : 'bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px]">{modelLoading ? 'Loading...' : 'Camera'}</span>
            </button>
            <button
              onClick={toggleVoice}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                voiceEnabled
                  ? 'bg-cyan-500/22 border border-cyan-400/45 text-cyan-200'
                  : 'bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16'
              }`}
            >
              {voiceEnabled ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span className="text-[10px]">{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
            </button>
            <button
              onClick={() => setShowElevenLabsModal(true)}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16 transition-colors"
              title="Set ElevenLabs API key"
            >
              <KeyRound className="w-5 h-5" />
              <span className="text-[10px]">Voice Key</span>
            </button>
            <button
              onClick={() => setHumanoidLiveEnabled((prev) => !prev)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                humanoidLiveEnabled
                  ? 'bg-cyan-500/22 border border-cyan-400/45 text-cyan-200'
                  : 'bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16'
              }`}
              title={humanoidLiveEnabled ? 'Humanoid live command mode active' : 'Enable humanoid live command mode'}
            >
              <Cpu className="w-5 h-5" />
              <span className="text-[10px]">{humanoidLiveEnabled ? 'Humanoid' : 'Humanoid Off'}</span>
            </button>
            <button
              onClick={() => setWakeWordEnabled(prev => !prev)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${
                wakeWordEnabled
                  ? 'bg-cyan-500/22 border border-cyan-400/45 text-cyan-200'
                  : 'bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16'
              }`}
              title={wakeWordEnabled ? 'Say "CYRUS" to activate' : 'Enable wake word detection'}
            >
              <Radio className={`w-5 h-5 ${wakeWordListening && wakeWordEnabled ? 'animate-pulse' : ''}`} />
              {wakeWordActivated && <span className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-ping" />}
              <span className="text-[10px]">{wakeWordEnabled ? '"CYRUS"' : 'Wake Word'}</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px]">Upload</span>
            </button>
            <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-[10px]">Security</span>
            </button>
            <a
              href="/comms"
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="text-[10px]">Comms</span>
            </a>
            <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-[#0d1822] border border-cyan-500/25 text-cyan-200/80 hover:text-cyan-100 hover:bg-cyan-500/16 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="text-[10px]">Export</span>
            </button>
          </div>
          <div className="mt-2 text-center text-[11px] text-cyan-200/80">
            Humanoid Live: {humanoidLiveEnabled ? `ACTIVE | ${humanoidStatus}` : "OFF"}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-cyan-500/30">
          <form onSubmit={handleSubmit}>
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-2 bg-[#2c2c2e] rounded-2xl px-3 py-3 border border-cyan-500/30">
                <input type="file" ref={chatFileInputRef} onChange={handleChatFileUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  className="p-2 text-[rgba(235,235,245,0.4)] hover:text-[#0a84ff] rounded-lg transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition-colors ${
                    micActive || isListening
                      ? "text-cyan-200 bg-cyan-500/22 border border-cyan-400/40"
                      : "text-[rgba(235,235,245,0.4)] hover:text-[#0a84ff]"
                  }`}
                  title={isListening ? "Stop microphone" : "Start microphone"}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Message CYRUS"
                  rows={3}
                  className="flex-1 min-h-[86px] max-h-52 resize-y overflow-y-auto bg-transparent text-sm leading-relaxed text-white placeholder-[rgba(235,235,245,0.3)] outline-none py-2"
                  disabled={sendMessage.isPending || commandInFlight}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sendMessage.isPending || commandInFlight}
                  className="p-2.5 bg-[#0a84ff] text-white rounded-lg disabled:opacity-30 hover:bg-[#409cff] transition-colors"
                  title="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-cyan-200/55 px-1">Press Enter to send, Shift+Enter for a new line.</p>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Vision + Analysis */}
      <div className="flex w-full lg:w-[620px] flex-col bg-[#1c1c1e] border-t lg:border-t-0 lg:border-l border-cyan-500/35">
        {/* CYRUS Vision Panel - Top Section (Larger) */}
        <div className="h-[52%] p-4 flex flex-col overflow-hidden border-b border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">CYRUS Vision</h3>
              {modelLoading && (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-[10px] text-amber-400">Loading ML...</span>
                </span>
              )}
              {cameraActive && !modelLoading && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-emerald-400">LIVE</span>
                </span>
              )}
              {visionError && !modelLoading && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-[10px] text-red-400">ERROR</span>
                </span>
              )}
              {alarmActive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40">
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-red-300">ALARM</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleVisionRecording}
                disabled={!cameraActive}
                className={`p-1.5 rounded-lg transition-colors ${
                  isRecordingVision
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : "text-[rgba(235,235,245,0.4)] hover:bg-[rgba(120,120,128,0.2)] disabled:opacity-40"
                }`}
                title={isRecordingVision ? "Stop recording" : "Start recording"}
              >
                <Radio className={`w-4 h-4 ${isRecordingVision ? "animate-pulse" : ""}`} />
              </button>
              {/* Multi-frame burst capture button */}
              <button
                onClick={() => void runBurstCapture(4, 400)}
                disabled={!cameraActive || isBurstCapturing}
                className={`p-1.5 rounded-lg transition-colors text-xs font-bold ${
                  isBurstCapturing
                    ? "bg-purple-500/20 text-purple-300 cursor-wait"
                    : "text-[rgba(235,235,245,0.4)] hover:bg-[rgba(120,120,128,0.2)] disabled:opacity-40"
                }`}
                title="Burst capture: analyse 4 frames from different angles"
              >
                {isBurstCapturing ? (
                  <span className="text-[10px] font-bold animate-pulse">{burstFrameCount}/4</span>
                ) : (
                  <Layers className="w-4 h-4" />
                )}
              </button>
              <input type="file" ref={faceDbInputRef} onChange={handleFaceDatabaseUpload} accept="image/*" className="hidden" />
              <button
                onClick={() => faceDbInputRef.current?.click()}
                disabled={isRegisteringFace}
                className="p-1.5 rounded-lg text-[rgba(235,235,245,0.4)] hover:bg-[rgba(120,120,128,0.2)] disabled:opacity-40"
                title="Upload face to search database"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={toggleCamera}
                disabled={modelLoading}
                className={`p-1.5 rounded-lg transition-colors ${
                  cameraActive
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : modelLoading
                      ? "text-amber-400 cursor-wait"
                      : "text-[rgba(235,235,245,0.4)] hover:bg-[rgba(120,120,128,0.2)]"
                }`}
              >
                {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              value={enrollName}
              onChange={(e) => setEnrollName(e.target.value)}
              placeholder="Name for face DB"
              className="h-8 rounded-md border border-cyan-500/30 bg-black/40 px-2 text-[11px] text-white placeholder-[rgba(235,235,245,0.35)] outline-none"
            />
            <input
              value={enrollRole}
              onChange={(e) => setEnrollRole(e.target.value)}
              placeholder="Role"
              className="h-8 rounded-md border border-cyan-500/30 bg-black/40 px-2 text-[11px] text-white placeholder-[rgba(235,235,245,0.35)] outline-none"
            />
          </div>
          <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-cyan-500/25 bg-black/20 px-2 py-1.5">
            <div>
              <p className="text-[10px] text-[rgba(235,235,245,0.75)]">Match sensitivity</p>
              <p className="text-[10px] text-[rgba(235,235,245,0.4)]">Lenient improves recall. Strict reduces false alarms.</p>
            </div>
            <select
              value={matchSensitivity}
              onChange={(e) => setMatchSensitivity(e.target.value as "strict" | "normal" | "lenient")}
              className="h-7 rounded-md border border-cyan-500/30 bg-black/50 px-2 text-[11px] text-white outline-none"
            >
              <option value="strict">Strict</option>
              <option value="normal">Normal</option>
              <option value="lenient">Lenient</option>
            </select>
          </div>
          <p className="mb-2 text-[10px] text-[rgba(235,235,245,0.42)]">
            Extra advantage: upload the same person 2 to 5 times with different angles or lighting to strengthen recognition.
          </p>
          
          {/* Camera Feed with ML Overlay */}
          <div className="flex-1 bg-black rounded-xl border border-cyan-500/30 overflow-hidden relative min-h-[340px]">
            {cameraActive || modelLoading ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Canvas overlay for bounding boxes */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
                {/* Vision overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {modelLoading ? "INITIALIZING..." : "VISUAL CORTEX ACTIVE"}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 text-[10px] text-emerald-400 font-mono">
                    {detectedObjects.length > 0 && `${detectedObjects.length} OBJECTS`}
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-500/30 flex items-center justify-center mb-3">
                  <CameraOff className="w-6 h-6 text-[rgba(235,235,245,0.3)]" />
                </div>
                <p className="text-xs text-[rgba(235,235,245,0.4)] text-center mb-1">Vision Offline</p>
                <p className="text-[10px] text-[rgba(235,235,245,0.3)]">Click camera to activate ML vision</p>
              </div>
            )}
          </div>

          {/* Detected Objects List */}
          {cameraActive && detectedObjects.length > 0 && (
            <div className="mt-2 max-h-20 overflow-auto">
              <div className="flex flex-wrap gap-1">
                {detectedObjects.map((obj, i) => (
                  <span 
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full font-mono"
                  >
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    {obj.class} {Math.round(obj.score * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
            <div className="text-[rgba(235,235,245,0.6)]">
              Face DB: <span className="text-cyan-300">{knownFaces.length}</span>
              {isRegisteringFace ? <span className="text-amber-300"> · Enrolling...</span> : null}
            </div>
            {latestSearchMatch ? (
              <div className="text-red-300">
                Search match: {latestSearchMatch.name} ({Math.round(latestSearchMatch.confidence * 100)}%)
              </div>
            ) : (
              <div className="text-[rgba(235,235,245,0.45)]">Search match: none</div>
            )}
          </div>
          {knownFaces.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {knownFaces.slice(0, 4).map((profile) => (
                <span
                  key={profile.id}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200"
                >
                  {profile.name}
                  <span className="text-[rgba(235,235,245,0.55)]">{profile.referenceImageCount || 0} shot{(profile.referenceImageCount || 0) === 1 ? "" : "s"}</span>
                </span>
              ))}
            </div>
          )}
          {visionRecordingUrl && (
            <a
              href={visionRecordingUrl}
              download={`cyrus-vision-capture-${Date.now()}.webm`}
              className="mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"
            >
              <Download className="w-3 h-3" />
              Download latest vision recording
            </a>
          )}
        </div>

        {/* Vision Analysis Report Panel - Replaces File Workspace */}
        <div className="h-[28%] p-4 flex flex-col overflow-hidden border-b border-cyan-500/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">Vision Analysis Report</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadVisionReport(visionReport)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[rgba(120,120,128,0.25)] text-[rgba(235,235,245,0.75)] hover:bg-[rgba(120,120,128,0.35)]"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">{visionReport.status}</span>
            </div>
          </div>
          <div className="flex-1 bg-black rounded-lg border border-cyan-500/25 p-3 overflow-auto">
            {latestSearchMatch && (
              <p className="text-[11px] text-red-300 mb-2 font-semibold">
                SEARCH MATCH: {latestSearchMatch.name} ({latestSearchMatch.role}) at {Math.round(latestSearchMatch.confidence * 100)}% confidence.
              </p>
            )}
            <p className="text-xs text-white leading-relaxed mb-2">{visionReport.summary}</p>
            <div className="space-y-1.5">
              {visionReport.details.map((line, i) => (
                <p key={i} className="text-[11px] text-[rgba(235,235,245,0.65)] font-mono py-1 border-b border-cyan-500/20 last:border-0">
                  {line}
                </p>
              ))}
            </div>
            {visionActivityLog.length > 0 && (
              <div className="mt-2 pt-2 border-t border-cyan-500/20 space-y-1">
                {visionActivityLog.slice(0, 3).map((event) => (
                  <p key={event.id} className="text-[10px] text-[rgba(235,235,245,0.5)]">
                    {new Date(event.timestamp).toLocaleTimeString()} · {event.title}: {event.detail}
                  </p>
                ))}
              </div>
            )}
            {/* Burst capture analysis result */}
            {burstAnalysis && (
              <div className="mt-2 pt-2 border-t border-purple-500/20 space-y-1">
                <p className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Burst Analysis</p>
                <p className="text-[10px] text-[rgba(235,235,245,0.6)]">
                  Scene: {String((burstAnalysis as any).compositeScene || "N/A").slice(0, 100)}
                </p>
                <p className="text-[10px] text-[rgba(235,235,245,0.5)]">
                  People: {String((burstAnalysis as any).peopleCount ?? 0)} · Safety:{" "}
                  <span className={
                    (burstAnalysis as any).safetyAssessment === "alert" ? "text-red-400" :
                    (burstAnalysis as any).safetyAssessment === "caution" ? "text-amber-400" :
                    "text-emerald-400"
                  }>
                    {String((burstAnalysis as any).safetyAssessment || "unknown")}
                  </span>
                </p>
                {Array.isArray((burstAnalysis as any).codesDetected) && (burstAnalysis as any).codesDetected.length > 0 && (
                  <p className="text-[10px] text-cyan-300">
                    Codes: {(burstAnalysis as any).codesDetected.map((c: any) => `${c.type}:${c.value}`).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-[160px] p-3">
          <div className="relative w-full h-full rounded-2xl overflow-hidden border border-cyan-500/35 bg-black/45 shadow-lg shadow-cyan-500/20">
            <img src="/images/cyrus-logo.png" alt="CYRUS" className="w-full h-full object-cover scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/45" />

            <div className="absolute top-2 left-3 right-3 flex items-center justify-between text-[10px] tracking-[0.2em] text-cyan-200/85 font-semibold uppercase">
              <span>CYRUS CORE</span>
              <span>VISION</span>
            </div>

            <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[10px] tracking-[0.26em] text-cyan-100/75 font-semibold uppercase">
              HUMANOID INTELLIGENCE
            </div>

            <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 origin-right text-[10px] tracking-[0.26em] text-cyan-100/75 font-semibold uppercase">
              AUTONOMOUS SYSTEM
            </div>

            <div className="absolute bottom-2 left-3 right-3 text-[10px] tracking-[0.18em] text-cyan-100/80 font-semibold uppercase text-center">
              QUANTUM NEXUS • WATCH • ANALYZE • RESPOND
            </div>
          </div>
        </div>

      </div>

      {showElevenLabsModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1c1c1e] border border-cyan-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">ElevenLabs API Key</h3>
              <button
                onClick={() => setShowElevenLabsModal(false)}
                className="p-1 text-[rgba(235,235,245,0.5)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[rgba(235,235,245,0.55)] mb-3">
              Paste your ElevenLabs key to enable CYRUS voice synthesis.
            </p>
            <div className="flex items-center gap-2 bg-[rgba(120,120,128,0.2)] rounded-lg px-3 py-2 mb-3">
              <input
                type={showApiKey ? "text" : "password"}
                value={elevenLabsApiKeyInput}
                onChange={(e) => setElevenLabsApiKeyInput(e.target.value)}
                placeholder="sk_..."
                className="flex-1 bg-transparent text-sm text-white placeholder-[rgba(235,235,245,0.3)] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="p-1 text-[rgba(235,235,245,0.5)] hover:text-white"
                title={showApiKey ? "Hide key" : "Show key"}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  localStorage.removeItem("cyrus-elevenlabs-api-key");
                  setElevenLabsApiKeyInput("");
                }}
                className="px-3 py-2 rounded-lg bg-[rgba(255,69,58,0.15)] text-[#ff453a] text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("cyrus-elevenlabs-api-key", elevenLabsApiKeyInput.trim());
                  setShowElevenLabsModal(false);
                }}
                className="px-3 py-2 rounded-lg bg-[#0a84ff] text-white text-xs"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
