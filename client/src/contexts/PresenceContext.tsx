import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";

export interface OnlineUser {
  id: string;
  displayName: string;
  deviceId: string;
  inCall: boolean;
  lastActivity: string;
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
  sendPresenceMessage: (message: any) => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectPresence = useCallback((displayName: string = "User") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[GlobalPresence] Already connected");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log("[GlobalPresence] Connection in progress...");
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const deviceId = `device_${navigator.userAgent.substring(0, 20).replace(/\s/g, '_')}`;
    
    console.log(`[GlobalPresence] Connecting as ${displayName}...`);
    
    const ws = new WebSocket(
      `${wsProtocol}//${window.location.host}/ws?userId=${userId}&name=${encodeURIComponent(displayName)}&deviceId=${deviceId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[GlobalPresence] Connected to presence server");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case "connected":
            console.log("[GlobalPresence] My user ID:", msg.userId, "| Total online:", msg.totalOnline);
            (ws as any)._myUserId = msg.userId;
            setMyUserId(msg.userId);
            break;

          case "presence-update":
            const allUsers = msg.users?.length || 0;
            const currentUserId = (ws as any)._myUserId || userId;
            const otherUsers = msg.users.filter((u: OnlineUser) => u.id !== currentUserId);
            console.log(`[GlobalPresence] Total online: ${allUsers} | Other users visible: ${otherUsers.length}`);
            if (allUsers > 0) {
              console.log("[GlobalPresence] All users:", msg.users.map((u: OnlineUser) => `${u.displayName} (${u.id})`).join(", "));
            }
            setOnlineUsers(otherUsers);
            break;

          case "incoming-call":
            console.log("[GlobalPresence] Incoming call from:", msg.callerName);
            setIncomingCall({
              callerId: msg.callerId,
              callerName: msg.callerName,
              roomId: msg.roomId,
              callType: msg.callType,
            });
            break;

          case "call-declined":
            console.log("[GlobalPresence] Call was declined");
            break;

          case "call-ended":
            console.log("[GlobalPresence] Call ended by peer");
            break;

          case "call-failed":
            console.log("[GlobalPresence] Call failed:", msg.reason);
            break;
        }
      } catch (err) {
        console.error("[GlobalPresence] Message parse error:", err);
      }
    };

    ws.onclose = () => {
      console.log("[GlobalPresence] Disconnected from presence server");
      setIsConnected(false);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        const savedName = localStorage.getItem("cyrus-display-name");
        if (savedName && wsRef.current === ws) {
          console.log("[GlobalPresence] Attempting reconnect...");
          connectPresence(savedName);
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error("[GlobalPresence] WebSocket error:", error);
    };
  }, []);

  const disconnectPresence = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setOnlineUsers([]);
    setMyUserId(null);
  }, []);

  const callUser = useCallback((targetUserId: string, targetName: string, type: "audio" | "video") => {
    console.log(`[GlobalPresence] callUser invoked: target=${targetName} (${targetUserId}), type=${type}`);
    
    if (!wsRef.current) {
      console.error("[GlobalPresence] WebSocket ref is null - not connected");
      alert("Not connected to server. Please refresh the page.");
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.error(`[GlobalPresence] WebSocket not open, state=${wsRef.current.readyState}`);
      alert("Connection not ready. Please wait and try again.");
      return;
    }

    const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
      type: "call-user",
      targetUserId,
      roomId,
      payload: { callType: type },
    };
    
    console.log("[GlobalPresence] Sending call message:", JSON.stringify(message));

    try {
      wsRef.current.send(JSON.stringify(message));
      console.log(`[GlobalPresence] Call sent to ${targetName} - Room: ${roomId}`);
      alert(`Calling ${targetName}... Please wait for them to answer.`);
    } catch (err) {
      console.error("[GlobalPresence] Failed to send call:", err);
      alert("Failed to initiate call. Please try again.");
    }
  }, []);

  const acceptCall = useCallback(() => {
    console.log("[GlobalPresence] acceptCall invoked, incomingCall:", incomingCall);
    
    if (!incomingCall) {
      console.error("[GlobalPresence] No incoming call to accept");
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[GlobalPresence] WebSocket not connected");
      alert("Connection lost. Please refresh and try again.");
      return;
    }

    const message = {
      type: "accept-call",
      roomId: incomingCall.roomId,
      callerId: incomingCall.callerId,
    };
    
    console.log("[GlobalPresence] Sending accept message:", JSON.stringify(message));

    try {
      wsRef.current.send(JSON.stringify(message));
      console.log("[GlobalPresence] Call accepted - Room:", incomingCall.roomId);
      alert(`Call connected with ${incomingCall.callerName}!`);
      setIncomingCall(null);
    } catch (err) {
      console.error("[GlobalPresence] Failed to accept call:", err);
      alert("Failed to accept call. Please try again.");
    }
  }, [incomingCall]);

  const declineCall = useCallback(() => {
    console.log("[GlobalPresence] declineCall invoked, incomingCall:", incomingCall);
    
    if (!incomingCall) {
      console.error("[GlobalPresence] No incoming call to decline");
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[GlobalPresence] WebSocket not connected");
      setIncomingCall(null);
      return;
    }

    const message = {
      type: "decline-call",
      roomId: incomingCall.roomId,
      callerId: incomingCall.callerId,
      payload: { reason: "declined" },
    };
    
    console.log("[GlobalPresence] Sending decline message:", JSON.stringify(message));

    try {
      wsRef.current.send(JSON.stringify(message));
      console.log("[GlobalPresence] Call declined");
      setIncomingCall(null);
    } catch (err) {
      console.error("[GlobalPresence] Failed to decline call:", err);
      setIncomingCall(null);
    }
  }, [incomingCall]);

  const sendPresenceMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
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
        sendPresenceMessage,
        wsRef,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}
