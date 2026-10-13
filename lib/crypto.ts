import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { isSupabaseConfigured } from "@/lib/data/config";

/**
 * Encrypts secrets (Discord OAuth tokens) before they're stored. AES-256-GCM,
 * with the owner's user id bound in as additional authenticated data, so a
 * ciphertext copied onto another person's row simply fails to decrypt.
 *
 * TOKEN_ENCRYPTION_KEY: 32 random bytes as hex (64 chars) or base64.
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Required whenever Supabase is configured. For local development only, a key
 * is derived from SESSION_SECRET so the dev store works without extra setup.
 */
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex characters, or base64).");
    return key;
  }
  if (isSupabaseConfigured() || process.env.NODE_ENV === "production") {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set.");
  }
  return createHash("sha256").update(`dev-token-key:${process.env.SESSION_SECRET ?? "dev"}`).digest();
}

export function encryptSecret(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(payload: string, aad: string): string {
  const [version, iv, tag, ct] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognized encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
