import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import { storage } from "./storage";

// ============================================================================
// REAL-TIME COMMUNICATION SYSTEM
// WebSocket + WebRTC signaling for voice/video calls and text messaging
// ============================================================================

interface ConnectedUser {
  id: string;
  name: string;
  socket: WebSocket;
  deviceId: string;
  status: "online" | "busy" | "in_call";
  lastSeen: number;
}

interface SignalingMessage {
  type: "register" | "offer" | "answer" | "ice-candidate" | "call-request" | "call-response" | "call-end" | "text-message" | "user-list" | "presence" | "ping" | "pong" | "ice-restart";
  from?: string;
  to?: string;
  data?: any;
}

// Connected users for real-time communication
const connectedUsers: Map<string, ConnectedUser> = new Map();

// Message history for text chat (in-memory, per conversation)
const messageHistory: Map<string, Array<{from: string; to: string; message: string; timestamp: number}>> = new Map();

function getConversationKey(user1: string, user2: string): string {
  return [user1, user2].sort().join(":");
}

function broadcastUserList() {
  const userList = Array.from(connectedUsers.values()).map(u => ({
    id: u.id,
    name: u.name,
    deviceId: u.deviceId,
    status: u.status,
    lastSeen: u.lastSeen
  }));
  
  const message = JSON.stringify({
    type: "user-list",
    data: userList
  });
  
  connectedUsers.forEach(user => {
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(message);
    }
  });
}

function sendToUser(userId: string, message: SignalingMessage) {
  const user = connectedUsers.get(userId);
  if (user && user.socket.readyState === WebSocket.OPEN) {
    user.socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, videos, documents, and common file types
    const allowedMimes = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
      "application/pdf", "application/json", "application/xml",
      "text/plain", "text/csv", "text/html",
      "application/zip", "application/x-tar", "application/gzip"
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// In-memory storage for uploaded files metadata
interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedAt: Date;
  description?: string;
}
const uploadedFiles: Map<string, UploadedFile> = new Map();

// Biometric operator registration storage
interface RegisteredOperator {
  id: string;
  name: string;
  role: string;
  clearanceLevel: string;
  faceImageBase64: string;
  registeredAt: Date;
  lastVerifiedAt?: Date;
  verificationCount: number;
}
const registeredOperators: Map<string, RegisteredOperator> = new Map();

import { insertDroneSchema, insertMissionSchema, insertAlertSchema } from "@shared/schema";
import { z } from "zod";
import { cyrusHealth, cyrusModels, cyrusInfer, cyrusInferAsync, cyrusAnalyzeCommand, cyrusListCommands, cyrusListModes, isDroneCommand, executeDroneVoiceCommand, isScanCommand, isConnectCommand, isConnectAllCommand, isDisconnectCommand, isListDronesCommand } from "./cyrus-ai";
import { getMAVLinkController, CyrusMAVLinkController, ConnectionConfig, MAV_CMD, COPTER_MODES } from "./cyrus-mavlink-controller";
import { runAnalyticMode, shouldEnterAnalyticMode, formatAnalyticReport } from "./cyrus-analytic-mode";
import { autonomousEngine, FlightState } from "./autonomous-engine";
import { predictiveAnalytics } from "./predictive-analytics";
import { emergencyEngine } from "./emergency-protocols";
import { cyrusCognitiveCore } from "./cyrus-cognitive-core";
import { roeEngine } from "./cyrus-roe-engine";
import { sensorFusionEngine } from "./cyrus-sensor-fusion";
import { flightControlEngine } from "./cyrus-flight-control";
import { missionCommander } from "./cyrus-mission-commander";
import { pathPlanningEngine } from "./cyrus-path-planning";
import { adaptiveLearningEngine } from "./cyrus-adaptive-learning";
import { cyrusKnowledgeEngine } from "./cyrus-knowledge-engine";
import { cyrusMissionModules } from "./cyrus-mission-modules";
import { cyrusSecurityEngine } from "./cyrus-security";
import { cyrusPersonality } from "./cyrus-personality";
import { voiceDroneController } from "./cyrus-voice-drone-controller";
import { obstacleAvoidanceSystem } from "./cyrus-obstacle-avoidance";
import { autonomousFlightEngine } from "./cyrus-autonomous-flight-engine";
import { cognitiveEngine } from "./cyrus-cognitive-engine";
import { deviceController } from "./cyrus-device-controller";
import { autonomousAgent } from "./cyrus-autonomous-agent";

// Server-side session token storage for MAVLink authentication
interface SessionData {
  createdAt: number;
  expiresAt: number;
  biometricVerified: boolean;
  operatorId?: string;
  operatorName?: string;
}
const validSessionTokens: Map<string, SessionData> = new Map();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CORRECT_PASSWORD = process.env.APP_PASSWORD || "71580019";

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isValidSessionToken(token: string): boolean {
  const session = validSessionTokens.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    validSessionTokens.delete(token);
    return false;
  }
  return true;
}

function getSessionData(token: string): SessionData | null {
  const session = validSessionTokens.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    validSessionTokens.delete(token);
    return null;
  }
  return session;
}

function markSessionBiometricVerified(token: string, operatorId: string, operatorName: string): boolean {
  const session = validSessionTokens.get(token);
  if (!session) return false;
  session.biometricVerified = true;
  session.operatorId = operatorId;
  session.operatorName = operatorName;
  return true;
}

function createSession(): string {
  const token = generateSessionToken();
  validSessionTokens.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
    biometricVerified: false,
  });
  return token;
}

// Authentication middleware for file upload endpoints - checks session token or allows development access
const fileAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check for valid session token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (isValidSessionToken(token)) {
      return next();
    }
  }
  
  // Check for session token in custom header
  const sessionToken = req.headers["x-cyrus-session-token"];
  if (typeof sessionToken === "string" && isValidSessionToken(sessionToken)) {
    return next();
  }
  
  // Development mode: allow localhost access
  if (process.env.NODE_ENV === "development") {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket.remoteAddress;
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
      return next();
    }
  }
  
  return res.status(401).json({ 
    error: "Unauthorized", 
    message: "File operations require authentication. Please login first." 
  });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================================================
  // WEBSOCKET SERVER FOR REAL-TIME COMMUNICATION
  // Handles signaling for WebRTC calls and text messaging
  // ============================================================================
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  wss.on("connection", (socket) => {
    let currentUserId: string | null = null;
    
    console.log("[WebSocket] New connection established");
    
    socket.on("message", (data) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case "ping":
            // Heartbeat response
            socket.send(JSON.stringify({
              type: "pong",
              data: { timestamp: Date.now() }
            }));
            // Update last seen
            if (currentUserId) {
              const user = connectedUsers.get(currentUserId);
              if (user) {
                user.lastSeen = Date.now();
              }
            }
            break;
            
          case "register":
            // Register user for real-time communication
            const { userId, userName, deviceId } = message.data || {};
            if (userId && userName) {
              currentUserId = userId;
              
              // Remove existing connection if user reconnects
              const existing = connectedUsers.get(userId);
              if (existing && existing.socket !== socket) {
                try {
                  existing.socket.close();
                } catch (e) {
                  // Ignore close errors
                }
              }
              
              connectedUsers.set(userId, {
                id: userId,
                name: userName,
                socket: socket,
                deviceId: deviceId || `device-${Date.now()}`,
                status: "online",
                lastSeen: Date.now()
              });
              
              console.log(`[WebSocket] User registered: ${userName} (${userId})`);
              
              // Send confirmation and user list
              socket.send(JSON.stringify({
                type: "register",
                data: { success: true, userId, deviceId }
              }));
              
              broadcastUserList();
            }
            break;
            
          case "offer":
          case "answer":
          case "ice-candidate":
          case "ice-restart":
            // WebRTC signaling - forward to target user (includes ICE restart)
            if (message.to && message.from) {
              console.log(`[WebSocket] Forwarding ${message.type} from ${message.from} to ${message.to}`);
              const sent = sendToUser(message.to, {
                type: message.type,
                from: message.from,
                to: message.to,
                data: message.data
              });
              if (!sent) {
                socket.send(JSON.stringify({
                  type: "error",
                  data: { message: "Target user not available" }
                }));
              }
            }
            break;
            
          case "call-request":
            // Incoming call request (voice or video)
            if (message.to && message.from) {
              const caller = connectedUsers.get(message.from);
              if (caller) {
                caller.status = "busy";
              }
              
              const sent = sendToUser(message.to, {
                type: "call-request",
                from: message.from,
                to: message.to,
                data: message.data // { callType: "voice" | "video", callerName: string }
              });
              
              if (!sent) {
                socket.send(JSON.stringify({
                  type: "call-response",
                  from: message.to,
                  data: { accepted: false, reason: "User not available" }
                }));
                if (caller) {
                  caller.status = "online";
                }
              }
            }
            break;
            
          case "call-response":
            // Call accepted/rejected
            if (message.to && message.from) {
              const responder = connectedUsers.get(message.from);
              const caller = connectedUsers.get(message.to);
              
              if (message.data?.accepted) {
                if (responder) responder.status = "in_call";
                if (caller) caller.status = "in_call";
              } else {
                if (caller) caller.status = "online";
              }
              
              sendToUser(message.to, {
                type: "call-response",
                from: message.from,
                to: message.to,
                data: message.data
              });
              
              broadcastUserList();
            }
            break;
            
          case "call-end":
            // Call ended
            if (message.to && message.from) {
              const user1 = connectedUsers.get(message.from);
              const user2 = connectedUsers.get(message.to);
              
              if (user1) user1.status = "online";
              if (user2) user2.status = "online";
              
              sendToUser(message.to, {
                type: "call-end",
                from: message.from,
                to: message.to,
                data: message.data
              });
              
              broadcastUserList();
            }
            break;
            
          case "text-message":
            // Text message between users
            if (message.to && message.from && message.data?.text) {
              const convKey = getConversationKey(message.from, message.to);
              
              const msgEntry = {
                from: message.from,
                to: message.to,
                message: message.data.text,
                timestamp: Date.now()
              };
              
              // Store message
              if (!messageHistory.has(convKey)) {
                messageHistory.set(convKey, []);
              }
              messageHistory.get(convKey)!.push(msgEntry);
              
              // Keep only last 100 messages per conversation
              const history = messageHistory.get(convKey)!;
              if (history.length > 100) {
                messageHistory.set(convKey, history.slice(-100));
              }
              
              // Deliver to recipient
              sendToUser(message.to, {
                type: "text-message",
                from: message.from,
                to: message.to,
                data: { text: message.data.text, timestamp: msgEntry.timestamp }
              });
              
              // Confirm to sender
              socket.send(JSON.stringify({
                type: "text-message-sent",
                data: { to: message.to, timestamp: msgEntry.timestamp }
              }));
            }
            break;
            
          case "presence":
            // Update presence status
            if (currentUserId && message.data?.status) {
              const user = connectedUsers.get(currentUserId);
              if (user) {
                user.status = message.data.status;
                user.lastSeen = Date.now();
                broadcastUserList();
              }
            }
            break;
        }
      } catch (error) {
        console.error("[WebSocket] Message parse error:", error);
      }
    });
    
    socket.on("close", () => {
      if (currentUserId) {
        console.log(`[WebSocket] User disconnected: ${currentUserId}`);
        connectedUsers.delete(currentUserId);
        broadcastUserList();
      }
    });
    
    socket.on("error", (error) => {
      console.error("[WebSocket] Socket error:", error);
    });
  });
  
  // API endpoint to get message history
  app.get("/api/communication/history/:userId1/:userId2", (req, res) => {
    const { userId1, userId2 } = req.params;
    const convKey = getConversationKey(userId1, userId2);
    const history = messageHistory.get(convKey) || [];
    res.json({ history });
  });
  
  // API endpoint to get online users
  app.get("/api/communication/users", (_req, res) => {
    const users = Array.from(connectedUsers.values()).map(u => ({
      id: u.id,
      name: u.name,
      deviceId: u.deviceId,
      status: u.status,
      lastSeen: u.lastSeen
    }));
    res.json({ users });
  });

  // Password verification endpoint - returns session token for MAVLink access
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { password } = req.body;
      
      if (password === CORRECT_PASSWORD) {
        const sessionToken = createSession();
        res.json({ success: true, sessionToken });
      } else {
        res.status(401).json({ error: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Check session status (2FA status)
  app.get("/api/auth/session", (req, res) => {
    const sessionToken = req.headers["x-cyrus-session-token"] as string || 
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
    
    if (!sessionToken) {
      return res.json({ authenticated: false, biometricVerified: false });
    }

    const session = getSessionData(sessionToken);
    if (!session) {
      return res.json({ authenticated: false, biometricVerified: false });
    }

    res.json({
      authenticated: true,
      biometricVerified: session.biometricVerified,
      operatorId: session.operatorId,
      operatorName: session.operatorName
    });
  });

  // File Upload Endpoints (authenticated)
  // Upload single file
  app.post("/api/upload", fileAuthMiddleware, upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileId = crypto.randomBytes(16).toString("hex");
      const uploadedFile: UploadedFile = {
        id: fileId,
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedAt: new Date(),
        description: req.body.description || undefined
      };

      uploadedFiles.set(fileId, uploadedFile);

      res.json({
        success: true,
        file: {
          id: fileId,
          originalName: uploadedFile.originalName,
          filename: uploadedFile.filename,
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
          uploadedAt: uploadedFile.uploadedAt,
          url: `/api/files/${fileId}`
        }
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Upload multiple files
  app.post("/api/upload/multiple", fileAuthMiddleware, upload.array("files", 10), (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedFilesResult = req.files.map((file: Express.Multer.File) => {
        const fileId = crypto.randomBytes(16).toString("hex");
        const uploadedFile: UploadedFile = {
          id: fileId,
          originalName: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          uploadedAt: new Date()
        };
        uploadedFiles.set(fileId, uploadedFile);
        return {
          id: fileId,
          originalName: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          uploadedAt: uploadedFile.uploadedAt,
          url: `/api/files/${fileId}`
        };
      });

      res.json({ success: true, files: uploadedFilesResult });
    } catch (error) {
      console.error("Multiple file upload error:", error);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Get list of uploaded files
  app.get("/api/files", fileAuthMiddleware, (_req, res) => {
    try {
      const files = Array.from(uploadedFiles.values()).map(file => ({
        id: file.id,
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
        url: `/api/files/${file.id}`,
        isImage: file.mimetype.startsWith("image/"),
        isVideo: file.mimetype.startsWith("video/")
      }));
      res.json(files);
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Get/download a specific file
  app.get("/api/files/:id", fileAuthMiddleware, (req, res) => {
    try {
      const file = uploadedFiles.get(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!fs.existsSync(file.path)) {
        uploadedFiles.delete(req.params.id);
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.setHeader("Content-Type", file.mimetype);
      res.setHeader("Content-Disposition", `inline; filename="${file.originalName}"`);
      fs.createReadStream(file.path).pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Delete a file
  app.delete("/api/files/:id", fileAuthMiddleware, (req, res) => {
    try {
      const file = uploadedFiles.get(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      uploadedFiles.delete(req.params.id);

      res.json({ success: true, message: "File deleted" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Get file metadata
  app.get("/api/files/:id/metadata", fileAuthMiddleware, (req, res) => {
    try {
      const file = uploadedFiles.get(req.params.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json({
        id: file.id,
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
        description: file.description,
        isImage: file.mimetype.startsWith("image/"),
        isVideo: file.mimetype.startsWith("video/"),
        url: `/api/files/${file.id}`
      });
    } catch (error) {
      console.error("Error getting file metadata:", error);
      res.status(500).json({ error: "Failed to get file metadata" });
    }
  });

  // ============================================
  // BIOMETRIC IDENTIFICATION SYSTEM ENDPOINTS
  // ============================================

  // Register new operator with face biometrics
  app.post("/api/biometric/register", fileAuthMiddleware, async (req, res) => {
    try {
      const { name, role, clearanceLevel, faceImageBase64 } = req.body;

      if (!name || !faceImageBase64) {
        return res.status(400).json({ error: "Name and face image are required" });
      }

      // Validate face image is base64
      if (!faceImageBase64.includes("base64,") && !faceImageBase64.match(/^[A-Za-z0-9+/=]+$/)) {
        return res.status(400).json({ error: "Invalid face image format" });
      }

      // Use OpenAI vision to verify this is a valid face image
      const faceValidationResult = await cyrusInferAsync(
        "BIOMETRIC VALIDATION MODE: Analyze this image and determine if it contains a clear, identifiable human face suitable for biometric registration. Respond ONLY with JSON in this exact format: { \"isFaceValid\": boolean, \"confidence\": number (0-100), \"issues\": string[] }",
        {
          imageData: faceImageBase64,
          hasImage: true
        }
      );

      let validation = { isFaceValid: false, confidence: 0, issues: ["Could not validate"] };
      try {
        const answer = faceValidationResult?.result?.answer || "";
        const jsonMatch = answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          validation = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Face validation parse error:", e);
      }

      if (!validation.isFaceValid || validation.confidence < 70) {
        return res.status(400).json({ 
          error: "Face validation failed", 
          details: validation.issues || ["Face not clearly visible or unsuitable for biometric registration"],
          confidence: validation.confidence
        });
      }

      const operatorId = crypto.randomBytes(16).toString("hex");
      const operator: RegisteredOperator = {
        id: operatorId,
        name: name.trim(),
        role: role || "Operator",
        clearanceLevel: clearanceLevel || "STANDARD",
        faceImageBase64: faceImageBase64,
        registeredAt: new Date(),
        verificationCount: 0
      };

      registeredOperators.set(operatorId, operator);

      res.json({
        success: true,
        message: `Operator ${name} registered successfully`,
        operatorId: operatorId,
        name: operator.name,
        role: operator.role,
        clearanceLevel: operator.clearanceLevel,
        registeredAt: operator.registeredAt
      });
    } catch (error) {
      console.error("Biometric registration error:", error);
      res.status(500).json({ error: "Failed to register operator" });
    }
  });

  // Verify operator identity with face biometrics (requires prior password authentication)
  app.post("/api/biometric/verify", fileAuthMiddleware, async (req, res) => {
    try {
      const { faceImageBase64 } = req.body;

      if (!faceImageBase64) {
        return res.status(400).json({ error: "Face image is required for verification" });
      }

      if (registeredOperators.size === 0) {
        return res.status(404).json({ 
          error: "No operators registered", 
          message: "Please register at least one operator before verification" 
        });
      }

      // Get all registered operators for comparison
      const operators = Array.from(registeredOperators.values());
      
      // First, analyze the verification face to extract key features
      const verificationAnalysis = await cyrusInferAsync(
        "BIOMETRIC ANALYSIS MODE: Analyze this face image and provide a detailed description of the person's facial features for identification purposes. Include: approximate age range, gender, distinctive facial features (eye shape, nose shape, face shape, skin tone, hair color/style, facial hair, glasses, etc). Respond with JSON: { \"description\": string, \"features\": { \"ageRange\": string, \"gender\": string, \"faceShape\": string, \"distinctiveFeatures\": string[] } }",
        {
          imageData: faceImageBase64,
          hasImage: true
        }
      );

      let verificationFeatures = "";
      try {
        const answer = verificationAnalysis?.result?.answer || "";
        const jsonMatch = answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          verificationFeatures = parsed.description || JSON.stringify(parsed.features);
        }
      } catch (e) {
        verificationFeatures = verificationAnalysis?.result?.answer || "";
      }

      // Compare against each registered operator
      let bestMatch = { operatorIndex: -1, confidence: 0, reasoning: "" };
      
      for (let i = 0; i < operators.length; i++) {
        const operator = operators[i];
        
        // Analyze registered operator's face
        const operatorAnalysis = await cyrusInferAsync(
          `BIOMETRIC COMPARISON MODE: Compare this registered operator's face with the following verification subject description: "${verificationFeatures}". Determine if they are the SAME PERSON. Be strict - facial features must closely match. Respond ONLY with JSON: { "isSamePerson": boolean, "confidence": number (0-100), "reasoning": string }`,
          {
            imageData: operator.faceImageBase64,
            hasImage: true
          }
        );

        try {
          const answer = operatorAnalysis?.result?.answer || "";
          const jsonMatch = answer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const comparison = JSON.parse(jsonMatch[0]);
            if (comparison.isSamePerson && comparison.confidence > bestMatch.confidence) {
              bestMatch = {
                operatorIndex: i,
                confidence: comparison.confidence,
                reasoning: comparison.reasoning
              };
            }
          }
        } catch (e) {
          console.error("Comparison parse error:", e);
        }
      }

      let verification = { 
        matched: bestMatch.operatorIndex >= 0 && bestMatch.confidence >= 85, 
        matchedOperatorIndex: bestMatch.operatorIndex >= 0 ? bestMatch.operatorIndex : null, 
        confidence: bestMatch.confidence, 
        reasoning: bestMatch.reasoning 
      };

      if (verification.matched && verification.matchedOperatorIndex !== null && verification.confidence >= 85) {
        const matchedOperator = operators[verification.matchedOperatorIndex];
        if (matchedOperator) {
          // Update verification stats
          matchedOperator.lastVerifiedAt = new Date();
          matchedOperator.verificationCount++;
          registeredOperators.set(matchedOperator.id, matchedOperator);

          // Mark existing session as biometric verified (true 2FA)
          const sessionToken = req.headers["x-cyrus-session-token"] as string || 
            (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
          
          if (sessionToken) {
            markSessionBiometricVerified(sessionToken, matchedOperator.id, matchedOperator.name);
          }

          return res.json({
            verified: true,
            operator: {
              id: matchedOperator.id,
              name: matchedOperator.name,
              role: matchedOperator.role,
              clearanceLevel: matchedOperator.clearanceLevel
            },
            confidence: verification.confidence,
            biometricVerified: true,
            message: `Identity verified: ${matchedOperator.name} (${matchedOperator.role}). Dual-factor authentication complete.`
          });
        }
      }

      res.json({
        verified: false,
        confidence: verification.confidence,
        reasoning: verification.reasoning || "Face does not match any registered operator",
        message: "Identity verification failed. Access denied."
      });
    } catch (error) {
      console.error("Biometric verification error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // List registered operators (without face data for security)
  app.get("/api/biometric/operators", fileAuthMiddleware, (_req, res) => {
    try {
      const operators = Array.from(registeredOperators.values()).map(op => ({
        id: op.id,
        name: op.name,
        role: op.role,
        clearanceLevel: op.clearanceLevel,
        registeredAt: op.registeredAt,
        lastVerifiedAt: op.lastVerifiedAt,
        verificationCount: op.verificationCount
      }));

      res.json({
        count: operators.length,
        operators: operators
      });
    } catch (error) {
      console.error("Error listing operators:", error);
      res.status(500).json({ error: "Failed to list operators" });
    }
  });

  // Delete registered operator
  app.delete("/api/biometric/operators/:id", fileAuthMiddleware, (req, res) => {
    try {
      const operatorId = req.params.id;
      const operator = registeredOperators.get(operatorId);

      if (!operator) {
        return res.status(404).json({ error: "Operator not found" });
      }

      registeredOperators.delete(operatorId);

      res.json({
        success: true,
        message: `Operator ${operator.name} has been removed from the biometric system`
      });
    } catch (error) {
      console.error("Error deleting operator:", error);
      res.status(500).json({ error: "Failed to delete operator" });
    }
  });

  // Drones
  app.get("/api/drones", async (req, res) => {
    try {
      const drones = await storage.getDrones();
      res.json(drones);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drones" });
    }
  });

  app.get("/api/drones/:id", async (req, res) => {
    try {
      const drone = await storage.getDrone(req.params.id);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      res.json(drone);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drone" });
    }
  });

  app.post("/api/drones", async (req, res) => {
    try {
      const parsed = insertDroneSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const drone = await storage.createDrone(parsed.data);
      res.status(201).json(drone);
    } catch (error) {
      res.status(500).json({ error: "Failed to create drone" });
    }
  });

  app.patch("/api/drones/:id/pilot-mode", async (req, res) => {
    try {
      const modeSchema = z.object({ mode: z.enum(["manual", "autonomous", "ai-assist"]) });
      const parsed = modeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const drone = await storage.updateDronePilotMode(req.params.id, parsed.data.mode);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      res.json(drone);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pilot mode" });
    }
  });

  app.patch("/api/drones/:id/status", async (req, res) => {
    try {
      const statusSchema = z.object({ status: z.enum(["online", "offline", "mission", "returning", "maintenance", "emergency"]) });
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const drone = await storage.updateDroneStatus(req.params.id, parsed.data.status);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      res.json(drone);
    } catch (error) {
      res.status(500).json({ error: "Failed to update drone status" });
    }
  });

  // Missions
  app.get("/api/missions", async (req, res) => {
    try {
      const missions = await storage.getMissions();
      res.json(missions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch missions" });
    }
  });

  app.get("/api/missions/:id", async (req, res) => {
    try {
      const mission = await storage.getMission(req.params.id);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      res.json(mission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch mission" });
    }
  });

  app.get("/api/drones/:droneId/missions", async (req, res) => {
    try {
      const missions = await storage.getMissionsByDroneId(req.params.droneId);
      res.json(missions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch missions" });
    }
  });

  app.post("/api/missions", async (req, res) => {
    try {
      const parsed = insertMissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const mission = await storage.createMission(parsed.data);
      res.status(201).json(mission);
    } catch (error) {
      res.status(500).json({ error: "Failed to create mission" });
    }
  });

  app.patch("/api/missions/:id/status", async (req, res) => {
    try {
      const statusSchema = z.object({ status: z.enum(["planning", "active", "completed", "aborted"]) });
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const mission = await storage.updateMissionStatus(req.params.id, parsed.data.status);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      res.json(mission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update mission status" });
    }
  });

  // Alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const parsed = insertAlertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
      }
      const alert = await storage.createAlert(parsed.data);
      res.status(201).json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.patch("/api/alerts/:id/acknowledge", async (req, res) => {
    try {
      const alert = await storage.acknowledgeAlert(req.params.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAlert(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // Flight Logs
  app.get("/api/flight-logs", async (req, res) => {
    try {
      const droneId = req.query.droneId as string | undefined;
      const logs = await storage.getFlightLogs(droneId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flight logs" });
    }
  });

  app.get("/api/flight-logs/:droneId", async (req, res) => {
    try {
      const logs = await storage.getFlightLogs(req.params.droneId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flight logs" });
    }
  });

  // CYRUS AI Integrated Routes
  app.get("/api/cyrus/health", (req, res) => {
    res.json(cyrusHealth());
  });

  app.get("/api/cyrus/v1/models", (req, res) => {
    res.json(cyrusModels());
  });

  app.post("/api/cyrus/v1/infer", async (req, res) => {
    try {
      const { text, context } = req.body;
      if (!text) {
        return res.status(400).json({ error: "text field is required" });
      }
      const result = await cyrusInferAsync(text, context);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Inference failed" });
    }
  });

  app.post("/api/cyrus/v1/command/analyze", (req, res) => {
    try {
      const { command, drone_id } = req.body;
      if (!command) {
        return res.status(400).json({ error: "command field is required" });
      }
      res.json(cyrusAnalyzeCommand(command, drone_id));
    } catch (error) {
      res.status(500).json({ error: "Command analysis failed" });
    }
  });

  app.get("/api/cyrus/v1/commands", (req, res) => {
    res.json(cyrusListCommands());
  });

  app.get("/api/cyrus/v1/modes", (req, res) => {
    res.json(cyrusListModes());
  });

  // CYRUS Analytic Mode - Structured tactical analysis
  app.post("/api/cyrus/v1/analyze", async (req, res) => {
    try {
      const { query, context, depth } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query field is required" });
      }

      // Get fleet context if not provided
      let analysisContext = context || {};
      if (!analysisContext.drones) {
        analysisContext.drones = await storage.getDrones();
      }
      if (!analysisContext.missions) {
        analysisContext.missions = await storage.getMissions();
      }
      if (!analysisContext.alerts) {
        analysisContext.alerts = await storage.getAlerts();
      }

      const result = await runAnalyticMode({
        query,
        context: analysisContext,
        depth: depth || "standard"
      });

      res.json(result);
    } catch (error) {
      console.error("Analytic mode error:", error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  // Formatted analytic report endpoint
  app.post("/api/cyrus/v1/analyze/report", async (req, res) => {
    try {
      const { query, context, depth } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query field is required" });
      }

      let analysisContext = context || {};
      if (!analysisContext.drones) {
        analysisContext.drones = await storage.getDrones();
      }
      if (!analysisContext.missions) {
        analysisContext.missions = await storage.getMissions();
      }
      if (!analysisContext.alerts) {
        analysisContext.alerts = await storage.getAlerts();
      }

      const result = await runAnalyticMode({
        query,
        context: analysisContext,
        depth: depth || "comprehensive"
      });

      const formattedReport = formatAnalyticReport(result);
      res.json({ ...result, formattedReport });
    } catch (error) {
      console.error("Analytic report error:", error);
      res.status(500).json({ error: "Report generation failed" });
    }
  });

  // Mission AI Planning - Generate optimized waypoints
  app.post("/api/cyrus/v1/plan-mission", async (req, res) => {
    try {
      const { objective, droneId, constraints } = req.body;
      if (!objective) {
        return res.status(400).json({ error: "objective field is required" });
      }

      const drone = droneId ? await storage.getDrone(droneId) : null;
      
      const result = await cyrusInferAsync(
        `Plan a drone mission with the following objective: ${objective}. 
        ${constraints ? `Constraints: ${JSON.stringify(constraints)}` : ''}
        ${drone ? `Selected drone: ${drone.name} (${drone.model}), Battery: ${drone.batteryLevel}%` : ''}
        
        Provide waypoint suggestions with coordinates, altitudes, and actions.`,
        { drone_name: drone?.name }
      );

      res.json({
        id: result.id,
        objective,
        droneId,
        plan: result.result.answer,
        timestamp: result.timestamp
      });
    } catch (error) {
      console.error("Mission planning error:", error);
      res.status(500).json({ error: "Mission planning failed" });
    }
  });

  // Autonomous Engine - Generate flight path for mission
  app.post("/api/autonomous/flight-path", async (req, res) => {
    try {
      const { missionId, droneId, constraints } = req.body;
      if (!missionId || !droneId) {
        return res.status(400).json({ error: "missionId and droneId are required" });
      }

      const mission = await storage.getMission(missionId);
      const drone = await storage.getDrone(droneId);
      
      if (!mission || !drone) {
        return res.status(404).json({ error: "Mission or drone not found" });
      }

      const flightPath = await autonomousEngine.generateFlightPath(mission, drone, constraints);
      res.json(flightPath);
    } catch (error) {
      console.error("Flight path generation error:", error);
      res.status(500).json({ error: "Failed to generate flight path" });
    }
  });

  // Autonomous Engine - Start mission execution
  app.post("/api/autonomous/start/:droneId", async (req, res) => {
    try {
      const { droneId } = req.params;
      const success = autonomousEngine.startMission(droneId);
      
      if (success) {
        await storage.updateDroneStatus(droneId, "mission");
        await storage.updateDronePilotMode(droneId, "autonomous");
        res.json({ status: "executing", droneId });
      } else {
        res.status(400).json({ error: "No planned flight path found for drone" });
      }
    } catch (error) {
      console.error("Mission start error:", error);
      res.status(500).json({ error: "Failed to start mission" });
    }
  });

  // Autonomous Engine - Abort mission
  app.post("/api/autonomous/abort/:droneId", async (req, res) => {
    try {
      const { droneId } = req.params;
      const success = autonomousEngine.abortMission(droneId);
      
      if (success) {
        await storage.updateDroneStatus(droneId, "returning");
        res.json({ status: "aborted", droneId });
      } else {
        res.status(400).json({ error: "No active mission to abort" });
      }
    } catch (error) {
      console.error("Mission abort error:", error);
      res.status(500).json({ error: "Failed to abort mission" });
    }
  });

  // Autonomous Engine - Evaluate flight state and get decisions
  app.post("/api/autonomous/evaluate", async (req, res) => {
    try {
      const state: FlightState = req.body;
      if (!state.droneId) {
        return res.status(400).json({ error: "droneId is required in flight state" });
      }

      const decisions = await autonomousEngine.evaluateFlightState(state);
      res.json({ decisions, count: decisions.length });
    } catch (error) {
      console.error("Flight state evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate flight state" });
    }
  });

  // Autonomous Engine - Navigate to next waypoint
  app.post("/api/autonomous/navigate", async (req, res) => {
    try {
      const { droneId, position } = req.body;
      if (!droneId || !position) {
        return res.status(400).json({ error: "droneId and position are required" });
      }

      const navigation = await autonomousEngine.executeWaypointNavigation(droneId, position);
      res.json(navigation);
    } catch (error) {
      console.error("Navigation error:", error);
      res.status(500).json({ error: "Failed to get navigation command" });
    }
  });

  // Autonomous Engine - Get flight path for drone
  app.get("/api/autonomous/flight-path/:droneId", async (req, res) => {
    try {
      const flightPath = autonomousEngine.getFlightPath(req.params.droneId);
      if (!flightPath) {
        return res.status(404).json({ error: "No flight path found for drone" });
      }
      res.json(flightPath);
    } catch (error) {
      console.error("Flight path fetch error:", error);
      res.status(500).json({ error: "Failed to get flight path" });
    }
  });

  // Autonomous Engine - Get decision log
  app.get("/api/autonomous/decisions", async (req, res) => {
    try {
      const decisions = autonomousEngine.getDecisionLog();
      res.json(decisions);
    } catch (error) {
      console.error("Decision log fetch error:", error);
      res.status(500).json({ error: "Failed to get decision log" });
    }
  });

  // Autonomous Engine - AI tactical recommendation
  app.post("/api/autonomous/recommend", async (req, res) => {
    try {
      const { situation, droneId, missionId } = req.body;
      if (!situation) {
        return res.status(400).json({ error: "situation description is required" });
      }

      const drone = droneId ? await storage.getDrone(droneId) : undefined;
      const mission = missionId ? await storage.getMission(missionId) : undefined;
      
      const recommendation = await autonomousEngine.getAIRecommendation(situation, { drone, mission });
      res.json(recommendation);
    } catch (error) {
      console.error("AI recommendation error:", error);
      res.status(500).json({ error: "Failed to get AI recommendation" });
    }
  });

  // Predictive Analytics - Fleet health analysis
  app.get("/api/analytics/fleet-health", async (req, res) => {
    try {
      const drones = await storage.getDrones();
      const missions = await storage.getMissions();
      const fleetHealth = predictiveAnalytics.analyzeFleetHealth(drones, missions);
      res.json(fleetHealth);
    } catch (error) {
      console.error("Fleet health analysis error:", error);
      res.status(500).json({ error: "Failed to analyze fleet health" });
    }
  });

  // Predictive Analytics - Battery prediction for drone
  app.get("/api/analytics/battery/:droneId", async (req, res) => {
    try {
      const drone = await storage.getDrone(req.params.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const prediction = predictiveAnalytics.predictBatteryLife(drone);
      res.json(prediction);
    } catch (error) {
      console.error("Battery prediction error:", error);
      res.status(500).json({ error: "Failed to predict battery life" });
    }
  });

  // Predictive Analytics - Mission completion prediction
  app.get("/api/analytics/mission/:missionId", async (req, res) => {
    try {
      const mission = await storage.getMission(req.params.missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      const drone = await storage.getDrone(mission.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Assigned drone not found" });
      }
      const prediction = predictiveAnalytics.predictMissionCompletion(mission, drone);
      res.json(prediction);
    } catch (error) {
      console.error("Mission prediction error:", error);
      res.status(500).json({ error: "Failed to predict mission completion" });
    }
  });

  // Predictive Analytics - Maintenance prediction for drone
  app.get("/api/analytics/maintenance/:droneId", async (req, res) => {
    try {
      const drone = await storage.getDrone(req.params.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const prediction = predictiveAnalytics.predictMaintenance(drone);
      res.json(prediction);
    } catch (error) {
      console.error("Maintenance prediction error:", error);
      res.status(500).json({ error: "Failed to predict maintenance" });
    }
  });

  // Predictive Analytics - Operational recommendations
  app.get("/api/analytics/recommendations", async (req, res) => {
    try {
      const drones = await storage.getDrones();
      const missions = await storage.getMissions();
      const recommendations = predictiveAnalytics.getOperationalRecommendations(drones, missions);
      res.json({ recommendations });
    } catch (error) {
      console.error("Recommendations error:", error);
      res.status(500).json({ error: "Failed to get recommendations" });
    }
  });

  // Emergency Protocols - List all protocols
  app.get("/api/emergency/protocols", async (req, res) => {
    try {
      const protocols = emergencyEngine.getAllProtocols();
      res.json(protocols);
    } catch (error) {
      console.error("Protocols fetch error:", error);
      res.status(500).json({ error: "Failed to get protocols" });
    }
  });

  // Emergency Protocols - Detect emergency for drone
  app.post("/api/emergency/detect", async (req, res) => {
    try {
      const { droneId, telemetry } = req.body;
      const drone = await storage.getDrone(droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const emergencyType = emergencyEngine.detectEmergency(drone, telemetry);
      res.json({ emergency: emergencyType !== null, type: emergencyType });
    } catch (error) {
      console.error("Emergency detection error:", error);
      res.status(500).json({ error: "Failed to detect emergency" });
    }
  });

  // Emergency Protocols - Initiate emergency response
  app.post("/api/emergency/initiate", async (req, res) => {
    try {
      const { droneId, emergencyType } = req.body;
      if (!droneId || !emergencyType) {
        return res.status(400).json({ error: "droneId and emergencyType are required" });
      }
      const response = emergencyEngine.initiateEmergencyResponse(droneId, emergencyType);
      res.json(response);
    } catch (error) {
      console.error("Emergency initiation error:", error);
      res.status(500).json({ error: "Failed to initiate emergency response" });
    }
  });

  // Emergency Protocols - Execute full emergency protocol
  app.post("/api/emergency/execute", async (req, res) => {
    try {
      const { droneId, emergencyType } = req.body;
      if (!droneId || !emergencyType) {
        return res.status(400).json({ error: "droneId and emergencyType are required" });
      }
      const response = await emergencyEngine.executeFullProtocol(droneId, emergencyType);
      res.json(response);
    } catch (error) {
      console.error("Emergency execution error:", error);
      res.status(500).json({ error: "Failed to execute emergency protocol" });
    }
  });

  // Emergency Protocols - Get active emergency responses
  app.get("/api/emergency/active", async (req, res) => {
    try {
      const responses = emergencyEngine.getActiveResponses();
      res.json(responses);
    } catch (error) {
      console.error("Active responses fetch error:", error);
      res.status(500).json({ error: "Failed to get active responses" });
    }
  });

  // Emergency Protocols - Get AI analysis for emergency
  app.post("/api/emergency/analyze", async (req, res) => {
    try {
      const { droneId, emergencyType } = req.body;
      const drone = await storage.getDrone(droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const analysis = await emergencyEngine.getAIEmergencyAnalysis(drone, emergencyType);
      res.json({ analysis });
    } catch (error) {
      console.error("Emergency analysis error:", error);
      res.status(500).json({ error: "Failed to analyze emergency" });
    }
  });

  // Emergency Protocols - Resolve emergency
  app.post("/api/emergency/resolve/:responseId", async (req, res) => {
    try {
      const success = emergencyEngine.resolveEmergency(req.params.responseId);
      if (success) {
        res.json({ status: "resolved" });
      } else {
        res.status(404).json({ error: "Response not found" });
      }
    } catch (error) {
      console.error("Emergency resolve error:", error);
      res.status(500).json({ error: "Failed to resolve emergency" });
    }
  });

  // ============================================================================
  // CYRUS COGNITIVE CORE - Humanoid AI Pilot
  // ============================================================================

  app.get("/api/cyrus/pilot/status", async (req, res) => {
    try {
      const status = cyrusCognitiveCore.generatePilotStatus();
      res.json(status);
    } catch (error) {
      console.error("CYRUS pilot status error:", error);
      res.status(500).json({ error: "Failed to get pilot status" });
    }
  });

  app.get("/api/cyrus/pilot/identity", async (req, res) => {
    try {
      const identity = cyrusCognitiveCore.getIdentity();
      res.json(identity);
    } catch (error) {
      console.error("CYRUS identity error:", error);
      res.status(500).json({ error: "Failed to get identity" });
    }
  });

  app.post("/api/cyrus/ooda/cycle", async (req, res) => {
    try {
      const { droneId, missionId } = req.body;
      const drone = await storage.getDrone(droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const mission = missionId ? await storage.getMission(missionId) : undefined;
      const telemetry = await storage.getTelemetry(droneId);
      const alerts = await storage.getAlerts();
      const droneAlerts = alerts.filter(a => a.droneId === droneId);

      const result = cyrusCognitiveCore.executeOODACycle(
        drone,
        mission || undefined,
        telemetry || undefined,
        droneAlerts
      );
      res.json(result);
    } catch (error) {
      console.error("OODA cycle error:", error);
      res.status(500).json({ error: "Failed to execute OODA cycle" });
    }
  });

  app.get("/api/cyrus/decisions/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = cyrusCognitiveCore.getDecisionHistory(limit);
      res.json(history);
    } catch (error) {
      console.error("Decision history error:", error);
      res.status(500).json({ error: "Failed to get decision history" });
    }
  });

  app.get("/api/cyrus/orientation", async (req, res) => {
    try {
      const state = cyrusCognitiveCore.getOrientationState();
      res.json(state || { message: "No orientation state available" });
    } catch (error) {
      console.error("Orientation state error:", error);
      res.status(500).json({ error: "Failed to get orientation state" });
    }
  });

  // ============================================================================
  // CYRUS ROE ENGINE - Rules of Engagement
  // ============================================================================

  app.get("/api/cyrus/roe/status", async (req, res) => {
    try {
      const status = roeEngine.getCurrentROEStatus();
      res.json(status);
    } catch (error) {
      console.error("ROE status error:", error);
      res.status(500).json({ error: "Failed to get ROE status" });
    }
  });

  app.get("/api/cyrus/roe/laws", async (req, res) => {
    try {
      const laws = roeEngine.getImmutableLaws();
      res.json(laws);
    } catch (error) {
      console.error("ROE laws error:", error);
      res.status(500).json({ error: "Failed to get immutable laws" });
    }
  });

  app.post("/api/cyrus/roe/evaluate", async (req, res) => {
    try {
      const { action, context } = req.body;
      if (!action || !context) {
        return res.status(400).json({ error: "action and context are required" });
      }
      const evaluation = roeEngine.evaluateAction(action, context);
      res.json(evaluation);
    } catch (error) {
      console.error("ROE evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate action" });
    }
  });

  app.post("/api/cyrus/roe/update", async (req, res) => {
    try {
      const { missionId, roe } = req.body;
      if (!missionId) {
        return res.status(400).json({ error: "missionId is required" });
      }
      const result = roeEngine.updateMissionROE(missionId, roe || {});
      res.json(result);
    } catch (error) {
      console.error("ROE update error:", error);
      res.status(500).json({ error: "Failed to update ROE" });
    }
  });

  app.post("/api/cyrus/roe/authority", async (req, res) => {
    try {
      const { level, authorizedBy } = req.body;
      if (!level || !authorizedBy) {
        return res.status(400).json({ error: "level and authorizedBy are required" });
      }
      roeEngine.setAuthorityLevel(level, authorizedBy);
      res.json({ success: true, level });
    } catch (error) {
      console.error("ROE authority error:", error);
      res.status(500).json({ error: "Failed to set authority level" });
    }
  });

  app.get("/api/cyrus/roe/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = roeEngine.getROEHistory(limit);
      res.json(history);
    } catch (error) {
      console.error("ROE history error:", error);
      res.status(500).json({ error: "Failed to get ROE history" });
    }
  });

  // ============================================================================
  // CYRUS SENSOR FUSION
  // ============================================================================

  app.get("/api/cyrus/sensors/status", async (req, res) => {
    try {
      const sensors = sensorFusionEngine.getSensorStatus();
      res.json(sensors);
    } catch (error) {
      console.error("Sensor status error:", error);
      res.status(500).json({ error: "Failed to get sensor status" });
    }
  });

  app.post("/api/cyrus/sensors/picture", async (req, res) => {
    try {
      const { droneId } = req.body;
      const drone = await storage.getDrone(droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const telemetry = await storage.getTelemetry(droneId);
      const picture = sensorFusionEngine.generateSituationalPicture(drone, telemetry || undefined);
      res.json(picture);
    } catch (error) {
      console.error("Situational picture error:", error);
      res.status(500).json({ error: "Failed to generate situational picture" });
    }
  });

  app.get("/api/cyrus/sensors/tracks", async (req, res) => {
    try {
      const tracks = sensorFusionEngine.getTracks();
      res.json(tracks);
    } catch (error) {
      console.error("Tracks error:", error);
      res.status(500).json({ error: "Failed to get tracks" });
    }
  });

  // Multimodal AI Vision Analysis
  app.post("/api/cyrus/sensors/analyze-vision", async (req, res) => {
    try {
      const { imageBase64, missionContext } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      const analysis = await sensorFusionEngine.analyzeVisionWithAI(imageBase64, missionContext);
      res.json(analysis);
    } catch (error) {
      console.error("Vision analysis error:", error);
      res.status(500).json({ error: "Failed to analyze vision" });
    }
  });

  // Multimodal AI Audio Analysis
  app.post("/api/cyrus/sensors/analyze-audio", async (req, res) => {
    try {
      const { audioDescription } = req.body;
      if (!audioDescription) {
        return res.status(400).json({ error: "audioDescription is required" });
      }
      const analysis = await sensorFusionEngine.analyzeAudioContext(audioDescription);
      res.json(analysis);
    } catch (error) {
      console.error("Audio analysis error:", error);
      res.status(500).json({ error: "Failed to analyze audio" });
    }
  });

  // Multimodal Fusion
  app.post("/api/cyrus/sensors/multimodal-fusion", async (req, res) => {
    try {
      const { gps, visionImage, audioContext, missionContext } = req.body;
      if (!gps) {
        return res.status(400).json({ error: "GPS position is required" });
      }
      const result = await sensorFusionEngine.performMultimodalFusion(
        gps,
        visionImage,
        audioContext,
        missionContext
      );
      res.json(result);
    } catch (error) {
      console.error("Multimodal fusion error:", error);
      res.status(500).json({ error: "Failed to perform multimodal fusion" });
    }
  });

  // ============================================================================
  // CYRUS FLIGHT CONTROL
  // ============================================================================

  app.get("/api/cyrus/flight/status/:droneId", async (req, res) => {
    try {
      const status = flightControlEngine.getFlightStatus(req.params.droneId);
      res.json(status);
    } catch (error) {
      console.error("Flight status error:", error);
      res.status(500).json({ error: "Failed to get flight status" });
    }
  });

  app.post("/api/cyrus/flight/envelope", async (req, res) => {
    try {
      const { droneId } = req.body;
      const drone = await storage.getDrone(droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const telemetry = await storage.getTelemetry(droneId);
      const check = flightControlEngine.checkEnvelopeCompliance(droneId, drone, telemetry || undefined);
      res.json(check);
    } catch (error) {
      console.error("Envelope check error:", error);
      res.status(500).json({ error: "Failed to check envelope" });
    }
  });

  app.post("/api/cyrus/flight/command", async (req, res) => {
    try {
      const { droneId, command, parameters } = req.body;
      if (!droneId || !command) {
        return res.status(400).json({ error: "droneId and command are required" });
      }
      const result = flightControlEngine.executeFlightCommand(droneId, command, parameters || {});
      res.json(result);
    } catch (error) {
      console.error("Flight command error:", error);
      res.status(500).json({ error: "Failed to execute flight command" });
    }
  });

  app.post("/api/cyrus/flight/degradation", async (req, res) => {
    try {
      const { droneId, trigger } = req.body;
      if (!droneId || !trigger) {
        return res.status(400).json({ error: "droneId and trigger are required" });
      }
      const response = flightControlEngine.handleDegradation(droneId, trigger);
      res.json(response);
    } catch (error) {
      console.error("Degradation handling error:", error);
      res.status(500).json({ error: "Failed to handle degradation" });
    }
  });

  app.get("/api/cyrus/flight/commands/:droneId", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = flightControlEngine.getCommandHistory(req.params.droneId, limit);
      res.json(history);
    } catch (error) {
      console.error("Command history error:", error);
      res.status(500).json({ error: "Failed to get command history" });
    }
  });

  // ============================================================================
  // CYRUS PATH PLANNING & COLLISION AVOIDANCE
  // ============================================================================

  app.post("/api/cyrus/path/plan", async (req, res) => {
    try {
      const { start, destination, options } = req.body;
      if (!start || !destination) {
        return res.status(400).json({ error: "Start and destination positions are required" });
      }
      const result = pathPlanningEngine.planPath(start, destination, options || {});
      res.json(result);
    } catch (error) {
      console.error("Path planning error:", error);
      res.status(500).json({ error: "Failed to plan path" });
    }
  });

  app.post("/api/cyrus/path/check-collision", async (req, res) => {
    try {
      const { position, velocity } = req.body;
      if (!position || !velocity) {
        return res.status(400).json({ error: "Position and velocity are required" });
      }
      const warning = pathPlanningEngine.checkCollision(position, velocity);
      res.json({ warning });
    } catch (error) {
      console.error("Collision check error:", error);
      res.status(500).json({ error: "Failed to check collision" });
    }
  });

  app.post("/api/cyrus/path/obstacle", async (req, res) => {
    try {
      const obstacle = req.body;
      if (!obstacle.id || !obstacle.type || !obstacle.position) {
        return res.status(400).json({ error: "Obstacle id, type, and position are required" });
      }
      pathPlanningEngine.addObstacle(obstacle);
      res.json({ success: true, message: "Obstacle added" });
    } catch (error) {
      console.error("Add obstacle error:", error);
      res.status(500).json({ error: "Failed to add obstacle" });
    }
  });

  app.delete("/api/cyrus/path/obstacle/:id", async (req, res) => {
    try {
      const success = pathPlanningEngine.removeObstacle(req.params.id);
      res.json({ success, message: success ? "Obstacle removed" : "Obstacle not found" });
    } catch (error) {
      console.error("Remove obstacle error:", error);
      res.status(500).json({ error: "Failed to remove obstacle" });
    }
  });

  app.get("/api/cyrus/path/obstacles", async (req, res) => {
    try {
      const obstacles = pathPlanningEngine.getObstacles();
      res.json(obstacles);
    } catch (error) {
      console.error("Get obstacles error:", error);
      res.status(500).json({ error: "Failed to get obstacles" });
    }
  });

  app.get("/api/cyrus/path/no-fly-zones", async (req, res) => {
    try {
      const zones = pathPlanningEngine.getNoFlyZones();
      res.json(zones);
    } catch (error) {
      console.error("Get no-fly zones error:", error);
      res.status(500).json({ error: "Failed to get no-fly zones" });
    }
  });

  app.post("/api/cyrus/path/no-fly-zone", async (req, res) => {
    try {
      const zone = req.body;
      if (!zone.id || !zone.name || !zone.center) {
        return res.status(400).json({ error: "Zone id, name, and center are required" });
      }
      pathPlanningEngine.addNoFlyZone(zone);
      res.json({ success: true, message: "No-fly zone added" });
    } catch (error) {
      console.error("Add no-fly zone error:", error);
      res.status(500).json({ error: "Failed to add no-fly zone" });
    }
  });

  // ============================================================================
  // CYRUS ADAPTIVE LEARNING ENGINE
  // ============================================================================

  app.get("/api/cyrus/learning/stats", async (req, res) => {
    try {
      const stats = adaptiveLearningEngine.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Learning stats error:", error);
      res.status(500).json({ error: "Failed to get learning stats" });
    }
  });

  app.get("/api/cyrus/learning/metrics", async (req, res) => {
    try {
      const metrics = adaptiveLearningEngine.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Learning metrics error:", error);
      res.status(500).json({ error: "Failed to get learning metrics" });
    }
  });

  app.get("/api/cyrus/learning/thresholds", async (req, res) => {
    try {
      const thresholds = adaptiveLearningEngine.getThresholds();
      res.json(thresholds);
    } catch (error) {
      console.error("Learning thresholds error:", error);
      res.status(500).json({ error: "Failed to get learning thresholds" });
    }
  });

  app.get("/api/cyrus/learning/models", async (req, res) => {
    try {
      const models = adaptiveLearningEngine.getModels();
      res.json(models);
    } catch (error) {
      console.error("Learning models error:", error);
      res.status(500).json({ error: "Failed to get learning models" });
    }
  });

  app.post("/api/cyrus/learning/event", async (req, res) => {
    try {
      const event = adaptiveLearningEngine.recordEvent(req.body);
      res.json(event);
    } catch (error) {
      console.error("Learning event error:", error);
      res.status(500).json({ error: "Failed to record learning event" });
    }
  });

  app.post("/api/cyrus/learning/predict", async (req, res) => {
    try {
      const { modelId, features } = req.body;
      if (!modelId || !features) {
        return res.status(400).json({ error: "modelId and features are required" });
      }
      const result = adaptiveLearningEngine.predict(modelId, features);
      res.json(result);
    } catch (error) {
      console.error("Prediction error:", error);
      res.status(500).json({ error: "Failed to make prediction" });
    }
  });

  app.post("/api/cyrus/learning/train", async (req, res) => {
    try {
      const { modelId, examples } = req.body;
      if (!modelId || !examples || !Array.isArray(examples)) {
        return res.status(400).json({ error: "modelId and examples array are required" });
      }
      const success = adaptiveLearningEngine.trainModel(modelId, examples);
      res.json({ success });
    } catch (error) {
      console.error("Training error:", error);
      res.status(500).json({ error: "Failed to train model" });
    }
  });

  app.post("/api/cyrus/learning/adjust-threshold", async (req, res) => {
    try {
      const { name, value, reason } = req.body;
      if (!name || value === undefined || !reason) {
        return res.status(400).json({ error: "name, value, and reason are required" });
      }
      const success = adaptiveLearningEngine.adjustThreshold(name, value, reason);
      res.json({ success });
    } catch (error) {
      console.error("Threshold adjustment error:", error);
      res.status(500).json({ error: "Failed to adjust threshold" });
    }
  });

  // ============================================================================
  // CYRUS ADVANCED COGNITIVE ENGINE
  // ============================================================================

  app.get("/api/cyrus/cognitive/metrics", async (req, res) => {
    try {
      const metrics = cognitiveEngine.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Cognitive metrics error:", error);
      res.status(500).json({ error: "Failed to get cognitive metrics" });
    }
  });

  app.get("/api/cyrus/cognitive/neural-architecture", async (req, res) => {
    try {
      const architecture = cognitiveEngine.getNeuralArchitecture();
      res.json(architecture);
    } catch (error) {
      console.error("Neural architecture error:", error);
      res.status(500).json({ error: "Failed to get neural architecture" });
    }
  });

  app.get("/api/cyrus/cognitive/symbolic-rules", async (req, res) => {
    try {
      const rules = cognitiveEngine.getSymbolicRules();
      res.json(rules);
    } catch (error) {
      console.error("Symbolic rules error:", error);
      res.status(500).json({ error: "Failed to get symbolic rules" });
    }
  });

  app.get("/api/cyrus/cognitive/quantum-states", async (req, res) => {
    try {
      const states = cognitiveEngine.getQuantumStates();
      res.json(states);
    } catch (error) {
      console.error("Quantum states error:", error);
      res.status(500).json({ error: "Failed to get quantum states" });
    }
  });

  app.get("/api/cyrus/cognitive/safety-constraints", async (req, res) => {
    try {
      const constraints = cognitiveEngine.getSafetyConstraints();
      res.json(constraints);
    } catch (error) {
      console.error("Safety constraints error:", error);
      res.status(500).json({ error: "Failed to get safety constraints" });
    }
  });

  app.get("/api/cyrus/cognitive/insights", async (req, res) => {
    try {
      const insights = cognitiveEngine.getCreativeInsights();
      res.json(insights);
    } catch (error) {
      console.error("Insights error:", error);
      res.status(500).json({ error: "Failed to get creative insights" });
    }
  });

  app.get("/api/cyrus/cognitive/learning-history", async (req, res) => {
    try {
      const history = cognitiveEngine.getLearningHistory();
      res.json(history);
    } catch (error) {
      console.error("Learning history error:", error);
      res.status(500).json({ error: "Failed to get learning history" });
    }
  });

  app.post("/api/cyrus/cognitive/process", async (req, res) => {
    try {
      const { sensoryData, context, query, urgency } = req.body;
      const result = cognitiveEngine.process({ sensoryData, context, query, urgency });
      res.json(result);
    } catch (error) {
      console.error("Cognitive process error:", error);
      res.status(500).json({ error: "Failed to process cognitive input" });
    }
  });

  app.post("/api/cyrus/cognitive/settings", async (req, res) => {
    try {
      const { learningRate, emergentCapacity, selfImprovement } = req.body;
      if (learningRate !== undefined) cognitiveEngine.setLearningRate(learningRate);
      if (emergentCapacity !== undefined) cognitiveEngine.setEmergentCapacity(emergentCapacity);
      if (selfImprovement !== undefined) cognitiveEngine.setSelfImprovement(selfImprovement);
      res.json({ success: true, message: "Cognitive settings updated" });
    } catch (error) {
      console.error("Cognitive settings error:", error);
      res.status(500).json({ error: "Failed to update cognitive settings" });
    }
  });

  // ============================================================================
  // UNIFIED INTEGRATION ENDPOINT - Connects Sensor Fusion → Cognitive → Learning
  // ============================================================================

  app.post("/api/cyrus/integrated-process", async (req, res) => {
    try {
      const { context, query, urgency = 0.5, droneId } = req.body;
      const startTime = Date.now();

      // Step 1: Get real-time sensor data from sensor fusion
      const sensors = sensorFusionEngine.getSensorStatus();
      const tracks = sensorFusionEngine.getTracks();
      
      // Convert sensor data to numeric pattern for cognitive processing
      const sensoryData: number[] = [];
      sensors.forEach((sensor) => {
        sensoryData.push(sensor.reliability || 0);
        sensoryData.push(sensor.status === "operational" ? 1 : 0);
      });
      
      // Add fused track data
      tracks.forEach((track) => {
        const confidenceValue = track.confidence === "high" ? 0.9 :
                               track.confidence === "medium" ? 0.6 :
                               track.confidence === "low" ? 0.3 : 0.1;
        sensoryData.push(confidenceValue);
        const threatValue = track.threatLevel === "critical" ? 1 : 
                           track.threatLevel === "high" ? 0.8 :
                           track.threatLevel === "medium" ? 0.5 :
                           track.threatLevel === "low" ? 0.2 : 0;
        sensoryData.push(threatValue);
      });

      // Step 2: Process through cognitive engine
      const cognitiveResult = cognitiveEngine.process({
        sensoryData,
        context: context || `Processing sensor data with ${sensors.length} active sensors`,
        query,
        urgency
      });

      // Step 3: Record decision to adaptive learning system
      const learningEvent = adaptiveLearningEngine.recordEvent({
        eventType: "decision",
        category: "cognitive_decision",
        decision: cognitiveResult.output?.decision || "analysis",
        context: {
          sensorCount: sensors.length,
          trackCount: tracks.length,
          cognitiveConfidence: cognitiveResult.confidence,
          processingTime: cognitiveResult.processingTime,
          droneId
        },
        outcome: cognitiveResult.confidence > 0.7 ? "success" : "partial",
        reward: cognitiveResult.confidence
      });

      // Step 4: Update adaptive thresholds based on performance
      if (cognitiveResult.confidence < 0.5) {
        adaptiveLearningEngine.adjustThreshold("sensor_reliability", 0.78, "Low cognitive confidence");
      } else if (cognitiveResult.confidence > 0.9) {
        adaptiveLearningEngine.adjustThreshold("sensor_reliability", 0.82, "High cognitive confidence");
      }

      const totalTime = Date.now() - startTime;

      res.json({
        success: true,
        integration: {
          sensorFusion: {
            sensorsActive: sensors.filter((s) => s.status === "operational").length,
            tracksDetected: tracks.length,
            dataPoints: sensoryData.length
          },
          cognitive: {
            output: cognitiveResult.output,
            reasoning: cognitiveResult.reasoning,
            confidence: cognitiveResult.confidence,
            insights: cognitiveResult.insights.length
          },
          learning: {
            eventId: learningEvent.id,
            category: learningEvent.category,
            recorded: true
          }
        },
        metrics: {
          totalProcessingTime: totalTime,
          cognitiveProcessingTime: cognitiveResult.processingTime,
          integrationOverhead: totalTime - cognitiveResult.processingTime
        }
      });
    } catch (error) {
      console.error("Integrated process error:", error);
      res.status(500).json({ error: "Failed to run integrated processing" });
    }
  });

  // Real-time cognitive analysis with sensor context
  app.post("/api/cyrus/analyze-situation", async (req, res) => {
    try {
      const { droneId, threatLevel = "low", missionContext } = req.body;

      // Get current sensor readings
      const sensors = sensorFusionEngine.getSensorStatus();
      const tracks = sensorFusionEngine.getTracks();

      // Categorize tracks
      const hostileTracks = tracks.filter(t => t.threatLevel === "high" || t.threatLevel === "critical");
      const unknownTracks = tracks.filter(t => t.threatLevel === "medium" || t.threatLevel === "low");

      // Build situational context
      const situationalContext = [
        `Active sensors: ${sensors.filter((s) => s.status === "operational").length}`,
        `Threat level: ${threatLevel}`,
        `Mission: ${missionContext || "General surveillance"}`,
        hostileTracks.length ? `Hostile tracks: ${hostileTracks.length}` : "No hostile tracks",
        unknownTracks.length ? `Unknown tracks: ${unknownTracks.length}` : "No unknown tracks"
      ].join(". ");

      // Determine urgency based on threat level
      const urgencyMap: Record<string, number> = {
        "critical": 1.0,
        "high": 0.8,
        "medium": 0.5,
        "low": 0.3
      };

      const cognitiveResult = cognitiveEngine.process({
        context: situationalContext,
        query: "Analyze current situation and recommend action",
        urgency: urgencyMap[threatLevel] || 0.5
      });

      // Generate tactical recommendation
      const recommendation = {
        action: cognitiveResult.output?.decision || "MONITOR",
        confidence: cognitiveResult.confidence,
        reasoning: cognitiveResult.reasoning,
        insights: cognitiveResult.insights,
        sensorSupport: {
          reliableSensors: sensors.filter((s) => s.reliability > 0.8).length,
          totalSensors: sensors.length
        }
      };

      // Record analysis for learning
      adaptiveLearningEngine.recordEvent({
        eventType: "action",
        category: "situation_analysis",
        decision: recommendation.action,
        context: { threatLevel, droneId, sensorCount: sensors.length },
        outcome: "success",
        reward: cognitiveResult.confidence
      });

      res.json({
        droneId,
        threatLevel,
        analysis: recommendation,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Situation analysis error:", error);
      res.status(500).json({ error: "Failed to analyze situation" });
    }
  });

  // ============================================================================
  // CYRUS MISSION COMMANDER
  // ============================================================================

  app.post("/api/cyrus/mission/plan", async (req, res) => {
    try {
      const { missionId, missionType, objective } = req.body;
      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      const drone = await storage.getDrone(mission.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const plan = missionCommander.createMissionPlan(
        mission,
        drone,
        missionType || "isr",
        objective || mission.name
      );
      res.json(plan);
    } catch (error) {
      console.error("Mission plan error:", error);
      res.status(500).json({ error: "Failed to create mission plan" });
    }
  });

  app.post("/api/cyrus/mission/start/:missionId", async (req, res) => {
    try {
      const { authorizedBy } = req.body;
      const state = missionCommander.startMission(req.params.missionId, authorizedBy);
      res.json(state);
    } catch (error: unknown) {
      console.error("Mission start error:", error);
      // BLACKTALON: Return specific error for authorization failures
      const errorMessage = error instanceof Error ? error.message : "Failed to start mission";
      if (errorMessage.includes("BLACKTALON VIOLATION")) {
        return res.status(403).json({ error: errorMessage, requiresAuthorization: true });
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // BLACKTALON: Human authorization endpoint for high-risk missions
  app.post("/api/cyrus/mission/authorize/:missionId", async (req, res) => {
    try {
      const { authorizedBy, approved } = req.body;
      if (!authorizedBy) {
        return res.status(400).json({ error: "authorizedBy is required for mission authorization" });
      }
      if (typeof approved !== "boolean") {
        return res.status(400).json({ error: "approved (boolean) is required" });
      }
      const plan = missionCommander.authorizeMission(req.params.missionId, authorizedBy, approved);
      if (!plan) {
        return res.status(404).json({ error: "Mission plan not found" });
      }
      res.json({
        success: true,
        missionId: req.params.missionId,
        status: plan.humanAuthStatus,
        authorizedBy: plan.humanAuthBy,
        timestamp: plan.humanAuthTimestamp,
        message: approved 
          ? `Mission authorized by ${authorizedBy} - ready for execution`
          : `Mission authorization denied by ${authorizedBy}`,
      });
    } catch (error) {
      console.error("Mission authorization error:", error);
      res.status(500).json({ error: "Failed to authorize mission" });
    }
  });

  app.post("/api/cyrus/mission/update", async (req, res) => {
    try {
      const { missionId } = req.body;
      const mission = await storage.getMission(missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      const drone = await storage.getDrone(mission.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const telemetry = await storage.getTelemetry(mission.droneId);
      
      const ooda = cyrusCognitiveCore.executeOODACycle(drone, mission, telemetry || undefined);
      const state = missionCommander.updateMissionExecution(missionId, drone, telemetry || undefined, ooda);
      
      res.json({ execution: state, ooda });
    } catch (error) {
      console.error("Mission update error:", error);
      res.status(500).json({ error: "Failed to update mission" });
    }
  });

  app.post("/api/cyrus/mission/abort/:missionId", async (req, res) => {
    try {
      const { reason } = req.body;
      const state = missionCommander.abortMission(req.params.missionId, reason || "Operator requested abort");
      if (!state) {
        return res.status(404).json({ error: "Mission not found" });
      }
      res.json(state);
    } catch (error) {
      console.error("Mission abort error:", error);
      res.status(500).json({ error: "Failed to abort mission" });
    }
  });

  app.post("/api/cyrus/mission/complete/:missionId", async (req, res) => {
    try {
      const state = missionCommander.completeMission(req.params.missionId);
      if (!state) {
        return res.status(404).json({ error: "Mission not found" });
      }
      res.json(state);
    } catch (error) {
      console.error("Mission complete error:", error);
      res.status(500).json({ error: "Failed to complete mission" });
    }
  });

  app.get("/api/cyrus/mission/plan/:missionId", async (req, res) => {
    try {
      const plan = missionCommander.getMissionPlan(req.params.missionId);
      if (!plan) {
        return res.status(404).json({ error: "Mission plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Mission plan fetch error:", error);
      res.status(500).json({ error: "Failed to get mission plan" });
    }
  });

  app.get("/api/cyrus/mission/execution/:missionId", async (req, res) => {
    try {
      const state = missionCommander.getMissionExecution(req.params.missionId);
      if (!state) {
        return res.status(404).json({ error: "Mission execution not found" });
      }
      res.json(state);
    } catch (error) {
      console.error("Mission execution fetch error:", error);
      res.status(500).json({ error: "Failed to get mission execution" });
    }
  });

  app.get("/api/cyrus/mission/active", async (req, res) => {
    try {
      const missions = missionCommander.getAllActiveMissions();
      res.json(missions);
    } catch (error) {
      console.error("Active missions error:", error);
      res.status(500).json({ error: "Failed to get active missions" });
    }
  });

  app.post("/api/cyrus/mission/probability/:missionId", async (req, res) => {
    try {
      const mission = await storage.getMission(req.params.missionId);
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }
      const drone = await storage.getDrone(mission.droneId);
      if (!drone) {
        return res.status(404).json({ error: "Drone not found" });
      }
      const probability = missionCommander.calculateSuccessProbability(req.params.missionId, drone);
      res.json({ probability, percentage: Math.round(probability * 100) });
    } catch (error) {
      console.error("Success probability error:", error);
      res.status(500).json({ error: "Failed to calculate success probability" });
    }
  });

  // ============================================================================
  // CYRUS KNOWLEDGE ENGINE
  // ============================================================================

  app.get("/api/cyrus/knowledge/identity", async (req, res) => {
    try {
      res.json(cyrusKnowledgeEngine.identity);
    } catch (error) {
      console.error("Knowledge identity error:", error);
      res.status(500).json({ error: "Failed to get CYRUS identity" });
    }
  });

  app.get("/api/cyrus/knowledge/expertise", async (req, res) => {
    try {
      const summary = cyrusKnowledgeEngine.getExpertiseSummary();
      const capabilities = cyrusKnowledgeEngine.getCapabilities();
      res.json({ expertise: summary, capabilities, totalDomains: Object.keys(summary).length });
    } catch (error) {
      console.error("Knowledge expertise error:", error);
      res.status(500).json({ error: "Failed to get expertise summary" });
    }
  });

  app.post("/api/cyrus/knowledge/query", async (req, res) => {
    try {
      const { domain, context, specificQuestion, urgency, classificationLevel } = req.body;
      const response = cyrusKnowledgeEngine.queryKnowledge({
        domain,
        context,
        specificQuestion,
        urgency: urgency || "tactical",
        classificationLevel: classificationLevel || "secret",
      });
      res.json(response);
    } catch (error) {
      console.error("Knowledge query error:", error);
      res.status(500).json({ error: "Failed to query knowledge base" });
    }
  });

  app.post("/api/cyrus/knowledge/tactical-analysis", async (req, res) => {
    try {
      const { situation, missionType } = req.body;
      const analysis = cyrusKnowledgeEngine.performTacticalAnalysis(situation, missionType);
      res.json(analysis);
    } catch (error) {
      console.error("Tactical analysis error:", error);
      res.status(500).json({ error: "Failed to perform tactical analysis" });
    }
  });

  app.post("/api/cyrus/knowledge/sar-guidance", async (req, res) => {
    try {
      const { lastKnownPosition, hoursElapsed } = req.body;
      const guidance = cyrusKnowledgeEngine.getSearchRescueGuidance(lastKnownPosition, hoursElapsed);
      res.json(guidance);
    } catch (error) {
      console.error("SAR guidance error:", error);
      res.status(500).json({ error: "Failed to get search and rescue guidance" });
    }
  });

  app.post("/api/cyrus/knowledge/anti-poaching", async (req, res) => {
    try {
      const { area, targetSpecies } = req.body;
      const intelligence = cyrusKnowledgeEngine.getAntiPoachingIntelligence(area, targetSpecies);
      res.json(intelligence);
    } catch (error) {
      console.error("Anti-poaching intel error:", error);
      res.status(500).json({ error: "Failed to get anti-poaching intelligence" });
    }
  });

  app.post("/api/cyrus/knowledge/border-patrol", async (req, res) => {
    try {
      const { sectorId, threatLevel } = req.body;
      const intelligence = cyrusKnowledgeEngine.getBorderPatrolIntelligence(sectorId, threatLevel);
      res.json(intelligence);
    } catch (error) {
      console.error("Border patrol intel error:", error);
      res.status(500).json({ error: "Failed to get border patrol intelligence" });
    }
  });

  app.post("/api/cyrus/knowledge/isr-guidance", async (req, res) => {
    try {
      const { targetArea, objectives } = req.body;
      const guidance = cyrusKnowledgeEngine.getISRGuidance(targetArea, objectives);
      res.json(guidance);
    } catch (error) {
      console.error("ISR guidance error:", error);
      res.status(500).json({ error: "Failed to get ISR guidance" });
    }
  });

  // ============================================================================
  // CYRUS SPECIALIZED MISSIONS
  // ============================================================================

  app.get("/api/cyrus/missions/spying-capabilities", async (req, res) => {
    try {
      const capabilities = cyrusMissionModules.getSpyingCapabilities();
      res.json(capabilities);
    } catch (error) {
      console.error("Spying capabilities error:", error);
      res.status(500).json({ error: "Failed to get spying capabilities" });
    }
  });

  app.post("/api/cyrus/missions/covert-collection", async (req, res) => {
    try {
      const { targetArea, collectionTypes } = req.body;
      const operation = cyrusMissionModules.executeCovertCollection(targetArea, collectionTypes);
      res.json(operation);
    } catch (error) {
      console.error("Covert collection error:", error);
      res.status(500).json({ error: "Failed to execute covert collection" });
    }
  });

  // ============================================================================
  // CYRUS SECURITY
  // ============================================================================

  app.get("/api/cyrus/security/status", async (req, res) => {
    try {
      const status = cyrusSecurityEngine.getSecurityStatus();
      res.json(status);
    } catch (error) {
      console.error("Security status error:", error);
      res.status(500).json({ error: "Failed to get security status" });
    }
  });

  app.get("/api/cyrus/security/events", async (req, res) => {
    try {
      const { severity, type, limit } = req.query;
      const events = cyrusSecurityEngine.getSecurityEvents({
        severity: severity as string,
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(events);
    } catch (error) {
      console.error("Security events error:", error);
      res.status(500).json({ error: "Failed to get security events" });
    }
  });

  app.post("/api/cyrus/security/verify-integrity", async (req, res) => {
    try {
      const checks = cyrusSecurityEngine.verifySystemIntegrity();
      const allValid = checks.every((c) => c.valid);
      res.json({ status: allValid ? "VERIFIED" : "COMPROMISED", checks });
    } catch (error) {
      console.error("Integrity verification error:", error);
      res.status(500).json({ error: "Failed to verify system integrity" });
    }
  });

  app.post("/api/cyrus/security/detect-intrusion", async (req, res) => {
    try {
      const { source, action, data } = req.body;
      const result = cyrusSecurityEngine.detectIntrusion(source, action, data);
      res.json(result);
    } catch (error) {
      console.error("Intrusion detection error:", error);
      res.status(500).json({ error: "Failed to run intrusion detection" });
    }
  });

  app.post("/api/cyrus/security/check-anomalies", async (req, res) => {
    try {
      const { commandRate, dataRate, errorRate } = req.body;
      const anomalies = cyrusSecurityEngine.checkForAnomalies({ commandRate, dataRate, errorRate });
      res.json({ anomalies, count: anomalies.length, hasAnomalies: anomalies.length > 0 });
    } catch (error) {
      console.error("Anomaly check error:", error);
      res.status(500).json({ error: "Failed to check for anomalies" });
    }
  });

  // ============================================================================
  // CYRUS PERSONALITY & INTERACTION
  // ============================================================================

  app.get("/api/cyrus/personality/identity", async (req, res) => {
    try {
      const identity = cyrusPersonality.getIdentity();
      res.json(identity);
    } catch (error) {
      console.error("Personality identity error:", error);
      res.status(500).json({ error: "Failed to get CYRUS personality" });
    }
  });

  app.get("/api/cyrus/personality/status", async (req, res) => {
    try {
      const status = cyrusPersonality.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Personality status error:", error);
      res.status(500).json({ error: "Failed to get CYRUS status" });
    }
  });

  app.post("/api/cyrus/personality/start-conversation", async (req, res) => {
    try {
      const { userId, missionContext } = req.body;
      const sessionId = cyrusPersonality.startConversation(userId, missionContext);
      res.json({ sessionId, message: cyrusPersonality.speak("Session initialized. I am CYRUS, ready to assist.") });
    } catch (error) {
      console.error("Start conversation error:", error);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  });

  app.post("/api/cyrus/personality/message", async (req, res) => {
    try {
      const { message, location, hasCamera, hasLocation, recentMemories, hasImage, imageData } = req.body;
      
      // Check if this is a drone scan command
      if (isScanCommand(message)) {
        try {
          const scanResult = await autonomousFlightEngine.scanForDrones();
          return res.json({ 
            response: scanResult.voiceFeedback,
            isDroneCommand: true,
            commandType: "scan",
            dronesFound: scanResult.dronesFound
          });
        } catch (error) {
          console.error("Scan error:", error);
          return res.json({ response: "I had trouble scanning for drones. Please try again.", isDroneCommand: true, error: true });
        }
      }

      // Check if this is a connect to all drones command
      if (isConnectAllCommand(message)) {
        try {
          const connectResult = await autonomousFlightEngine.connectToAllDrones();
          return res.json({ 
            response: connectResult.voiceFeedback,
            isDroneCommand: true,
            commandType: "connect_all",
            connectedDrones: connectResult.allConnected
          });
        } catch (error) {
          console.error("Connect all error:", error);
          return res.json({ response: "I had trouble connecting to all drones. Please try again.", isDroneCommand: true, error: true });
        }
      }

      // Check if this is a connect command
      if (isConnectCommand(message)) {
        try {
          const droneIdMatch = message.match(/drone[-\s]?(\d+)/i);
          const droneId = droneIdMatch ? `drone-${droneIdMatch[1]}` : "drone-2";
          const connectResult = await autonomousFlightEngine.connectToDrone(droneId);
          return res.json({ 
            response: connectResult.voiceFeedback,
            isDroneCommand: true,
            commandType: "connect",
            drone: connectResult.drone
          });
        } catch (error) {
          console.error("Connect error:", error);
          return res.json({ response: "I had trouble connecting to that drone. Please try again.", isDroneCommand: true, error: true });
        }
      }

      // Check if this is a disconnect command
      if (isDisconnectCommand(message)) {
        try {
          const droneIdMatch = message.match(/drone[-\s]?(\d+)/i);
          const droneId = droneIdMatch ? `drone-${droneIdMatch[1]}` : "drone-1";
          const disconnectResult = await autonomousFlightEngine.disconnectDrone(droneId);
          return res.json({ 
            response: disconnectResult.voiceFeedback,
            isDroneCommand: true,
            commandType: "disconnect"
          });
        } catch (error) {
          console.error("Disconnect error:", error);
          return res.json({ response: "I had trouble disconnecting. Please try again.", isDroneCommand: true, error: true });
        }
      }

      // Check if this is a list drones command
      if (isListDronesCommand(message)) {
        try {
          const connectedDrones = autonomousFlightEngine.getConnectedDrones();
          const discoveredDrones = autonomousFlightEngine.getDiscoveredDrones();
          const response = connectedDrones.length > 0 
            ? `You have ${connectedDrones.length} drones connected: ${connectedDrones.map(d => d.name).join(", ")}. ${discoveredDrones.length} total drones discovered.`
            : `No drones currently connected. ${discoveredDrones.length} drones available. Say "scan for drones" to find them.`;
          return res.json({ 
            response,
            isDroneCommand: true,
            commandType: "list",
            connectedDrones,
            discoveredDrones
          });
        } catch (error) {
          console.error("List drones error:", error);
          return res.json({ response: "I had trouble listing the drones. Please try again.", isDroneCommand: true, error: true });
        }
      }

      // Check if this is a drone control command - use autonomous flight engine
      if (isDroneCommand(message)) {
        try {
          const flightResult = await autonomousFlightEngine.processVoiceCommand(message, "drone-1");
          
          return res.json({ 
            response: flightResult.voiceFeedback,
            isDroneCommand: true,
            droneState: flightResult.realTimeData,
            mission: flightResult.mission,
            commandExecuted: flightResult.mission?.type || "flight_command",
            warnings: flightResult.warnings,
            nextAction: flightResult.nextAction
          });
        } catch (droneError) {
          console.error("Drone command error:", droneError);
          return res.json({ 
            response: "I had trouble executing that drone command. Please try again.",
            isDroneCommand: true,
            error: true
          });
        }
      }
      
      // Build enhanced context for CYRUS
      let enhancedMessage = message;
      const context: any = {};
      
      if (location) {
        context.location = location;
        enhancedMessage += `\n[Context: User's current GPS location is ${location.latitude}, ${location.longitude} with accuracy ${location.accuracy}]`;
      }
      
      if (hasCamera) {
        context.hasVision = true;
        enhancedMessage += `\n[Context: Camera is active - you can see through the user's device camera]`;
      }
      
      // If image data is provided, use GPT-4o vision
      if (hasImage && imageData) {
        context.hasImage = true;
        context.imageData = imageData; // Base64 image for vision analysis
        enhancedMessage += `\n[Context: User is sharing a live camera image with you - ANALYZE what you see and describe it naturally]`;
      }
      
      if (recentMemories && recentMemories.length > 0) {
        context.memories = recentMemories;
        enhancedMessage += `\n[Context: Recent conversation memories: ${recentMemories.join(' | ')}]`;
      }
      
      // Use OpenAI for real AI responses via async function (with vision if image provided)
      const result = await cyrusInferAsync(enhancedMessage, context);
      const response = result.result?.answer || 
        "I'm here and ready to help. What would you like to know?";
      
      res.json({ response });
    } catch (error) {
      console.error("Message processing error:", error);
      // Fallback response if OpenAI fails
      const identity = cyrusPersonality.getIdentity();
      res.json({ 
        response: `This is ${identity.designation}, your AI assistant. ` +
          `Created by ${identity.creator.name} from ${identity.creator.country}. ` +
          `All systems operational. How can I help you?`
      });
    }
  });

  app.post("/api/cyrus/personality/advisory", async (req, res) => {
    try {
      const { subject, situation } = req.body;
      const advisory = cyrusPersonality.provideAdvisory(subject, situation);
      res.json(advisory);
    } catch (error) {
      console.error("Advisory error:", error);
      res.status(500).json({ error: "Failed to provide advisory" });
    }
  });

  app.post("/api/cyrus/speak", async (req, res) => {
    try {
      const { message, urgency } = req.body;
      const response = cyrusPersonality.speak(message, urgency || "normal");
      res.json({ response });
    } catch (error) {
      console.error("Speak error:", error);
      res.status(500).json({ error: "Failed to generate CYRUS response" });
    }
  });

  // ============================================================================
  // VOICE DRONE CONTROL ENDPOINTS
  // ============================================================================

  app.post("/api/cyrus/drone/voice-command", async (req, res) => {
    try {
      const { command, droneId } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: "Voice command required" });
      }
      
      const parsedCommand = voiceDroneController.parseVoiceCommand(command);
      const result = await voiceDroneController.executeCommand(parsedCommand, droneId || "drone-1");
      
      res.json({
        command: parsedCommand,
        result,
        voiceFeedback: result.voiceFeedback
      });
    } catch (error) {
      console.error("Voice drone command error:", error);
      res.status(500).json({ 
        error: "Failed to execute drone command",
        voiceFeedback: "I encountered an error processing that command. Please try again."
      });
    }
  });

  app.get("/api/cyrus/drone/status", async (req, res) => {
    try {
      const droneId = req.query.droneId as string || "drone-1";
      const states = voiceDroneController.getAllDroneStates();
      const droneState = states.find(s => s.droneId === droneId) || states[0];
      
      res.json({
        drone: droneState,
        allDrones: states,
        commandHistory: voiceDroneController.getCommandHistory().slice(-10)
      });
    } catch (error) {
      console.error("Drone status error:", error);
      res.status(500).json({ error: "Failed to get drone status" });
    }
  });

  app.post("/api/cyrus/drone/check-path", async (req, res) => {
    try {
      const { from, to, altitude } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({ error: "From and to coordinates required" });
      }
      
      const corridor = obstacleAvoidanceSystem.checkFlightPath(from, to, altitude || 100);
      
      res.json({
        corridor,
        isSafe: corridor.isClear,
        obstacles: corridor.obstacles,
        voiceFeedback: corridor.isClear 
          ? "Flight path is clear. Safe to proceed."
          : `Warning: ${corridor.obstacles.length} obstacle(s) detected in flight path.`
      });
    } catch (error) {
      console.error("Path check error:", error);
      res.status(500).json({ error: "Failed to check flight path" });
    }
  });

  app.get("/api/cyrus/drone/obstacles", async (req, res) => {
    try {
      const obstacles = obstacleAvoidanceSystem.getKnownObstacles();
      res.json({ obstacles });
    } catch (error) {
      console.error("Obstacles fetch error:", error);
      res.status(500).json({ error: "Failed to fetch obstacles" });
    }
  });

  app.get("/api/cyrus/drone/command-history", async (req, res) => {
    try {
      const history = voiceDroneController.getCommandHistory();
      res.json({ history: history.slice(-50) });
    } catch (error) {
      console.error("Command history error:", error);
      res.status(500).json({ error: "Failed to fetch command history" });
    }
  });

  // ============================================================================
  // AUTONOMOUS FLIGHT ENGINE ENDPOINTS
  // ============================================================================

  app.post("/api/cyrus/flight/autonomous-command", async (req, res) => {
    try {
      const { command, droneId } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: "Voice command required" });
      }
      
      const result = await autonomousFlightEngine.processVoiceCommand(command, droneId || "drone-1");
      
      res.json({
        success: result.success,
        voiceFeedback: result.voiceFeedback,
        mission: result.mission,
        realTimeData: result.realTimeData,
        warnings: result.warnings,
        nextAction: result.nextAction
      });
    } catch (error) {
      console.error("Autonomous flight command error:", error);
      res.status(500).json({ 
        error: "Failed to execute autonomous flight command",
        voiceFeedback: "I encountered an error processing that command. Please try again."
      });
    }
  });

  app.get("/api/cyrus/flight/drone-state/:droneId", async (req, res) => {
    try {
      const droneState = autonomousFlightEngine.getDroneState(req.params.droneId);
      const mission = autonomousFlightEngine.getActiveMission(req.params.droneId);
      
      if (!droneState) {
        return res.status(404).json({ error: "Drone not found" });
      }
      
      res.json({
        drone: droneState,
        mission,
        allDrones: autonomousFlightEngine.getAllDrones()
      });
    } catch (error) {
      console.error("Drone state error:", error);
      res.status(500).json({ error: "Failed to get drone state" });
    }
  });

  app.get("/api/cyrus/flight/mission/:droneId", async (req, res) => {
    try {
      const mission = autonomousFlightEngine.getActiveMission(req.params.droneId);
      
      if (!mission) {
        return res.json({ mission: null, message: "No active mission" });
      }
      
      res.json({ mission });
    } catch (error) {
      console.error("Mission fetch error:", error);
      res.status(500).json({ error: "Failed to get mission" });
    }
  });

  app.get("/api/cyrus/flight/all-drones", async (req, res) => {
    try {
      const drones = autonomousFlightEngine.getAllDrones();
      res.json({ drones });
    } catch (error) {
      console.error("All drones fetch error:", error);
      res.status(500).json({ error: "Failed to get drones" });
    }
  });

  // ============================================================================
  // DRONE SCANNING & CONNECTION ENDPOINTS
  // ============================================================================

  app.post("/api/cyrus/drone/scan", async (req, res) => {
    try {
      const { radius } = req.body;
      const scanResult = await autonomousFlightEngine.scanForDrones(radius || 5000);
      res.json(scanResult);
    } catch (error) {
      console.error("Drone scan error:", error);
      res.status(500).json({ error: "Failed to scan for drones" });
    }
  });

  app.post("/api/cyrus/drone/connect", async (req, res) => {
    try {
      const { droneId } = req.body;
      
      if (!droneId) {
        return res.status(400).json({ error: "Drone ID required" });
      }
      
      const result = await autonomousFlightEngine.connectToDrone(droneId);
      res.json(result);
    } catch (error) {
      console.error("Drone connect error:", error);
      res.status(500).json({ error: "Failed to connect to drone" });
    }
  });

  app.post("/api/cyrus/drone/connect-all", async (req, res) => {
    try {
      const result = await autonomousFlightEngine.connectToAllDrones();
      res.json(result);
    } catch (error) {
      console.error("Connect all drones error:", error);
      res.status(500).json({ error: "Failed to connect to all drones" });
    }
  });

  app.post("/api/cyrus/drone/disconnect", async (req, res) => {
    try {
      const { droneId } = req.body;
      
      if (!droneId) {
        return res.status(400).json({ error: "Drone ID required" });
      }
      
      const result = await autonomousFlightEngine.disconnectDrone(droneId);
      res.json(result);
    } catch (error) {
      console.error("Drone disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect drone" });
    }
  });

  app.get("/api/cyrus/drone/discovered", async (req, res) => {
    try {
      const drones = autonomousFlightEngine.getDiscoveredDrones();
      res.json({ drones, count: drones.length });
    } catch (error) {
      console.error("Get discovered drones error:", error);
      res.status(500).json({ error: "Failed to get discovered drones" });
    }
  });

  app.get("/api/cyrus/drone/connected", async (req, res) => {
    try {
      const drones = autonomousFlightEngine.getConnectedDrones();
      res.json({ drones, count: drones.length });
    } catch (error) {
      console.error("Get connected drones error:", error);
      res.status(500).json({ error: "Failed to get connected drones" });
    }
  });

  // ============================================================================
  // REAL MAVLINK DRONE CONTROL ENDPOINTS
  // These endpoints communicate with actual drones using the MAVLink protocol
  // Supports: ArduPilot, PX4, and other MAVLink-compatible flight controllers
  // ============================================================================

  // Store active MAVLink connections
  const mavlinkConnections: Map<string, CyrusMAVLinkController> = new Map();

  // Authentication middleware for MAVLink endpoints - requires BOTH password AND biometric verification (2FA)
  // MAVLink control is a critical operation that requires dual-factor authentication
  const mavlinkAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Get session token from headers
    let token: string | null = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
    
    if (!token) {
      const sessionToken = req.headers["x-cyrus-session-token"];
      if (typeof sessionToken === "string") {
        token = sessionToken;
      }
    }

    // Development mode: allow localhost access (for testing without 2FA)
    if (process.env.NODE_ENV === "development" && !token) {
      const forwarded = req.headers["x-forwarded-for"];
      const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket.remoteAddress;
      if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
        return next();
      }
    }

    if (!token) {
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "MAVLink control requires authentication. Please login first." 
      });
    }

    const session = getSessionData(token);
    if (!session) {
      return res.status(401).json({ 
        error: "Session expired", 
        message: "Session has expired. Please login again." 
      });
    }

    // CRITICAL: Require biometric verification for MAVLink drone control (2FA enforcement)
    if (!session.biometricVerified) {
      return res.status(403).json({ 
        error: "Biometric verification required",
        message: "MAVLink drone control requires dual-factor authentication. Please complete biometric face verification first.",
        requiresBiometric: true
      });
    }

    // 2FA complete - allow MAVLink access
    return next();
  };

  app.post("/api/cyrus/mavlink/connect", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId, type, host, port, serialPath, baudRate, systemId, componentId } = req.body;
      
      const config: ConnectionConfig = {
        type: type || "udp",
        host: host || "127.0.0.1",
        port: port || 14550,
        serialPath: serialPath || "/dev/ttyACM0",
        baudRate: baudRate || 57600,
        systemId: systemId || 255,
        componentId: componentId || 0,
      };

      const id = connectionId || `mavlink-${Date.now()}`;
      const controller = new CyrusMAVLinkController(config);
      
      const result = await controller.connect();
      
      if (result.success) {
        mavlinkConnections.set(id, controller);
        
        // Set up event listeners
        controller.on("telemetry", (telemetry) => {
          console.log(`[MAVLink ${id}] Telemetry update:`, telemetry.latitude, telemetry.longitude);
        });
        
        controller.on("heartbeat", (drone) => {
          console.log(`[MAVLink ${id}] Heartbeat from ${drone.autopilotType} ${drone.vehicleType}`);
        });
      }
      
      res.json({ 
        success: result.success,
        connectionId: id,
        message: result.message,
        config: { type: config.type, host: config.host, port: config.port }
      });
    } catch (error) {
      console.error("MAVLink connect error:", error);
      res.status(500).json({ error: "Failed to establish MAVLink connection" });
    }
  });

  app.post("/api/cyrus/mavlink/disconnect", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      
      const controller = mavlinkConnections.get(connectionId);
      if (!controller) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      controller.disconnect();
      mavlinkConnections.delete(connectionId);
      
      res.json({ success: true, message: "Disconnected successfully" });
    } catch (error) {
      console.error("MAVLink disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  app.post("/api/cyrus/mavlink/arm", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.arm();
      res.json(result);
    } catch (error) {
      console.error("MAVLink arm error:", error);
      res.status(500).json({ error: "Failed to arm drone" });
    }
  });

  app.post("/api/cyrus/mavlink/disarm", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.disarm();
      res.json(result);
    } catch (error) {
      console.error("MAVLink disarm error:", error);
      res.status(500).json({ error: "Failed to disarm drone" });
    }
  });

  app.post("/api/cyrus/mavlink/takeoff", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId, altitude } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.takeoff(altitude || 10);
      res.json(result);
    } catch (error) {
      console.error("MAVLink takeoff error:", error);
      res.status(500).json({ error: "Failed to execute takeoff" });
    }
  });

  app.post("/api/cyrus/mavlink/land", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.land();
      res.json(result);
    } catch (error) {
      console.error("MAVLink land error:", error);
      res.status(500).json({ error: "Failed to execute land" });
    }
  });

  app.post("/api/cyrus/mavlink/rtl", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.returnToLaunch();
      res.json(result);
    } catch (error) {
      console.error("MAVLink RTL error:", error);
      res.status(500).json({ error: "Failed to execute return to launch" });
    }
  });

  app.post("/api/cyrus/mavlink/goto", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId, latitude, longitude, altitude } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      
      const result = await controller.gotoLocation(latitude, longitude, altitude || 50);
      res.json(result);
    } catch (error) {
      console.error("MAVLink goto error:", error);
      res.status(500).json({ error: "Failed to navigate to location" });
    }
  });

  app.post("/api/cyrus/mavlink/setmode", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId, mode } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      if (!mode) {
        return res.status(400).json({ error: "Mode required" });
      }
      
      const result = await controller.setMode(mode);
      res.json(result);
    } catch (error) {
      console.error("MAVLink setmode error:", error);
      res.status(500).json({ error: "Failed to set flight mode" });
    }
  });

  app.post("/api/cyrus/mavlink/mission/upload", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId, waypoints } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      if (!waypoints || !Array.isArray(waypoints)) {
        return res.status(400).json({ error: "Waypoints array required" });
      }
      
      const result = await controller.uploadMission(waypoints);
      res.json(result);
    } catch (error) {
      console.error("MAVLink mission upload error:", error);
      res.status(500).json({ error: "Failed to upload mission" });
    }
  });

  app.post("/api/cyrus/mavlink/mission/start", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const { connectionId } = req.body;
      const controller = mavlinkConnections.get(connectionId) || getMAVLinkController();
      
      const result = await controller.startMission();
      res.json(result);
    } catch (error) {
      console.error("MAVLink mission start error:", error);
      res.status(500).json({ error: "Failed to start mission" });
    }
  });

  app.get("/api/cyrus/mavlink/telemetry/:connectionId", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const controller = mavlinkConnections.get(req.params.connectionId);
      
      if (!controller) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      const telemetry = controller.getTelemetry();
      res.json({ telemetry, connected: controller.getConnectionStatus() });
    } catch (error) {
      console.error("MAVLink telemetry error:", error);
      res.status(500).json({ error: "Failed to get telemetry" });
    }
  });

  app.get("/api/cyrus/mavlink/discovered/:connectionId", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const controller = mavlinkConnections.get(req.params.connectionId);
      
      if (!controller) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      const drones = controller.getDiscoveredDrones();
      res.json({ drones, count: drones.length });
    } catch (error) {
      console.error("MAVLink discovered drones error:", error);
      res.status(500).json({ error: "Failed to get discovered drones" });
    }
  });

  app.get("/api/cyrus/mavlink/connections", mavlinkAuthMiddleware, async (req, res) => {
    try {
      const connections = Array.from(mavlinkConnections.entries()).map(([id, controller]) => ({
        connectionId: id,
        connected: controller.getConnectionStatus(),
        discoveredDrones: controller.getDiscoveredDrones().length,
      }));
      
      res.json({ connections, count: connections.length });
    } catch (error) {
      console.error("MAVLink connections error:", error);
      res.status(500).json({ error: "Failed to get connections" });
    }
  });

  // Get available flight modes
  app.get("/api/cyrus/mavlink/modes", mavlinkAuthMiddleware, async (req, res) => {
    try {
      res.json({
        arducopter: Object.keys(COPTER_MODES),
        common: ["STABILIZE", "ALT_HOLD", "LOITER", "AUTO", "GUIDED", "RTL", "LAND"],
        description: {
          STABILIZE: "Manual control with self-leveling",
          ALT_HOLD: "Altitude hold with manual horizontal control",
          LOITER: "GPS position hold",
          AUTO: "Follow uploaded mission waypoints",
          GUIDED: "Navigate to commanded GPS location",
          RTL: "Return to launch point",
          LAND: "Controlled descent and landing",
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get modes" });
    }
  });

  // ============================================================================
  // CYRUS DEVICE CONTROLLER - AI Assistant Device Control Interface
  // All device control endpoints require session authentication
  // ============================================================================

  app.get("/api/cyrus/device/state", fileAuthMiddleware, async (req, res) => {
    try {
      res.json(deviceController.getDeviceState());
    } catch (error) {
      console.error("Device state error:", error);
      res.status(500).json({ error: "Failed to get device state" });
    }
  });

  app.get("/api/cyrus/device/queue", fileAuthMiddleware, async (req, res) => {
    try {
      res.json(deviceController.getActionQueue());
    } catch (error) {
      console.error("Action queue error:", error);
      res.status(500).json({ error: "Failed to get action queue" });
    }
  });

  app.get("/api/cyrus/device/history", fileAuthMiddleware, async (req, res) => {
    try {
      res.json(deviceController.getExecutionHistory());
    } catch (error) {
      console.error("Execution history error:", error);
      res.status(500).json({ error: "Failed to get execution history" });
    }
  });

  app.get("/api/cyrus/device/commands", fileAuthMiddleware, async (req, res) => {
    try {
      res.json(deviceController.getSupportedCommands());
    } catch (error) {
      console.error("Supported commands error:", error);
      res.status(500).json({ error: "Failed to get supported commands" });
    }
  });

  app.get("/api/cyrus/device/clipboard/history", fileAuthMiddleware, async (req, res) => {
    try {
      res.json(deviceController.getClipboardHistory());
    } catch (error) {
      console.error("Clipboard history error:", error);
      res.status(500).json({ error: "Failed to get clipboard history" });
    }
  });

  app.post("/api/cyrus/device/execute", fileAuthMiddleware, async (req, res) => {
    try {
      const { command } = req.body;
      if (!command || typeof command !== "string") {
        return res.status(400).json({ error: "Command is required" });
      }

      const parsedCommand = deviceController.parseCommand(command);
      
      if (parsedCommand.status === "failed") {
        return res.json(parsedCommand);
      }

      const result = await deviceController.executeCommand(parsedCommand);
      res.json(result);
    } catch (error) {
      console.error("Device execute error:", error);
      res.status(500).json({ error: "Failed to execute command" });
    }
  });

  app.post("/api/cyrus/device/queue", fileAuthMiddleware, async (req, res) => {
    try {
      const { command } = req.body;
      if (!command || typeof command !== "string") {
        return res.status(400).json({ error: "Command is required" });
      }

      const parsedCommand = deviceController.parseCommand(command);
      
      if (parsedCommand.status !== "failed") {
        deviceController.queueCommand(parsedCommand);
      }

      res.json(parsedCommand);
    } catch (error) {
      console.error("Device queue error:", error);
      res.status(500).json({ error: "Failed to queue command" });
    }
  });

  app.post("/api/cyrus/device/process-queue", fileAuthMiddleware, async (req, res) => {
    try {
      const results = await deviceController.processQueue();
      res.json({ processed: results.length, results });
    } catch (error) {
      console.error("Process queue error:", error);
      res.status(500).json({ error: "Failed to process queue" });
    }
  });

  app.post("/api/cyrus/device/clear-queue", fileAuthMiddleware, async (req, res) => {
    try {
      deviceController.clearQueue();
      res.json({ success: true, message: "Queue cleared" });
    } catch (error) {
      console.error("Clear queue error:", error);
      res.status(500).json({ error: "Failed to clear queue" });
    }
  });

  app.post("/api/cyrus/device/clipboard", fileAuthMiddleware, async (req, res) => {
    try {
      const { content, format } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      deviceController.setClipboardContent(content, format || "text");
      res.json({ 
        success: true, 
        clipboard: deviceController.getClipboardContent() 
      });
    } catch (error) {
      console.error("Set clipboard error:", error);
      res.status(500).json({ error: "Failed to set clipboard" });
    }
  });

  app.post("/api/cyrus/device/screen", fileAuthMiddleware, async (req, res) => {
    try {
      const { width, height, activeWindow } = req.body;
      
      if (width && height) {
        deviceController.updateScreenSize(width, height);
      }
      if (activeWindow) {
        deviceController.setActiveWindow(activeWindow);
      }

      res.json({ 
        success: true, 
        screen: deviceController.getDeviceState().screen 
      });
    } catch (error) {
      console.error("Update screen error:", error);
      res.status(500).json({ error: "Failed to update screen settings" });
    }
  });

  // ============================================================================
  // CYRUS AUTONOMOUS AGENT - Human-like AI Device Interaction
  // All autonomous agent endpoints require session authentication
  // ============================================================================

  app.get("/api/cyrus/agent/status", fileAuthMiddleware, async (_req, res) => {
    try {
      res.json(autonomousAgent.getStatus());
    } catch (error) {
      console.error("Agent status error:", error);
      res.status(500).json({ error: "Failed to get agent status" });
    }
  });

  app.get("/api/cyrus/agent/feedback", fileAuthMiddleware, async (_req, res) => {
    try {
      res.json(autonomousAgent.getFeedbackHistory());
    } catch (error) {
      console.error("Agent feedback error:", error);
      res.status(500).json({ error: "Failed to get feedback history" });
    }
  });

  app.get("/api/cyrus/agent/history", fileAuthMiddleware, async (_req, res) => {
    try {
      res.json(autonomousAgent.getTaskHistory());
    } catch (error) {
      console.error("Agent history error:", error);
      res.status(500).json({ error: "Failed to get task history" });
    }
  });

  app.get("/api/cyrus/agent/apps", fileAuthMiddleware, async (_req, res) => {
    try {
      res.json(autonomousAgent.getAppContexts());
    } catch (error) {
      console.error("Agent apps error:", error);
      res.status(500).json({ error: "Failed to get app contexts" });
    }
  });

  app.get("/api/cyrus/agent/config", fileAuthMiddleware, async (_req, res) => {
    try {
      res.json(autonomousAgent.getBehaviorConfig());
    } catch (error) {
      console.error("Agent config error:", error);
      res.status(500).json({ error: "Failed to get behavior config" });
    }
  });

  app.post("/api/cyrus/agent/execute", fileAuthMiddleware, async (req, res) => {
    try {
      const { command } = req.body;
      if (!command || typeof command !== "string") {
        return res.status(400).json({ error: "Command is required" });
      }

      if (autonomousAgent.isAgentBusy()) {
        return res.status(409).json({ 
          error: "Agent is busy", 
          message: "Agent is currently executing another task. Please wait." 
        });
      }

      const task = await autonomousAgent.processCommand(command);
      res.json(task);
    } catch (error) {
      console.error("Agent execute error:", error);
      res.status(500).json({ error: "Failed to execute command" });
    }
  });

  app.post("/api/cyrus/agent/config", fileAuthMiddleware, async (req, res) => {
    try {
      const config = req.body;
      autonomousAgent.setBehaviorConfig(config);
      res.json({ 
        success: true, 
        config: autonomousAgent.getBehaviorConfig() 
      });
    } catch (error) {
      console.error("Agent config update error:", error);
      res.status(500).json({ error: "Failed to update behavior config" });
    }
  });

  app.post("/api/cyrus/agent/pause", fileAuthMiddleware, async (_req, res) => {
    try {
      const paused = autonomousAgent.pauseCurrentTask();
      res.json({ success: paused, message: paused ? "Task paused" : "No task to pause" });
    } catch (error) {
      console.error("Agent pause error:", error);
      res.status(500).json({ error: "Failed to pause task" });
    }
  });

  app.post("/api/cyrus/agent/register-app", fileAuthMiddleware, async (req, res) => {
    try {
      const { id, context } = req.body;
      if (!id || !context) {
        return res.status(400).json({ error: "App ID and context are required" });
      }
      autonomousAgent.registerApp(id, context);
      res.json({ success: true, message: `App ${id} registered` });
    } catch (error) {
      console.error("Agent register app error:", error);
      res.status(500).json({ error: "Failed to register app" });
    }
  });

  // SSE endpoint for real-time feedback streaming
  app.get("/api/cyrus/agent/stream", fileAuthMiddleware, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendFeedback = (feedback: any) => {
      res.write(`data: ${JSON.stringify(feedback)}\n\n`);
    };

    // Send initial status
    sendFeedback({ type: "connected", message: "Agent stream connected", timestamp: Date.now() });

    // Subscribe to feedback
    const unsubscribe = autonomousAgent.onFeedback(sendFeedback);

    // Handle client disconnect
    req.on("close", () => {
      unsubscribe();
    });
  });

  // ============================================================================
  // AUTONOMOUS TRADING ENGINE API
  // Forex/Crypto trading with AI-powered market analysis
  // ============================================================================

  app.get("/api/trading/status", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getStatus());
  });

  app.get("/api/trading/markets", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getMarketData());
  });

  app.get("/api/trading/portfolio", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getPortfolio());
  });

  app.get("/api/trading/trades", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getTrades());
  });

  app.get("/api/trading/signals", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getSignals());
  });

  app.get("/api/trading/config", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    res.json(tradingEngine.getConfig());
  });

  app.post("/api/trading/config", fileAuthMiddleware, async (req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    const config = tradingEngine.updateConfig(req.body);
    res.json(config);
  });

  app.post("/api/trading/start", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    tradingEngine.startAutonomousTrading();
    res.json({ success: true, message: "Autonomous trading started" });
  });

  app.post("/api/trading/stop", fileAuthMiddleware, async (_req, res) => {
    const { tradingEngine } = await import("./cyrus-trading-engine");
    tradingEngine.stopAutonomousTrading();
    res.json({ success: true, message: "Autonomous trading stopped" });
  });

  app.post("/api/trading/analyze", fileAuthMiddleware, async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol required" });
    }
    const { tradingEngine } = await import("./cyrus-trading-engine");
    const signal = await tradingEngine.analyzeMarketWithAI(symbol);
    res.json(signal || { message: "No trading signal generated" });
  });

  app.post("/api/trading/execute", fileAuthMiddleware, async (req, res) => {
    const { symbol, side, quantity } = req.body;
    if (!symbol || !side || !quantity) {
      return res.status(400).json({ error: "Symbol, side, and quantity required" });
    }
    const { tradingEngine } = await import("./cyrus-trading-engine");
    const signal = await tradingEngine.generateSignal(symbol);
    if (!signal) {
      return res.status(400).json({ error: "Could not generate signal for symbol" });
    }
    signal.side = side;
    const trade = await tradingEngine.executeTrade(signal, quantity);
    res.json(trade || { error: "Trade rejected by risk management" });
  });

  app.post("/api/trading/close", fileAuthMiddleware, async (req, res) => {
    const { tradeId } = req.body;
    if (!tradeId) {
      return res.status(400).json({ error: "Trade ID required" });
    }
    const { tradingEngine } = await import("./cyrus-trading-engine");
    const trade = await tradingEngine.closeTrade(tradeId);
    res.json(trade || { error: "Trade not found or already closed" });
  });

  // ============================================================================
  // AUTONOMOUS TRADING AI ENGINE
  // World events analysis, predictive analytics, strategy learning
  // ============================================================================

  app.get("/api/trading/autonomous/status", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    res.json({
      isAutonomous: autonomousTradingEngine.isAutonomous(),
      worldEventsCount: autonomousTradingEngine.getWorldEvents().length,
      strategiesCount: autonomousTradingEngine.getStrategies().length,
      decisionsCount: autonomousTradingEngine.getTradeDecisions().length,
      predictionsCount: autonomousTradingEngine.getPredictions().size
    });
  });

  app.get("/api/trading/autonomous/events", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    res.json(autonomousTradingEngine.getWorldEvents());
  });

  app.get("/api/trading/autonomous/predictions", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const predictions = autonomousTradingEngine.getPredictions();
    res.json(Array.from(predictions.entries()).map(([sym, pred]) => ({ ...pred, symbol: sym })));
  });

  app.post("/api/trading/autonomous/predict", fileAuthMiddleware, async (req, res) => {
    const { symbol, currentPrice, historicalData } = req.body;
    if (!symbol || !currentPrice) {
      return res.status(400).json({ error: "Symbol and currentPrice required" });
    }
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const prediction = await autonomousTradingEngine.generatePricePrediction(
      symbol, 
      currentPrice, 
      historicalData || []
    );
    res.json(prediction);
  });

  app.get("/api/trading/autonomous/strategies", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    res.json(autonomousTradingEngine.getStrategies());
  });

  app.post("/api/trading/autonomous/refine", fileAuthMiddleware, async (req, res) => {
    const { strategyId } = req.body;
    if (!strategyId) {
      return res.status(400).json({ error: "Strategy ID required" });
    }
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const refined = await autonomousTradingEngine.refineStrategy(strategyId);
    res.json(refined || { error: "Strategy not found" });
  });

  app.get("/api/trading/autonomous/decisions", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    res.json(autonomousTradingEngine.getTradeDecisions());
  });

  app.get("/api/trading/autonomous/analyses", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const analyses = autonomousTradingEngine.getMarketAnalyses();
    res.json(Array.from(analyses.entries()).map(([sym, analysis]) => ({ ...analysis, symbol: sym })));
  });

  app.post("/api/trading/autonomous/analyze", fileAuthMiddleware, async (req, res) => {
    const { symbol, marketData } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol required" });
    }
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const analysis = await autonomousTradingEngine.analyzeMarket(symbol, marketData || {});
    res.json(analysis);
  });

  app.post("/api/trading/autonomous/start", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    const { tradingEngine } = await import("./cyrus-trading-engine");
    
    autonomousTradingEngine.startAutonomousTrading(async (decision) => {
      console.log(`[AutonomousTrade] ${decision.action.toUpperCase()} ${decision.symbol} @ ${decision.entryPrice}`);
      
      if (decision.confidence >= 0.6) {
        const isCrypto = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOT", "LINK", "AVAX"].some(c => decision.symbol.includes(c));
        const stopLossDiff = Math.abs(decision.entryPrice - decision.stopLoss);
        const takeProfitDiff = Math.abs(decision.takeProfit - decision.entryPrice);
        const riskRewardRatio = stopLossDiff > 0 ? takeProfitDiff / stopLossDiff : 2.0;
        
        const strategyType = autonomousTradingEngine.getStrategyForSignal(decision.strategyUsed);
        
        const signal = {
          id: `sig_${Date.now()}`,
          symbol: decision.symbol,
          type: isCrypto ? "crypto" as const : "forex" as const,
          side: decision.action === "buy" ? "buy" as const : "sell" as const,
          strength: decision.confidence,
          confidence: decision.confidence * 100,
          strategy: strategyType as "scalping" | "swing" | "trend_following" | "mean_reversion" | "breakout",
          entryPrice: decision.entryPrice,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          riskRewardRatio,
          reasoning: decision.reasoning,
          timestamp: Date.now()
        };
        await tradingEngine.executeTrade(signal, decision.quantity);
      }
    });
    
    res.json({ success: true, message: "Autonomous trading started" });
  });

  app.post("/api/trading/autonomous/stop", fileAuthMiddleware, async (_req, res) => {
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    autonomousTradingEngine.stopAutonomousTrading();
    res.json({ success: true, message: "Autonomous trading stopped" });
  });

  app.post("/api/trading/autonomous/outcome", fileAuthMiddleware, async (req, res) => {
    const { decisionId, outcome, actualProfit } = req.body;
    if (!decisionId || !outcome) {
      return res.status(400).json({ error: "Decision ID and outcome required" });
    }
    const { autonomousTradingEngine } = await import("./cyrus-autonomous-trading");
    autonomousTradingEngine.recordTradeOutcome(decisionId, outcome, actualProfit || 0);
    res.json({ success: true });
  });

  // ============================================================================
  // ADVANCED TRADING INTELLIGENCE API
  // Enhanced autonomous decision-making, risk management, and self-learning
  // ============================================================================

  app.get("/api/trading/intelligence/status", fileAuthMiddleware, async (_req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    res.json(advancedTradingIntelligence.getStatus());
  });

  app.get("/api/trading/intelligence/circuit-breakers", fileAuthMiddleware, async (_req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    res.json(advancedTradingIntelligence.getCircuitBreakers());
  });

  app.post("/api/trading/intelligence/circuit-breakers/:id/reset", fileAuthMiddleware, async (req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    const success = advancedTradingIntelligence.resetCircuitBreaker(req.params.id);
    if (success) {
      res.json({ success: true, message: "Circuit breaker reset" });
    } else {
      res.status(404).json({ error: "Circuit breaker not found" });
    }
  });

  app.get("/api/trading/intelligence/compliance", fileAuthMiddleware, async (_req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    res.json(advancedTradingIntelligence.getComplianceRules());
  });

  app.get("/api/trading/intelligence/learning-metrics", fileAuthMiddleware, async (_req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    res.json(advancedTradingIntelligence.getLearningMetrics());
  });

  app.get("/api/trading/intelligence/environment", fileAuthMiddleware, async (_req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    res.json(advancedTradingIntelligence.getEnvironmentalAwareness());
  });

  app.get("/api/trading/intelligence/decisions", fileAuthMiddleware, async (req, res) => {
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(advancedTradingIntelligence.getRecentDecisions(limit));
  });

  app.post("/api/trading/intelligence/learning", fileAuthMiddleware, async (req, res) => {
    const { enabled } = req.body;
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    advancedTradingIntelligence.setLearningEnabled(enabled);
    res.json({ success: true, learningEnabled: enabled });
  });

  app.post("/api/trading/intelligence/update-environment", fileAuthMiddleware, async (req, res) => {
    const { marketData, worldEvents } = req.body;
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    advancedTradingIntelligence.updateEnvironmentalAwareness(marketData || {}, worldEvents || []);
    res.json(advancedTradingIntelligence.getEnvironmentalAwareness());
  });

  app.post("/api/trading/intelligence/check-compliance", fileAuthMiddleware, async (req, res) => {
    const { symbol, side, size, portfolioValue, openPositions, recentTrades } = req.body;
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    const result = advancedTradingIntelligence.checkCompliance({
      symbol,
      side,
      size,
      portfolioValue,
      openPositions: openPositions || [],
      recentTrades: recentTrades || []
    });
    res.json(result);
  });

  app.post("/api/trading/intelligence/make-decision", fileAuthMiddleware, async (req, res) => {
    const { symbol, marketData, prediction, strategies, portfolio } = req.body;
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    const decision = await advancedTradingIntelligence.makeAutonomousDecision(
      symbol,
      marketData || {},
      prediction || {},
      strategies || [],
      portfolio || {}
    );
    res.json(decision);
  });

  app.post("/api/trading/intelligence/learn-outcome", fileAuthMiddleware, async (req, res) => {
    const { decision, outcome } = req.body;
    if (!decision || !outcome) {
      return res.status(400).json({ error: "Decision and outcome required" });
    }
    const { advancedTradingIntelligence } = await import("./cyrus-advanced-trading-intelligence");
    await advancedTradingIntelligence.learnFromOutcome(decision, outcome);
    res.json({ success: true, message: "Outcome recorded for learning" });
  });

  // ============================================================================
  // DESIGN SOFTWARE AUTOMATION API
  // Autonomous operation of creative applications
  // ============================================================================

  app.get("/api/design/status", fileAuthMiddleware, async (_req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    res.json(designAutomation.getStatus());
  });

  app.get("/api/design/software", fileAuthMiddleware, async (_req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    res.json(designAutomation.getSoftwareStatus());
  });

  app.get("/api/design/templates", fileAuthMiddleware, async (_req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    res.json(designAutomation.getTemplates());
  });

  app.get("/api/design/tasks", fileAuthMiddleware, async (_req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    res.json(designAutomation.getTasks());
  });

  app.get("/api/design/tasks/:taskId", fileAuthMiddleware, async (req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    const task = designAutomation.getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(task);
  });

  app.get("/api/design/config", fileAuthMiddleware, async (_req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    res.json(designAutomation.getConfig());
  });

  app.post("/api/design/config", fileAuthMiddleware, async (req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    const config = designAutomation.updateConfig(req.body);
    res.json(config);
  });

  app.post("/api/design/parse", fileAuthMiddleware, async (req, res) => {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: "Input required" });
    }
    const { designAutomation } = await import("./cyrus-design-automation");
    const task = await designAutomation.parseNaturalLanguageTask(input);
    res.json(task || { error: "Could not parse design task" });
  });

  app.post("/api/design/execute", fileAuthMiddleware, async (req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    
    if (req.body.templateId) {
      const task = designAutomation.createTaskFromTemplate(req.body.templateId, req.body.customizations);
      if (!task) {
        return res.status(400).json({ error: "Template not found" });
      }
      const result = await designAutomation.executeTask(task);
      return res.json(result);
    }
    
    if (req.body.input) {
      const task = await designAutomation.parseNaturalLanguageTask(req.body.input);
      if (!task) {
        return res.status(400).json({ error: "Could not parse design task" });
      }
      const result = await designAutomation.executeTask(task);
      return res.json(result);
    }
    
    return res.status(400).json({ error: "Either templateId or input required" });
  });

  app.post("/api/design/queue", fileAuthMiddleware, async (req, res) => {
    const { designAutomation } = await import("./cyrus-design-automation");
    const task = await designAutomation.parseNaturalLanguageTask(req.body.input);
    if (!task) {
      return res.status(400).json({ error: "Could not parse design task" });
    }
    await designAutomation.queueTask(task);
    res.json({ success: true, taskId: task.id, message: "Task queued for processing" });
  });

  return httpServer;
}
