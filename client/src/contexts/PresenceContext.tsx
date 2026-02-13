import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

export interface OnlineUser {
  id: string;
  displayName: string;
  deviceId: string;
  inCall: boolean;
  lastActivity?: string;
}

export interface IncomingCall {
  callerId: string;
  callerName: string;
  roomId: string;
  callType: "audio" | "video";
}

export interface CallNotification {
  id: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
  timestamp: number;
}

export interface ActiveCallState {
  roomId: string;
  peerName: string;
  peerId: string;
  callType: "audio" | "video";
  isInitiator: boolean;
  status: "ringing" | "connected" | "ended";
}

interface PresenceContextType {
  isConnected: boolean;
  myUserId: string | null;
  onlineUsers: OnlineUser[];
  incomingCall: IncomingCall | null;
  activeCall: ActiveCallState | null;
  notifications: CallNotification[];
  connectPresence: (displayName: string) => void;
  disconnectPresence: () => void;
  callUser: (targetUserId: string, targetName: string, type: "audio" | "video") => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  sendMessage: (targetUserId: string, message: string) => void;
  clearNotification: (id: string) => void;
  wsRef: React.MutableRefObject<Socket | null>;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}

function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [notifications, setNotifications] = useState<CallNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const activeCallRef = useRef<ActiveCallState | null>(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const addNotification = useCallback((type: CallNotification["type"], message: string) => {
    const notif: CallNotification = {
      id: generateNotificationId(),
      type,
      message,
      timestamp: Date.now(),
    };
    setNotifications(prev => [...prev.slice(-4), notif]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    }, 5000);
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const connectPresence = useCallback((displayName: string = "User") => {
    console.log("[Presence] connectPresence called, displayName:", displayName);
    
    if (socketRef.current?.connected) {
      console.log("[Presence] Already connected, skipping");
      return;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const deviceId = localStorage.getItem('cyrus_device_id') || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cyrus_device_id', deviceId);
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    currentUserIdRef.current = userId;

    console.log(`[Presence] Creating Socket.IO connection to ${window.location.origin}`);
    
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("[Presence] CONNECTED - Socket ID:", socket.id);
      socket.emit('register', { userId, displayName, deviceId });
    });

    socket.on('registered', (data: { userId: string; totalOnline: number }) => {
      console.log("[Presence] Registered successfully:", data);
      setMyUserId(data.userId);
      setIsConnected(true);
      addNotification("success", `Connected as ${displayName}`);
    });

    socket.on('presence-update', (data: { users: OnlineUser[]; total: number }) => {
      const currentId = currentUserIdRef.current;
      const otherUsers = data.users.filter((u) => u.id !== currentId);
      console.log(`[Presence] Online: ${data.total} total, ${otherUsers.length} others`);
      setOnlineUsers(otherUsers);
    });

    socket.on('incoming-call', (data: IncomingCall) => {
      console.log("[Presence] *** INCOMING CALL ***", data);
      setIncomingCall(data);
      incomingCallRef.current = data;
      addNotification("info", `Incoming ${data.callType} call from ${data.callerName}`);
    });

    socket.on('call-ringing', (data: { roomId: string; targetName: string; callType?: "audio" | "video" }) => {
      console.log("[Presence] Call ringing:", data.targetName, "type:", data.callType);
      setActiveCall({
        roomId: data.roomId,
        peerName: data.targetName,
        peerId: "",
        callType: data.callType || "audio",
        isInitiator: true,
        status: "ringing",
      });
      addNotification("info", `Calling ${data.targetName}...`);
    });

    socket.on('call-accepted', (data: { roomId: string; peerName: string; peerId: string; callType?: "audio" | "video" }) => {
      console.log("[Presence] Call accepted by:", data.peerName, "type:", data.callType);
      setActiveCall(prev => prev ? {
        ...prev,
        peerId: data.peerId,
        peerName: data.peerName,
        callType: data.callType || prev.callType,
        status: "connected",
      } : {
        roomId: data.roomId,
        peerName: data.peerName,
        peerId: data.peerId,
        callType: data.callType || "audio",
        isInitiator: true,
        status: "connected",
      });
      setIncomingCall(null);
      incomingCallRef.current = null;
      addNotification("success", `Connected to ${data.peerName}`);
    });

    socket.on('call-connected', (data: { roomId: string; peerName: string; peerId: string; isInitiator?: boolean; callType?: "audio" | "video" }) => {
      console.log("[Presence] Call connected:", data.peerName, "type:", data.callType);
      setActiveCall({
        roomId: data.roomId,
        peerName: data.peerName,
        peerId: data.peerId,
        callType: data.callType || "audio",
        isInitiator: data.isInitiator || false,
        status: "connected",
      });
      setIncomingCall(null);
      incomingCallRef.current = null;
      addNotification("success", `Connected to ${data.peerName}`);
    });

    socket.on('call-declined', (data: { roomId: string }) => {
      console.log("[Presence] Call was declined");
      setActiveCall(null);
      activeCallRef.current = null;
      addNotification("warning", "Call was declined");
    });

    socket.on('call-ended', (data: { roomId: string; reason?: string }) => {
      console.log("[Presence] Call ended:", data.reason || "normal");
      setActiveCall(null);
      activeCallRef.current = null;
      addNotification("info", `Call ended${data.reason ? `: ${data.reason}` : ""}`);
    });

    socket.on('call-failed', (data: { reason: string }) => {
      console.log("[Presence] Call failed:", data.reason);
      setActiveCall(null);
      activeCallRef.current = null;
      addNotification("error", `Call failed: ${data.reason}`);
    });

    socket.on('new-message', (data: { senderId: string; senderName: string; message: string; timestamp: string }) => {
      console.log("[Presence] Message from:", data.senderName);
      addNotification("info", `Message from ${data.senderName}: ${data.message}`);
    });

    socket.on('disconnect', () => {
      console.log("[Presence] Disconnected");
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log("[Presence] Reconnected");
      socket.emit('register', { userId, displayName, deviceId });
    });

    socket.on('connect_error', (error) => {
      console.error("[Presence] Connection error:", error.message);
    });

  }, [addNotification]);

  const disconnectPresence = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setOnlineUsers([]);
    setMyUserId(null);
    setActiveCall(null);
    setIncomingCall(null);
    currentUserIdRef.current = null;
    incomingCallRef.current = null;
    activeCallRef.current = null;
  }, []);

  const callUser = useCallback((targetUserId: string, targetName: string, type: "audio" | "video") => {
    console.log(`[Presence] Initiating ${type} call to ${targetName} (${targetUserId})`);

    if (!socketRef.current?.connected) {
      console.error("[Presence] Socket not connected - cannot place call");
      addNotification("error", "Not connected. Please refresh the page.");
      return;
    }

    socketRef.current.emit('call-user', { targetUserId, callType: type });
    addNotification("info", `Calling ${targetName}...`);
  }, [addNotification]);

  const acceptCall = useCallback(() => {
    const call = incomingCallRef.current;
    console.log("[Presence] acceptCall triggered, call ref:", call);

    if (!call) {
      console.error("[Presence] No incoming call to accept");
      addNotification("error", "No incoming call found");
      return;
    }

    if (!socketRef.current?.connected) {
      console.error("[Presence] Socket not connected - cannot accept call");
      addNotification("error", "Connection lost. Please refresh.");
      return;
    }

    console.log("[Presence] Emitting accept-call for room:", call.roomId);
    socketRef.current.emit('accept-call', { roomId: call.roomId });
    
    setIncomingCall(null);
    incomingCallRef.current = null;
    addNotification("success", `Connecting to ${call.callerName}...`);
  }, [addNotification]);

  const declineCall = useCallback(() => {
    const call = incomingCallRef.current;
    console.log("[Presence] declineCall triggered, call ref:", call);

    if (!call) {
      console.error("[Presence] No incoming call to decline");
      return;
    }

    if (socketRef.current?.connected) {
      console.log("[Presence] Emitting decline-call for room:", call.roomId);
      socketRef.current.emit('decline-call', { roomId: call.roomId });
    }
    
    setIncomingCall(null);
    incomingCallRef.current = null;
    addNotification("info", "Call declined");
  }, [addNotification]);

  const endCall = useCallback(() => {
    const call = activeCallRef.current;
    console.log("[Presence] endCall triggered");

    if (call && socketRef.current?.connected) {
      socketRef.current.emit('end-call', { roomId: call.roomId });
    }

    setActiveCall(null);
    activeCallRef.current = null;
    addNotification("info", "Call ended");
  }, [addNotification]);

  const sendMessage = useCallback((targetUserId: string, message: string) => {
    if (!socketRef.current?.connected) {
      console.error("[Presence] Socket not connected - cannot send message");
      addNotification("error", "Not connected");
      return;
    }

    socketRef.current.emit('send-message', {
      targetUserId,
      message,
      timestamp: new Date().toISOString(),
    });
    addNotification("success", "Message sent");
  }, [addNotification]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <PresenceContext.Provider
      value={{
        isConnected,
        myUserId,
        onlineUsers,
        incomingCall,
        activeCall,
        notifications,
        connectPresence,
        disconnectPresence,
        callUser,
        acceptCall,
        declineCall,
        endCall,
        sendMessage,
        clearNotification,
        wsRef: socketRef as any,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
