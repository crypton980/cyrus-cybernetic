import { users } from "../../../shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";
class AuthStorage {
    async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }
    async upsertUser(userData) {
        const [user] = await db
            .insert(users)
            .values(userData)
            .onConflictDoUpdate({
            target: users.id,
            set: {
                ...userData,
                updatedAt: new Date(),
            },
        })
            .returning();
        return user;
    }
}
export const authStorage = new AuthStorage();
