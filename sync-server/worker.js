/**
 * Threadmark sync server (Cloudflare Worker).
 *
 * Stores one encrypted library per sync code. The library is encrypted on the reader's
 * device before it arrives here; this server never sees the sync code or the contents.
 *
 * Setup: bind a KV namespace to this Worker with the variable name VAULTS.
 *
 * API
 *   GET    /v1/vault/:id   -> { rev, data }            (404 if none)
 *   PUT    /v1/vault/:id   body { rev, data } -> { rev } (409 if rev is out of date)
 *   DELETE /v1/vault/:id   -> { ok: true }
 *   GET    /               -> health check
 * Every vault request needs "Authorization: Bearer <token>". The first upload sets the
 * token (only its SHA-256 hash is stored); later requests must present the same token.
 */
const MAX_BYTES = 20 * 1024 * 1024;
const ID_RE = /^[0-9a-f]{64}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400"
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") return json({ ok: true, service: "threadmark-sync", version: 1 });

    const m = url.pathname.match(/^\/v1\/vault\/([^/]+)$/);
    if (!m) return json({ error: "Not found" }, 404);
    const id = m[1];
    if (!ID_RE.test(id)) return json({ error: "Bad vault id" }, 400);
    if (!env.VAULTS) return json({ error: "Server not set up: KV namespace VAULTS is not bound" }, 500);

    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (token.length < 20) return json({ error: "Missing token" }, 401);
    const tokenHash = await sha256(token);

    const key = "v:" + id;
    const record = await env.VAULTS.get(key, "json");
    if (record && !same(record.h, tokenHash)) return json({ error: "Forbidden" }, 403);

    if (request.method === "GET") {
      if (!record) return json({ error: "No vault" }, 404);
      return json({ rev: record.rev, data: record.data, at: record.at });
    }

    if (request.method === "PUT") {
      const len = Number(request.headers.get("Content-Length") || 0);
      if (len > MAX_BYTES) return json({ error: "Library too large to sync" }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
      if (!body || typeof body.data !== "string" || typeof body.rev !== "number") return json({ error: "Bad body" }, 400);
      if (body.data.length > MAX_BYTES) return json({ error: "Library too large to sync" }, 413);
      const current = record ? record.rev : 0;
      if (body.rev !== current) return json({ error: "Out of date", rev: current }, 409);
      const next = { h: tokenHash, rev: current + 1, at: Date.now(), data: body.data };
      await env.VAULTS.put(key, JSON.stringify(next));
      return json({ rev: next.rev });
    }

    if (request.method === "DELETE") {
      if (record) await env.VAULTS.delete(key);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  }
};
