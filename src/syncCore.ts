/**
 * Threadmark sync, pure parts: change stamps, merging, sync codes and encryption.
 * Nothing here talks to the network or the UI, so it can be tested on its own.
 *
 * How merging works
 * - Every item (character, relationship, event, place, faction, note) carries `_u`,
 *   the time it was last changed on any device.
 * - Deleting an item leaves a tombstone (`tomb[id] = time`), so a deletion on one
 *   device is not undone by the other device's older copy.
 * - Book-level details (title, progress, settings) carry `metaAt`.
 * - Two copies of a book merge item by item: the newer version of each item wins.
 *   So editing different things on the Mac and iPhone, even offline, keeps both edits.
 */
import type { Atlas } from "./types";

export const LISTS = ["characters", "relationships", "events", "places", "factions", "notes"] as const;
type ListKey = (typeof LISTS)[number];
type Item = { id: string; _u?: number; createdAt?: number };
export type Tombs = Record<string, number>;
export interface Lib { atlases: Atlas[]; atlasTomb: Tombs }

const TOMB_KEEP_MS = 180 * 24 * 3600 * 1000;

const stripU = (o: any) => { const { _u, ...r } = o; return JSON.stringify(r); };
function metaOf(a: any) {
  const { characters, relationships, events, places, factions, notes, tomb, updatedAt, openedAt, metaAt, ...r } = a;
  return JSON.stringify(r);
}
export function maxMerge(a: Tombs = {}, b: Tombs = {}): Tombs {
  const out: Tombs = { ...a };
  for (const [k, v] of Object.entries(b)) if (!(k in out) || v > out[k]) out[k] = v;
  return out;
}
function prune(t: Tombs, nowMs: number): Tombs {
  const out: Tombs = {};
  for (const [k, v] of Object.entries(t)) if (nowMs - v < TOMB_KEEP_MS) out[k] = v;
  return out;
}

/**
 * Marks what changed between `prev` and `next` (next is modified in place).
 * Returns true if anything that should sync changed.
 */
export function stamp(prev: Atlas | null, next: Atlas, t = Date.now()): boolean {
  let changed = false;
  const n = next as any, p = prev as any;
  n.tomb = maxMerge(p?.tomb, n.tomb);
  for (const L of LISTS) {
    const before = new Map<string, Item>((p?.[L] || []).map((x: Item) => [x.id, x]));
    const nowIds = new Set<string>();
    for (const item of n[L] as Item[]) {
      nowIds.add(item.id);
      const old = before.get(item.id);
      if (!old || stripU(old) !== stripU(item)) { item._u = t; changed = true; }
      else if (old._u != null) item._u = old._u;
    }
    for (const old of before.values()) if (!nowIds.has(old.id)) { n.tomb[old.id] = t; changed = true; }
  }
  if (!p || metaOf(p) !== metaOf(n)) { n.metaAt = t; changed = true; }
  else n.metaAt = p.metaAt;
  return changed;
}

/** When was anything in this book last edited (ignores just opening it). */
export function lastEdit(a: Atlas): number {
  let m = (a as any).metaAt || 0;
  for (const L of LISTS) for (const it of (a as any)[L] as Item[]) if ((it._u || 0) > m) m = it._u!;
  return m || a.createdAt || 0;
}

const byCreated = (x: Item, y: Item) => ((x.createdAt || 0) - (y.createdAt || 0)) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

/** Merge two copies of the same book. `a` is the local copy; it wins exact ties. */
export function mergeAtlas(a: Atlas, b: Atlas, nowMs = Date.now()): Atlas {
  const A = a as any, B = b as any;
  const tomb = prune(maxMerge(A.tomb, B.tomb), nowMs);
  const base = (B.metaAt || 0) > (A.metaAt || 0) ? B : A;
  const out: any = {};
  for (const [k, v] of Object.entries(base)) if (!(LISTS as readonly string[]).includes(k)) out[k] = v;
  for (const L of LISTS) {
    const m = new Map<string, Item>();
    for (const it of A[L] as Item[]) m.set(it.id, it);
    for (const it of B[L] as Item[]) { const cur = m.get(it.id); if (!cur || (it._u || 0) > (cur._u || 0)) m.set(it.id, it); }
    out[L] = [...m.values()].filter((it) => !(it.id in tomb) || (it._u || 0) > tomb[it.id]).sort(byCreated);
  }
  out.tomb = tomb;
  out.metaAt = Math.max(A.metaAt || 0, B.metaAt || 0);
  out.updatedAt = Math.max(A.updatedAt || 0, B.updatedAt || 0);
  out.openedAt = Math.max(A.openedAt || 0, B.openedAt || 0);
  return out as Atlas;
}

/** Merge two whole libraries (all books). */
export function mergeLib(local: Lib, remote: Lib | null, nowMs = Date.now()): Lib {
  if (!remote) return { atlases: [...local.atlases].sort(byCreated as any), atlasTomb: prune(local.atlasTomb, nowMs) };
  const atlasTomb = prune(maxMerge(local.atlasTomb, remote.atlasTomb), nowMs);
  const m = new Map<string, Atlas>();
  for (const x of local.atlases) m.set(x.id, x);
  for (const r of remote.atlases) { const l = m.get(r.id); m.set(r.id, l ? mergeAtlas(l, r, nowMs) : r); }
  const atlases = [...m.values()].filter((x) => !(x.id in atlasTomb) || lastEdit(x) > atlasTomb[x.id]).sort(byCreated as any);
  return { atlases, atlasTomb };
}

/** Stable JSON (sorted keys) so two equal libraries always compare equal. */
export function canon(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}

/* ---------------- sync codes ---------------- */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I: easy to read aloud and type
export function newSyncCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(20));
  const s = Array.from(b, (x) => ALPHA[x & 31]).join(""); // 20 chars × 5 bits = 100 bits
  return s.match(/.{4}/g)!.join("-");
}
export function normCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 20 || [...s].some((c) => !ALPHA.includes(c))) return null;
  return s.match(/.{4}/g)!.join("-");
}

/* ---------------- encryption ---------------- */
const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
export function toB64(u: Uint8Array): string {
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + CH)));
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const b64url = (b: ArrayBuffer) => toB64(new Uint8Array(b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export interface Keys { vaultId: string; auth: string; key: CryptoKey }
/** Everything is derived from the sync code. The server only ever sees vaultId, auth and scrambled data. */
export async function deriveKeys(code: string): Promise<Keys> {
  const base = await crypto.subtle.importKey("raw", enc(code.replace(/-/g, "")), "HKDF", false, ["deriveBits", "deriveKey"]);
  const salt = enc("threadmark-sync-v1");
  const bits = (info: string) => crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc(info) }, base, 256);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: enc("encryption-key") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { vaultId: hex(await bits("vault-id")), auth: b64url(await bits("auth-token")), key };
}

async function pipe(data: Uint8Array, stream: any): Promise<Uint8Array> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const canZip = () => typeof (globalThis as any).CompressionStream === "function" && typeof (globalThis as any).DecompressionStream === "function";

/** Format: [1 version][1 flags: 1 = gzip][12 iv][ciphertext], base64. */
export async function seal(lib: Lib, key: CryptoKey): Promise<string> {
  let body = enc(JSON.stringify({ v: 1, ...lib }));
  let flags = 0;
  if (canZip()) { body = await pipe(body, new (globalThis as any).CompressionStream("gzip")); flags = 1; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body));
  const out = new Uint8Array(2 + 12 + ct.length);
  out[0] = 1; out[1] = flags; out.set(iv, 2); out.set(ct, 14);
  return toB64(out);
}
export async function unseal(data: string, key: CryptoKey): Promise<Lib> {
  const u = fromB64(data);
  if (u[0] !== 1) throw new Error("This library was synced by a newer version of Threadmark. Please update the app.");
  const iv = u.subarray(2, 14), ct = u.subarray(14);
  let body: Uint8Array;
  try { body = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)); }
  catch { throw new Error("Couldn't unlock the synced library with this code."); }
  if (u[1] & 1) {
    if (!canZip()) throw new Error("This browser is too old to read the synced library. Please update it.");
    body = await pipe(body, new (globalThis as any).DecompressionStream("gzip"));
  }
  const j = JSON.parse(new TextDecoder().decode(body));
  return { atlases: Array.isArray(j.atlases) ? j.atlases : [], atlasTomb: j.atlasTomb || {} };
}
