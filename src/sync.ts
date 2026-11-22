/**
 * Threadmark sync engine: keeps this device's library in step with the encrypted copy on the sync server.
 *
 * - Turned on per device with a sync code. The code never leaves the device.
 * - Checks for changes when the app opens, when it comes back to the front, and every minute while open.
 * - Sends local changes a few seconds after editing stops (at most about once a minute while
 *   editing continuously, to stay well inside the server's free daily write allowance), and
 *   straight away when the app goes to the background.
 */
import { useStore, onLocalChange } from "./store";
import * as db from "./storage";
import { normAtlas, now } from "./model";
import { canon, deriveKeys, mergeLib, normCode, seal, unseal, type Keys, type Lib } from "./syncCore";
import type { Atlas } from "./types";

export const SYNC_URL: string = (import.meta.env.VITE_SYNC_URL || "").replace(/\/+$/, "");
const MIN_PUT_GAP = 60_000;
const QUIET_DELAY = 5_000;
const POLL_EVERY = 60_000;

let code = "";
let keys: Keys | null = null;
let rev = 0;
let timer: any = null;
let poller: any = null;
let inFlight: Promise<void> | null = null;
let again = false;
let changeSeq = 0;
let lastPut = 0;
let listening = false;

const setStatus = (state: "off" | "syncing" | "synced" | "pending" | "offline" | "error", msg = "") =>
  useStore.setState((s) => ({ sync: { state, msg, at: state === "synced" ? now() : s.sync.at } }));

export const syncEnabled = () => !!code;
export const currentCode = () => code;

export async function initSync() {
  onLocalChange(markDirty);
  if (!SYNC_URL) return;
  code = await db.getSetting<string>("syncCode", "");
  if (!code) return;
  keys = await deriveKeys(code);
  rev = await db.getSetting<number>("syncRev", 0);
  listen();
  setStatus("syncing");
  syncNow();
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (!code) return;
    if (document.visibilityState === "hidden") syncNow({ force: true });
    else syncNow();
  });
  window.addEventListener("online", () => code && syncNow());
  window.addEventListener("offline", () => code && setStatus("offline", "Offline. Changes will sync when you're back online."));
  poller = setInterval(() => { if (code && document.visibilityState === "visible") syncNow(); }, POLL_EVERY);
}

function markDirty() {
  changeSeq++;
  if (!code) return;
  if (!inFlight) { const st = useStore.getState().sync.state; if (st === "synced" || st === "error") setStatus("pending"); }
  clearTimeout(timer);
  const wait = Math.max(QUIET_DELAY, MIN_PUT_GAP - (Date.now() - lastPut));
  timer = setTimeout(() => syncNow(), wait);
}

/** Library as it should be shared: demo books stay on each device. */
function localLib(): Lib {
  const s = useStore.getState();
  return { atlases: s.atlases.filter((a) => !a.demo), atlasTomb: s.atlasTomb };
}

/** Bring this device's library in line with the merged result. */
function apply(merged: Lib) {
  const s = useStore.getState();
  const keep = new Map(merged.atlases.map((a) => [a.id, a]));
  const next: Atlas[] = [];
  const toSave: Atlas[] = [];
  const toDelete: string[] = [];
  for (const a of s.atlases) {
    if (a.demo) { next.push(a); continue; }
    const m = keep.get(a.id);
    if (!m) { toDelete.push(a.id); continue; }
    keep.delete(a.id);
    if (canon(m) === canon(a)) next.push(a);
    else { const n = normAtlas(m); next.push(n); toSave.push(n); }
  }
  for (const m of keep.values()) { const n = normAtlas(m); next.push(n); toSave.push(n); }
  const tombChanged = canon(merged.atlasTomb) !== canon(s.atlasTomb);
  if (!toSave.length && !toDelete.length && !tombChanged) return;
  const curGone = s.curId && toDelete.includes(s.curId);
  useStore.setState({ atlases: next, atlasTomb: merged.atlasTomb, ...(curGone ? { curId: null, sel: null, past: [], future: [] } : {}) });
  // Clear a selection that points at something the other device deleted.
  const st = useStore.getState(); const cur = st.atlas();
  if (cur && st.sel) {
    const L: Record<string, keyof Atlas> = { char: "characters", rel: "relationships", event: "events", place: "places", faction: "factions", note: "notes" };
    const list = (cur[L[st.sel.kind]] as any[]) || [];
    if (!list.some((x) => x.id === st.sel!.id)) useStore.setState({ sel: null });
  }
  toSave.forEach((a) => db.saveAtlas(a).catch(() => {}));
  toDelete.forEach((id) => db.deleteAtlas(id).catch(() => {}));
  if (tombChanged) db.setSetting("atlasTomb", merged.atlasTomb);
  if (curGone) useStore.getState().toast("This book was deleted on your other device");
}

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function api(method: "GET" | "PUT" | "DELETE", body?: unknown) {
  const res = await fetch(`${SYNC_URL}/v1/vault/${keys!.vaultId}`, {
    method,
    headers: { Authorization: `Bearer ${keys!.auth}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  if (res.status === 404 && method === "GET") return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, j.error || `Sync server error (${res.status})`);
  return j;
}

/** One full round: fetch, merge, apply, and send back if needed. */
async function round() {
  const seqAtStart = changeSeq;
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await api("GET");
    const remoteLib = remote ? await unseal(remote.data, keys!.key) : null;
    const remoteRev = remote ? remote.rev : 0;
    const merged = mergeLib(localLib(), remoteLib);
    apply(merged);
    rev = remoteRev;
    if (remoteLib && canon(merged) === canon(remoteLib)) break;
    try {
      const r = await api("PUT", { rev: remoteRev, data: await seal(merged, keys!.key) });
      rev = r.rev; lastPut = Date.now();
      break;
    } catch (e) {
      if (e instanceof HttpError && e.status === 409) continue; // the other device saved first: merge again
      throw e;
    }
  }
  db.setSetting("syncRev", rev);
  if (changeSeq !== seqAtStart) markDirty();
}

export function syncNow(opts: { force?: boolean } = {}): Promise<void> {
  if (!code || !keys || !SYNC_URL) return Promise.resolve();
  if (opts.force) clearTimeout(timer);
  if (inFlight) { again = true; return inFlight; }
  setStatus("syncing");
  inFlight = round()
    .then(() => setStatus("synced"))
    .catch((e) => {
      if (e instanceof HttpError) setStatus("error", e.status === 403 ? "This sync code was rejected by the server." : e.message);
      else if (e instanceof TypeError || !navigator.onLine) setStatus("offline", "Offline. Changes will sync when you're back online.");
      else setStatus("error", e?.message || "Sync failed");
    })
    .finally(() => {
      inFlight = null;
      if (again) { again = false; syncNow(); }
    });
  return inFlight;
}

/** First device: create a new code and upload this library. */
export async function startNewSync(): Promise<string> {
  const { newSyncCode } = await import("./syncCore");
  const c = newSyncCode();
  await turnOn(c);
  await syncNow();
  return c;
}

/** Another device: join with an existing code. Refuses codes that don't match a synced library. */
export async function joinSync(raw: string): Promise<{ ok: boolean; msg?: string }> {
  const c = normCode(raw);
  if (!c) return { ok: false, msg: "That doesn't look like a sync code. It has 20 letters and numbers, like ABCD-EFGH-JKLM-NPQR-STUV." };
  const k = await deriveKeys(c);
  try {
    const res = await fetch(`${SYNC_URL}/v1/vault/${k.vaultId}`, { headers: { Authorization: `Bearer ${k.auth}` }, cache: "no-store" });
    if (res.status === 404) return { ok: false, msg: "No synced library uses that code. Check it for typos." };
    if (!res.ok) return { ok: false, msg: res.status === 403 ? "That code was rejected." : `Sync server error (${res.status}).` };
    const j = await res.json();
    await unseal(j.data, k.key);
  } catch (e: any) {
    return { ok: false, msg: e instanceof TypeError ? "Couldn't reach the sync server. Are you online?" : e?.message || "Couldn't connect." };
  }
  await turnOn(c);
  await syncNow();
  return { ok: true };
}

async function turnOn(c: string) {
  code = c;
  keys = await deriveKeys(c);
  rev = 0;
  await db.setSetting("syncCode", c);
  await db.setSetting("syncRev", 0);
  listen();
}

/** Stop syncing on this device. The library stays on the device. */
export async function turnOffSync() {
  code = ""; keys = null; rev = 0;
  clearTimeout(timer);
  await db.setSetting("syncCode", "");
  setStatus("off");
}

export const _testing = { get poller() { return poller; } };
