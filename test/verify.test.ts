import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature, verifySubscription } from "../src/webhook/verify.js";

const SECRET = "test_app_secret";
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

describe("verifySignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ hello: "world", emoji: "🙂" });
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifySignature(body + " ", sign(body), SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifySignature("{}", undefined, SECRET)).toBe(false);
    expect(verifySignature("{}", "nope", SECRET)).toBe(false);
    expect(verifySignature("{}", "sha256=zzzz", SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const body = "{}";
    expect(verifySignature(body, sign(body), "other_secret")).toBe(false);
  });
});

describe("verifySubscription", () => {
  it("echoes the challenge on a valid handshake", () => {
    expect(verifySubscription({ mode: "subscribe", token: "tok", challenge: "123" }, "tok")).toBe("123");
  });
  it("rejects a wrong token", () => {
    expect(verifySubscription({ mode: "subscribe", token: "bad", challenge: "123" }, "tok")).toBeNull();
  });
});
