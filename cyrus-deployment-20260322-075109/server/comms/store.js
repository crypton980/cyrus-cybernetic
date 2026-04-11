import { v4 as uuid } from "uuid";
const offlineMessages = new Map();
const reminders = new Map();
export function enqueueMessage(to, from, text) {
    const msg = { id: uuid(), to, from, text, timestamp: Date.now(), delivered: false };
    if (!offlineMessages.has(to))
        offlineMessages.set(to, []);
    offlineMessages.get(to).push(msg);
    return msg;
}
export function dequeueMessages(user) {
    const msgs = offlineMessages.get(user) || [];
    offlineMessages.set(user, []);
    return msgs;
}
export function addReminder(text, time, type) {
    const r = { id: uuid(), text, time, type, createdAt: Date.now() };
    reminders.set(r.id, r);
    return r;
}
export function listReminders() {
    return Array.from(reminders.values()).sort((a, b) => a.time - b.time);
}
