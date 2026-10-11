import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM at rest for CalendarConnection.accessToken/refreshToken
 * (ARCHITECTURE.md §11). CALENDAR_TOKEN_ENCRYPTION_KEY is a base64-encoded
 * 32-byte key; each value gets its own random IV, stored alongside the
 * ciphertext and auth tag as `iv:tag:ciphertext` (all base64).
 */
function getKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(packed: string): string {
  const [ivB64, tagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !tagB64 || !ciphertextB64) throw new Error("Malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
