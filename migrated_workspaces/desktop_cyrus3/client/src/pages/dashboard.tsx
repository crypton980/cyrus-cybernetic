import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Send, Mic, MicOff, Volume2, LogOut, Camera, CameraOff, MapPin, Brain, Eye, Ear, Image, X, Download, Radio, Upload, Video, Square, Circle, Shield, Terminal, TrendingUp, Palette } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileUpload, FilePreviewModal } from "@/components/file-upload";
import { BiometricVerification } from "@/components/biometric-verification";
import { CommunicationPanel } from "@/components/communication-panel";
import { Phone } from "lucide-react";
import cyrusEmblem from "@assets/generated_images/cyrus_military_eagle_emblem.png";

interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  url: string;
  isImage?: boolean;
  isVideo?: boolean;
}

interface Message {
  id: string;
  role: "user" | "cyrus";
  content: string;
  timestamp: Date;
  hasImage?: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

interface MemoryItem {
  id: string;
  type: "person" | "place" | "thing" | "conversation";
  description: string;
  timestamp: Date;
}

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "cyrus",
      content: "Hello! I'm CYRUS - your intelligent AI companion. I can see through your camera, hear you speak, know your location, and remember our conversations. All my senses are active and ready. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<{id: string; data: string; timestamp: Date}[]>([]);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  
  // File upload state
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  
  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Location state
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Memory state
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldRestartRef = useRef(false);
  const isSpeakingRef = useRef(false); // Track speaking state for recognition callback
  const lastMessageTimeRef = useRef(0);
  const processingRef = useRef(false);
  const lastSpeakEndRef = useRef<number>(0); // When CYRUS last finished speaking
  const recentCyrusWordsRef = useRef<string[]>([]); // Words CYRUS recently said (for echo detection)
  const DEBOUNCE_MS = 2000; // Minimum 2 seconds between messages

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load memories from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("cyrus_memories");
    if (saved) {
      setMemories(JSON.parse(saved));
    }
  }, []);
  
  // Load saved photos from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("cyrus_photos");
    if (saved) {
      setSavedPhotos(JSON.parse(saved));
    }
  }, []);

  // Save memories to localStorage
  const saveMemory = useCallback((memory: MemoryItem) => {
    setMemories(prev => {
      const updated = [...prev, memory];
      localStorage.setItem("cyrus_memories", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Initialize location tracking
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError(error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const voices = synthRef.current?.getVoices() || [];
        const femaleVoice = voices.find(v => 
          v.name.includes("Samantha") ||
          v.name.includes("Victoria") ||
          v.name.includes("Karen") ||
          v.name.includes("Google UK English Female") ||
          v.name.includes("Microsoft Zira") ||
          v.name.toLowerCase().includes("female")
        ) || voices.find(v => v.lang.includes("en")) || voices[0];
        
        femaleVoiceRef.current = femaleVoice;
      };
      
      loadVoices();
      synthRef.current?.addEventListener("voiceschanged", loadVoices);
      
      return () => {
        synthRef.current?.removeEventListener("voiceschanged", loadVoices);
      };
    }
  }, []);

  const [currentVolume, setCurrentVolume] = useState(1);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTextRef = useRef<string>("");
  
  // Voice commands CYRUS responds to while speaking
  const handleVoiceCommand = useCallback((command: string): boolean => {
    const cmd = command.toLowerCase().trim();
    
    // Stop/interrupt commands
    if (cmd.includes("stop") || cmd.includes("wait") || cmd.includes("pause") || 
        cmd.includes("quiet") || cmd.includes("shut up") || cmd.includes("hold on") ||
        cmd.includes("just a minute") || cmd.includes("one moment") || cmd.includes("hang on")) {
      if (synthRef.current) {
        synthRef.current.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
      return true; // Command handled
    }
    
    // Volume commands - need to restart speech with new volume
    if (cmd.includes("lower") || cmd.includes("quieter") || cmd.includes("softer")) {
      const newVolume = Math.max(0.3, currentVolume - 0.3);
      setCurrentVolume(newVolume);
      if (synthRef.current) {
        synthRef.current.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
      return true;
    }
    
    if (cmd.includes("louder") || cmd.includes("speak up") || cmd.includes("volume up")) {
      const newVolume = Math.min(1, currentVolume + 0.3);
      setCurrentVolume(newVolume);
      if (synthRef.current) {
        synthRef.current.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
      return true;
    }
    
    return false; // Not a voice command
  }, [currentVolume]);

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    currentTextRef.current = text;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = currentVolume;
    
    if (femaleVoiceRef.current) {
      utterance.voice = femaleVoiceRef.current;
    }
    
    currentUtteranceRef.current = utterance;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      // Store words for echo detection
      recentCyrusWordsRef.current = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    };
    
    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      // Mark when CYRUS stopped speaking (for cooldown period)
      lastSpeakEndRef.current = Date.now();
      // Keep recent words for a bit to catch delayed echoes
      setTimeout(() => {
        currentTextRef.current = "";
        recentCyrusWordsRef.current = [];
      }, 2000); // Clear after 2 seconds
    };

    synthRef.current.speak(utterance);
  }, [currentVolume]);

  // Capture image from camera
  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setLastCapture(imageData);
    return imageData;
  }, []);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; imageData?: string | null }) => {
      // Build context with location and memory
      const context: any = {
        message: data.message,
        hasCamera: cameraActive,
        hasLocation: !!location,
      };
      
      if (location) {
        context.location = {
          latitude: location.latitude.toFixed(6),
          longitude: location.longitude.toFixed(6),
          accuracy: `${location.accuracy.toFixed(0)}m`
        };
      }
      
      if (memories.length > 0) {
        context.recentMemories = memories.slice(-5).map(m => m.description);
      }
      
      // Send actual image data for vision analysis
      if (data.imageData) {
        context.hasImage = true;
        context.imageData = data.imageData; // Base64 image for GPT-4o vision
      }
      
      const response = await apiRequest("POST", "/api/cyrus/personality/message", context);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const responseText = data.response || "I'm here to help. What would you like to know?";
      const cyrusMessage: Message = {
        id: Date.now().toString(),
        role: "cyrus",
        content: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, cyrusMessage]);
      setIsThinking(false);
      speak(responseText);
      
      // Save conversation to memory
      saveMemory({
        id: Date.now().toString(),
        type: "conversation",
        description: `User: "${variables.message}" | CYRUS: "${responseText.substring(0, 100)}..."`,
        timestamp: new Date()
      });
    },
    onError: () => {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "cyrus",
        content: "I apologize, I'm having trouble connecting right now. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsThinking(false);
    }
  });

  // Photo command detection
  const isPhotoCommand = useCallback((text: string): boolean => {
    const cmd = text.toLowerCase();
    return cmd.includes("take my picture") || cmd.includes("take a picture") ||
           cmd.includes("take a photo") || cmd.includes("take my photo") ||
           cmd.includes("photograph me") || cmd.includes("snap a photo") ||
           cmd.includes("capture me") || cmd.includes("selfie") ||
           cmd.includes("what do you see") || cmd.includes("look at me") ||
           cmd.includes("describe what you see") || cmd.includes("can you see me") ||
           cmd.includes("what am i wearing") || cmd.includes("how do i look");
  }, []);
  
  // Save photo to gallery
  const savePhoto = useCallback((imageData: string) => {
    const newPhoto = {
      id: Date.now().toString(),
      data: imageData,
      timestamp: new Date()
    };
    setSavedPhotos(prev => {
      const updated = [...prev, newPhoto];
      localStorage.setItem("cyrus_photos", JSON.stringify(updated.slice(-20))); // Keep last 20
      return updated.slice(-20);
    });
  }, []);

  const handleSendMessage = useCallback((text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;
    
    // Prevent duplicate rapid-fire calls (critical for mobile stability)
    const now = Date.now();
    if (processingRef.current || now - lastMessageTimeRef.current < DEBOUNCE_MS) {
      console.log("Message blocked - debounce active");
      return;
    }
    
    if (isThinking) return;
    
    processingRef.current = true;
    lastMessageTimeRef.current = now;

    // Check if this is a photo/vision command - always capture if camera is on
    const needsVision = isPhotoCommand(messageText);
    
    // Capture image if camera is active OR if this is a photo command
    let imageData: string | null = null;
    if (cameraActive) {
      imageData = captureImage();
      // Save photo if user asked for a picture
      if (imageData && needsVision) {
        savePhoto(imageData);
      }
    } else if (needsVision) {
      // User wants vision but camera is off - add hint to enable it
      const hintMessage: Message = {
        id: Date.now().toString() + "-hint",
        role: "cyrus",
        content: "I'd love to see you, but my camera isn't turned on yet. Please tap the 'Start Camera' button so I can see!",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, hintMessage]);
      speak("I'd love to see you, but my camera isn't turned on yet. Please tap the Start Camera button so I can see!");
      processingRef.current = false;
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
      hasImage: !!imageData
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsThinking(true);
    
    // Release processing lock after a delay
    setTimeout(() => {
      processingRef.current = false;
    }, DEBOUNCE_MS);
    
    sendMessageMutation.mutate({ message: messageText, imageData });
  }, [inputText, isThinking, cameraActive, captureImage, sendMessageMutation, isPhotoCommand, savePhoto]);

  // Initialize continuous speech recognition with mobile stability fixes
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // Clean up existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false; // Changed to false for mobile stability
    recognition.interimResults = false; // Changed to false to prevent duplicate results
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      // Always restart if continuous mode is on (even while speaking - for interrupt detection)
      if (shouldRestartRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Silently handle - will retry on next cycle
            }
          }
        }, 300); // Quick restart for interrupt responsiveness
      }
    };

    recognition.onresult = (event) => {
      // Only process final results to avoid duplicates
      const result = event.results[event.results.length - 1];
      if (result && result.isFinal) {
        const transcript = result[0].transcript.trim();
        if (transcript && transcript.length > 0) {
          const heardText = transcript.toLowerCase();
          const cyrusText = currentTextRef.current.toLowerCase();
          
          // ECHO FILTER: Check if this sounds like CYRUS's own voice
          const isLikelyEcho = () => {
            // Very short phrases are likely echo fragments
            if (heardText.length < 5) return true;
            
            // If CYRUS is speaking and we hear part of what she's saying
            if (isSpeakingRef.current) {
              // Check if heard text is a substring of what CYRUS is saying
              if (cyrusText.includes(heardText)) return true;
              
              // Check if words overlap significantly
              const heardWords = heardText.split(/\s+/).filter(w => w.length > 2);
              const cyrusWords = cyrusText.split(/\s+/).filter(w => w.length > 2);
              const matchCount = heardWords.filter(w => cyrusWords.includes(w)).length;
              if (heardWords.length > 0 && matchCount / heardWords.length > 0.5) return true;
            }
            
            // Check cooldown period after CYRUS finishes speaking
            const lastSpoke = lastSpeakEndRef.current;
            if (lastSpoke && Date.now() - lastSpoke < 1500) {
              // Within 1.5 seconds of CYRUS finishing - likely delayed echo
              const recentWords = recentCyrusWordsRef.current;
              const heardWords = heardText.split(/\s+/).filter(w => w.length > 2);
              const matchCount = heardWords.filter(w => recentWords.includes(w)).length;
              if (heardWords.length > 0 && matchCount / heardWords.length > 0.4) return true;
            }
            
            return false;
          };
          
          if (isLikelyEcho()) {
            console.log("Filtered CYRUS echo:", transcript);
            return;
          }
          
          // If CYRUS is speaking, only accept interrupt commands
          if (isSpeakingRef.current) {
            if (handleVoiceCommand(transcript)) {
              console.log("Voice command executed:", transcript);
            }
            return; // Don't process as regular message while speaking
          }
          
          // Normal message - CYRUS is not speaking
          handleSendMessage(transcript);
        }
      }
    };

    recognition.onerror = (event) => {
      console.log("Speech error:", event.error);
      if (event.error === "aborted" || event.error === "network") {
        setIsListening(false);
      }
      // For no-speech, we just continue listening
    };

    recognitionRef.current = recognition;
  }, [handleSendMessage, handleVoiceCommand]);

  const toggleContinuousListening = useCallback(() => {
    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }

    if (isContinuousListening) {
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
      setIsContinuousListening(false);
    } else {
      shouldRestartRef.current = true;
      setIsContinuousListening(true);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        initializeSpeechRecognition();
        setTimeout(() => recognitionRef.current?.start(), 100);
      }
    }
  }, [isContinuousListening, initializeSpeechRecognition]);

  // Camera toggle
  const toggleCamera = useCallback(async () => {
    if (cameraActive) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch (error) {
        console.error("Camera error:", error);
      }
    }
  }, [cameraActive]);

  // Video recording functions
  const startRecording = useCallback(() => {
    if (!streamRef.current || isRecording) return;

    recordedChunksRef.current = [];
    
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp9" });
    } catch (e) {
      try {
        mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
      } catch (e2) {
        mediaRecorder = new MediaRecorder(streamRef.current);
      }
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cyrus-video-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    setRecordingDuration(0);

    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }
  }, [isRecording]);

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle file selection for CYRUS analysis
  const handleFileAnalyze = useCallback(async (file: UploadedFile) => {
    setSelectedFile(null);
    setShowFileUpload(false);
    
    const analysisMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `Analyze this ${file.isImage ? "image" : file.isVideo ? "video" : "file"}: ${file.originalName}`,
      timestamp: new Date(),
      hasImage: file.isImage || file.isVideo
    };
    setMessages(prev => [...prev, analysisMessage]);
    
    // For images, we can send to CYRUS for vision analysis
    if (file.isImage) {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendMessageMutation.mutate({ 
            message: `Analyze this uploaded image: ${file.originalName}`, 
            imageData: base64data 
          });
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Error analyzing file:", error);
      }
    } else {
      sendMessageMutation.mutate({ 
        message: `The user uploaded a file: ${file.originalName} (${file.mimetype}, ${(file.size / 1024).toFixed(1)}KB)`,
        imageData: null
      });
    }
  }, [sendMessageMutation]);

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem("cyrus_auth_session");
    localStorage.removeItem("cyrus_auth_timestamp");
    // Stop any active recognition
    if (recognitionRef.current) {
      shouldRestartRef.current = false;
      try { recognitionRef.current.stop(); } catch {}
    }
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col tactical-grid relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/2 to-transparent rounded-full" />
      </div>

      {/* Header with Status Indicators */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 glass border-b border-cyan-500/20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-sm animate-pulse-glow" />
            <img src={cyrusEmblem} alt="CYRUS" className="relative w-12 h-12 rounded-full ring-2 ring-cyan-500/50" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-cyan-400 tracking-wider text-glow-subtle">CYRUS</h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wide">COMMAND CENTER</p>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full glass-light">
            <div className={`flex items-center gap-1.5 ${isContinuousListening ? "text-emerald-400" : "text-muted-foreground"}`}>
              <div className={`w-2 h-2 rounded-full ${isContinuousListening ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"}`} />
              <Ear className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">EAR</span>
            </div>
            <div className={`flex items-center gap-1.5 ${cameraActive ? "text-emerald-400" : "text-muted-foreground"}`}>
              <div className={`w-2 h-2 rounded-full ${cameraActive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"}`} />
              <Eye className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">EYE</span>
            </div>
            <div className={`flex items-center gap-1.5 ${location ? "text-emerald-400" : "text-muted-foreground"}`}>
              <div className={`w-2 h-2 rounded-full ${location ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/50"}`} />
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">GPS</span>
            </div>
            <div className={`flex items-center gap-1.5 ${memories.length > 0 ? "text-cyan-400" : "text-muted-foreground"}`}>
              <Brain className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">{memories.length}</span>
            </div>
          </div>
          
          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse">
              <Volume2 className="w-4 h-4" />
              <span className="text-xs font-mono">SPEAKING</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Link href="/drone-control">
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/40 text-cyan-400   gap-1.5 font-mono text-xs"
                data-testid="button-drone-control"
              >
                <Radio className="w-4 h-4" />
                DRONE
              </Button>
            </Link>
            
            <Link href="/ai-dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-purple-500/40 text-purple-400   gap-1.5 font-mono text-xs"
                data-testid="button-ai-dashboard"
              >
                <Brain className="w-4 h-4" />
                AI
              </Button>
            </Link>

            <Link href="/ai-assistant">
              <Button
                variant="outline"
                size="sm"
                className="border-cyan-500/40 text-cyan-400   gap-1.5 font-mono text-xs"
                data-testid="button-ai-assistant"
              >
                <Terminal className="w-4 h-4" />
                ASSIST
              </Button>
            </Link>

            <Link href="/trading">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-500/40 text-emerald-400   gap-1.5 font-mono text-xs"
                data-testid="button-trading"
              >
                <TrendingUp className="w-4 h-4" />
                TRADE
              </Button>
            </Link>

            <Link href="/design">
              <Button
                variant="outline"
                size="sm"
                className="border-pink-500/40 text-pink-400   gap-1.5 font-mono text-xs"
                data-testid="button-design"
              >
                <Palette className="w-4 h-4" />
                DESIGN
              </Button>
            </Link>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Camera Preview (if active) */}
      {cameraActive && (
        <div className="relative z-10 w-full h-36 bg-black/80 border-b border-cyan-500/30">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="video-live-camera"
          />
          <div className="absolute inset-0 pointer-events-none border-2 border-cyan-500/20" />
          <div className="absolute top-3 left-3 flex gap-2">
            <div className="glass-light px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 text-emerald-400">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              LIVE FEED
            </div>
            {isRecording && (
              <div className="bg-red-500/90 text-white px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 animate-pulse-red">
                <div className="w-2 h-2 bg-white rounded-full" />
                REC {formatRecordingTime(recordingDuration)}
              </div>
            )}
          </div>
          <div className="absolute bottom-3 right-3 text-xs font-mono text-cyan-400/60">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Location Banner */}
      {location && (
        <div className="relative z-10 px-4 py-2 glass-light border-b border-cyan-500/10 text-xs font-mono flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-400">LAT:</span>
          <span className="text-foreground">{location.latitude.toFixed(6)}</span>
          <span className="text-cyan-400">LON:</span>
          <span className="text-foreground">{location.longitude.toFixed(6)}</span>
          <span className="text-muted-foreground">(±{location.accuracy.toFixed(0)}m)</span>
        </div>
      )}

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`message-${message.role}-${message.id}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 rounded-lg ${
                message.role === "user"
                  ? "bg-cyan-600/90 text-white border border-cyan-400/30 glow-cyan"
                  : "glass border border-cyan-500/20"
              }`}
            >
              {message.role === "cyrus" && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-cyan-500/30 rounded-full blur-sm" />
                    <img src={cyrusEmblem} alt="CYRUS" className="relative w-6 h-6 rounded-full ring-1 ring-cyan-500/50" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-cyan-400 tracking-wider">CYRUS</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {message.hasImage && (
                <div className="text-xs text-cyan-300 mb-2 flex items-center gap-1.5 font-mono">
                  <Camera className="w-3 h-3" /> IMAGE ATTACHED
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start" data-testid="message-thinking">
            <div className="glass border border-cyan-500/20 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-cyan-500/30 rounded-full blur-sm animate-pulse" />
                  <img src={cyrusEmblem} alt="CYRUS" className="relative w-6 h-6 rounded-full ring-1 ring-cyan-500/50" />
                </div>
                <span className="text-xs font-mono font-semibold text-cyan-400 tracking-wider">CYRUS</span>
                <span className="text-xs text-muted-foreground font-mono">PROCESSING</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-4 glass border-t border-cyan-500/20">
        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <Button
            variant={isContinuousListening ? "default" : "outline"}
            size="sm"
            onClick={toggleContinuousListening}
            className={`font-mono text-xs ${
              isContinuousListening 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white glow-green" 
                : "border-cyan-500/40 text-cyan-400 "
            }`}
            data-testid="button-continuous-mic"
          >
            {isContinuousListening ? <Mic className="w-4 h-4 mr-1.5" /> : <MicOff className="w-4 h-4 mr-1.5" />}
            {isContinuousListening ? "LISTENING" : "START MIC"}
          </Button>
          
          <Button
            variant={cameraActive ? "default" : "outline"}
            size="sm"
            onClick={toggleCamera}
            className={`font-mono text-xs ${
              cameraActive 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white glow-green" 
                : "border-cyan-500/40 text-cyan-400 "
            }`}
            data-testid="button-camera"
          >
            {cameraActive ? <Camera className="w-4 h-4 mr-1.5" /> : <CameraOff className="w-4 h-4 mr-1.5" />}
            {cameraActive ? "CAMERA ON" : "START CAM"}
          </Button>

          {cameraActive && (
            <Button
              variant={isRecording ? "default" : "outline"}
              size="sm"
              onClick={isRecording ? stopRecording : startRecording}
              className={`font-mono text-xs ${
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse-red" 
                  : "border-red-500/40 text-red-400 "
              }`}
              data-testid="button-record-video"
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-1.5 fill-white" />
                  STOP ({formatRecordingTime(recordingDuration)})
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 mr-1.5 fill-red-400" />
                  RECORD
                </>
              )}
            </Button>
          )}

          <Button
            variant={showFileUpload ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`font-mono text-xs ${
              showFileUpload 
                ? "bg-purple-500 hover:bg-purple-600 text-white" 
                : "border-purple-500/40 text-purple-400 "
            }`}
            data-testid="button-file-upload"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            UPLOAD
          </Button>

          <Button
            variant={showBiometric ? "default" : "outline"}
            size="sm"
            onClick={() => setShowBiometric(!showBiometric)}
            className={`font-mono text-xs ${
              showBiometric 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                : "border-emerald-500/40 text-emerald-400 "
            }`}
            data-testid="button-biometric"
          >
            <Shield className="w-4 h-4 mr-1.5" />
            BIOMETRIC
          </Button>

          <Button
            variant={showCommunication ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCommunication(!showCommunication)}
            className={`font-mono text-xs ${
              showCommunication 
                ? "bg-blue-500 hover:bg-blue-600 text-white" 
                : "border-blue-500/40 text-blue-400 "
            }`}
            data-testid="button-communication"
          >
            <Phone className="w-4 h-4 mr-1.5" />
            COMMS
          </Button>
          
          {savedPhotos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPhotoGallery(true)}
              className="font-mono text-xs border-cyan-500/40 text-cyan-400 "
              data-testid="button-gallery"
            >
              <Image className="w-4 h-4 mr-1.5" />
              GALLERY ({savedPhotos.length})
            </Button>
          )}
        </div>

        {/* File Upload Panel */}
        {showFileUpload && (
          <div className="mb-3 max-w-3xl mx-auto">
            <FileUpload 
              compact 
              onFileSelect={(file) => setSelectedFile(file)}
              onAnalyze={handleFileAnalyze}
            />
          </div>
        )}

        {/* Biometric Verification Panel */}
        {showBiometric && (
          <div className="mb-3 max-w-xl mx-auto">
            <BiometricVerification 
              mode="both"
              onVerified={(result) => {
                if (result.verified && result.operator) {
                  const msg: Message = {
                    id: Date.now().toString(),
                    role: "cyrus",
                    content: `Identity verified successfully. Welcome, ${result.operator.name}. Role: ${result.operator.role}, Clearance: ${result.operator.clearanceLevel}. Confidence: ${result.confidence}%. Full system access granted.`,
                    timestamp: new Date()
                  };
                  setMessages(prev => [...prev, msg]);
                }
              }}
              onSessionToken={(token) => {
                localStorage.setItem("cyrus_session_token", token);
              }}
            />
          </div>
        )}

        {/* Communication Panel */}
        {showCommunication && (
          <div className="mb-3 max-w-2xl mx-auto">
            <CommunicationPanel 
              operatorName={localStorage.getItem("cyrus_operator_name") || "Operator"}
              operatorId={localStorage.getItem("cyrus_operator_id") || `user-${Date.now()}`}
              isAuthenticated={true}
            />
          </div>
        )}

        {/* Text Input */}
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <div className="flex-1 relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-cyan-500/30 via-transparent to-cyan-500/30 rounded-lg opacity-0 group-focus-within:opacity-100 blur-sm transition-all duration-300" />
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={isContinuousListening ? "LISTENING... OR TYPE COMMAND" : "ENTER COMMAND..."}
              className="relative w-full px-5 py-3.5 bg-card border border-cyan-500/30 rounded-lg text-foreground placeholder-muted-foreground font-mono text-sm focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all"
              disabled={isThinking}
              data-testid="input-message"
            />
          </div>
          
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isThinking}
            className="shrink-0 bg-cyan-600 hover:bg-cyan-500 text-white glow-cyan"
            size="icon"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        
        {isContinuousListening && isListening && (
          <div className="text-center mt-3 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <p className="text-sm text-emerald-400 font-mono tracking-wide animate-pulse">
              MICROPHONE ACTIVE - SPEAK ANYTIME
            </p>
          </div>
        )}
      </div>
      
      {/* Photo Gallery Modal */}
      {showPhotoGallery && (
        <div className="fixed inset-0 bg-background/95 z-50 flex flex-col tactical-grid">
          <div className="flex items-center justify-between p-4 glass border-b border-cyan-500/30">
            <h2 className="text-lg font-bold text-cyan-400 font-mono tracking-wider">PHOTO GALLERY</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPhotoGallery(false)}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-close-gallery"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div className="absolute -inset-px bg-cyan-500/20 rounded-lg opacity-0 group-hover:opacity-100 blur-sm transition-all" />
                  <img 
                    src={photo.data} 
                    alt={`Photo ${photo.id}`} 
                    className="relative w-full aspect-square object-cover rounded-lg border border-cyan-500/30 group-hover:border-cyan-500/50 transition-all"
                  />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-white bg-black/70 px-2 py-1 rounded font-mono">
                      {new Date(photo.timestamp).toLocaleDateString()}
                    </span>
                    <a
                      href={photo.data}
                      download={`cyrus-photo-${photo.id}.jpg`}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white p-1.5 rounded glow-cyan"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            
            {savedPhotos.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-mono">NO PHOTOS YET. ASK CYRUS TO TAKE YOUR PICTURE!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal 
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
        onAnalyze={handleFileAnalyze}
      />
    </div>
  );
}
