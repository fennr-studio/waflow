import { describe, expect, it } from "vitest";
import { FlowEngine } from "../src/flow/engine.js";
import type { Conversation } from "../src/flow/types.js";
import { fennrFlow } from "../src/flows/fennr.js";

const flow = fennrFlow({ calendlyUrl: "https://cal.test/x", portfolioUrl: "https://site.test" });
const engine = new FlowEngine(flow);

/** Helper: apply an input to a conversation and return the outcome. */
function step(conv: Conversation | undefined, input: { replyId?: string; text?: string; name?: string }) {
  return engine.step(conv, input);
}

describe("FlowEngine — Fennr flow", () => {
  it("greets on first contact with the service list", () => {
    const out = step(undefined, { name: "Asha" });
    expect(out.completed).toBe(false);
    expect(out.conversation.step).toBe("service");
    expect(out.messages[0]?.kind).toBe("list");
  });

  it("walks the full happy path via tapped ids", () => {
    let conv = bind(step(undefined, {}).conversation, "919000000001");

    conv = advance(conv, { replyId: "logo" }, "budget");
    conv = advance(conv, { replyId: "50k-1L" }, "timeline");
    conv = advance(conv, { replyId: "asap" }, "name");

    const done = step(conv, { text: "Asha Traders" });
    expect(done.completed).toBe(true);
    expect(done.conversation.data).toMatchObject({
      service: "logo",
      budget: "50k-1L",
      timeline: "asap",
      name: "Asha Traders",
    });
    // Final message contains the Calendly link.
    const last = done.messages.at(-1);
    expect(last?.kind).toBe("text");
    expect(last && "body" in last ? last.body : "").toContain("cal.test");
  });

  it("accepts typed numbers and aliases as choices", () => {
    let conv = bind(step(undefined, {}).conversation, "919000000002");
    conv = advance(conv, { text: "1" }, "budget"); // "1" → Web Development
    expect(conv.data.service).toBe("web");
    conv = advance(conv, { text: "b" }, "timeline"); // "b" → ₹50k–1L
    expect(conv.data.budget).toBe("50k-1L");
  });

  it("re-prompts on an unrecognized choice without advancing", () => {
    const conv = bind(step(undefined, {}).conversation, "919000000003");
    const out = step(conv, { text: "banana" });
    expect(out.completed).toBe(false);
    expect(out.conversation.step).toBe("service"); // stayed put
    expect(out.messages[0]?.kind).toBe("text"); // fallback nudge
    expect(out.messages[1]?.kind).toBe("list"); // re-rendered options
  });
});

// ---- helpers ----
function bind(conv: Conversation, from: string): Conversation {
  return { ...conv, from };
}
function advance(conv: Conversation, input: { replyId?: string; text?: string }, expectedStep: string): Conversation {
  const out = step(conv, input);
  expect(out.conversation.step).toBe(expectedStep);
  return { ...out.conversation, from: conv.from };
}
