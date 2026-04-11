import { getBestFix } from "./position";
const sessions = new Map();
function randomToken() {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
export function startShare(recipientId, durationSeconds, mode) {
    const token = randomToken();
    const expiresAt = Date.now() + durationSeconds * 1000;
    const snapshotFix = mode === "snapshot" ? getBestFix() : undefined;
    sessions.set(token, { token, recipientId, expiresAt, mode, snapshotFix });
    return token;
}
export function stopShare(token) {
    sessions.delete(token);
}
export function getSharedFix(token) {
    const session = sessions.get(token);
    if (!session)
        return null;
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return null;
    }
    if (session.mode === "snapshot")
        return session.snapshotFix;
    return getBestFix();
}
