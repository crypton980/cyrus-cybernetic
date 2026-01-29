import { Router } from "express";
import { db } from "../db";
import { onlineUsers, directMessages, callHistory, meetingRooms } from "../../shared/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/api/comms/users", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const users = await db.select().from(onlineUsers).where(eq(onlineUsers.isOnline, true));
    const filteredUsers = users.filter(u => u.id !== userId);
    res.json(filteredUsers);
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/api/comms/user/status", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { isOnline, socketId } = req.body;
    const claims = req.user?.claims;

    await db.insert(onlineUsers).values({
      id: userId,
      displayName: `${claims?.first_name || ""} ${claims?.last_name || ""}`.trim() || claims?.email || "Anonymous",
      email: claims?.email,
      profileImageUrl: claims?.profile_image_url,
      lastSeen: new Date(),
      isOnline,
      socketId,
    }).onConflictDoUpdate({
      target: onlineUsers.id,
      set: {
        lastSeen: new Date(),
        isOnline,
        socketId,
        displayName: `${claims?.first_name || ""} ${claims?.last_name || ""}`.trim() || claims?.email || "Anonymous",
        profileImageUrl: claims?.profile_image_url,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/api/comms/messages/:recipientId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { recipientId } = req.params;

    const messages = await db.select().from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, recipientId)),
          and(eq(directMessages.senderId, recipientId), eq(directMessages.recipientId, userId))
        )
      )
      .orderBy(directMessages.createdAt);

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/api/comms/messages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { recipientId, content } = req.body;

    const [message] = await db.insert(directMessages).values({
      senderId: userId,
      recipientId,
      content,
    }).returning();

    res.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/api/comms/call/start", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { recipientId, callType } = req.body;
    const roomId = `call_${uuid()}`;

    const [call] = await db.insert(callHistory).values({
      callerId: userId,
      recipientId,
      roomId,
      callType: callType || "audio",
      status: "ringing",
    }).returning();

    res.json({ call, roomId });
  } catch (error) {
    console.error("Error starting call:", error);
    res.status(500).json({ error: "Failed to start call" });
  }
});

router.post("/api/comms/call/:callId/answer", isAuthenticated, async (req: any, res) => {
  try {
    const { callId } = req.params;

    await db.update(callHistory)
      .set({ status: "connected" })
      .where(eq(callHistory.id, callId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error answering call:", error);
    res.status(500).json({ error: "Failed to answer call" });
  }
});

router.post("/api/comms/call/:callId/end", isAuthenticated, async (req: any, res) => {
  try {
    const { callId } = req.params;

    await db.update(callHistory)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(callHistory.id, callId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error ending call:", error);
    res.status(500).json({ error: "Failed to end call" });
  }
});

router.get("/api/comms/calls/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;

    const calls = await db.select().from(callHistory)
      .where(or(eq(callHistory.callerId, userId), eq(callHistory.recipientId, userId)))
      .orderBy(desc(callHistory.startedAt))
      .limit(50);

    res.json(calls);
  } catch (error) {
    console.error("Error fetching call history:", error);
    res.status(500).json({ error: "Failed to fetch call history" });
  }
});

router.post("/api/comms/meeting/create", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { name } = req.body;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const [meeting] = await db.insert(meetingRooms).values({
      name: name || "CYRUS Meeting",
      hostId: userId,
      roomCode,
      participants: [userId],
    }).returning();

    res.json(meeting);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Failed to create meeting" });
  }
});

router.post("/api/comms/meeting/join", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const { roomCode } = req.body;

    const [meeting] = await db.select().from(meetingRooms)
      .where(and(eq(meetingRooms.roomCode, roomCode), eq(meetingRooms.isActive, true)));

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const participants = (meeting.participants as string[]) || [];
    if (!participants.includes(userId)) {
      participants.push(userId);
      await db.update(meetingRooms)
        .set({ participants })
        .where(eq(meetingRooms.id, meeting.id));
    }

    res.json(meeting);
  } catch (error) {
    console.error("Error joining meeting:", error);
    res.status(500).json({ error: "Failed to join meeting" });
  }
});

router.get("/api/comms/meetings", isAuthenticated, async (req: any, res) => {
  try {
    const meetings = await db.select().from(meetingRooms)
      .where(eq(meetingRooms.isActive, true))
      .orderBy(desc(meetingRooms.createdAt));

    res.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

export function registerCommsRoutes(app: any) {
  app.use(router);
  console.log("[Comms] Registered communication routes");
}
