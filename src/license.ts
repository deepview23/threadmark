/**
 * Threadmark licence: "your first book is free".
 * - Off unless the app is built with VITE_PAYWALL=on, so early-access readers are never blocked.
 * - Demo books and free classics never count towards the free book.
 * - A licence key is checked once by the Threadmark server (which asks Gumroad or Lemon Squeezy),
 *   remembered on the device, and re-checked about once a month when online.
 */
import * as db from "./storage";
import { useStore } from "./store";
import { SYNC_URL } from "./sync";
import type { Atlas } from "./types";
import { signedUp } from "./signup";

export const PAYWALL = import.meta.env.VITE_PAYWALL === "on";
export const BUY_URL: string = import.meta.env.VITE_BUY_URL || "";
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
export const FREE_BOOKS = 1;
const RECHECK_MS = 30 * 24 * 3600 * 1000;

export interface Licence { key: string; valid: boolean; at: number }
let licence: Licence | null = null;

export const isClassic = (a: Atlas) => typeof (a as any).sourceUrl === "string" && (a as any).sourceUrl.startsWith("/classics/");
export const personalCount = (list: Atlas[]) => list.filter((a) => !a.demo && !isClassic(a)).length;
export const licensed = () => !!licence?.valid;
export const currentLicence = () => licence;

/** May the reader add another book of their own? Opens the sign-up or unlock window if not.
 *  `next` is the window to open once the reader has signed up (e.g. the new-book form). */
export function canAddBook(next?: { type: string; props?: any }): boolean {
  if (!PAYWALL || licensed()) return true;
  if (personalCount(useStore.getState().atlases) < FREE_BOOKS) {
    if (signedUp()) return true;
    useStore.getState().openModal({ type: "signup", props: { next } });
    return false;
  }
  useStore.getState().openModal({ type: "unlock" });
  return false;
}

export async function initLicence() {
  licence = await db.getSetting<Licence | null>("licence", null);
  if (licence?.valid && Date.now() - licence.at > RECHECK_MS && navigator.onLine) {
    const r = await check(licence.key).catch(() => null);
    if (r && r.definitive) { licence = { key: licence.key, valid: r.valid, at: Date.now() }; await db.setSetting("licence", licence); }
  }
}

async function check(key: string): Promise<{ valid: boolean; reason?: string; definitive: boolean }> {
  const res = await fetch(`${SYNC_URL}/v1/license/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
  const j = await res.json().catch(() => ({}));
  return { valid: !!j.valid, reason: j.reason, definitive: res.status === 200 };
}

export async function activate(raw: string): Promise<{ ok: boolean; msg?: string }> {
  const key = raw.trim();
  if (!key) return { ok: false, msg: "Please enter your licence key." };
  if (!SYNC_URL) return { ok: false, msg: "Licences aren't available in this version." };
  try {
    const r = await check(key);
    if (!r.valid) return { ok: false, msg: r.reason || "That licence key wasn't recognised." };
    licence = { key, valid: true, at: Date.now() };
    await db.setSetting("licence", licence);
    useStore.setState({}); // re-render
    return { ok: true };
  } catch {
    return { ok: false, msg: "Couldn't reach the licence service. Are you online?" };
  }
}
