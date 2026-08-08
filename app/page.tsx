"use client";

import { useEffect, useState } from "react";

const REPO = "https://github.com/fennr-studio/waflow";

const FEATURES = [
  { title: "Two modes", body: "Step-by-step chat, or one native multi-select WhatsApp Flow form." },
  { title: "Secure", body: "Verifies X-Hub-Signature-256 over the raw body, timing-safe." },
  { title: "Config-driven", body: "A conversation is typed data — no engine changes to add a business." },
  { title: "Unified CRM", body: "Completed leads land in your existing leads table." },
];

const STEPS = [
  "User messages your number → the service menu is sent.",
  "They pick service · budget · timeline and share their name.",
  "The lead lands in your CRM and they get a booking link.",
];

export default function Home() {
  const [status, setStatus] = useState<"checking" | "ok" | "bad">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setStatus(d?.ok ? "ok" : "bad"))
      .catch(() => setStatus("bad"));
  }, []);

  return (
    <div className="wrap">
      <header>
        <div className="topbar">
          <div className="brand">
            <span className="mark">w</span>
            <span>waflow</span>
          </div>
          <span className="status">
            <span className={`dot ${status === "ok" ? "ok" : status === "bad" ? "bad" : ""}`} />
            <span>{status === "checking" ? "checking…" : status === "ok" ? "Online" : "Offline"}</span>
          </span>
        </div>
      </header>

      <main>
        <p className="eyebrow">WhatsApp Cloud API</p>
        <h1>
          A config-driven <span className="it">flow engine</span> for WhatsApp.
        </h1>
        <p className="lede">
          Verify webhooks, drive a typed state machine, send interactive lists / buttons / Flows, and
          capture qualified leads — straight into your CRM. The open, self-hosted core of a WhatsApp
          lead bot.
        </p>

        <div className="btns">
          <a className="btn primary" href={REPO} target="_blank" rel="noopener noreferrer">
            View on GitHub →
          </a>
          <a className="btn ghost" href={`${REPO}/blob/main/README.md`} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <a className="btn ghost" href="/api/health">
            Health
          </a>
        </div>

        <div className="grid">
          {FEATURES.map((f) => (
            <div className="card" key={f.title}>
              <h3>
                <span className="k">◆</span> {f.title}
              </h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <div className="flow">
          {STEPS.map((s, i) => (
            <div className="step" key={i}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </main>

      <footer>
        Built by{" "}
        <a href="https://www.fennrstudio.com" target="_blank" rel="noopener noreferrer">
          Fennr Studio
        </a>{" "}
        · MIT licensed ·{" "}
        <a href={REPO} target="_blank" rel="noopener noreferrer">
          fennr-studio/waflow
        </a>
      </footer>
    </div>
  );
}
