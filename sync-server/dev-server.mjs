// Runs the sync Worker locally with in-memory storage, for testing: node sync-server/dev-server.mjs [port]
import http from "node:http";
import worker from "./worker.js";
const mem = new Map();
const env = { ADMIN_TOKEN: process.env.ADMIN_TOKEN || "", LICENSE_PROVIDER: process.env.LICENSE_PROVIDER || "", OWNER_KEYS: process.env.OWNER_KEYS || "", VAULTS: {
  async get(k, type) { const v = mem.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
  async put(k, v) { mem.set(k, v); },
  async list({ prefix = "", cursor, limit = 1000 } = {}) { const keys = [...mem.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })); return { keys, list_complete: true }; },
  async delete(k) { mem.delete(k); }
} };
const port = Number(process.argv[2] || 8787);
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request("http://localhost:" + port + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log("threadmark sync dev server on " + port));
