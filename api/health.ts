// Simple uptime check at /api/health.
export function GET(): Response {
  return new Response(JSON.stringify({ ok: true, service: "waflow" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
