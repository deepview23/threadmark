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
 *   POST   /v1/subscribe        body { email, list, consent, source, website } -> { ok }
 *   GET    /v1/unsubscribe?id=  -> confirmation page
 *   POST   /v1/feedback         body { name, email, quote, rating, book, publish, website } -> { ok }
 *   POST   /v1/license/verify   body { key } -> { valid, reason }
 *   GET    /v1/admin/export?type=subscribers|feedback   (Authorization: Bearer ADMIN_TOKEN) -> CSV
 * Settings (Worker → Settings → Variables): ADMIN_TOKEN (secret), LICENSE_PROVIDER ("gumroad" or
 * "lemonsqueezy"), GUMROAD_PRODUCT_ID or LEMON_PRODUCT_ID, OWNER_KEYS (comma-separated keys that
 * always unlock, e.g. for yourself).
 * Every vault request needs "Authorization: Bearer <token>". The first upload sets the
 * token (only its SHA-256 hash is stored); later requests must present the same token.
 */
const MAX_BYTES = 20 * 1024 * 1024;
const ID_RE = /^[0-9a-f]{64}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    if (url.pathname === "/v1/subscribe" && request.method === "POST") return subscribe(request, env);
    if (url.pathname === "/v1/unsubscribe") return unsubscribe(url, env);
    if (url.pathname === "/v1/feedback" && request.method === "POST") return feedback(request, env);
    if (url.pathname === "/v1/license/verify" && request.method === "POST") return verifyLicense(request, env);
    if (url.pathname.startsWith("/v1/admin/")) return admin(request, url, env);

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


/* ---------------- sign-ups, feedback, licences, admin ---------------- */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
async function readJson(request, max = 20000) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > max) return null;
  try { return await request.json(); } catch { return null; }
}

async function subscribe(request, env) {
  if (!env.VAULTS) return json({ error: "Server not set up" }, 500);
  const b = await readJson(request);
  if (!b) return json({ error: "Bad request" }, 400);
  if (b.website) return json({ ok: true }); // honeypot: bots fill hidden fields
  const email = clean(b.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (b.consent !== true) return json({ error: "Please tick the box to agree to emails." }, 400);
  const list = clean(b.list, 40) || "classics";
  const id = (await sha256("sub:" + email)).slice(0, 32);
  const key = "sub:" + id;
  const prev = await env.VAULTS.get(key, "json");
  const lists = Array.from(new Set([...(prev?.lists || []), list]));
  const rec = { email, lists, source: clean(b.source, 120), at: prev?.at || Date.now(), updated: Date.now(), id };
  await env.VAULTS.put(key, JSON.stringify(rec), { metadata: { email, lists: lists.join("|"), at: rec.at } });
  return json({ ok: true, id });
}

async function unsubscribe(url, env) {
  const id = (url.searchParams.get("id") || "").replace(/[^0-9a-f]/g, "").slice(0, 32);
  if (id && env.VAULTS) await env.VAULTS.delete("sub:" + id);
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><body style="font:17px/1.6 system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#152030"><h1 style="font-family:Georgia,serif">You're unsubscribed.</h1><p>You won't get any more emails from Threadmark. Sorry to see you go.</p></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } });
}

async function feedback(request, env) {
  if (!env.VAULTS) return json({ error: "Server not set up" }, 500);
  const b = await readJson(request);
  if (!b) return json({ error: "Bad request" }, 400);
  if (b.website) return json({ ok: true });
  const quote = clean(b.quote, 1200);
  if (quote.length < 10) return json({ error: "Please write a sentence or two." }, 400);
  const email = clean(b.email, 254).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return json({ error: "That email address doesn't look right." }, 400);
  const rec = { name: clean(b.name, 80), email, quote, book: clean(b.book, 120), rating: Math.max(0, Math.min(5, Number(b.rating) || 0)), publish: b.publish === true, at: Date.now() };
  const key = "fb:" + Date.now().toString(36) + ":" + crypto.randomUUID().slice(0, 8);
  await env.VAULTS.put(key, JSON.stringify(rec), { metadata: { name: rec.name, publish: rec.publish, at: rec.at } });
  return json({ ok: true });
}

async function verifyLicense(request, env) {
  const b = await readJson(request, 4000);
  const key = clean(b?.key, 200);
  if (!key) return json({ valid: false, reason: "Please enter your licence key." }, 400);
  const owners = (env.OWNER_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (owners.includes(key)) return json({ valid: true, reason: "owner" });
  const provider = (env.LICENSE_PROVIDER || "").toLowerCase();
  try {
    if (provider === "gumroad") {
      if (!env.GUMROAD_PRODUCT_ID) return json({ valid: false, reason: "Licences aren't set up yet." }, 503);
      const r = await fetch("https://api.gumroad.com/v2/licenses/verify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ product_id: env.GUMROAD_PRODUCT_ID, license_key: key, increment_uses_count: "false" }) });
      const j = await r.json().catch(() => ({}));
      const p = j.purchase || {};
      if (j.success && !p.refunded && !p.disputed && !p.chargebacked) return json({ valid: true });
      return json({ valid: false, reason: j.success ? "This purchase was refunded or disputed." : "That licence key wasn't recognised." });
    }
    if (provider === "lemonsqueezy") {
      const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ license_key: key }) });
      const j = await r.json().catch(() => ({}));
      const productOk = !env.LEMON_PRODUCT_ID || String(j.meta?.product_id) === String(env.LEMON_PRODUCT_ID);
      if (j.valid && productOk && j.license_key?.status !== "disabled" && j.license_key?.status !== "expired") return json({ valid: true });
      return json({ valid: false, reason: "That licence key wasn't recognised." });
    }
    return json({ valid: false, reason: "Licences aren't set up yet." }, 503);
  } catch {
    return json({ valid: false, reason: "Couldn't reach the licence service. Try again in a minute." }, 502);
  }
}

const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function admin(request, url, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (url.searchParams.get("token") || "");
  if (!env.ADMIN_TOKEN || !same(await sha256(token), await sha256(env.ADMIN_TOKEN))) return json({ error: "Forbidden" }, 403);
  if (url.pathname !== "/v1/admin/export") return json({ error: "Not found" }, 404);
  const type = url.searchParams.get("type") === "feedback" ? "feedback" : "subscribers";
  const prefix = type === "feedback" ? "fb:" : "sub:";
  const rows = [];
  let cursor;
  do {
    const page = await env.VAULTS.list({ prefix, cursor, limit: 1000 });
    for (const k of page.keys) { const v = await env.VAULTS.get(k.name, "json"); if (v) rows.push(v); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const cols = type === "feedback" ? ["at", "name", "email", "book", "rating", "publish", "quote"] : ["at", "email", "lists", "source", "id"];
  const out = [cols.join(",")].concat(rows.map((r) => cols.map((c) => csvCell(c === "at" ? new Date(r.at).toISOString() : Array.isArray(r[c]) ? r[c].join("|") : r[c])).join(","))).join("\n");
  return new Response(out, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="threadmark-${type}.csv"`, "Cache-Control": "no-store", ...CORS } });
}
