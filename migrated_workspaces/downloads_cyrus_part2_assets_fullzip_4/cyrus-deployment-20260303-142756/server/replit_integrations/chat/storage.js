class MemoryChatStorage {
    conversations = new Map();
    messages = new Map();
    conversationIdCounter = 1;
    messageIdCounter = 1;
    async getConversation(id) {
        return this.conversations.get(id);
    }
    async getAllConversations() {
        return Array.from(this.conversations.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async createConversation(title) {
        const conversation = {
            id: this.conversationIdCounter++,
            title,
            createdAt: new Date(),
        };
        this.conversations.set(conversation.id, conversation);
        this.messages.set(conversation.id, []);
        return conversation;
    }
    async deleteConversation(id) {
        this.conversations.delete(id);
        this.messages.delete(id);
    }
    async getMessagesByConversation(conversationId) {
        return this.messages.get(conversationId) || [];
    }
    async createMessage(conversationId, role, content) {
        const message = {
            id: this.messageIdCounter++,
            conversationId,
            role,
            content,
            createdAt: new Date(),
        };
        const msgs = this.messages.get(conversationId) || [];
        msgs.push(message);
        this.messages.set(conversationId, msgs);
        return message;
    }
}
export const chatStorage = new MemoryChatStorage();
