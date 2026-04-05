/**
 * OpenAI Custom GPT / ChatGPT Plugin endpoints
 *
 * Serves:
 *   GET /.well-known/ai-plugin.json   – ChatGPT plugin manifest
 *   GET /openapi.json                 – OpenAPI 3.0 spec for Custom GPT Actions
 *
 * The base URL is derived from the incoming request so the same code works
 * locally (http://localhost:3105) and on any deployed host.
 */

import type { Express, Request, Response } from "express";

function getBaseUrl(req: Request): string {
  // Honour X-Forwarded-Proto/Host set by proxies (Railway, Vercel, Cloudflare…)
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ||
    req.protocol ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ||
    req.headers.host ||
    `localhost:${process.env.PORT || 3105}`;
  return `${proto}://${host}`;
}

export function registerOpenAIPluginRoutes(app: Express): void {
  // ── Plugin Manifest ──────────────────────────────────────────────────────────
  app.get("/.well-known/ai-plugin.json", (req: Request, res: Response) => {
    const base = getBaseUrl(req);
    res.setHeader("Content-Type", "application/json");
    res.json({
      schema_version: "v1",
      name_for_model: "cyrus_ai",
      name_for_human: "CYRUS AI",
      description_for_model:
        "CYRUS is an advanced cybernetic AI system. Use this plugin to chat with CYRUS, " +
        "query its knowledge graph, inspect system status, and store/retrieve memories.",
      description_for_human:
        "Interact with the CYRUS AI system: ask questions, explore its knowledge base, " +
        "and manage AI memories.",
      auth: { type: "none" },
      api: {
        type: "openapi",
        url: `${base}/openapi.json`,
      },
      logo_url: `${base}/images/cyrus-logo.png`,
      contact_email: "support@cyrus.ai",
      legal_info_url: `${base}/`,
    });
  });

  // ── OpenAPI Specification ────────────────────────────────────────────────────
  app.get("/openapi.json", (req: Request, res: Response) => {
    const base = getBaseUrl(req);
    res.setHeader("Content-Type", "application/json");
    res.json({
      openapi: "3.0.0",
      info: {
        title: "CYRUS AI API",
        description:
          "API for the CYRUS cybernetic AI system. Provides chat inference, " +
          "knowledge queries, memory management, and system status.",
        version: "3.0.0",
      },
      servers: [{ url: base, description: "CYRUS AI Server" }],
      paths: {
        "/api/inference": {
          post: {
            operationId: "chat",
            summary: "Send a message to CYRUS",
            description:
              "Send a text message to CYRUS and receive a response. CYRUS may also " +
              "generate images when the message requests one.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["message"],
                    properties: {
                      message: {
                        type: "string",
                        description: "The message or question to send to CYRUS.",
                      },
                      userId: {
                        type: "string",
                        description: "Optional user identifier for session context.",
                      },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "CYRUS response",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        imageGenerated: { type: "boolean" },
                        imageUrl: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        "/api/cyrus/status": {
          get: {
            operationId: "getStatus",
            summary: "Get CYRUS system status",
            description:
              "Returns the current status of the CYRUS soul, neural network, AGI state, " +
              "and quantum core.",
            responses: {
              "200": {
                description: "System status",
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
            },
          },
        },

        "/api/cyrus/identity": {
          get: {
            operationId: "getIdentity",
            summary: "Get CYRUS identity and system prompt",
            description: "Returns the full identity, personality, and operational context of CYRUS.",
            responses: {
              "200": {
                description: "CYRUS identity",
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
            },
          },
        },

        "/api/cyrus/knowledge": {
          get: {
            operationId: "queryKnowledge",
            summary: "Query the CYRUS knowledge graph",
            description: "Search the CYRUS knowledge base for a specific concept, optionally scoped to a domain.",
            parameters: [
              {
                name: "concept",
                in: "query",
                required: true,
                schema: { type: "string" },
                description: "The concept or topic to search for.",
              },
              {
                name: "domain",
                in: "query",
                required: false,
                schema: { type: "string" },
                description: "Optional domain to narrow the search (e.g. science, engineering).",
              },
            ],
            responses: {
              "200": {
                description: "Knowledge graph results",
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
            },
          },
        },

        "/api/memories": {
          get: {
            operationId: "listMemories",
            summary: "List stored memories",
            description: "Retrieve the list of memories stored in the CYRUS memory system.",
            responses: {
              "200": {
                description: "Array of memory objects",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: { type: "object" },
                    },
                  },
                },
              },
            },
          },
          post: {
            operationId: "storeMemory",
            summary: "Store a new memory",
            description: "Save a piece of information to the CYRUS memory system.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["content"],
                    properties: {
                      content: {
                        type: "string",
                        description: "The information to remember.",
                      },
                      category: {
                        type: "string",
                        description: "Optional category tag for the memory.",
                      },
                    },
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Stored memory object",
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
            },
          },
        },

        "/api/cyrus/domains": {
          get: {
            operationId: "getDomains",
            summary: "Get CYRUS cognitive domains",
            description:
              "Returns the list of knowledge domains and cognitive branches active in CYRUS.",
            responses: {
              "200": {
                description: "Domain and branch overview",
                content: {
                  "application/json": {
                    schema: { type: "object" },
                  },
                },
              },
            },
          },
        },

        "/health/ready": {
          get: {
            operationId: "healthCheck",
            summary: "Server health check",
            description: "Returns whether the CYRUS server is ready to accept requests.",
            responses: {
              "200": {
                description: "Server is ready",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        status: { type: "string", example: "ready" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
}
