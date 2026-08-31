import { createHash, randomBytes } from "node:crypto";

export function sha256Hex(input: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashPublicToken(token: string): string {
  return sha256Hex(token);
}
