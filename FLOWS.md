# WhatsApp Flows (form mode)

By default waflow runs a **step-by-step conversation** (list → budget → timeline → name). If you'd rather send **one native form** — with a **multi-select** service picker, exactly like the website brief — switch on **form mode** with a WhatsApp Flow.

|  | Conversational (default) | Form mode (Flows) |
|--|--------------------------|-------------------|
| Service selection | one at a time (list) | **multi-select** ✅ |
| Screens | several messages | **one form** |
| Setup | none | publish a Flow once |
| Handoff on submit | — | `nfm_reply` → lead |

---

## 1. Publish the Flow (once, ~5 min)

1. Meta **WhatsApp Manager → Flows → Create Flow**.
2. Name it (e.g. *Fennr Brief*), category **Lead generation / Sign up**.
3. Choose **"Build from scratch"**, then open the **Endpoint / JSON editor** and **paste the contents of [`flows/brief-flow.json`](./flows/brief-flow.json)**.
   - It has one screen `BRIEF` with a **CheckboxGroup** (multi-select services), two **RadioButtonsGroup** (budget, timeline), a **TextInput** (name), and a **Footer** that completes the flow.
   - No endpoint is required — it's a **static** flow; the answers come back to your webhook on submit.
4. **Publish**. Copy the **Flow ID** shown in the Flows list.

## 2. Turn on form mode

Set the id in your environment and redeploy:

```bash
WHATSAPP_FLOW_ID=1234567890123456
```

That's it. When set, `createBot()` calls `bot.useForm(fennrForm(...))` automatically. Now:

- Any inbound message → the bot sends the **"Start your brief"** button that opens the form.
- The user multi-selects services, picks budget + timeline, types their name, taps **Send brief**.
- On submit you get a `nfm_reply` webhook; waflow maps it to a lead (services → `interests[]`) and fires `onLead` → your unified CRM (`source = "whatsapp"`), then sends a confirmation with your Calendly link.

## 3. What the submission looks like

The Footer's `complete` payload sends back:

```json
{
  "services": ["web", "logo"],
  "budget": "50k-1L",
  "timeline": "asap",
  "name": "Asha Traders"
}
```

`mapBriefResponse` flattens `services` to `"web,logo"`; the Fennr CRM handler expands it to `["Web Development", "Logo & Identity"]` so it renders in `/admin` just like a website brief.

## Customizing the form

Edit `flows/brief-flow.json` (choices, labels, add fields), re-publish in WhatsApp Manager, and — if you added fields — extend `mapBriefResponse` in `src/flows/fennrForm.ts`. Field limits: a screen title ≤ 30 chars, option titles ≤ 30, and inputs must live inside a `Form`.

## Notes & caveats

- **Static vs dynamic:** this uses a **static** flow (no endpoint, no encryption keys). If you later need server-driven screens (e.g. availability that changes per user), that's "data-exchange" mode — it requires a signed endpoint with an RSA key pair. Not needed here.
- **Testing:** WhatsApp Manager → your Flow → **Preview** sends a test to your own number.
- **Number:** Flows require the number to be on the Cloud API (same as the rest of waflow).
