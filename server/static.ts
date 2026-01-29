import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, we run from dist/server/index.js, so public is at ../public
  // In development, we run from server/, so public is at ../dist/public
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = isProduction
    ? path.resolve(import.meta.dirname, "..", "public")
    : path.resolve(import.meta.dirname, "..", "dist", "public");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
