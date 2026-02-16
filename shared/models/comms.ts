import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";

export const onlineUsers = pgTable("online_users", {
  id: varchar("id").primaryKey(),
  displayName: varchar("display_name"),
  email: varchar("email"),
  profileImageUrl: varchar("profile_image_url"),
  lastSeen: timestamp("last_seen").defaultNow(),
  isOnline: boolean("is_online").default(true),
  socketId: varchar("socket_id"),
  status: varchar("status").default("online"),
  currentCallId: varchar("current_call_id"),
  currentConferenceId: varchar("current_conference_id"),
  deviceInfo: jsonb("device_info"),
  networkLatencyMs: varchar("network_latency_ms").default("0"),
  connectionQuality: varchar("connection_quality").default("1.0"),
});

export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  messageType: varchar("message_type").default("text"),
  isEncrypted: boolean("is_encrypted").default(false),
  encryptionLevel: varchar("encryption_level").default("none"),
  fileUrl: varchar("file_url"),
  fileName: varchar("file_name"),
  fileSizeBytes: integer("file_size_bytes"),
  readAt: timestamp("read_at"),
  replyToId: varchar("reply_to_id"),
  groupId: varchar("group_id"),
  reactions: jsonb("reactions"),
});

export const callHistory = pgTable("call_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callerId: varchar("caller_id").notNull(),
  recipientId: varchar("recipient_id"),
  roomId: varchar("room_id").notNull(),
  callType: varchar("call_type").notNull(),
  status: varchar("status").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  duration: varchar("duration"),
  isRecording: boolean("is_recording").default(false),
  recordingUrl: varchar("recording_url"),
  callQuality: varchar("call_quality").default("1.0"),
  bandwidthKbps: varchar("bandwidth_kbps").default("0"),
  missedBy: jsonb("missed_by"),
  declinedBy: jsonb("declined_by"),
});

export const meetingRooms = pgTable("meeting_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  hostId: varchar("host_id").notNull(),
  roomCode: varchar("room_code").unique().notNull(),
  isActive: boolean("is_active").default(true),
  maxParticipants: varchar("max_participants").default("10"),
  createdAt: timestamp("created_at").defaultNow(),
  participants: jsonb("participants").default([]),
  description: text("description"),
  isRecording: boolean("is_recording").default(false),
  recordingUrl: varchar("recording_url"),
  screenSharingBy: varchar("screen_sharing_by"),
  password: varchar("password"),
  meetingLink: varchar("meeting_link"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"),
});

export const reminders = pgTable("reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at").notNull(),
  completed: boolean("completed").default(false),
  priority: varchar("priority").default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const newsItems = pgTable("news_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  summary: text("summary"),
  source: varchar("source"),
  url: varchar("url"),
  category: varchar("category").default("general"),
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  contactId: varchar("contact_id").notNull(),
  contactName: varchar("contact_name").notNull(),
  contactEmail: varchar("contact_email"),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const incomingCalls = pgTable("incoming_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callerId: varchar("caller_id").notNull(),
  callerName: varchar("caller_name"),
  recipientId: varchar("recipient_id").notNull(),
  roomId: varchar("room_id").notNull(),
  callType: varchar("call_type").notNull(),
  status: varchar("status").default("ringing"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  answeredAt: timestamp("answered_at"),
  declinedAt: timestamp("declined_at"),
});

export const groupChats = pgTable("group_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  createdBy: varchar("created_by").notNull(),
  members: jsonb("members").default([]),
  isEncrypted: boolean("is_encrypted").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OnlineUser = typeof onlineUsers.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type CallHistory = typeof callHistory.$inferSelect;
export type MeetingRoom = typeof meetingRooms.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type IncomingCall = typeof incomingCalls.$inferSelect;
export type GroupChat = typeof groupChats.$inferSelect;
