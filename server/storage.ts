import { 
  conversations, 
  memories, 
  uploadedFiles,
  type Conversation,
  type InsertConversation,
  type Memory,
  type InsertMemory,
  type UploadedFile,
  type InsertUploadedFile 
} from "../shared/schema";
import { hasDatabase, db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Conversations
  getConversations(userId?: string, limit?: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  clearConversations(userId?: string): Promise<void>;
  
  // Memories
  getMemories(userId?: string): Promise<Memory[]>;
  createMemory(memory: InsertMemory): Promise<Memory>;
  
  // Files
  getUploadedFiles(userId?: string): Promise<UploadedFile[]>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
}

export class DatabaseStorage implements IStorage {
  async getConversations(userId?: string, limit: number = 50): Promise<Conversation[]> {
    const query = db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
    
    if (userId) {
      return await query.where(eq(conversations.userId, userId));
    }

    return await query;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async clearConversations(userId?: string): Promise<void> {
    if (userId) {
      await db.delete(conversations).where(eq(conversations.userId, userId));
    } else {
      await db.delete(conversations);
    }
  }

  async getMemories(userId?: string): Promise<Memory[]> {
    const query = db
      .select()
      .from(memories)
      .orderBy(desc(memories.createdAt));
    
    if (userId) {
      return await query.where(eq(memories.userId, userId));
    }
    
    return await query;
  }

  async createMemory(insertMemory: InsertMemory): Promise<Memory> {
    const [memory] = await db
      .insert(memories)
      .values(insertMemory)
      .returning();
    return memory;
  }

  async getUploadedFiles(userId?: string): Promise<UploadedFile[]> {
    const query = db
      .select()
      .from(uploadedFiles)
      .orderBy(desc(uploadedFiles.uploadedAt));
    
    if (userId) {
      return await query.where(eq(uploadedFiles.userId, userId));
    }
    
    return await query;
  }

  async createUploadedFile(insertFile: InsertUploadedFile): Promise<UploadedFile> {
    const [file] = await db
      .insert(uploadedFiles)
      .values(insertFile)
      .returning();
    return file;
  }
}

// In-memory fallback used when DATABASE_URL is not configured.
export class MemoryStorage implements IStorage {
  private conversations: Conversation[] = [];
  private memories: Memory[] = [];
  private files: UploadedFile[] = [];

  async getConversations(userId?: string, limit: number = 50): Promise<Conversation[]> {
    const result = userId
      ? this.conversations.filter(c => c.userId === userId)
      : [...this.conversations];
    return result.slice(-limit).reverse();
  }

  async createConversation(conv: InsertConversation): Promise<Conversation> {
    const record: Conversation = {
      id: randomUUID(),
      userId: conv.userId ?? null,
      role: conv.role,
      content: conv.content,
      hasImage: conv.hasImage ?? 0,
      imageData: conv.imageData ?? null,
      detectedObjects: conv.detectedObjects ?? null,
      createdAt: new Date(),
    };
    this.conversations.push(record);
    return record;
  }

  async clearConversations(userId?: string): Promise<void> {
    this.conversations = userId
      ? this.conversations.filter(c => c.userId !== userId)
      : [];
  }

  async getMemories(userId?: string): Promise<Memory[]> {
    return userId
      ? this.memories.filter(m => m.userId === userId)
      : [...this.memories];
  }

  async createMemory(mem: InsertMemory): Promise<Memory> {
    const record: Memory = {
      id: randomUUID(),
      userId: mem.userId ?? null,
      type: mem.type,
      description: mem.description,
      createdAt: new Date(),
    };
    this.memories.push(record);
    return record;
  }

  async getUploadedFiles(userId?: string): Promise<UploadedFile[]> {
    return userId
      ? this.files.filter(f => f.userId === userId)
      : [...this.files];
  }

  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const record: UploadedFile = {
      id: randomUUID(),
      userId: file.userId ?? null,
      filename: file.filename,
      originalName: file.originalName,
      mimetype: file.mimetype,
      size: file.size,
      url: file.url,
      uploadedAt: new Date(),
    };
    this.files.push(record);
    return record;
  }
}

export const storage: IStorage = hasDatabase
  ? new DatabaseStorage()
  : new MemoryStorage();
