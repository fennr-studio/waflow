import { verifySubscription } from "../src/webhook/verify.js";
import { getBot, verifyToken } from "./_app.js";

/**
 * Vercel serverless webhook. Uses the Web-handler signature so we get the
 * RAW request body via `request.text()` (required for signature verification;
 * the legacy (req,res) handler would auto-parse and break it).
 *
 * Routed at /api/webhook. Point your Meta webhook Callback URL there.
 */

// GET → Meta's subscription handshake.
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const challenge = verifySubscription(
    {
      mode: url.searchParams.get("hub.mode") ?? undefined,
      token: url.searchParams.get("hub.verify_token") ?? undefined,
      challenge: url.searchParams.get("hub.challenge") ?? undefined,
    },
    verifyToken(),
  );
  return challenge ? new Response(challenge, { status: 200 }) : new Response("Forbidden", { status: 403 });
}

// POST → inbound messages. Verify signature over the raw body, then process.
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const bot = await getBot();

  if (!bot.verify(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // On serverless we must finish before returning (no reliable background work).
  // Sending 1–3 messages is well within Meta's webhook timeout.
  await bot.handleWebhook(payload);
  return new Response("EVENT_RECEIVED", { status: 200 });
}
