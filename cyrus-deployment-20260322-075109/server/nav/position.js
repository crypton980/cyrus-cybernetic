let currentFix = null;
function confidenceFromAccuracy(acc) {
    // Simple mapping: 0-5m -> 0.95+, 50m -> ~0.5, 200m -> ~0.2
    if (acc <= 5)
        return 0.98;
    if (acc <= 20)
        return 0.9;
    if (acc <= 50)
        return 0.65;
    if (acc <= 100)
        return 0.45;
    if (acc <= 200)
        return 0.25;
    return 0.1;
}
export function updateFix(fix) {
    // Reject stale timestamps > 5 minutes in the past
    const now = Date.now();
    if (now - fix.timestamp > 5 * 60 * 1000) {
        throw new Error("Fix is too old");
    }
    currentFix = fix;
}
export function getBestFix() {
    if (!currentFix)
        return null;
    const ageMs = Date.now() - currentFix.timestamp;
    const agePenalty = Math.min(ageMs / (5 * 60 * 1000), 1); // after 5m, heavy penalty
    const confidence = Math.max(0, confidenceFromAccuracy(currentFix.accuracy) * (1 - 0.7 * agePenalty));
    return { ...currentFix, ageMs, confidence };
}
