import { describe, expect, it } from "vitest";
import { mapBriefResponse } from "../src/flows/fennrForm.js";
import { toLeadRow } from "../src/integrations/fennrCrm.js";
import { parseInbound } from "../src/webhook/parse.js";

describe("WhatsApp Flow form mode", () => {
  it("maps a multi-select submission to flat lead data", () => {
    const data = mapBriefResponse({
      services: ["web", "logo", "seo"], // CheckboxGroup → array
      budget: "1L-3L",
      timeline: "asap",
      name: "Asha Traders",
    });
    expect(data).toEqual({ services: "web,logo,seo", budget: "1L-3L", timeline: "asap", name: "Asha Traders" });
  });

  it("also accepts a JSON-string array (defensive)", () => {
    const data = mapBriefResponse({ services: '["web","brand"]', budget: "unsure", timeline: "exploring", name: "X" });
    expect(data.services).toBe("web,brand");
  });

  it("turns multi-select services into a CRM interests[] of labels", () => {
    const row = toLeadRow({
      from: "919876543210",
      data: mapBriefResponse({ services: ["web", "logo"], budget: "50k-1L", timeline: "asap", name: "Asha" }),
      completedAt: Date.now(),
    });
    expect(row).toMatchObject({
      interests: ["Web Development", "Logo & Identity"],
      budget: "₹50k – ₹1L",
      timeline: "ASAP",
      phone: "+919876543210",
      source: "whatsapp",
    });
  });

  it("parses a Flow submission (nfm_reply) from a webhook", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "919876543210", profile: { name: "Asha" } }],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.1",
                    timestamp: "1700000000",
                    type: "interactive",
                    interactive: {
                      type: "nfm_reply",
                      nfm_reply: {
                        name: "flow",
                        response_json: JSON.stringify({ services: ["web"], budget: "50k-1L", timeline: "asap", name: "Asha Traders" }),
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const [msg] = parseInbound(payload);
    expect(msg?.flowResponse).toMatchObject({ services: ["web"], budget: "50k-1L", name: "Asha Traders" });
    expect(msg?.name).toBe("Asha");
  });
});
