import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a WhatsApp webhook POST using the `X-Hub-Signature-256` header.
 *
 * Meta signs the **raw** request body with HMAC-SHA256 keyed by your App
 * Secret. You MUST compute the HMAC over the exact bytes received, before
 * any JSON parsing, or the signature will not match.
 *
 * Skipping this check lets anyone POST spoofed messages to your endpoint.
 */
export function verifySignature(rawBody: string, header: string | undefined | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) {
    // Constant-time even on the mismatch path.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Handle the GET verification handshake Meta performs when you register the
 * webhook. Returns the challenge string to echo back, or null to reject.
 */
export function verifySubscription(
  query: { mode?: string; token?: string; challenge?: string },
  verifyToken: string,
): string | null {
  if (query.mode === "subscribe" && query.token === verifyToken && query.challenge) {
    return query.challenge;
  }
  return null;
}
