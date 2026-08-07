# waflow

A small, **config-driven WhatsApp Cloud API flow engine**. Define a conversation as data — waflow verifies the webhook, drives the state machine, sends interactive **list / button** messages, captures the answers, and hands you a completed **lead**.

It's the open, self-hosted core that tools like AiSensy / Interakt / Wati wrap in a paid dashboard. If all you need is *"reply to inbound leads with a menu, qualify them, and book a call,"* this is ~600 lines you fully own.

- 🧩 **Config-driven** — a flow is a typed object (`Flow`). No engine changes to add a business.
- 🔐 **Secure by default** — verifies `X-Hub-Signature-256` over the raw body (timing-safe).
- 🗄️ **Pluggable storage** — in-memory out of the box; Supabase adapter included; bring your own via the `Store` interface.
- ⚡ **Portable** — plain TypeScript + [Hono](https://hono.dev). Runs on Node, Vercel, Cloudflare Workers, Bun.
- ✅ **Tested** — the engine and signature verification have unit tests.

---

## How it works

```
WhatsApp user ──▶ Meta Cloud API ──▶ POST /webhook ──▶ Bot.handleWebhook()
                                                          │
                             verify signature ── parse ── FlowEngine.step()
                                                          │
                             persist state (Store) ── send replies (WhatsAppClient)
                                                          │
                                            on completion ── onLead(lead)
```

The engine is a **pure state machine**: given the stored conversation and the user's input, it returns the messages to send and the next state. It does no I/O, so it's trivial to test and reason about.

## Cost

For an **inbound** bot this is effectively free. Meta makes all messages within the **24-hour customer-service window free** (and 72 hours for Click-to-WhatsApp ad chats). You only pay for business-*initiated* template messages (India: ~₹0.35 utility / ~₹0.85 marketing each), which this flow doesn't send.

---

## Quick start

```bash
npm install
cp .env.example .env      # fill in the WhatsApp values (see below)
npm run dev               # starts on http://localhost:3000
```

Then expose it publicly (e.g. `ngrok http 3000`) and point your Meta webhook at `https://<host>/webhook`.

### Run the tests / typecheck

```bash
npm test
npm run typecheck
```

---

## Meta setup (one time)

1. **Create an app** at [developers.facebook.com](https://developers.facebook.com) → *Business* type → add the **WhatsApp** product.
2. In **WhatsApp → API Setup**, note your **Phone number ID** and generate an access token. For production, create a **System User** token (never expires) with `whatsapp_business_messaging` + `whatsapp_business_management`.
3. **App Secret**: *App → Settings → Basic → App Secret* → `WHATSAPP_APP_SECRET`.
4. **Register your phone number** to the Cloud API. ⚠️ Once registered, that number is **API-only** — it can no longer be used in the WhatsApp / WhatsApp Business phone app. Use a **dedicated number** for the bot.
5. **Configure the webhook**: *WhatsApp → Configuration → Webhook* →
   - **Callback URL:** `https://<your-host>/webhook`
   - **Verify token:** the same random string you put in `WHATSAPP_VERIFY_TOKEN`
   - **Subscribe** to the **`messages`** field.

That's it — message the number and the flow starts.

## Configuration

All via environment variables (validated at boot — see `src/config.ts`):

| Var | Required | Notes |
|-----|----------|-------|
| `WHATSAPP_TOKEN` | ✅ | Access token (System User token for prod) |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ | The **ID**, not the phone number |
| `WHATSAPP_APP_SECRET` | ✅ | Used to verify webhook signatures |
| `WHATSAPP_VERIFY_TOKEN` | ✅ | Any random string; matches the Meta webhook config |
| `WHATSAPP_API_VERSION` | – | Defaults to `v22.0` |
| `STORAGE` | – | `memory` (default) or `supabase` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | when `supabase` | Run `sql/schema.sql` first |
| `CALENDLY_URL`, `PORTFOLIO_URL` | – | Used by the bundled Fennr flow |

---

## Defining your own flow

A flow is just data. Copy `src/flows/fennr.ts` and change the copy/choices:

```ts
import type { Flow } from "waflow";

export const flow: Flow = {
  id: "acme",
  start: "service",
  steps: {
    service: {
      type: "choice", render: "list", button: "View services",
      body: "Hi! What are you after?",
      store: "service", next: "budget",
      choices: [
        { id: "web",  title: "A website", aliases: ["1"] },
        { id: "logo", title: "A logo",    aliases: ["2"] },
      ],
    },
    budget: {
      type: "choice", render: "buttons",   // ≤3 options → tappable buttons
      body: "Rough budget?",
      store: "budget", next: "name",
      choices: [
        { id: "s", title: "Under ₹50k" },
        { id: "m", title: "₹50k–2L" },
        { id: "l", title: "₹2L+" },
      ],
    },
    name: { type: "text", body: "Your name & business?", store: "name", next: "done" },
    done: {
      type: "message", end: true,
      body: (d) => `Thanks ${d.name}! We'll be in touch. 🙌`,
    },
  },
};
```

Step types:

- **`choice`** — renders an interactive **list** (up to 10 rows) or **buttons** (up to 3). The user's pick is matched by tapped id, exact title, a typed **number**, or an **alias**. Stored under `store`.
- **`text`** — asks a question and captures the free-text reply.
- **`message`** — sends text and auto-advances (or `end: true` to finish). `body` can be a function of the collected data.

`next` can be a string or `(data) => stepId` for branching.

## Embedding in your own server

Skip the bundled server and use the `Bot` directly:

```ts
import { Bot, loadConfig, createStore } from "waflow";
import { flow } from "./flow.js";

const cfg = loadConfig();
const bot = new Bot(cfg, await createStore(cfg), flow);
bot.onLead(async (lead) => { /* email it, push to your CRM, notify Slack… */ });

// In your POST /webhook handler (raw body!):
if (!bot.verify(rawBody, signatureHeader)) return res.status(401).end();
await bot.handleWebhook(JSON.parse(rawBody));
```

## Human handoff

waflow qualifies and captures — it is **not** a full team inbox. When a lead completes (or types something off-menu you want to catch), use `onLead` / your logs to get notified, then reply from Meta's **WhatsApp Manager** inbox or a lightweight inbox of your own. A shared team inbox is the main thing the paid BSPs add on top.

## Project layout

```
src/
  config.ts            env validation (zod)
  bot.ts               orchestrator: verify → parse → engine → persist → send
  server.ts            reference Hono server (thin)
  flow/
    types.ts           Flow / Step / Conversation types
    engine.ts          the pure state machine
  flows/fennr.ts       example flow (service → budget → timeline → name → book)
  whatsapp/
    types.ts           outgoing + normalized inbound message types
    client.ts          Cloud API client (list / buttons / text / read receipts)
  webhook/
    verify.ts          X-Hub-Signature-256 + GET handshake
    parse.ts           raw webhook → normalized inbound messages
  store/
    types.ts memory.ts supabase.ts factory.ts
sql/schema.sql         Supabase tables (STORAGE=supabase)
test/                  engine + signature tests
```

## License

MIT — see [LICENSE](./LICENSE).
