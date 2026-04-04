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

// In-memory fallback used when DATABASE_URL is not configured or DB is unavailable
class MemoryStorage implements IStorage {
  private convs: Conversation[] = [];
  private mems: Memory[] = [];
  private files: UploadedFile[] = [];

  async getConversations(userId?: string, limit = 50): Promise<Conversation[]> {
    const result = userId ? this.convs.filter(c => c.userId === userId) : [...this.convs];
    return result.slice(0, limit);
  }
  async createConversation(data: InsertConversation): Promise<Conversation> {
    const conv: Conversation = { id: randomUUID(), createdAt: new Date(), ...data } as Conversation;
    this.convs.unshift(conv);
    return conv;
  }
  async clearConversations(userId?: string): Promise<void> {
    this.convs = userId ? this.convs.filter(c => c.userId !== userId) : [];
  }
  async getMemories(userId?: string): Promise<Memory[]> {
    return userId ? this.mems.filter(m => m.userId === userId) : [...this.mems];
  }
  async createMemory(data: InsertMemory): Promise<Memory> {
    const mem: Memory = { id: randomUUID(), createdAt: new Date(), ...data } as Memory;
    this.mems.unshift(mem);
    return mem;
  }
  async getUploadedFiles(userId?: string): Promise<UploadedFile[]> {
    return userId ? this.files.filter(f => f.userId === userId) : [...this.files];
  }
  async createUploadedFile(data: InsertUploadedFile): Promise<UploadedFile> {
    const file: UploadedFile = { id: randomUUID(), uploadedAt: new Date(), ...data } as UploadedFile;
    this.files.unshift(file);
    return file;
  }
}

class DatabaseStorage implements IStorage {
  private db: any = null;
  private drizzle: any = null;
  private dbAvailable: boolean | null = null;

  private async getDb(): Promise<{ db: any; eq: any; desc: any } | null> {
    if (this.dbAvailable === false) return null;
    if (this.db) return { db: this.db, eq: this.drizzle.eq, desc: this.drizzle.desc };
    try {
      const drizzleModule = await import("drizzle-orm");
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const pg = await import("pg");
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
      // Test connection
      const client = await pool.connect();
      client.release();
      this.db = drizzle(pool, { schema: { conversations, memories, uploadedFiles } });
      this.drizzle = drizzleModule;
      this.dbAvailable = true;
      return { db: this.db, eq: drizzleModule.eq, desc: drizzleModule.desc };
    } catch {
      this.dbAvailable = false;
      console.warn("[Storage] Database unavailable, falling back to in-memory storage for this request.");
      return null;
    }
  }

  async getConversations(userId?: string, limit = 50): Promise<Conversation[]> {
    const conn = await this.getDb();
    if (!conn) return memFallback.getConversations(userId, limit);
    const { db, eq, desc } = conn;
    try {
      const query = db.select().from(conversations).orderBy(desc(conversations.createdAt)).limit(limit);
      return userId ? await query.where(eq(conversations.userId, userId)) : await query;
    } catch { return memFallback.getConversations(userId, limit); }
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const conn = await this.getDb();
    if (!conn) return memFallback.createConversation(data);
    try {
      const [conv] = await conn.db.insert(conversations).values(data).returning();
      return conv;
    } catch { return memFallback.createConversation(data); }
  }

  async clearConversations(userId?: string): Promise<void> {
    const conn = await this.getDb();
    if (!conn) return memFallback.clearConversations(userId);
    try {
      const { db, eq } = conn;
      userId ? await db.delete(conversations).where(eq(conversations.userId, userId)) : await db.delete(conversations);
    } catch { return memFallback.clearConversations(userId); }
  }

  async getMemories(userId?: string): Promise<Memory[]> {
    const conn = await this.getDb();
    if (!conn) return memFallback.getMemories(userId);
    try {
      const { db, eq, desc } = conn;
      const query = db.select().from(memories).orderBy(desc(memories.createdAt));
      return userId ? await query.where(eq(memories.userId, userId)) : await query;
    } catch { return memFallback.getMemories(userId); }
  }

  async createMemory(data: InsertMemory): Promise<Memory> {
    const conn = await this.getDb();
    if (!conn) return memFallback.createMemory(data);
    try {
      const [mem] = await conn.db.insert(memories).values(data).returning();
      return mem;
    } catch { return memFallback.createMemory(data); }
  }

  async getUploadedFiles(userId?: string): Promise<UploadedFile[]> {
    const conn = await this.getDb();
    if (!conn) return memFallback.getUploadedFiles(userId);
    try {
      const { db, eq, desc } = conn;
      const query = db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.uploadedAt));
      return userId ? await query.where(eq(uploadedFiles.userId, userId)) : await query;
    } catch { return memFallback.getUploadedFiles(userId); }
  }

  async createUploadedFile(data: InsertUploadedFile): Promise<UploadedFile> {
    const conn = await this.getDb();
    if (!conn) return memFallback.createUploadedFile(data);
    try {
      const [file] = await conn.db.insert(uploadedFiles).values(data).returning();
      return file;
    } catch { return memFallback.createUploadedFile(data); }
  }
}

const memFallback = new MemoryStorage();
export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : (() => { console.warn("[Storage] DATABASE_URL not set — using in-memory storage (data lost on restart)."); return memFallback; })();

