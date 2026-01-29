import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  status: "connecting" | "connected" | "ended";
}

export function useComms() {
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

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

  const startCall = useCallback(
    async (peerId: string, type: "audio" | "video") => {
      const roomId = `call_${Date.now()}`;
      const constraints =
        type === "video" ? { video: true, audio: true } : { audio: true };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);

        const ws = new WebSocket(
          `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws?room=${roomId}`
        );
        wsRef.current = ws;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
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

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "offer") {
            await pc.setRemoteDescription(msg.payload);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", roomId, payload: answer }));
          } else if (msg.type === "answer") {
            await pc.setRemoteDescription(msg.payload);
          } else if (msg.type === "ice-candidate") {
            await pc.addIceCandidate(msg.payload);
          }
        };

        ws.onopen = async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", roomId, payload: offer }));
        };

        setActiveCall({ roomId, peerId, type, status: "connecting" });
      } catch (err) {
        console.error("Failed to start call:", err);
      }
    },
    []
  );

  const endCall = useCallback(() => {
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
    setRemoteStream(null);
    setActiveCall(null);
  }, [localStream]);

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
    sendMessage,
    addReminder,
    completeReminder,
    deleteReminder,
    startCall,
    endCall,
    isLoading: messagesQuery.isLoading || remindersQuery.isLoading,
  };
}
