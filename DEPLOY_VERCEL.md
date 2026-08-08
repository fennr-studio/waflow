# Deploying waflow to Vercel

Vercel is serverless, so two things are non-negotiable:

1. **`STORAGE=supabase`** — in-memory state is lost between invocations. Conversation state must be durable.
2. The webhook runs as a **Web-handler function** at `/api/webhook` (already wired in `api/webhook.ts`) so signature verification sees the raw body.

Everything below is one-time setup. Budget ~20 minutes.

---

## 0. Prerequisites

- A **dedicated phone number** for the bot (not your personal WhatsApp — once it's on the Cloud API it can't be used in the phone app).
- A **Meta app** with the WhatsApp product (see the main README → *Meta setup*), giving you: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`.
- Your **Supabase** project (the same one the website uses, for a unified CRM).

## 1. Prepare Supabase

In the **Supabase SQL editor**, run:

1. `sql/schema.sql` (from this repo) — creates `wa_conversations` for durable state.
2. `supabase-migration-3.sql` (from the **website** repo) — makes `leads.email` nullable so WhatsApp leads save.

Grab from **Project Settings → API**:
- `SUPABASE_URL` (Project URL)
- `SUPABASE_SERVICE_ROLE_KEY` (service_role secret — server-only)

## 2. Import the repo into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `fennr-studio/waflow`
   (grant Vercel access to the **fennr-studio** org if it isn't listed).
2. Vercel **auto-detects Next.js** — leave **Framework Preset = Next.js** and **Root Directory = `./`**. No build config needed.
3. Don't deploy yet — add env vars first (next step).

## 3. Set Environment Variables

In the Vercel project → **Settings → Environment Variables**, add (Production):

| Key | Value |
|-----|-------|
| `WHATSAPP_TOKEN` | your access token |
| `WHATSAPP_PHONE_NUMBER_ID` | the phone number **ID** |
| `WHATSAPP_APP_SECRET` | app secret |
| `WHATSAPP_VERIFY_TOKEN` | any random string you invent (used in step 5) |
| `WHATSAPP_API_VERSION` | `v22.0` (optional) |
| `STORAGE` | `supabase` ← **required on Vercel** |
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `CRM_LEADS_TABLE` | `leads` |
| `CALENDLY_URL` | `https://calendly.com/fennrstudio/15min` |
| `PORTFOLIO_URL` | `https://www.fennrstudio.com` |

Then **Deploy**. Your URLs will be:
- Health: `https://<project>.vercel.app/api/health`
- Webhook: `https://<project>.vercel.app/api/webhook`

Hit `/api/health` in a browser — you should see `{"ok":true,"service":"waflow"}`.

## 4. (Recommended) Use a custom subdomain

In Vercel → **Domains**, add e.g. `bot.fennrstudio.com`. It keeps the webhook URL stable and on-brand. Then use `https://bot.fennrstudio.com/api/webhook` below.

## 5. Point Meta at the webhook

Meta app → **WhatsApp → Configuration → Webhook → Edit**:

- **Callback URL:** `https://<project>.vercel.app/api/webhook`
- **Verify token:** the same string you set as `WHATSAPP_VERIFY_TOKEN`
- Click **Verify and save** (Meta calls `GET /api/webhook` — the function echoes the challenge).
- Under **Webhook fields**, **Subscribe** to **`messages`**.

## 6. Test it

From any phone, message your bot number **"hi"**. You should get the service menu, walk through budget → timeline → name, and get the Calendly link. Then check:

- **Supabase → `leads`** (or your `/admin`): a new row with `source = whatsapp`. ✅
- **Vercel → your project → Logs**: `🎉 lead from …`.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Meta "Verify and save" fails | `WHATSAPP_VERIFY_TOKEN` in Vercel must exactly match the token typed in Meta. Redeploy after changing env vars. |
| `401 Invalid signature` in logs | `WHATSAPP_APP_SECRET` is wrong, or a proxy altered the body. Copy the secret from *App → Settings → Basic*. |
| Replies never arrive | Check `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`; look at the function logs for the WhatsApp API error text. |
| Leads not in `/admin` | Did you run `supabase-migration-3.sql` (nullable email)? Are the Supabase env vars set? |
| State resets mid-conversation | `STORAGE` isn't `supabase`, or `sql/schema.sql` wasn't run. |
| Function timeout | Rare; `vercel.json` sets `maxDuration: 15`. Only the send calls run per message. |

## Notes

- **Cost:** replies within the 24-hour service window are free; this bot never sends paid templates. Vercel's free/hobby tier is plenty for this traffic.
- **Env var changes require a redeploy** to take effect.
- Prefer a long-running host instead? The bundled `src/server.ts` runs anywhere Node runs (Railway/Fly/Render) with `STORAGE=memory` — no Vercel-specific pieces needed.
