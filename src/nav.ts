import { useStore } from "./store";
import type { Kind, View } from "./types";

type Focuser = (id: string) => void;
const focusers: Partial<Record<"canvas" | "places", Focuser>> = {};
export const registerFocuser = (k: "canvas" | "places", f: Focuser | undefined) => { focusers[k] = f; };

const VIEW_FOR: Record<Kind, View> = { char: "canvas", rel: "canvas", event: "timeline", place: "places", faction: "factions", note: "notes" };
const STAYS: Partial<Record<View, Kind[]>> = {
  canvas: ["char", "rel"], family: ["char", "rel"], timeline: ["event"], places: ["place"], factions: ["faction"], notes: ["note"],
  dashboard: [], connections: ["char", "rel"]
};

/** Select an item and bring the right view into focus. */
export function goto(kind: Kind, id: string, opts: { switchView?: boolean } = {}) {
  const s = useStore.getState();
  const stay = STAYS[s.view]?.includes(kind);
  if (!stay && opts.switchView !== false) s.setView(VIEW_FOR[kind]);
  s.setSel({ kind, id });
  setTimeout(() => {
    if (kind === "char" && useStore.getState().view === "canvas") focusers.canvas?.(id);
    if (kind === "place" && useStore.getState().view === "places") focusers.places?.(id);
  }, 80);
}
