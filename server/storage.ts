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
import { db, hasDatabase } from "./db";
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

// ---------------------------------------------------------------------------
// In-memory fallback — used when DATABASE_URL is not configured.
// Data is kept for the lifetime of the process only.
// ---------------------------------------------------------------------------
export class MemoryStorage implements IStorage {
  private _conversations: Conversation[] = [];
  private _memories: Memory[] = [];
  private _uploadedFiles: UploadedFile[] = [];

  async getConversations(userId?: string, limit = 50): Promise<Conversation[]> {
    let results = userId
      ? this._conversations.filter((c) => c.userId === userId)
      : [...this._conversations];
    return results.reverse().slice(0, limit);
  }

  async createConversation(insert: InsertConversation): Promise<Conversation> {
    const conversation: Conversation = {
      id: randomUUID(),
      userId: insert.userId ?? null,
      role: insert.role,
      content: insert.content,
      hasImage: insert.hasImage ?? 0,
      imageData: insert.imageData ?? null,
      detectedObjects: insert.detectedObjects ?? null,
      createdAt: new Date(),
    };
    this._conversations.push(conversation);
    return conversation;
  }

  async clearConversations(userId?: string): Promise<void> {
    if (userId) {
      this._conversations = this._conversations.filter((c) => c.userId !== userId);
    } else {
      this._conversations = [];
    }
  }

  async getMemories(userId?: string): Promise<Memory[]> {
    const results = userId
      ? this._memories.filter((m) => m.userId === userId)
      : [...this._memories];
    return results.reverse();
  }

  async createMemory(insert: InsertMemory): Promise<Memory> {
    const memory: Memory = {
      id: randomUUID(),
      userId: insert.userId ?? null,
      type: insert.type,
      description: insert.description,
      createdAt: new Date(),
    };
    this._memories.push(memory);
    return memory;
  }

  async getUploadedFiles(userId?: string): Promise<UploadedFile[]> {
    const results = userId
      ? this._uploadedFiles.filter((f) => f.userId === userId)
      : [...this._uploadedFiles];
    return results.reverse();
  }

  async createUploadedFile(insert: InsertUploadedFile): Promise<UploadedFile> {
    const file: UploadedFile = {
      id: randomUUID(),
      userId: insert.userId ?? null,
      originalName: insert.originalName,
      filename: insert.filename,
      mimetype: insert.mimetype,
      size: insert.size,
      url: insert.url,
      uploadedAt: new Date(),
    };
    this._uploadedFiles.push(file);
    return file;
  }
}

export const storage: IStorage = hasDatabase
  ? new DatabaseStorage()
  : new MemoryStorage();
