import { Router } from "express";
import { db } from "../db";
import { onlineUsers, directMessages, callHistory, meetingRooms, reminders, newsItems } from "../../shared/schema";
import { eq, or, and, desc, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const router = Router();

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || req.headers['x-user-id'] || null;
}

router.get("/api/comms/users", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const users = await db.select().from(onlineUsers).where(eq(onlineUsers.isOnline, true));
    const filteredUsers = users.filter(u => u.id !== userId);
    res.json(filteredUsers);
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/api/comms/user/status", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
    const { isOnline, socketId, displayName } = req.body;
    const claims = req.user?.claims || {};

    await db.insert(onlineUsers).values({
      id: userId,
      displayName: displayName || `${claims?.first_name || ""} ${claims?.last_name || ""}`.trim() || claims?.email || "Anonymous",
      email: claims?.email,
      profileImageUrl: claims?.profile_image_url,
      lastSeen: new Date(),
      isOnline: isOnline !== false,
      socketId,
    }).onConflictDoUpdate({
      target: onlineUsers.id,
      set: {
        lastSeen: new Date(),
        isOnline: isOnline !== false,
        socketId,
        displayName: displayName || `${claims?.first_name || ""} ${claims?.last_name || ""}`.trim() || claims?.email || "Anonymous",
        profileImageUrl: claims?.profile_image_url,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/api/comms/messages", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.json([]);
    }

    const messages = await db.select().from(directMessages)
      .where(
        or(
          eq(directMessages.senderId, userId),
          eq(directMessages.recipientId, userId)
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(100);

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      content: msg.content,
      timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
      read: msg.isRead || false
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/api/comms/messages/:recipientId", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { recipientId } = req.params;

    if (!userId) {
      return res.json([]);
    }

    const messages = await db.select().from(directMessages)
      .where(
        or(
          and(eq(directMessages.senderId, userId), eq(directMessages.recipientId, recipientId)),
          and(eq(directMessages.senderId, recipientId), eq(directMessages.recipientId, userId))
        )
      )
      .orderBy(asc(directMessages.createdAt));

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      content: msg.content,
      timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
      read: msg.isRead || false
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/api/comms/messages", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
    const { recipientId, content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content required" });
    }

    const [message] = await db.insert(directMessages).values({
      senderId: userId,
      recipientId: recipientId || 'broadcast',
      content,
    }).returning();

    res.json({
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      timestamp: message.createdAt?.toISOString() || new Date().toISOString(),
      read: false
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/api/comms/reminders", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    
    let reminderList;
    if (userId) {
      reminderList = await db.select().from(reminders)
        .where(eq(reminders.userId, userId))
        .orderBy(asc(reminders.dueAt));
    } else {
      reminderList = await db.select().from(reminders)
        .orderBy(asc(reminders.dueAt))
        .limit(50);
    }

    const formattedReminders = reminderList.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      dueAt: r.dueAt?.toISOString() || new Date().toISOString(),
      completed: r.completed || false,
      priority: r.priority || 'medium'
    }));

    res.json(formattedReminders);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

router.post("/api/comms/reminders", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
    const { title, description, dueAt, priority } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title required" });
    }

    const [reminder] = await db.insert(reminders).values({
      userId,
      title,
      description: description || null,
      dueAt: new Date(dueAt),
      priority: priority || 'medium',
      completed: false,
    }).returning();

    res.json({
      id: reminder.id,
      title: reminder.title,
      description: reminder.description,
      dueAt: reminder.dueAt?.toISOString(),
      completed: reminder.completed,
      priority: reminder.priority
    });
  } catch (error) {
    console.error("Error creating reminder:", error);
    res.status(500).json({ error: "Failed to create reminder" });
  }
});

router.post("/api/comms/reminders/:id/complete", async (req: any, res) => {
  try {
    const { id } = req.params;

    await db.update(reminders)
      .set({ completed: true })
      .where(eq(reminders.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error completing reminder:", error);
    res.status(500).json({ error: "Failed to complete reminder" });
  }
});

router.delete("/api/comms/reminders/:id", async (req: any, res) => {
  try {
    const { id } = req.params;

    await db.delete(reminders).where(eq(reminders.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

router.get("/api/comms/news", async (req: any, res) => {
  try {
    let newsList = await db.select().from(newsItems)
      .orderBy(desc(newsItems.publishedAt))
      .limit(20);

    if (newsList.length === 0) {
      newsList = [
        {
          id: 'news_1',
          title: 'CYRUS v3.0 Module System Fully Operational',
          summary: 'All 20 AI modules are now running in unified harmony, including the new Blood Sampling System with automated collection capabilities.',
          source: 'CYRUS System',
          url: '/modules',
          category: 'technology',
          publishedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 'news_2',
          title: 'Interactive Systems Now Available',
          summary: 'Biology, Environmental Sensing, Medical Diagnostics, Robotic Integration, Teaching, and Security modules are ready for use.',
          source: 'CYRUS System',
          url: '/modules',
          category: 'updates',
          publishedAt: new Date(Date.now() - 3600000),
          createdAt: new Date(Date.now() - 3600000)
        },
        {
          id: 'news_3',
          title: 'Quantum Neural Networks Active',
          summary: 'The quantum circuit simulator is now processing with 99.9% accuracy across 3 active circuits.',
          source: 'CYRUS System',
          url: '/modules',
          category: 'science',
          publishedAt: new Date(Date.now() - 7200000),
          createdAt: new Date(Date.now() - 7200000)
        }
      ];
    }

    const formattedNews = newsList.map(n => ({
      id: n.id,
      title: n.title,
      summary: n.summary || '',
      source: n.source || 'Unknown',
      url: n.url || '#',
      category: n.category || 'general',
      publishedAt: (n.publishedAt instanceof Date ? n.publishedAt : new Date()).toISOString()
    }));

    res.json(formattedNews);
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.post("/api/comms/call/start", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
    const { recipientId, callType } = req.body;
    const roomId = `call_${uuid()}`;

    const [call] = await db.insert(callHistory).values({
      callerId: userId,
      recipientId: recipientId || null,
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

router.post("/api/comms/call/:callId/answer", async (req: any, res) => {
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

router.post("/api/comms/call/:callId/end", async (req: any, res) => {
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

router.get("/api/comms/calls/history", async (req: any, res) => {
  try {
    const userId = getUserId(req);
    
    let calls;
    if (userId) {
      calls = await db.select().from(callHistory)
        .where(or(eq(callHistory.callerId, userId), eq(callHistory.recipientId, userId)))
        .orderBy(desc(callHistory.startedAt))
        .limit(50);
    } else {
      calls = await db.select().from(callHistory)
        .orderBy(desc(callHistory.startedAt))
        .limit(50);
    }

    res.json(calls);
  } catch (error) {
    console.error("Error fetching call history:", error);
    res.status(500).json({ error: "Failed to fetch call history" });
  }
});

router.post("/api/comms/meeting/create", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
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

router.post("/api/comms/meeting/join", async (req: any, res) => {
  try {
    const userId = getUserId(req) || `anon_${Date.now()}`;
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

router.get("/api/comms/meetings", async (req: any, res) => {
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

router.get("/api/comms/status", (req, res) => {
  res.json({
    operational: true,
    features: {
      messaging: true,
      reminders: true,
      news: true,
      voiceCalls: true,
      videoCalls: true,
      meetings: true,
      webrtc: true
    },
    websocket: '/ws'
  });
});

export function registerCommsRoutes(app: any) {
  app.use(router);
  console.log("[Comms] Registered communication routes (17 endpoints)");
}
