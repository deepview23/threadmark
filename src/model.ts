import type { Atlas, Character, Relationship, StoryEvent, Place, Faction, Note, Pos, Kind } from "./types";
import { PALETTE, REL } from "./constants";

export const uid = (p: string) => p + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const now = () => Date.now();
const pos = (p?: Partial<Pos>): Pos => ({ order: p?.order ?? null, label: p?.label ?? "" });
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export function newChar(p: Partial<Character> = {}, i = 0): Character {
  return {
    id: uid("char"), name: "", aliases: "", titles: "", pronouns: "", emoji: "", portrait: "", color: PALETTE[i % PALETTE.length],
    role: "unknown", importance: "supporting", status: "alive", tags: "", short: "", backstory: "", traits: "", motivations: "",
    fears: "", secrets: "", beliefs: "", skills: "", arcStart: "", arcTurns: "", arcNow: "", arcPredicted: "", notes: "",
    spoiler: "none", x: 0, y: 0, pinned: false, createdAt: now(),
    ...p,
    factionIds: arr(p.factionIds), custom: Array.isArray(p.custom) ? p.custom : [], first: pos(p.first)
  };
}
export function newRel(p: Partial<Relationship> = {}): Relationship {
  return {
    id: uid("rel"), from: "", to: "", type: "unknown", label: "", direction: "mutual", status: "current", significance: "important",
    desc: "", evidence: "", color: "", spoiler: "none", createdAt: now(),
    ...p,
    first: pos(p.first), end: pos(p.end), changes: Array.isArray(p.changes) ? p.changes.map((c) => ({ id: c.id || uid("chg"), pos: pos(c.pos), status: c.status || "", note: c.note || "" })) : []
  };
}
export function newEvent(p: Partial<StoryEvent> = {}): StoryEvent {
  return {
    id: uid("event"), title: "", etype: "custom", importance: "major", tone: "", storyTime: "", storyOrder: null, desc: "", notes: "",
    spoiler: "none", createdAt: now(),
    ...p,
    pos: pos(p.pos), chars: arr(p.chars), locations: arr(p.locations), factions: arr(p.factions)
  };
}
export function newPlace(p: Partial<Place> | any = {}, i = 0): Place {
  return {
    id: uid("place"), name: "", kind: "custom", emoji: "", color: PALETTE[(i + 3) % PALETTE.length], desc: "", secrets: "",
    spoiler: "none", x: 0, y: 0, createdAt: now(),
    ...p,
    chars: arr(p.chars), links: arr(p.links), first: pos(p.first)
  };
}
export function newFaction(p: Partial<Faction> = {}, i = 0): Faction {
  return {
    id: uid("faction"), name: "", kind: "custom", symbol: "", color: PALETTE[(i + 6) % PALETTE.length], motto: "", desc: "", goals: "",
    secrets: "", hierarchy: "", spoiler: "none", createdAt: now(),
    ...p,
    allies: arr(p.allies), enemies: arr(p.enemies), first: pos(p.first)
  };
}
export function newNote(p: Partial<Note> | any = {}): Note {
  return {
    id: uid("note"), ntype: "observation", text: "", evidence: "", status: "open", confidence: "medium", createdAt: now(),
    ...p,
    chars: arr(p.chars), events: arr(p.events), locations: arr(p.locations), factions: arr(p.factions), pos: pos(p.pos)
  };
}
export function newAtlas(p: Partial<Atlas> = {}): Atlas {
  const t = now();
  return {
    id: uid("atlas"), title: "Untitled story", creator: "", type: "Book", unit: "Page", status: "Reading", archived: false,
    cover: PALETTE[0], veil: true, demo: false, createdAt: t, updatedAt: t, openedAt: t,
    ...p,
    progress: pos(p.progress), characters: [], relationships: [], events: [], places: [], factions: [], notes: []
  };
}

/** Accepts anything (an import, an older version, a v1 web-page atlas) and returns a complete Atlas. */
export function normAtlas(raw: any): Atlas {
  const a = newAtlas({ ...raw, characters: undefined, relationships: undefined, events: undefined, places: undefined, factions: undefined, notes: undefined } as any);
  if (raw?.id) a.id = raw.id;
  const factions: Faction[] = (raw?.factions || []).map((f: any, i: number) => newFaction(f, i));
  // v1 stored a free-text "group" on characters: turn each distinct group into a faction.
  const groupIds = new Map<string, string>();
  factions.forEach((f) => groupIds.set(f.name.toLowerCase(), f.id));
  const chars: Character[] = (raw?.characters || []).map((c: any, i: number) => {
    const ch = newChar({ ...c, x: typeof c.x === "number" ? c.x : (i % 5) * 240, y: typeof c.y === "number" ? c.y : Math.floor(i / 5) * 140 }, i);
    if (c.group && typeof c.group === "string") {
      const k = c.group.toLowerCase();
      if (!groupIds.has(k)) { const f = newFaction({ name: c.group, kind: /family/i.test(c.group) ? "family" : "custom" }, factions.length); factions.push(f); groupIds.set(k, f.id); }
      const fid = groupIds.get(k)!;
      if (!ch.factionIds.includes(fid)) ch.factionIds.push(fid);
    }
    delete (ch as any).group;
    return ch;
  });
  a.factions = factions;
  a.characters = chars;
  a.relationships = (raw?.relationships || []).map((r: any) => newRel(r)).filter((r: Relationship) => r.from && r.to);
  a.events = (raw?.events || []).map((e: any) => newEvent(e));
  a.places = (raw?.places || []).map((p: any, i: number) => newPlace(p, i));
  a.notes = (raw?.notes || []).map((n: any) => newNote(n));
  a.updatedAt = raw?.updatedAt || a.updatedAt;
  a.openedAt = raw?.openedAt || a.openedAt;
  return a;
}

/* ---------- reading position & visibility ---------- */
export const isFuture = (a: Atlas, p?: Pos) => !!(a.veil && a.progress.order != null && p && p.order != null && Number(p.order) > Number(a.progress.order));
export const visChars = (a: Atlas) => a.characters.filter((c) => !isFuture(a, c.first));
export const visRels = (a: Atlas) => {
  const v = new Set(visChars(a).map((c) => c.id));
  return a.relationships.filter((r) => v.has(r.from) && v.has(r.to) && !isFuture(a, r.first));
};
export const visEvents = (a: Atlas) => a.events.filter((e) => !isFuture(a, e.pos));
export const visPlaces = (a: Atlas) => a.places.filter((p) => !isFuture(a, p.first));
export const visFactions = (a: Atlas) => a.factions.filter((f) => !isFuture(a, f.first));
export const visNotes = (a: Atlas) => a.notes.filter((n) => !isFuture(a, n.pos));
export const countHidden = (a: Atlas) =>
  a.characters.length - visChars(a).length + a.relationships.length - visRels(a).length + a.events.length - visEvents(a).length +
  a.places.length - visPlaces(a).length + a.factions.length - visFactions(a).length + a.notes.length - visNotes(a).length;

export function posText(a: Atlas, p?: Pos | null): string {
  if (!p) return "";
  if (p.label) return p.label;
  if (p.order == null) return "";
  if (a.unit === "Percent") return p.order + "%";
  if (a.unit === "Page") return "p. " + p.order;
  return a.unit + " " + p.order;
}
export const unitLower = (a: Atlas) => (a.unit === "Percent" ? "percent" : a.unit.toLowerCase());

export const initials = (n: string) => {
  const w = String(n || "?").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return ((w[0][0] || "?") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
};
export const relLabel = (r: Relationship) => r.label || REL[r.type]?.short || "related";
export const relCat = (r: Relationship) => REL[r.type]?.cat || "unknown";
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const trunc = (s: string, n: number) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
export const num = (v: string): number | null => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

export const listFor = (a: Atlas, k: Kind): any[] =>
  ({ char: a.characters, rel: a.relationships, event: a.events, place: a.places, faction: a.factions, note: a.notes })[k];
export const KIND_LABEL: Record<Kind, string> = { char: "Character", rel: "Relationship", event: "Event", place: "Location", faction: "Faction", note: "Note" };
