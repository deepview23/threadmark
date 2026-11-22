/**
 * "Start your own book" sign-up: before a reader starts their first book of their own, we ask for an email
 * and the country they're in. Classics and the demo stay open to everyone, with no form.
 * Saved on the device; sent to the Threadmark server, and retried later if the reader is offline.
 */
import * as db from "./storage";
import { SYNC_URL } from "./sync";

export interface SignupInfo { email: string; country: string; news: boolean; at: number; sent: boolean }
let info: SignupInfo | null = null;

const CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
export function countries(): { code: string; name: string }[] {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* very old browser */ }
  return CODES.map((code) => ({ code, name: (dn && dn.of(code)) || code })).sort((a, b) => a.name.localeCompare(b.name));
}
/** A sensible default from the browser's language setting, e.g. en-IN -> IN. Only a pre-selection; the reader confirms it. */
export function guessCountry(): string {
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
  for (const l of langs) { const m = /-([A-Z]{2})$/i.exec(l); if (m && CODES.includes(m[1].toUpperCase())) return m[1].toUpperCase(); }
  return "";
}

export const signedUp = () => !!info;
export const signupInfo = () => info;

export async function initSignup() {
  info = await db.getSetting<SignupInfo | null>("signup", null);
  if (info && !info.sent && navigator.onLine) send(info).catch(() => {});
}

async function send(i: SignupInfo) {
  if (!SYNC_URL) return;
  const res = await fetch(`${SYNC_URL}/v1/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: i.email, country: i.country, list: "app", consent: i.news, source: "app:first-book" }),
  });
  if (res.ok) { info = { ...i, sent: true }; await db.setSetting("signup", info); }
  else if (res.status === 400) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Please check your details."); }
}

export const EMAIL_OK = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e.trim());

/** Save the details and try to send them. Offline is fine: the reader carries on and we send later. */
export async function saveSignup(email: string, country: string, news: boolean): Promise<{ ok: boolean; msg?: string }> {
  const i: SignupInfo = { email: email.trim().toLowerCase(), country, news, at: Date.now(), sent: false };
  if (!EMAIL_OK(i.email)) return { ok: false, msg: "Please enter a valid email address." };
  if (!country) return { ok: false, msg: "Please choose your country." };
  try { await send(i); }
  catch (e: any) { if (e && e.message && !/fetch|network|load/i.test(e.message)) return { ok: false, msg: e.message }; }
  info = info && info.email === i.email ? info : i;
  await db.setSetting("signup", info);
  return { ok: true };
}
