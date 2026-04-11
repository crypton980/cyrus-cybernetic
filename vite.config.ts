import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = process.env.CYRUS_UI_ROOT
  ? path.resolve(__dirname, process.env.CYRUS_UI_ROOT)
  : path.resolve(__dirname, "client");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(uiRoot, "src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  root: uiRoot,
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
});
