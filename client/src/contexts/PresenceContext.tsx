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

interface PresenceContextType {
  isConnected: boolean;
  myUserId: string | null;
  onlineUsers: OnlineUser[];
  incomingCall: IncomingCall | null;
  connectPresence: (displayName: string) => void;
  disconnectPresence: () => void;
  callUser: (targetUserId: string, targetName: string, type: "audio" | "video") => void;
  acceptCall: () => void;
  declineCall: () => void;
  sendMessage: (targetUserId: string, message: string) => void;
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

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);

  const connectPresence = useCallback((displayName: string = "User") => {
    console.log("[SocketIO Presence] ===== connectPresence called =====");
    console.log("[SocketIO Presence] Display name:", displayName);

    if (socketRef.current?.connected || isConnectingRef.current) {
      console.log("[SocketIO Presence] Already connected");
      return;
    }

    if (socketRef.current) {
      console.log("[SocketIO Presence] Disconnecting existing socket first");
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const deviceId = localStorage.getItem('cyrus_device_id') || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cyrus_device_id', deviceId);

    const userId = deviceId;
    currentUserIdRef.current = userId;
    isConnectingRef.current = true;

    console.log(`[SocketIO Presence] Connecting as ${displayName}...`);

    console.log("[SocketIO Presence] Creating socket connection to:", window.location.origin);

    const socket = io(window.location.origin, {
      path: '/cyrus-io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      isConnectingRef.current = false;
      console.log("[SocketIO Presence] *** SOCKET CONNECTED ***");
      console.log("[SocketIO Presence] Socket ID:", socket.id);
      console.log("[SocketIO Presence] Registering user:", displayName, userId);
      socket.emit('register', { userId, displayName, deviceId });
    });

    socket.on('registered', (data: { userId: string; totalOnline: number }) => {
      console.log("[SocketIO Presence] Registered:", data);
      setMyUserId(data.userId);
      setIsConnected(true);
    });

    socket.on('presence-update', (data: { users: OnlineUser[]; total: number }) => {
      const currentId = currentUserIdRef.current;
      const otherUsers = data.users.filter((u) => u.id !== currentId);
      console.log(`[SocketIO Presence] Online: ${data.total} total, ${otherUsers.length} others visible`);
      setOnlineUsers(otherUsers);
    });

    socket.on('incoming-call', (data: IncomingCall) => {
      console.log("[SocketIO Presence] INCOMING CALL:", data);
      setIncomingCall(data);
    });

    socket.on('call-ringing', (data: { roomId: string; targetName: string }) => {
      console.log("[SocketIO Presence] Ringing:", data.targetName);
    });

    socket.on('call-accepted', (data: { roomId: string; peerName: string; peerId: string }) => {
      console.log("[SocketIO Presence] Call accepted by:", data.peerName);
      alert(`${data.peerName} accepted your call!`);
    });

    socket.on('call-connected', (data: { roomId: string; peerName: string; peerId: string }) => {
      console.log("[SocketIO Presence] Connected to:", data.peerName);
      setIncomingCall(null);
      alert(`Connected to ${data.peerName}!`);
    });

    socket.on('call-declined', (data: { roomId: string }) => {
      console.log("[SocketIO Presence] Call was declined");
      alert("Call was declined");
    });

    socket.on('call-ended', (data: { roomId: string; reason?: string }) => {
      console.log("[SocketIO Presence] Call ended:", data.reason || "normal");
    });

    socket.on('call-failed', (data: { reason: string }) => {
      console.log("[SocketIO Presence] Call failed:", data.reason);
      alert(`Call failed: ${data.reason}`);
    });

    socket.on('new-message', (data: { senderId: string; senderName: string; message: string; timestamp: string }) => {
      console.log("[SocketIO Presence] Message from:", data.senderName, "-", data.message);
      alert(`Message from ${data.senderName}: ${data.message}`);
    });

    socket.on('disconnect', () => {
      isConnectingRef.current = false;
      console.log("[SocketIO Presence] Disconnected");
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      isConnectingRef.current = false;
      console.error("[SocketIO Presence] Connection error:", error);
    });

  }, []);

  const disconnectPresence = useCallback(() => {
    isConnectingRef.current = false;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setOnlineUsers([]);
    setMyUserId(null);
    currentUserIdRef.current = null;
  }, []);

  const callUser = useCallback((targetUserId: string, targetName: string, type: "audio" | "video") => {
    console.log(`[SocketIO Presence] Calling ${targetName} (${targetUserId}), type: ${type}`);

    if (!socketRef.current?.connected) {
      console.error("[SocketIO Presence] Socket not connected");
      alert("Not connected. Please refresh the page.");
      return;
    }

    socketRef.current.emit('call-user', { targetUserId, callType: type });
    alert(`Calling ${targetName}...`);
  }, []);

  const acceptCall = useCallback(() => {
    console.log("[SocketIO Presence] Accepting call, incomingCall:", incomingCall);

    if (!incomingCall) {
      console.error("[SocketIO Presence] No incoming call");
      return;
    }

    if (!socketRef.current?.connected) {
      console.error("[SocketIO Presence] Socket not connected");
      alert("Connection lost. Please refresh.");
      return;
    }

    console.log("[SocketIO Presence] Emitting accept-call for room:", incomingCall.roomId);
    socketRef.current.emit('accept-call', { roomId: incomingCall.roomId });
    setIncomingCall(null);
  }, [incomingCall]);

  const declineCall = useCallback(() => {
    console.log("[SocketIO Presence] Declining call");

    if (!incomingCall) {
      console.error("[SocketIO Presence] No incoming call");
      return;
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('decline-call', { roomId: incomingCall.roomId });
    }

    setIncomingCall(null);
  }, [incomingCall]);

  const sendMessage = useCallback((targetUserId: string, message: string) => {
    if (!socketRef.current?.connected) {
      console.error("[SocketIO Presence] Socket not connected");
      return;
    }

    socketRef.current.emit('send-message', {
      targetUserId,
      message,
      timestamp: new Date().toISOString(),
    });
  }, []);

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
        connectPresence,
        disconnectPresence,
        callUser,
        acceptCall,
        declineCall,
        sendMessage,
        wsRef: socketRef as any,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
