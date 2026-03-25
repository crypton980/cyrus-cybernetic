/**
 * MY SERVER — Custom personal server module for CYRUS Cybernetic
 *
 * Mounts at: /api/myserver/*
 *
 * Endpoints
 * ---------
 * GET  /api/myserver/status          — health & identity of this custom server
 * POST /api/myserver/ping            — echo test (sends back whatever you POST)
 * POST /api/myserver/chat            — forward a message to CYRUS AI and stream the reply
 * POST /api/myserver/webhook         — external webhook receiver (logs + stores payload)
 * GET  /api/myserver/messages        — list received webhook payloads (in-memory)
 * DELETE /api/myserver/messages      — clear stored messages
 */

import { Router, type Request, type Response } from "express";

const router = Router();

// ─── In-memory webhook inbox ─────────────────────────────────────────────────
interface WebhookEntry {
  id: string;
  receivedAt: string;
  source: string;
  payload: unknown;
}
const inbox: WebhookEntry[] = [];
const MAX_INBOX = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── GET /api/myserver/status ─────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  res.json({
    server: "MY SERVER",
    version: "1.0.0",
    description: "Custom personal server module connected to CYRUS Cybernetic",
    status: "online",
    connectedTo: "CYRUS Cybernetic (main server)",
    endpoints: [
      "GET  /api/myserver/status",
      "POST /api/myserver/ping",
      "POST /api/myserver/chat",
      "POST /api/myserver/webhook",
      "GET  /api/myserver/messages",
      "DELETE /api/myserver/messages",
    ],
    inboxCount: inbox.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/myserver/ping ──────────────────────────────────────────────────
router.post("/ping", (req: Request, res: Response) => {
  res.json({
    pong: true,
    echo: req.body,
    receivedAt: new Date().toISOString(),
    from: "MY SERVER",
  });
});

// ─── POST /api/myserver/chat ──────────────────────────────────────────────────
// Bridges a message to the CYRUS /api/cyrus/infer endpoint and returns the reply.
router.post("/chat", async (req: Request, res: Response) => {
  const { message, conversationHistory } = req.body as {
    message?: string;
    conversationHistory?: unknown[];
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message (string) is required" });
  }

  try {
    // Forward to the CYRUS inference endpoint on the same process/port.
    const port = process.env.PORT || "3105";
    const cyrusUrl = `http://127.0.0.1:${port}/api/cyrus/infer`;

    const upstream = await fetch(cyrusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), conversationHistory }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(upstream.status).json({ error: "CYRUS upstream error", detail: err });
    }

    const data = await upstream.json() as Record<string, unknown>;

    return res.json({
      from: "MY SERVER → CYRUS",
      query: message,
      response: data.response,
      identity: data.identity,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ error: "Failed to reach CYRUS", detail: message });
  }
});

// ─── POST /api/myserver/webhook ───────────────────────────────────────────────
// Receives payloads from any external service (GitHub, Stripe, etc.)
router.post("/webhook", (req: Request, res: Response) => {
  const entry: WebhookEntry = {
    id: uid(),
    receivedAt: new Date().toISOString(),
    source:
      (req.headers["x-webhook-source"] as string) ||
      (req.headers["user-agent"] as string) ||
      "unknown",
    payload: req.body,
  };

  inbox.unshift(entry);
  if (inbox.length > MAX_INBOX) inbox.length = MAX_INBOX;

  console.log(`[MY SERVER] Webhook received from "${entry.source}" — id: ${entry.id}`);

  return res.status(200).json({ received: true, id: entry.id });
});

// ─── GET /api/myserver/messages ───────────────────────────────────────────────
router.get("/messages", (_req: Request, res: Response) => {
  res.json({
    count: inbox.length,
    messages: inbox,
  });
});

// ─── DELETE /api/myserver/messages ────────────────────────────────────────────
router.delete("/messages", (_req: Request, res: Response) => {
  const count = inbox.length;
  inbox.length = 0;
  res.json({ cleared: count });
});

export default router;
