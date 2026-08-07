import type { FormFlow } from "../bot.js";
import type { FlowData } from "../flow/types.js";

/**
 * Form-mode counterpart of the Fennr flow: sends the published WhatsApp Flow
 * (see flows/brief-flow.json) and maps the submission to lead data.
 *
 * The Flow's multi-select `services` (CheckboxGroup) comes back as an array of
 * ids; we join them so downstream (the CRM handler) turns them into an
 * `interests[]` of labels.
 */
export function fennrForm(opts: { flowId: string; calendlyUrl: string; portfolioUrl: string }): FormFlow {
  return {
    flowId: opts.flowId,
    screen: "BRIEF",
    cta: "Start your brief",
    body: "Hi! 👋 Thanks for reaching out to Fennr Studio. Tap below to tell us what you need — it takes about 30 seconds.",
    map: mapBriefResponse,
    done: (d) =>
      `Thanks${firstWord(d.name) ? `, ${firstWord(d.name)}` : ""}! 🙌 We've got your brief and will come back with a plan.\n\n` +
      `Want to fast-track it? Book a free 15-minute call:\n${opts.calendlyUrl}\n\n` +
      `Our work: ${opts.portfolioUrl}`,
  };
}

/** Exported for testing: Flow submission → flat lead data. */
export function mapBriefResponse(r: Record<string, unknown>): FlowData {
  return {
    services: toIdList(r.services), // e.g. "web,logo"
    budget: str(r.budget),
    timeline: str(r.timeline),
    name: str(r.name),
  };
}

/** CheckboxGroup values arrive as an array (or, defensively, a CSV/JSON string). */
function toIdList(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(",");
  const s = str(v).trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).join(",");
    } catch {
      /* fall through */
    }
  }
  return s;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function firstWord(s: string | undefined): string {
  return (s ?? "").trim().split(/\s+/)[0] ?? "";
}
