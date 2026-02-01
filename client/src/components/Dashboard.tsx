import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import {
  Send,
  User,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  FileText,
  Upload,
  Search,
  X,
  Paperclip,
  Cpu,
  Volume2,
  VolumeX,
  Eye,
  Share2,
  Copy,
  Check,
  Radio,
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

export function Dashboard() {
  const [input, setInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, size: string}[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  
  const { playEnhancedAudio, cleanup: cleanupAudio } = useAudioProcessing();
  const wakeWordCommandRef = useRef<string | null>(null);
  
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

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
      setCameraActive(false);
    } else {
      // Start camera with ML
      try {
        setModelLoading(true);
        
        // Load COCO-SSD model if not already loaded
        if (!modelRef.current) {
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
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setModelLoading(false);
            setCameraActive(true);
            // Start detection loop
            detectObjects();
          };
        }
      } catch (err) {
        console.error("Camera/ML error:", err);
        setModelLoading(false);
      }
    }
  };

  // Cleanup camera and ML on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
          body: JSON.stringify({ text, voice: "nova" }),
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
            body: JSON.stringify({ text, voice: "nova" }),
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
    
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: message }),
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
        message,
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
        detectedObjects: cameraActive ? JSON.stringify(detectedObjects) : null,
      }),
    });

    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    
    if (voiceEnabledRef.current) {
      speakText(inferData.response);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      setMicActive(true);
      startListening();
    }
  };

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content }),
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
          detectedObjects: cameraActive ? JSON.stringify(detectedObjects) : null,
        }),
      });

      return inferData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setInput("");
      if (voiceEnabledRef.current && data?.response) {
        speakText(data.response);
      }
    },
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      await fetch("/api/conversations", { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleWakeWordCommand = useCallback((command: string) => {
    console.log("[WakeWord] Processing command:", command);
    sendMessage.mutate(command);
  }, [sendMessage]);

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
  }, [messages, sendMessage.isPending]);

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
      sendMessage.mutate(input.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        size: formatFileSize(file.size),
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setInput(prev => prev + (prev ? ' ' : '') + `[${file.name}]`);
    }
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleResearch = () => {
    if (researchQuery.trim()) {
      setResearchResults(prev => [`> ${researchQuery}`, "Processing...", ...prev]);
      setResearchQuery("");
    }
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // GPS location state
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null);

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
      <div className="flex-1 flex flex-col min-w-0 bg-black overflow-hidden">
        {/* Panel Header - Matching Previous App Design */}
        <div className="px-4 py-3 border-b border-[rgba(84,84,88,0.65)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-cyan-600 to-teal-700 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-white" />
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
              <div className="w-16 h-16 bg-[#0a84ff] rounded-2xl flex items-center justify-center mb-5">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to CYRUS</h3>
              <p className="text-sm text-[rgba(235,235,245,0.5)] max-w-sm">
                Autonomous quantum AI system ready. Enter a command to begin.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
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
                          <div className="absolute bottom-full mb-2 right-0 bg-[#2c2c2e] rounded-xl shadow-xl border border-[rgba(84,84,88,0.65)] p-2 z-50 min-w-[140px]">
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
              {sendMessage.isPending && !isStreaming && (
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
        <div className="px-4 py-2 border-t border-[rgba(84,84,88,0.65)]">
          <div className="flex justify-center gap-2">
            <button
              onClick={toggleCamera}
              disabled={modelLoading}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                cameraActive ? 'bg-cyan-500/20 text-cyan-400' : modelLoading ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px]">{modelLoading ? 'Loading...' : 'Camera'}</span>
            </button>
            <button
              onClick={toggleVoice}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                voiceEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
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
              onClick={() => setWakeWordEnabled(prev => !prev)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${
                wakeWordEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={wakeWordEnabled ? 'Say "CYRUS" to activate' : 'Enable wake word detection'}
            >
              <Radio className={`w-5 h-5 ${wakeWordListening && wakeWordEnabled ? 'animate-pulse' : ''}`} />
              {wakeWordActivated && <span className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full animate-ping" />}
              <span className="text-[10px]">{wakeWordEnabled ? '"CYRUS"' : 'Wake Word'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px]">Upload</span>
            </button>
            <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-[10px]">Security</span>
            </button>
            <a
              href="/comms"
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="text-[10px]">Comms</span>
            </a>
            <button className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <span className="text-[10px]">Export</span>
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-[rgba(84,84,88,0.65)]">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 bg-[#2c2c2e] rounded-xl px-3 py-2">
              <input type="file" ref={chatFileInputRef} onChange={handleChatFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                className="p-2 text-[rgba(235,235,245,0.4)] hover:text-[#0a84ff] rounded-lg transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message CYRUS"
                className="flex-1 bg-transparent text-sm text-white placeholder-[rgba(235,235,245,0.3)] outline-none py-2"
                disabled={sendMessage.isPending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sendMessage.isPending}
                className="p-2.5 bg-[#0a84ff] text-white rounded-lg disabled:opacity-30 hover:bg-[#409cff] transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Display Panels (Wider) */}
      <div className="hidden xl:flex w-[420px] flex-col bg-[#1c1c1e] border-l border-[rgba(84,84,88,0.65)]">
        {/* Research Panel */}
        <div className="p-4 border-b border-[rgba(84,84,88,0.65)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">Research Portal</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-[rgba(120,120,128,0.2)] text-sm text-white placeholder-[rgba(235,235,245,0.3)] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0a84ff]"
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            />
            <button
              onClick={handleResearch}
              className="p-2 bg-[#0a84ff] text-white rounded-lg hover:bg-[#409cff] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          
          {/* Console Display */}
          <div className="bg-black rounded-lg border border-[rgba(84,84,88,0.65)] p-3 h-24 overflow-auto">
            {researchResults.length === 0 ? (
              <p className="text-xs text-[rgba(235,235,245,0.3)] text-center py-3">No queries</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {researchResults.map((result, i) => (
                  <p key={i} className="text-[rgba(235,235,245,0.6)] py-0.5 border-b border-[rgba(84,84,88,0.3)] last:border-0">
                    {result}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Files Panel - Upper Section */}
        <div className="h-[45%] p-4 flex flex-col overflow-hidden border-b border-[rgba(84,84,88,0.65)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[rgba(235,235,245,0.5)] uppercase tracking-wide">File Workspace</h3>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-[#0a84ff] hover:bg-[rgba(10,132,255,0.1)] rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
          
          {uploadedFiles.length === 0 ? (
            <div 
              className="flex-1 border border-dashed border-[rgba(84,84,88,0.65)] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#0a84ff] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-[rgba(235,235,245,0.3)] mb-2" />
              <p className="text-xs text-[rgba(235,235,245,0.4)]">Drop files here</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-2">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-[#2c2c2e] rounded-lg">
                  <div className="w-8 h-8 bg-[rgba(120,120,128,0.2)] rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[#0a84ff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{file.name}</p>
                    <p className="text-[10px] text-[rgba(235,235,245,0.4)]">{file.size}</p>
                  </div>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-[rgba(235,235,245,0.4)] hover:text-[#ff453a] rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CYRUS Vision Panel - Lower Section (Live Camera Feed with ML) */}
        <div className="flex-1 p-4 flex flex-col overflow-hidden">
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
            </div>
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
          
          {/* Camera Feed with ML Overlay */}
          <div className="flex-1 bg-black rounded-xl border border-[rgba(84,84,88,0.65)] overflow-hidden relative min-h-[180px]">
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
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-[rgba(84,84,88,0.65)] flex items-center justify-center mb-3">
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
        </div>
      </div>
    </div>
  );
}
