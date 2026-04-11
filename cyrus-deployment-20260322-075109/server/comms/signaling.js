import WebSocket, { WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";
export function initSignalingServer(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
    const roomMap = new Map();
    function joinRoom(roomId, ws) {
        if (!roomMap.has(roomId))
            roomMap.set(roomId, new Set());
        roomMap.get(roomId).add(ws);
    }
    wss.on("connection", (ws, req) => {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const roomId = url.searchParams.get("room") || "default";
        const clientId = uuid();
        ws.clientId = clientId;
        joinRoom(roomId, ws);
        ws.on("message", (data) => {
            try {
                const msg = JSON.parse(data.toString());
                const peers = roomMap.get(msg.roomId) || new Set();
                peers.forEach((peer) => {
                    if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                        peer.send(JSON.stringify({ ...msg, sender: clientId }));
                    }
                });
            }
            catch (err) {
                console.error("Invalid signaling message", err);
            }
        });
        ws.on("close", () => {
            for (const set of roomMap.values()) {
                set.delete(ws);
            }
        });
    });
    console.log("[signaling] WebSocket signaling active at /ws");
}
