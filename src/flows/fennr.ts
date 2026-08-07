import type { Flow } from "../flow/types.js";

/**
 * Fennr Studio's lead-qualification flow, mirroring the website brief form:
 *   service → budget → timeline → name → book a call.
 *
 * This is just data. Copy it, change the copy/choices, and you have a
 * different business's bot with zero engine changes.
 */
export function fennrFlow(opts: { calendlyUrl: string; portfolioUrl: string }): Flow {
  return {
    id: "fennr",
    start: "service",
    fallback: "No worries — just tap an option from the list above, or reply with its number. 🙂",
    steps: {
      service: {
        type: "choice",
        render: "list",
        header: "Fennr Studio",
        body: "Hi! 👋 Thanks for reaching out to Fennr Studio. What are you looking for?",
        footer: "Pick the one that fits best",
        button: "View services",
        store: "service",
        next: "budget",
        choices: [
          { id: "web", title: "Web Development", description: "Site, WhatsApp, payments, API", aliases: ["1", "website"] },
          { id: "logo", title: "Logo & Identity", description: "Logo systems, brand boards", aliases: ["2", "branding"] },
          { id: "seo", title: "SEO & Visibility", description: "Search, analytics, rankings", aliases: ["3"] },
          { id: "photo", title: "Photography", description: "Product, food, spaces", aliases: ["4"] },
          { id: "design", title: "Graphic Design", description: "Social, print, campaigns", aliases: ["5"] },
          { id: "brand", title: "Brand Strategy", description: "Positioning, naming, moodboards", aliases: ["6"] },
          { id: "ai", title: "AI & Strategy", description: "Automation, analytics, research", aliases: ["7"] },
        ],
      },
      budget: {
        type: "choice",
        render: "list",
        body: "Great choice 🙌 A rough budget helps me prescribe the right tier — no pressure.",
        button: "Select budget",
        store: "budget",
        next: "timeline",
        choices: [
          { id: "under50k", title: "Under ₹50k", aliases: ["a", "1"] },
          { id: "50k-1L", title: "₹50k – ₹1L", aliases: ["b", "2"] },
          { id: "1L-3L", title: "₹1L – ₹3L", aliases: ["c", "3"] },
          { id: "3L+", title: "₹3L+", aliases: ["d", "4"] },
          { id: "unsure", title: "Not sure yet", aliases: ["e", "5"] },
        ],
      },
      timeline: {
        type: "choice",
        render: "list",
        body: "And roughly when are you looking to start?",
        button: "Select timeline",
        store: "timeline",
        next: "name",
        choices: [
          { id: "asap", title: "ASAP", aliases: ["1"] },
          { id: "1-3m", title: "1–3 months", aliases: ["2"] },
          { id: "3-6m", title: "3–6 months", aliases: ["3"] },
          { id: "exploring", title: "Just exploring", aliases: ["4"] },
        ],
      },
      name: {
        type: "text",
        body: "Perfect. Last thing — what's your name and business name? I'll put together a tailored plan. 🙂",
        store: "name",
        next: "done",
      },
      done: {
        type: "message",
        end: true,
        body: (data) =>
          `Thanks${firstWord(data.name) ? `, ${firstWord(data.name)}` : ""}! 🙌 I've got what I need — I'll come back with a plan shortly.\n\n` +
          `Want to fast-track it? Grab a free 15-minute call here:\n${opts.calendlyUrl}\n\n` +
          `Meanwhile, our work: ${opts.portfolioUrl}`,
      },
    },
  };
}

function firstWord(s: string | undefined): string {
  return (s ?? "").trim().split(/\s+/)[0] ?? "";
}
