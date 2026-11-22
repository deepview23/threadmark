import { get, set, del, keys, createStore } from "idb-keyval";
import type { Atlas } from "./types";
import { normAtlas } from "./model";

const store = createStore("threadmark", "data");
const BACKUPS_PER_ATLAS = 7;

export async function loadAll(): Promise<Atlas[]> {
  const ks = (await keys(store)).filter((k) => typeof k === "string" && k.startsWith("atlas:")) as string[];
  const out: Atlas[] = [];
  for (const k of ks) {
    try { const v = await get(k, store); if (v) out.push(normAtlas(v)); } catch { /* skip damaged record */ }
  }
  return out;
}

export async function saveAtlas(a: Atlas) {
  await set("atlas:" + a.id, a, store);
  await maybeBackup(a);
}

export async function deleteAtlas(id: string) {
  await del("atlas:" + id, store);
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

async function maybeBackup(a: Atlas) {
  const key = `backup:${a.id}:${day(Date.now())}`;
  const existing = await get(key, store);
  if (existing) return;
  await set(key, { at: Date.now(), atlas: a }, store);
  const all = (await keys(store)).filter((k) => typeof k === "string" && k.startsWith(`backup:${a.id}:`)) as string[];
  all.sort();
  while (all.length > BACKUPS_PER_ATLAS) { const k = all.shift()!; await del(k, store); }
}

export async function listBackups(id?: string): Promise<{ key: string; at: number; title: string; atlasId: string; counts: string }[]> {
  const all = (await keys(store)).filter((k) => typeof k === "string" && k.startsWith("backup:" + (id ? id + ":" : ""))) as string[];
  const out = [];
  for (const k of all) {
    const v: any = await get(k, store);
    if (v?.atlas) out.push({ key: k, at: v.at, title: v.atlas.title, atlasId: v.atlas.id, counts: `${v.atlas.characters?.length || 0} characters · ${v.atlas.events?.length || 0} events` });
  }
  return out.sort((x, y) => y.at - x.at);
}

export async function readBackup(key: string): Promise<Atlas | null> {
  const v: any = await get(key, store);
  return v?.atlas ? normAtlas(v.atlas) : null;
}

export async function getSetting<T>(k: string, fallback: T): Promise<T> {
  try { const v = await get("setting:" + k, store); return (v ?? fallback) as T; } catch { return fallback; }
}
export async function setSetting(k: string, v: unknown) { try { await set("setting:" + k, v, store); } catch { /* ignore */ } }

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* unsupported */ }
  return false;
}
