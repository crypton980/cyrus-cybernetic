/**
 * AES-256-GCM encryption helpers for API keys at rest.
 *
 * ENCRYPTION_SECRET — 64-char hex key (32 raw bytes).  Falls back to a
 * deterministic dev-only value so the server still starts without the env
 * var, but production deployments must set it.
 *
 * Format of ciphertext stored in DB:
 *   <hex-iv>:<hex-authTag>:<hex-ciphertext>
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

function resolveKey(): Buffer {
  const raw = process.env.ENCRYPTION_SECRET;

  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_SECRET must be set in production. " +
          "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    // Development fallback: derive a stable key from the session secret so
    // that encrypted values survive server restarts in local development.
    // This is NOT secure — ENCRYPTION_SECRET must be set in production.
    const devBase = process.env.SESSION_SECRET || "cyrus-dev-insecure-fallback";
    console.warn("[Encryption] ENCRYPTION_SECRET not set — using dev-mode derived key. Set ENCRYPTION_SECRET in production.");
    return crypto.createHash("sha256").update(devBase).digest();
  }

  if (raw.length === 64) {
    // Hex-encoded 32-byte key (preferred)
    return Buffer.from(raw, "hex");
  }

  if (raw.length >= 32) {
    // Raw string key — use first 32 bytes
    return Buffer.from(raw, "utf8").slice(0, 32);
  }

  throw new Error(
    "ENCRYPTION_SECRET must be at least 32 characters or a 64-character hex string."
  );
}

/**
 * Encrypt a plaintext string.
 * Returns a string safe to persist in the database.
 */
export function encrypt(plaintext: string): string {
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a ciphertext produced by `encrypt()`.
 * Returns the original plaintext, or null if decryption fails.
 * If the value does not contain ":" separators it is treated as a legacy
 * plaintext value (backward-compatible with keys stored before encryption
 * was introduced).
 */
export function decrypt(ciphertext: string): string | null {
  if (!ciphertext.includes(":")) {
    // Not an encrypted value — treat as plaintext (backward-compat).
    return ciphertext;
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encryptedHex] = parts;

  try {
    const key = resolveKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // Tampered or corrupted ciphertext
    return null;
  }
}

/**
 * Returns true if the value looks like it was produced by `encrypt()`.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2;
}
