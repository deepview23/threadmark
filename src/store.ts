import { create } from "zustand";
import type { Atlas, Sel, View, Kind } from "./types";
import { newAtlas, newChar, newRel, newEvent, newPlace, newFaction, newNote, normAtlas, uid, now, visChars, listFor } from "./model";
import * as db from "./storage";
import { PALETTE } from "./constants";
import { stamp, type Tombs } from "./syncCore";

export type SyncState = "off" | "syncing" | "synced" | "pending" | "offline" | "error";
let changeListener: (() => void) | null = null;
/** The sync engine registers here to hear about local edits. */
export function onLocalChange(fn: () => void) { changeListener = fn; }
const changed = (a: Atlas) => { if (!a.demo) changeListener?.(); };

export type Theme = "system" | "light" | "dark" | "sepia";
export interface Modal { type: string; props?: any }

interface UI {
  showLabels: boolean;
  showClusters: boolean;
  showMinimap: boolean;
  filterFaction: string;
  filterImp: string;
  tlMode: "reading" | "story";
  tlChar: string; tlPlace: string; tlFaction: string; tlType: string; tlImp: string;
  noteFilter: string;
  famMode: "tree" | "lineage" | "household" | "faction";
  famCollapsed: string[];
  connA: string; connB: string;
  libQ: string; libStatus: string; libShowArchived: boolean;
}

interface State {
  loaded: boolean;
  atlases: Atlas[];
  curId: string | null;
  view: View;
  sel: Sel | null;
  focusNew: boolean;
  revealed: Record<string, true>;
  past: string[];
  future: string[];
  toastMsg: string; toastKey: number;
  modal: Modal | null;
  theme: Theme;
  persisted: boolean;
  ui: UI;
  atlasTomb: Tombs;
  sync: { state: SyncState; at: number; msg: string };
  canvasCenter: (() => { x: number; y: number }) | null;
  placesCenter: (() => { x: number; y: number }) | null;

  init: () => Promise<void>;
  atlas: () => Atlas | null;
  openAtlas: (id: string) => void;
  goHome: () => void;
  createAtlas: (p: Partial<Atlas>) => Atlas;
  addExisting: (a: Atlas, open?: boolean) => void;
  removeAtlas: (id: string) => void;
  duplicateAtlas: (id: string) => void;
  updateAtlasById: (id: string, fn: (a: Atlas) => void) => void;
  mutate: (fn: (a: Atlas) => void, opts?: { history?: boolean }) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setSel: (s: Sel | null, focusNew?: boolean) => void;
  setView: (v: View) => void;
  setUi: (p: Partial<UI>) => void;
  toast: (m: string) => void;
  openModal: (m: Modal | null) => void;
  setTheme: (t: Theme) => void;
  reveal: (id: string) => void;
  addChar: (at?: { x: number; y: number }) => void;
  addRel: (from?: string, to?: string) => void;
  addEvent: (p?: Partial<import("./types").StoryEvent>) => void;
  addPlace: (at?: { x: number; y: number }) => void;
  addFaction: () => void;
  addNote: (ntype?: string, p?: Partial<import("./types").Note>) => void;
  deleteItem: (k: Kind, id: string) => void;
}

const timers: Record<string, any> = {};
function persist(a: Atlas) {
  clearTimeout(timers[a.id]);
  timers[a.id] = setTimeout(() => { db.saveAtlas(a).catch(() => useStore.getState().toast("Couldn't save. Is your device storage full?")); }, 400);
}

function freeSpot(items: { x: number; y: number }[], x: number, y: number, w = 220, h = 86) {
  const taken = (p: { x: number; y: number }) => items.some((o) => Math.abs(o.x - p.x) < w && Math.abs(o.y - p.y) < h);
  let p = { x, y }, ang = 0, rad = 0;
  for (let i = 0; i < 120 && taken(p); i++) { ang += 0.85; rad += 16; p = { x: x + Math.cos(ang) * rad * 1.6, y: y + Math.sin(ang) * rad }; }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

export const useStore = create<State>((set, get) => ({
  loaded: false,
  atlases: [],
  curId: null,
  view: "dashboard",
  sel: null,
  focusNew: false,
  revealed: {},
  past: [],
  future: [],
  toastMsg: "", toastKey: 0,
  modal: null,
  theme: "system",
  persisted: false,
  atlasTomb: {},
  sync: { state: "off", at: 0, msg: "" },
  canvasCenter: null,
  placesCenter: null,
  ui: {
    showLabels: true, showClusters: true, showMinimap: true, filterFaction: "", filterImp: "",
    tlMode: "reading", tlChar: "", tlPlace: "", tlFaction: "", tlType: "", tlImp: "",
    noteFilter: "", famMode: "tree", famCollapsed: [], connA: "", connB: "", libQ: "", libStatus: "", libShowArchived: false
  },

  init: async () => {
    const [atlases, theme, labels, clusters, minimap, atlasTomb] = await Promise.all([
      db.loadAll(), db.getSetting<Theme>("theme", "system"), db.getSetting("showLabels", true), db.getSetting("showClusters", true), db.getSetting("showMinimap", true), db.getSetting<Tombs>("atlasTomb", {})
    ]);
    set({ atlases, theme, atlasTomb, loaded: true, ui: { ...get().ui, showLabels: labels, showClusters: clusters, showMinimap: minimap } });
    const persisted = await db.requestPersistence();
    set({ persisted });
  },
  atlas: () => { const s = get(); return s.atlases.find((a) => a.id === s.curId) || null; },
  openAtlas: (id) => {
    get().updateAtlasById(id, (a) => { a.openedAt = now(); });
    set((s) => ({ curId: id, view: "dashboard", sel: null, past: [], future: [], ui: { ...s.ui, filterFaction: "", filterImp: "", tlChar: "", tlPlace: "", tlFaction: "", tlType: "", tlImp: "", connA: "", connB: "", famCollapsed: [] } }));
  },
  goHome: () => set({ curId: null, sel: null, past: [], future: [] }),
  createAtlas: (p) => {
    const a = newAtlas({ cover: PALETTE[get().atlases.length % PALETTE.length], ...p });
    stamp(null, a);
    set((s) => ({ atlases: [...s.atlases, a] }));
    persist(a); changed(a);
    return a;
  },
  addExisting: (raw, open = true) => {
    const a = normAtlas(raw);
    if (get().atlases.some((x) => x.id === a.id)) a.id = uid("atlas");
    a.updatedAt = now();
    stamp(null, a);
    set((s) => ({ atlases: [...s.atlases, a] }));
    persist(a); changed(a);
    if (open) get().openAtlas(a.id);
  },
  removeAtlas: (id) => {
    const gone = get().atlases.find((a) => a.id === id);
    const atlasTomb = gone && !gone.demo ? { ...get().atlasTomb, [id]: now() } : get().atlasTomb;
    set((s) => ({ atlasTomb, atlases: s.atlases.filter((a) => a.id !== id), curId: s.curId === id ? null : s.curId, sel: s.curId === id ? null : s.sel }));
    db.deleteAtlas(id);
    if (gone && !gone.demo) { db.setSetting("atlasTomb", atlasTomb); changed(gone); }
  },
  duplicateAtlas: (id) => {
    const src = get().atlases.find((a) => a.id === id); if (!src) return;
    const copy = normAtlas(JSON.parse(JSON.stringify(src)));
    copy.id = uid("atlas"); copy.title = src.title + " (copy)"; copy.demo = false; copy.createdAt = copy.updatedAt = copy.openedAt = now();
    delete (copy as any).tomb; stamp(null, copy);
    set((s) => ({ atlases: [...s.atlases, copy] }));
    persist(copy); changed(copy);
    get().toast("Duplicated “" + src.title + "”");
  },
  updateAtlasById: (id, fn) => {
    const s = get(); const i = s.atlases.findIndex((a) => a.id === id); if (i < 0) return;
    const draft: Atlas = structuredClone(s.atlases[i]);
    fn(draft);
    const did = stamp(s.atlases[i], draft);
    if (did) draft.updatedAt = now();
    const list = s.atlases.slice(); list[i] = draft;
    set({ atlases: list });
    persist(draft);
    if (did) changed(draft);
  },
  mutate: (fn, opts) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    if (opts?.history !== false) { const past = [...s.past, JSON.stringify(a)].slice(-100); set({ past, future: [] }); }
    s.updateAtlasById(a.id, fn);
  },
  pushHistory: () => { const s = get(); const a = s.atlas(); if (!a) return; set({ past: [...s.past, JSON.stringify(a)].slice(-100), future: [] }); },
  undo: () => {
    const s = get(); const a = s.atlas(); if (!a) return;
    if (!s.past.length) return s.toast("Nothing to undo");
    const prev = normAtlas(JSON.parse(s.past[s.past.length - 1]));
    const list = s.atlases.map((x) => (x.id === a.id ? prev : x));
    prev.updatedAt = now(); stamp(a, prev);
    set({ atlases: list, past: s.past.slice(0, -1), future: [...s.future, JSON.stringify(a)] });
    persist(prev); changed(prev);
    if (s.sel && !listFor(prev, s.sel.kind).some((x: any) => x.id === s.sel!.id)) set({ sel: null });
    s.toast("Undone");
  },
  redo: () => {
    const s = get(); const a = s.atlas(); if (!a) return;
    if (!s.future.length) return s.toast("Nothing to redo");
    const next = normAtlas(JSON.parse(s.future[s.future.length - 1]));
    next.updatedAt = now(); stamp(a, next);
    set({ atlases: s.atlases.map((x) => (x.id === a.id ? next : x)), future: s.future.slice(0, -1), past: [...s.past, JSON.stringify(a)] });
    persist(next); changed(next);
    if (s.sel && !listFor(next, s.sel.kind).some((x: any) => x.id === s.sel!.id)) set({ sel: null });
    s.toast("Redone");
  },
  setSel: (sel, focusNew = false) => set({ sel, focusNew }),
  setView: (view) => set({ view }),
  setUi: (p) => {
    set((s) => ({ ui: { ...s.ui, ...p } }));
    (["showLabels", "showClusters", "showMinimap"] as const).forEach((k) => { if (k in p) db.setSetting(k, (p as any)[k]); });
  },
  toast: (m) => set((s) => ({ toastMsg: m, toastKey: s.toastKey + 1 })),
  openModal: (modal) => set({ modal }),
  setTheme: (theme) => { set({ theme }); db.setSetting("theme", theme); },
  reveal: (id) => set((s) => ({ revealed: { ...s.revealed, [id]: true } })),

  addChar: (at) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const base = at || s.canvasCenter?.() || { x: 0, y: 0 };
    const p = freeSpot(a.characters, base.x, base.y);
    const c = newChar({ x: p.x, y: p.y, first: { order: a.progress.order, label: "" } }, a.characters.length);
    s.mutate((d) => { d.characters.push(c); });
    set({ sel: { kind: "char", id: c.id }, focusNew: true });
  },
  addRel: (from, to) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const vc = visChars(a);
    if (vc.length < 2) return s.toast("Add at least two characters first");
    const selC = s.sel?.kind === "char" ? s.sel.id : undefined;
    const f = from || selC || vc[0].id;
    const t = to || (vc.find((c) => c.id !== f) || vc[1]).id;
    const r = newRel({ from: f, to: t, first: { order: a.progress.order, label: "" } });
    s.mutate((d) => { d.relationships.push(r); });
    set({ sel: { kind: "rel", id: r.id }, focusNew: false });
  },
  addEvent: (p) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const chars = s.sel?.kind === "char" ? [s.sel.id] : [];
    const locations = s.sel?.kind === "place" ? [s.sel.id] : [];
    const factions = s.sel?.kind === "faction" ? [s.sel.id] : [];
    const e = newEvent({ pos: { order: a.progress.order, label: "" }, chars, locations, factions, ...p });
    s.mutate((d) => { d.events.push(e); });
    set({ sel: { kind: "event", id: e.id }, focusNew: true });
  },
  addPlace: (at) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const base = at || s.placesCenter?.() || { x: 0, y: 0 };
    const p = freeSpot(a.places, base.x, base.y, 200, 90);
    const pl = newPlace({ x: p.x, y: p.y, first: { order: a.progress.order, label: "" } }, a.places.length);
    s.mutate((d) => { d.places.push(pl); });
    set({ sel: { kind: "place", id: pl.id }, focusNew: true });
  },
  addFaction: () => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const f = newFaction({ first: { order: a.progress.order, label: "" } }, a.factions.length);
    s.mutate((d) => { d.factions.push(f); });
    set({ sel: { kind: "faction", id: f.id }, focusNew: true });
  },
  addNote: (ntype = "observation", p) => {
    const s = get(); const a = s.atlas(); if (!a) return;
    const link = s.sel;
    const n = newNote({
      ntype, pos: { order: a.progress.order, label: "" },
      chars: link?.kind === "char" ? [link.id] : [], events: link?.kind === "event" ? [link.id] : [],
      locations: link?.kind === "place" ? [link.id] : [], factions: link?.kind === "faction" ? [link.id] : [], ...p
    });
    s.mutate((d) => { d.notes.push(n); });
    set({ sel: { kind: "note", id: n.id }, focusNew: true });
  },
  deleteItem: (k, id) => {
    const s = get();
    s.mutate((d) => {
      if (k === "char") {
        d.characters = d.characters.filter((c) => c.id !== id);
        d.relationships = d.relationships.filter((r) => r.from !== id && r.to !== id);
        d.events.forEach((e) => (e.chars = e.chars.filter((x) => x !== id)));
        d.notes.forEach((n) => (n.chars = n.chars.filter((x) => x !== id)));
        d.places.forEach((p) => (p.chars = p.chars.filter((x) => x !== id)));
      } else if (k === "rel") d.relationships = d.relationships.filter((r) => r.id !== id);
      else if (k === "event") { d.events = d.events.filter((e) => e.id !== id); d.notes.forEach((n) => (n.events = n.events.filter((x) => x !== id))); }
      else if (k === "place") {
        d.places = d.places.filter((p) => p.id !== id);
        d.places.forEach((p) => (p.links = p.links.filter((x) => x !== id)));
        d.events.forEach((e) => (e.locations = e.locations.filter((x) => x !== id)));
        d.notes.forEach((n) => (n.locations = n.locations.filter((x) => x !== id)));
      } else if (k === "faction") {
        d.factions = d.factions.filter((f) => f.id !== id);
        d.factions.forEach((f) => { f.allies = f.allies.filter((x) => x !== id); f.enemies = f.enemies.filter((x) => x !== id); });
        d.characters.forEach((c) => (c.factionIds = c.factionIds.filter((x) => x !== id)));
        d.events.forEach((e) => (e.factions = e.factions.filter((x) => x !== id)));
        d.notes.forEach((n) => (n.factions = n.factions.filter((x) => x !== id)));
      } else d.notes = d.notes.filter((n) => n.id !== id);
    });
    set({ sel: null });
    s.toast("Deleted · Ctrl+Z to undo");
  }
}));

/** Convenience hook: the open atlas (re-renders when it changes). */
export const useAtlas = () => useStore((s) => s.atlases.find((a) => a.id === s.curId) || null);
