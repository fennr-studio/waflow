import { loadConfig } from "@/src/config";
import { createBot } from "@/src/createBot";
import { verifySubscription } from "@/src/webhook/verify";

// Always run on the Node runtime (node:crypto), never cache, allow a few
// seconds to send replies.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Memoize the bot across warm invocations.
let botPromise: ReturnType<typeof createBot> | undefined;
function getBot() {
  return (botPromise ??= createBot(loadConfig()));
}

// GET → Meta's subscription handshake.
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const challenge = verifySubscription(
    {
      mode: url.searchParams.get("hub.mode") ?? undefined,
      token: url.searchParams.get("hub.verify_token") ?? undefined,
      challenge: url.searchParams.get("hub.challenge") ?? undefined,
    },
    loadConfig().WHATSAPP_VERIFY_TOKEN,
  );
  return challenge ? new Response(challenge, { status: 200 }) : new Response("Forbidden", { status: 403 });
}

// POST → inbound messages. Verify the signature over the RAW body, then process.
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

  await bot.handleWebhook(payload);
  return new Response("EVENT_RECEIVED", { status: 200 });
}
