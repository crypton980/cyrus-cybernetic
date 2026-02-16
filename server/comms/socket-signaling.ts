import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "../db";
import { onlineUsers, directMessages } from "../../shared/models/comms";
import { eq } from "drizzle-orm";

interface User {
  id: string;
  socketId: string;
  displayName: string;
  deviceId: string;
  inCall: boolean;
  currentRoomId?: string;
}

interface PendingCall {
  callerId: string;
  callerName: string;
  targetId: string;
  roomId: string;
  callType: "audio" | "video";
  timestamp: Date;
}

const users = new Map<string, User>();
const pendingCalls = new Map<string, PendingCall>();

export function getSocketUsers(): User[] {
  return Array.from(users.values());
}

export function initSocketSignaling(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
    transports: ["polling", "websocket"],
  });

  console.log("[Socket.IO] Signaling server initialized");

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id}`);

    socket.on("register", async (data: { userId: string; displayName: string; deviceId: string }) => {
      const { userId, displayName, deviceId } = data;
      
      const user: User = {
        id: userId,
        socketId: socket.id,
        displayName,
        deviceId,
        inCall: false,
      };
      
      users.set(userId, user);
      (socket as any).userId = userId;
      
      console.log(`[Socket.IO] User registered: ${displayName} (${userId}) - Total: ${users.size}`);
      
      try {
        await db.insert(onlineUsers).values({
          id: userId,
          displayName,
          email: null,
          profileImageUrl: null,
          lastSeen: new Date(),
          isOnline: true,
          socketId: socket.id,
          status: "online",
        }).onConflictDoUpdate({
          target: onlineUsers.id,
          set: {
            displayName,
            lastSeen: new Date(),
            isOnline: true,
            socketId: socket.id,
            status: "online",
          },
        });
      } catch (err) {
        console.error("[Socket.IO] Failed to persist user:", err);
      }
      
      socket.emit("registered", { userId, totalOnline: users.size });
      
      broadcastPresence(io);
    });

    socket.on("call-user", (data: { targetUserId: string; callType: "audio" | "video" }) => {
      const callerId = (socket as any).userId;
      const caller = users.get(callerId);
      
      if (!caller) {
        socket.emit("call-failed", { reason: "not-registered" });
        return;
      }

      const target = users.get(data.targetUserId);
      
      if (!target) {
        socket.emit("call-failed", { reason: "user-offline" });
        return;
      }

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const pendingCall: PendingCall = {
        callerId,
        callerName: caller.displayName,
        targetId: data.targetUserId,
        roomId,
        callType: data.callType,
        timestamp: new Date(),
      };
      
      pendingCalls.set(roomId, pendingCall);
      caller.inCall = true;
      caller.currentRoomId = roomId;

      console.log(`[Socket.IO] Call: ${caller.displayName} -> ${target.displayName} (${data.callType}) Room: ${roomId}`);

      io.to(target.socketId).emit("incoming-call", {
        callerId,
        callerName: caller.displayName,
        roomId,
        callType: data.callType,
      });

      socket.emit("call-ringing", { roomId, targetName: target.displayName, callType: data.callType });
      
      broadcastPresence(io);
    });

    socket.on("accept-call", (data: { roomId: string }) => {
      const userId = (socket as any).userId;
      const user = users.get(userId);
      const pendingCall = pendingCalls.get(data.roomId);

      if (!pendingCall || !user) {
        socket.emit("call-failed", { reason: "call-not-found" });
        return;
      }

      const caller = users.get(pendingCall.callerId);
      
      if (!caller) {
        socket.emit("call-failed", { reason: "caller-disconnected" });
        pendingCalls.delete(data.roomId);
        return;
      }

      user.inCall = true;
      user.currentRoomId = data.roomId;

      socket.join(data.roomId);
      io.sockets.sockets.get(caller.socketId)?.join(data.roomId);

      console.log(`[Socket.IO] Call accepted: ${caller.displayName} <-> ${user.displayName}`);

      const callType = pendingCall.callType;
      
      io.to(caller.socketId).emit("call-accepted", {
        roomId: data.roomId,
        peerName: user.displayName,
        peerId: userId,
        callType,
      });

      socket.emit("call-connected", {
        roomId: data.roomId,
        peerName: caller.displayName,
        peerId: caller.id,
        isInitiator: false,
        callType,
      });

      pendingCalls.delete(data.roomId);
      broadcastPresence(io);
    });

    socket.on("decline-call", (data: { roomId: string }) => {
      const pendingCall = pendingCalls.get(data.roomId);

      if (pendingCall) {
        const caller = users.get(pendingCall.callerId);
        
        if (caller) {
          caller.inCall = false;
          caller.currentRoomId = undefined;
          io.to(caller.socketId).emit("call-declined", { roomId: data.roomId });
        }

        pendingCalls.delete(data.roomId);
        broadcastPresence(io);
      }
    });

    socket.on("webrtc-offer", (data: { roomId: string; offer: any }) => {
      socket.to(data.roomId).emit("webrtc-offer", { offer: data.offer, roomId: data.roomId });
    });

    socket.on("webrtc-answer", (data: { roomId: string; answer: any }) => {
      socket.to(data.roomId).emit("webrtc-answer", { answer: data.answer, roomId: data.roomId });
    });

    socket.on("webrtc-ice-candidate", (data: { roomId: string; candidate: any }) => {
      socket.to(data.roomId).emit("webrtc-ice-candidate", { candidate: data.candidate, roomId: data.roomId });
    });

    socket.on("end-call", (data: { roomId: string }) => {
      const userId = (socket as any).userId;
      const user = users.get(userId);

      if (user) {
        user.inCall = false;
        user.currentRoomId = undefined;
      }

      socket.to(data.roomId).emit("call-ended", { roomId: data.roomId });
      socket.leave(data.roomId);
      
      broadcastPresence(io);
    });

    socket.on("send-message", async (data: { targetUserId: string; message: string; timestamp: string }) => {
      const senderId = (socket as any).userId;
      const sender = users.get(senderId);
      const target = users.get(data.targetUserId);

      if (!sender) return;

      try {
        await db.insert(directMessages).values({
          senderId: senderId,
          recipientId: data.targetUserId,
          content: data.message,
          messageType: "text",
        });
      } catch (err) {
        console.error("[Socket.IO] Failed to persist message:", err);
      }

      if (target) {
        io.to(target.socketId).emit("new-message", {
          senderId,
          senderName: sender.displayName,
          message: data.message,
          timestamp: data.timestamp,
        });
      }

      socket.emit("message-sent", {
        recipientId: data.targetUserId,
        message: data.message,
        timestamp: data.timestamp,
      });
    });

    socket.on("disconnect", async () => {
      const userId = (socket as any).userId;
      
      if (userId) {
        const user = users.get(userId);
        
        if (user?.currentRoomId) {
          socket.to(user.currentRoomId).emit("call-ended", { roomId: user.currentRoomId, reason: "peer-disconnected" });
        }
        
        users.delete(userId);
        console.log(`[Socket.IO] Disconnected: ${user?.displayName || userId} - Remaining: ${users.size}`);
        
        try {
          await db.update(onlineUsers)
            .set({ isOnline: false, lastSeen: new Date(), status: "offline" })
            .where(eq(onlineUsers.id, userId));
        } catch (err) {
          console.error("[Socket.IO] Failed to update offline status:", err);
        }
        
        broadcastPresence(io);
      }
    });
  });

  function broadcastPresence(io: SocketIOServer) {
    const userList = Array.from(users.values()).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      deviceId: u.deviceId,
      inCall: u.inCall,
    }));

    io.emit("presence-update", { users: userList, total: userList.length });
  }

  return io;
}
