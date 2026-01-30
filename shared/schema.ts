import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  role: text("role").notNull(), // "user" | "cyrus"
  content: text("content").notNull(),
  hasImage: integer("has_image").default(0), // 0 or 1 as boolean
  imageData: text("image_data"),
  detectedObjects: jsonb("detected_objects"), // Array of detected objects
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memories = pgTable("memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  type: text("type").notNull(), // "person" | "place" | "thing" | "conversation"
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  originalName: text("original_name").notNull(),
  filename: text("filename").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const experienceLearning = pgTable("experience_learning", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: text("task_type").notNull(),
  taskDescription: text("task_description").notNull(),
  inputSignature: text("input_signature").notNull(),
  executionTimeMs: integer("execution_time_ms").notNull(),
  successScore: integer("success_score").notNull(),
  strategyUsed: text("strategy_used"),
  branchesActivated: jsonb("branches_activated"),
  optimizationsApplied: jsonb("optimizations_applied"),
  learnedPatterns: jsonb("learned_patterns"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeGraph = pgTable("knowledge_graph", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  concept: text("concept").notNull(),
  domain: text("domain").notNull(),
  relationships: jsonb("relationships"),
  properties: jsonb("properties"),
  confidence: integer("confidence").default(100),
  source: text("source"),
  learnedAt: timestamp("learned_at").defaultNow().notNull(),
  lastAccessed: timestamp("last_accessed").defaultNow().notNull(),
  accessCount: integer("access_count").default(1),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: text("metric_type").notNull(),
  taskCategory: text("task_category").notNull(),
  averageTimeMs: integer("average_time_ms").notNull(),
  bestTimeMs: integer("best_time_ms"),
  improvementRate: integer("improvement_rate").default(0),
  totalExecutions: integer("total_executions").default(1),
  successRate: integer("success_rate").default(100),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const evolutionLog = pgTable("evolution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evolutionType: text("evolution_type").notNull(),
  description: text("description").notNull(),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  improvementMetrics: jsonb("improvement_metrics"),
  triggeredBy: text("triggered_by"),
  evolvedAt: timestamp("evolved_at").defaultNow().notNull(),
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

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memories.$inferSelect;

export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;

export const insertExperienceLearningSchema = createInsertSchema(experienceLearning).omit({
  id: true,
  createdAt: true,
});

export const insertKnowledgeGraphSchema = createInsertSchema(knowledgeGraph).omit({
  id: true,
  learnedAt: true,
  lastAccessed: true,
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  lastUpdated: true,
});

export const insertEvolutionLogSchema = createInsertSchema(evolutionLog).omit({
  id: true,
  evolvedAt: true,
});

export type InsertExperienceLearning = z.infer<typeof insertExperienceLearningSchema>;
export type ExperienceLearning = typeof experienceLearning.$inferSelect;

export type InsertKnowledgeGraph = z.infer<typeof insertKnowledgeGraphSchema>;
export type KnowledgeGraph = typeof knowledgeGraph.$inferSelect;

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

export type InsertEvolutionLog = z.infer<typeof insertEvolutionLogSchema>;
export type EvolutionLog = typeof evolutionLog.$inferSelect;

export * from "./models/auth";
export * from "./models/comms";
