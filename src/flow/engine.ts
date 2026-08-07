import type { OutgoingMessage } from "../whatsapp/types.js";
import type {
  Choice,
  ChoiceStep,
  Conversation,
  Flow,
  FlowData,
  MessageStep,
  Step,
  StepOutcome,
  UserInput,
} from "./types.js";

const DEFAULT_FALLBACK = "Sorry, I didn't catch that — please pick one of the options above. 🙂";

/**
 * A pure, storage-agnostic state machine. Given a flow, the current
 * conversation (or none), and the user's input, it returns the messages to
 * send and the next conversation state. It performs no I/O — the caller
 * persists state and sends messages. That keeps it trivial to unit-test.
 */
export class FlowEngine {
  constructor(private readonly flow: Flow) {
    if (!flow.steps[flow.start]) {
      throw new Error(`Flow "${flow.id}" start step "${flow.start}" does not exist`);
    }
  }

  /**
   * Advance the conversation by one user input.
   * @param existing  the stored conversation, or undefined for a first contact
   * @param input     the normalized user input
   */
  step(existing: Conversation | undefined, input: UserInput): StepOutcome {
    // First contact → greet by entering the start step.
    if (!existing) {
      return this.enter(this.freshConversation(input.name ? { _name: input.name } : {}), this.flow.start);
    }

    const conv: Conversation = { ...existing, data: { ...existing.data } };
    const current = this.flow.steps[conv.step];

    // If state points at an unknown step (e.g. flow changed), restart cleanly.
    if (!current) return this.enter(conv, this.flow.start);

    if (current.type === "choice") {
      const picked = matchChoice(current, input);
      if (!picked) {
        return { messages: [{ kind: "text", body: this.flow.fallback ?? DEFAULT_FALLBACK }, this.renderStep(current)], conversation: touch(conv), completed: false };
      }
      if (current.store) conv.data[current.store] = picked.value ?? picked.id;
      return this.enter(conv, this.resolveNext(current, conv.data));
    }

    if (current.type === "text") {
      const value = (input.text ?? "").trim();
      if (!value) {
        return { messages: [this.renderStep(current)], conversation: touch(conv), completed: false };
      }
      if (current.store) conv.data[current.store] = value;
      return this.enter(conv, this.resolveNext(current, conv.data));
    }

    // A message step never waits for input; if we somehow receive one, re-enter.
    return this.enter(conv, conv.step);
  }

  /** Enter `stepId`, emitting its message(s) and chaining through message steps. */
  private enter(conv: Conversation, stepId: string): StepOutcome {
    const messages: OutgoingMessage[] = [];
    let current = conv.step;
    let cursor = stepId;
    let completed = false;

    // Walk forward: a `message` step with a `next` auto-advances; a `choice`
    // or `text` step stops and waits for the user.
    // Guard against accidental infinite loops in a misconfigured flow.
    for (let hops = 0; hops < 25; hops++) {
      const step = this.flow.steps[cursor];
      if (!step) break;
      current = cursor;
      messages.push(this.renderStep(step, conv.data));

      if (step.type === "message") {
        if (step.end) {
          completed = true;
          break;
        }
        const nxt = this.resolveNext(step, conv.data);
        if (!nxt || nxt === cursor) break;
        cursor = nxt;
        continue;
      }
      // choice/text: wait for the user's reply here.
      break;
    }

    conv.step = current;
    return { messages, conversation: touch(conv), completed };
  }

  private renderStep(step: Step, data: FlowData = {}): OutgoingMessage {
    switch (step.type) {
      case "text":
        return { kind: "text", body: step.body };
      case "message":
        return { kind: "text", body: typeof step.body === "function" ? step.body(data) : step.body, previewUrl: true };
      case "choice":
        return this.renderChoice(step);
    }
  }

  private renderChoice(step: ChoiceStep): OutgoingMessage {
    if (step.render === "buttons") {
      return {
        kind: "buttons",
        body: step.body,
        header: step.header,
        footer: step.footer,
        buttons: step.choices.slice(0, 3).map((c) => ({ id: c.id, title: c.title })),
      };
    }
    return {
      kind: "list",
      body: step.body,
      header: step.header,
      footer: step.footer,
      button: step.button ?? "Choose",
      sections: [{ rows: step.choices.slice(0, 10).map((c) => ({ id: c.id, title: c.title, description: c.description })) }],
    };
  }

  private resolveNext(step: Step, data: FlowData): string {
    const n = (step as MessageStep).next ?? (step as ChoiceStep).next;
    if (!n) return "";
    return typeof n === "function" ? n(data) : n;
  }

  private freshConversation(data: FlowData): Conversation {
    return { from: "", step: this.flow.start, data, updatedAt: Date.now() };
  }
}

/** Match a user's input to a choice: by tapped id, exact title, or alias/number. */
function matchChoice(step: ChoiceStep, input: UserInput): Choice | undefined {
  if (input.replyId) {
    const byId = step.choices.find((c) => c.id === input.replyId);
    if (byId) return byId;
  }
  const raw = (input.text ?? "").trim().toLowerCase();
  if (!raw) return undefined;

  // typed number → nth option ("1", "2", ...)
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= step.choices.length) {
    return step.choices[asNum - 1];
  }
  return step.choices.find(
    (c) =>
      c.id.toLowerCase() === raw ||
      c.title.toLowerCase() === raw ||
      (c.aliases ?? []).some((a) => a.toLowerCase() === raw),
  );
}

function touch(conv: Conversation): Conversation {
  conv.updatedAt = Date.now();
  return conv;
}
