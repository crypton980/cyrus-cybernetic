import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
export const onlineUsers = pgTable("online_users", {
    id: varchar("id").primaryKey(),
    displayName: varchar("display_name"),
    email: varchar("email"),
    profileImageUrl: varchar("profile_image_url"),
    lastSeen: timestamp("last_seen").defaultNow(),
    isOnline: boolean("is_online").default(true),
    socketId: varchar("socket_id"),
});
export const directMessages = pgTable("direct_messages", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    senderId: varchar("sender_id").notNull(),
    recipientId: varchar("recipient_id").notNull(),
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const callHistory = pgTable("call_history", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    callerId: varchar("caller_id").notNull(),
    recipientId: varchar("recipient_id"),
    roomId: varchar("room_id").notNull(),
    callType: varchar("call_type").notNull(),
    status: varchar("status").notNull(),
    startedAt: timestamp("started_at").defaultNow(),
    endedAt: timestamp("ended_at"),
    duration: varchar("duration"),
});
export const meetingRooms = pgTable("meeting_rooms", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    name: varchar("name").notNull(),
    hostId: varchar("host_id").notNull(),
    roomCode: varchar("room_code").unique().notNull(),
    isActive: boolean("is_active").default(true),
    maxParticipants: varchar("max_participants").default("10"),
    createdAt: timestamp("created_at").defaultNow(),
    participants: jsonb("participants").default([]),
});
