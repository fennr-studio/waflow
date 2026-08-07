import { describe, expect, it } from "vitest";
import { toLeadRow } from "../src/integrations/fennrCrm.js";

describe("fennrCrm.toLeadRow", () => {
  it("maps flow ids to the website's human labels", () => {
    const row = toLeadRow({
      from: "919876543210",
      name: "Asha Traders",
      data: { service: "logo", budget: "50k-1L", timeline: "asap", name: "Asha Traders" },
      completedAt: Date.now(),
    });
    expect(row).toMatchObject({
      name: "Asha Traders",
      email: null,
      phone: "+919876543210",
      interests: ["Logo & Identity"],
      budget: "₹50k – ₹1L",
      timeline: "ASAP",
      source: "whatsapp",
    });
  });

  it("degrades gracefully on missing/unknown fields", () => {
    const row = toLeadRow({ from: "+91 90000 11111", data: {}, completedAt: Date.now() });
    expect(row).toMatchObject({
      name: "WhatsApp lead",
      phone: "+919000011111", // normalized to E.164
      interests: null,
      budget: null,
      timeline: null,
      source: "whatsapp",
    });
  });
});
