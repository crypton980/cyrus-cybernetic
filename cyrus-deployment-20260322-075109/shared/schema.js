import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const conversations = pgTable("conversations", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    userId: varchar("user_id"),
    role: text("role").notNull(), // "user" | "cyrus"
    content: text("content").notNull(),
    hasImage: integer("has_image").default(0), // 0 or 1 as boolean
    imageData: text("image_data"),
    detectedObjects: jsonb("detected_objects"), // Array of detected objects
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const memories = pgTable("memories", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    userId: varchar("user_id"),
    type: text("type").notNull(), // "person" | "place" | "thing" | "conversation"
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const uploadedFiles = pgTable("uploaded_files", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    userId: varchar("user_id"),
    originalName: text("original_name").notNull(),
    filename: text("filename").notNull(),
    mimetype: text("mimetype").notNull(),
    size: integer("size").notNull(),
    url: text("url").notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
export const insertConversationSchema = createInsertSchema(conversations).omit({
    id: true,
    createdAt: true,
});
export const insertMemorySchema = createInsertSchema(memories).omit({
    id: true,
    createdAt: true,
});
export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
    id: true,
    uploadedAt: true,
});
export * from "./models/auth";
export * from "./models/comms";
