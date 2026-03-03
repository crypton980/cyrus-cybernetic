import { conversations, memories, uploadedFiles } from "../shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
export class DatabaseStorage {
    async getConversations(userId, limit = 50) {
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
    async createConversation(insertConversation) {
        const [conversation] = await db
            .insert(conversations)
            .values(insertConversation)
            .returning();
        return conversation;
    }
    async clearConversations() {
        await db.delete(conversations);
    }
    async getMemories(userId) {
        const query = db
            .select()
            .from(memories)
            .orderBy(desc(memories.createdAt));
        if (userId) {
            return await query.where(eq(memories.userId, userId));
        }
        return await query;
    }
    async createMemory(insertMemory) {
        const [memory] = await db
            .insert(memories)
            .values(insertMemory)
            .returning();
        return memory;
    }
    async getUploadedFiles(userId) {
        const query = db
            .select()
            .from(uploadedFiles)
            .orderBy(desc(uploadedFiles.uploadedAt));
        if (userId) {
            return await query.where(eq(uploadedFiles.userId, userId));
        }
        return await query;
    }
    async createUploadedFile(insertFile) {
        const [file] = await db
            .insert(uploadedFiles)
            .values(insertFile)
            .returning();
        return file;
    }
}
export const storage = new DatabaseStorage();
