import { useState, useRef, useEffect, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { Eye, Users, Loader2, AlertCircle } from "lucide-react";

interface PersonAnalysis {
  id: number;
  gender: string;
  ageRange: string;
  description: string;
  isRecognized: boolean;
  name?: string;
}

interface VisionData {
  peopleCount: number;
  persons: PersonAnalysis[];
  lastAnalyzed: Date | null;
  isAnalyzing: boolean;
}

interface AlwaysOnVisionProps {
  onVisionUpdate?: (data: VisionData) => void;
}

export function AlwaysOnVision({ onVisionUpdate }: AlwaysOnVisionProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visionData, setVisionData] = useState<VisionData>({
    peopleCount: 0,
    persons: [],
    lastAnalyzed: null,
    isAnalyzing: false,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationRef = useRef<number | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const detectObjects = useCallback(async () => {
    if (!videoRef.current || !modelRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== 4) {
      animationRef.current = requestAnimationFrame(detectObjects);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const predictions = await modelRef.current.detect(video);
      const people = predictions.filter((p) => p.class === "person");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.font = "12px Inter, sans-serif";

      people.forEach((person, index) => {
        const [x, y, width, height] = person.bbox;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = "rgba(34, 211, 238, 0.8)";
        ctx.fillRect(x, y - 18, 80, 18);
        ctx.fillStyle = "#000";
        ctx.fillText(`Person ${index + 1}`, x + 4, y - 5);
      });

      setVisionData((prev) => ({
        ...prev,
        peopleCount: people.length,
      }));
    } catch (err) {
      console.error("Detection error:", err);
    }

    animationRef.current = requestAnimationFrame(detectObjects);
  }, []);

  const analyzePersons = useCallback(async () => {
    if (!videoRef.current || !cameraActive) return;

    const video = videoRef.current;
    if (video.readyState !== 4) return;

    setVisionData((prev) => ({ ...prev, isAnalyzing: true }));

    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.drawImage(video, 0, 0);
      const imageData = tempCanvas.toDataURL("image/jpeg", 0.6);

      const response = await fetch("/api/vision/analyze-people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      if (response.ok) {
        const result = await response.json();
        const newData: VisionData = {
          peopleCount: result.peopleCount || 0,
          persons: result.persons || [],
          lastAnalyzed: new Date(),
          isAnalyzing: false,
        };
        setVisionData(newData);
        if (onVisionUpdate) {
          onVisionUpdate(newData);
        }
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setVisionData((prev) => ({ ...prev, isAnalyzing: false }));
    }
  }, [cameraActive, onVisionUpdate]);

  const startCamera = useCallback(async () => {
    try {
      setModelLoading(true);
      setError(null);

      if (!modelRef.current) {
        await tf.ready();
        modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          setModelLoading(false);
          setCameraActive(true);
          detectObjects();
          analysisIntervalRef.current = setInterval(analyzePersons, 5000);
        };
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(err.message || "Camera access denied");
      setModelLoading(false);
    }
  }, [detectObjects, analyzePersons]);

  useEffect(() => {
    startCamera();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/90 border border-cyan-500/30 rounded-lg overflow-hidden shadow-lg shadow-cyan-500/20 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-900/50 to-transparent border-b border-cyan-500/20">
        <Eye className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-medium text-cyan-400">CYRUS VISION</span>
        <div className={`w-2 h-2 rounded-full ${cameraActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
      </div>

      <div className="relative w-48 h-36">
        {modelLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-center p-2">
            <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </>
        )}
      </div>

      <div className="px-3 py-2 space-y-1 border-t border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-white font-medium">
              {visionData.peopleCount} {visionData.peopleCount === 1 ? "Person" : "People"}
            </span>
          </div>
          {visionData.isAnalyzing && (
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
          )}
        </div>

        {visionData.persons.length > 0 && (
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {visionData.persons.map((person, idx) => (
              <div
                key={idx}
                className="text-xs bg-cyan-900/30 rounded px-2 py-1 border-l-2 border-cyan-400"
              >
                <div className="flex items-center gap-1">
                  {person.isRecognized && (
                    <span className="text-green-400">✓</span>
                  )}
                  <span className="text-white font-medium">
                    {person.name || `Person ${idx + 1}`}
                  </span>
                </div>
                <div className="text-cyan-300/70">
                  {person.gender} · {person.ageRange}
                </div>
                {person.description && (
                  <div className="text-cyan-300/50 truncate">
                    {person.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
