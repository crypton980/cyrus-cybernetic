import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPeerConnectionConfig,
  getOptimalVideoConstraints,
  getAudioConstraints,
  getCallQualityMetrics,
  applyBandwidthConstraints,
  AdaptiveBitrateController,
  AudioProcessor,
  ConnectionManager,
  detectNetworkType,
  CallQualityMetrics,
} from "../lib/webrtc-config";

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
}

export interface CallSession {
  roomId: string;
  peerId: string;
  type: "audio" | "video";
  status: "connecting" | "connected" | "reconnecting" | "ended" | "failed";
  qualityMetrics?: CallQualityMetrics;
  networkType?: string;
  qualityPreset?: string;
}

export interface CallControls {
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  volume: number;
}

export function useComms() {
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callControls, setCallControls] = useState<CallControls>({
    isMuted: false,
    isVideoEnabled: true,
    isSpeakerOn: true,
    volume: 1,
  });
  const [qualityMetrics, setQualityMetrics] = useState<CallQualityMetrics | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const bitrateControllerRef = useRef<AdaptiveBitrateController | null>(null);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const qualityMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["/api/comms/messages"],
    queryFn: async () => {
      const res = await fetch("/api/comms/messages");
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const remindersQuery = useQuery<Reminder[]>({
    queryKey: ["/api/comms/reminders"],
    queryFn: async () => {
      const res = await fetch("/api/comms/reminders");
      if (!res.ok) throw new Error("Failed to fetch reminders");
      return res.json();
    },
  });

  const newsQuery = useQuery<NewsItem[]>({
    queryKey: ["/api/comms/news"],
    queryFn: async () => {
      const res = await fetch("/api/comms/news");
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      recipientId,
      content,
    }: {
      recipientId: string;
      content: string;
    }) => {
      const res = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/messages"] });
    },
  });

  const addReminder = useMutation({
    mutationFn: async (reminder: Omit<Reminder, "id" | "completed">) => {
      const res = await fetch("/api/comms/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reminder),
      });
      if (!res.ok) throw new Error("Failed to add reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/reminders"] });
    },
  });

  const completeReminder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/comms/reminders/${id}/complete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to complete reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/reminders"] });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/comms/reminders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/reminders"] });
    },
  });

  const startQualityMonitoring = useCallback(() => {
    if (qualityMonitorIntervalRef.current) {
      clearInterval(qualityMonitorIntervalRef.current);
    }

    qualityMonitorIntervalRef.current = setInterval(async () => {
      if (peerConnectionRef.current && peerConnectionRef.current.connectionState === "connected") {
        const metrics = await getCallQualityMetrics(peerConnectionRef.current);
        setQualityMetrics(metrics);
        setActiveCall((prev) =>
          prev ? { ...prev, qualityMetrics: metrics } : null
        );
      }
    }, 2000);
  }, []);

  const stopQualityMonitoring = useCallback(() => {
    if (qualityMonitorIntervalRef.current) {
      clearInterval(qualityMonitorIntervalRef.current);
      qualityMonitorIntervalRef.current = null;
    }
  }, []);

  const startCall = useCallback(
    async (peerId: string, type: "audio" | "video") => {
      const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const networkType = detectNetworkType();

      try {
        const videoConstraints = type === "video" ? getOptimalVideoConstraints() : false;
        const audioConstraints = getAudioConstraints();

        let stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });

        audioProcessorRef.current = new AudioProcessor();
        stream = await audioProcessorRef.current.processStream(stream);

        setLocalStream(stream);

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${wsProtocol}//${window.location.host}/ws?room=${roomId}`
        );
        wsRef.current = ws;

        const pc = new RTCPeerConnection(createPeerConnectionConfig());
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (type === "video") {
          await applyBandwidthConstraints(pc, "high");
        }

        bitrateControllerRef.current = new AdaptiveBitrateController(
          pc,
          (preset, metrics) => {
            console.log(`[WebRTC] Quality adjusted to ${preset}`, metrics);
            setActiveCall((prev) =>
              prev ? { ...prev, qualityPreset: preset } : null
            );
          }
        );

        pc.ontrack = (event) => {
          console.log("[WebRTC] Remote track received:", event.track.kind);
          setRemoteStream(event.streams[0]);
          setActiveCall((prev) =>
            prev ? { ...prev, status: "connected" } : null
          );
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "ice-candidate",
                roomId,
                payload: event.candidate,
              })
            );
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);
          if (pc.iceConnectionState === "connected") {
            setActiveCall((prev) =>
              prev ? { ...prev, status: "connected" } : null
            );
            bitrateControllerRef.current?.start();
            startQualityMonitoring();
          } else if (pc.iceConnectionState === "disconnected") {
            setActiveCall((prev) =>
              prev ? { ...prev, status: "reconnecting" } : null
            );
          } else if (pc.iceConnectionState === "failed") {
            setActiveCall((prev) =>
              prev ? { ...prev, status: "failed" } : null
            );
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[WebRTC] Connection state:", pc.connectionState);
        };

        ws.onopen = async () => {
          console.log("[WebRTC] WebSocket connected, creating offer...");
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: type === "video",
          });
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", roomId, payload: offer }));

          connectionManagerRef.current = new ConnectionManager(pc, ws, roomId, {
            onStateChange: (state) => {
              console.log("[WebRTC] Connection manager state:", state);
            },
            onReconnecting: () => {
              setActiveCall((prev) =>
                prev ? { ...prev, status: "reconnecting" } : null
              );
            },
            onReconnected: () => {
              setActiveCall((prev) =>
                prev ? { ...prev, status: "connected" } : null
              );
            },
            onFailed: () => {
              setActiveCall((prev) =>
                prev ? { ...prev, status: "failed" } : null
              );
            },
          });
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);
          console.log("[WebRTC] Received message:", msg.type);

          if (msg.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            
            for (const candidate of pendingCandidatesRef.current) {
              await pc.addIceCandidate(candidate);
            }
            pendingCandidatesRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", roomId, payload: answer }));
          } else if (msg.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            
            for (const candidate of pendingCandidatesRef.current) {
              await pc.addIceCandidate(candidate);
            }
            pendingCandidatesRef.current = [];
          } else if (msg.type === "ice-candidate") {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
            } else {
              pendingCandidatesRef.current.push(new RTCIceCandidate(msg.payload));
            }
          } else if (msg.type === "peer-joined") {
            console.log("[WebRTC] Peer joined the call");
          } else if (msg.type === "peer-left") {
            console.log("[WebRTC] Peer left the call");
            setRemoteStream(null);
          }
        };

        ws.onerror = (error) => {
          console.error("[WebRTC] WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("[WebRTC] WebSocket closed");
        };

        setActiveCall({
          roomId,
          peerId,
          type,
          status: "connecting",
          networkType,
          qualityPreset: type === "video" ? "high" : "audioOnly",
        });

        return roomId;
      } catch (err) {
        console.error("[WebRTC] Failed to start call:", err);
        throw err;
      }
    },
    [startQualityMonitoring]
  );

  const joinCall = useCallback(
    async (roomId: string, type: "audio" | "video") => {
      const networkType = detectNetworkType();

      try {
        const videoConstraints = type === "video" ? getOptimalVideoConstraints() : false;
        const audioConstraints = getAudioConstraints();

        let stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });

        audioProcessorRef.current = new AudioProcessor();
        stream = await audioProcessorRef.current.processStream(stream);

        setLocalStream(stream);

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${wsProtocol}//${window.location.host}/ws?room=${roomId}`
        );
        wsRef.current = ws;

        const pc = new RTCPeerConnection(createPeerConnectionConfig());
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (type === "video") {
          await applyBandwidthConstraints(pc, "high");
        }

        bitrateControllerRef.current = new AdaptiveBitrateController(pc);

        pc.ontrack = (event) => {
          console.log("[WebRTC] Remote track received:", event.track.kind);
          setRemoteStream(event.streams[0]);
          setActiveCall((prev) =>
            prev ? { ...prev, status: "connected" } : null
          );
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "ice-candidate",
                roomId,
                payload: event.candidate,
              })
            );
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "connected") {
            setActiveCall((prev) =>
              prev ? { ...prev, status: "connected" } : null
            );
            bitrateControllerRef.current?.start();
            startQualityMonitoring();
          }
        };

        ws.onopen = () => {
          console.log("[WebRTC] Joined room:", roomId);
          ws.send(JSON.stringify({ type: "join", roomId }));
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", roomId, payload: answer }));
          } else if (msg.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          } else if (msg.type === "ice-candidate") {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
            } else {
              pendingCandidatesRef.current.push(new RTCIceCandidate(msg.payload));
            }
          }
        };

        setActiveCall({
          roomId,
          peerId: "joining",
          type,
          status: "connecting",
          networkType,
          qualityPreset: type === "video" ? "high" : "audioOnly",
        });
      } catch (err) {
        console.error("[WebRTC] Failed to join call:", err);
        throw err;
      }
    },
    [startQualityMonitoring]
  );

  const endCall = useCallback(() => {
    console.log("[WebRTC] Ending call...");

    stopQualityMonitoring();

    bitrateControllerRef.current?.stop();
    bitrateControllerRef.current = null;

    audioProcessorRef.current?.destroy();
    audioProcessorRef.current = null;

    connectionManagerRef.current = null;

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    pendingCandidatesRef.current = [];

    setRemoteStream(null);
    setActiveCall(null);
    setQualityMetrics(null);
    setCallControls({
      isMuted: false,
      isVideoEnabled: true,
      isSpeakerOn: true,
      volume: 1,
    });
  }, [localStream, stopQualityMonitoring]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCallControls((prev) => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCallControls((prev) => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
    }
  }, [localStream]);

  const setVolume = useCallback((volume: number) => {
    audioProcessorRef.current?.setVolume(volume);
    setCallControls((prev) => ({ ...prev, volume }));
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStream || !peerConnectionRef.current) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const constraints = videoTrack.getConstraints();
    const currentFacing = (constraints as any).facingMode;
    const newFacing = currentFacing === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...getOptimalVideoConstraints(), facingMode: newFacing },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      localStream.addTrack(newVideoTrack);
    } catch (err) {
      console.error("[WebRTC] Failed to switch camera:", err);
    }
  }, [localStream]);

  const getAudioLevel = useCallback((): number => {
    return audioProcessorRef.current?.getAudioLevel() || 0;
  }, []);

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    messages: messagesQuery.data || [],
    reminders: remindersQuery.data || [],
    news: newsQuery.data || [],
    activeCall,
    localStream,
    remoteStream,
    callControls,
    qualityMetrics,
    sendMessage,
    addReminder,
    completeReminder,
    deleteReminder,
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    setVolume,
    switchCamera,
    getAudioLevel,
    isLoading: messagesQuery.isLoading || remindersQuery.isLoading,
  };
}
