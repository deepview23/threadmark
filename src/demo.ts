import { newAtlas, newChar, newRel, newEvent, newNote, newPlace, newFaction, uid } from "./model";
import type { Atlas } from "./types";
import { PALETTE } from "./constants";

/** A tiny, clearly-labelled fictional atlas used for onboarding. */
export function demoAtlas(): Atlas {
  const fam = newFaction({ id: "df_pen", name: "The Penhallows", kind: "family", symbol: "🕯", color: "#A16A2B", motto: "Keep the light", desc: "Keepers of the Gull's Rest lighthouse for four generations." });
  const crew = newFaction({ id: "df_vey", name: "The Vey crew", kind: "criminal organisation", symbol: "⚓", color: "#DC2626", desc: "Smugglers working the coves on moonless nights.", goals: "Keep the light dark when their ships come in." });
  fam.enemies = [crew.id]; crew.enemies = [fam.id];
  const c = (id: string, name: string, p: any) => newChar({ id, name, ...p });
  const chars = [
    c("d_mara", "Mara Penhallow", { role: "protagonist", importance: "main", color: PALETTE[0], factionIds: [fam.id], short: "Keeper of the Gull's Rest light", backstory: "Took over the lighthouse at nineteen when her father fell ill.", motivations: "Keep every ship safe, whatever it costs.", first: { order: 1 }, x: 0, y: 0 }),
    c("d_tobias", "Tobias Penhallow", { role: "family member", color: PALETTE[9], factionIds: [fam.id], status: "dead", short: "Mara's father, the old keeper", first: { order: 3 }, x: -280, y: -200 }),
    c("d_elin", "Elin Penhallow", { role: "family member", color: PALETTE[3], factionIds: [fam.id], short: "Mara's mother", first: { order: 3 }, x: 40, y: -210 }),
    c("d_jory", "Jory Penhallow", { role: "family member", color: PALETTE[1], factionIds: [fam.id], short: "Mara's restless younger brother", secrets: "Owes money to someone he won't name.", first: { order: 8 }, x: -300, y: 190 }),
    c("d_ruan", "Captain Ruan Vey", { role: "antagonist", importance: "main", color: PALETTE[4], factionIds: [crew.id], short: "Charming smuggler who wants the light dimmed", first: { order: 22 }, x: 330, y: 170 }),
    c("d_wenna", "Wenna Hale", { role: "ally", color: PALETTE[7], short: "Harbour-master's daughter, Mara's oldest friend", first: { order: 5 }, x: 360, y: -120 })
  ];
  const r = (from: string, to: string, type: string, p: any = {}) => newRel({ from, to, type, ...p });
  const rels = [
    r("d_tobias", "d_mara", "parent"), r("d_elin", "d_mara", "parent"), r("d_tobias", "d_jory", "parent"), r("d_elin", "d_jory", "parent"),
    r("d_tobias", "d_elin", "partner", { label: "married" }), r("d_mara", "d_wenna", "friend", { significance: "central" }),
    r("d_mara", "d_ruan", "rival", { desc: "He keeps asking her to look the other way on moonless nights.", first: { order: 22 },
      changes: [{ id: uid("chg"), pos: { order: 22, label: "" }, status: "current", note: "Polite, wary strangers" }, { id: uid("chg"), pos: { order: 51, label: "" }, status: "complicated", note: "After the storm she suspects him" }] }),
    r("d_jory", "d_ruan", "works", { status: "suspected", label: "secretly works for?", first: { order: 40 } })
  ];
  const light = newPlace({ id: "dp_light", name: "Gull's Rest Lighthouse", kind: "building", emoji: "🗼", desc: "A granite tower on the headland.", chars: ["d_mara", "d_tobias"], first: { order: 1 }, x: 0, y: 0 });
  const harbour = newPlace({ id: "dp_harb", name: "Porthkennack Harbour", kind: "city", desc: "The fishing harbour below the headland.", chars: ["d_wenna"], first: { order: 5 }, x: 300, y: 60 });
  const cove = newPlace({ id: "dp_cove", name: "Smugglers' Cove", kind: "sea", emoji: "🌊", desc: "Only reachable at low tide.", secrets: "Tunnel up to the lighthouse cellar?", chars: ["d_ruan"], first: { order: 22 }, x: 120, y: 230 });
  light.links = [harbour.id, cove.id]; harbour.links = [light.id]; cove.links = [light.id];
  const ev = (title: string, p: any) => newEvent({ title, ...p });
  const a = newAtlas({ title: "The Lighthouse at Gull's Rest", creator: "A Threadmark demo", type: "Book", unit: "Page", status: "Reading", cover: PALETTE[8], progress: { order: 60, label: "" }, veil: true, demo: true });
  a.factions = [fam, crew];
  a.characters = chars;
  a.relationships = rels;
  a.places = [light, harbour, cove];
  a.events = [
    ev("Tobias's last night on the light", { etype: "death", importance: "pivotal", tone: "tragic", pos: { order: 3 }, storyTime: "Ten years before", storyOrder: -10, chars: ["d_tobias", "d_mara"], locations: [light.id] }),
    ev("Ruan's ship anchors in the cove", { etype: "meeting", tone: "ominous", pos: { order: 22 }, storyTime: "Spring", storyOrder: 1, chars: ["d_ruan", "d_mara"], locations: [cove.id], factions: [crew.id] }),
    ev("The light fails during the storm", { etype: "turning point", importance: "pivotal", tone: "tense", pos: { order: 51 }, storyTime: "Midsummer", storyOrder: 2, chars: ["d_mara", "d_jory"], locations: [light.id] }),
    ev("Something in a later chapter", { etype: "reveal", pos: { order: 80 }, storyOrder: 3, desc: "This sits past your reading position, so it stays hidden until you turn off spoiler hiding.", chars: ["d_jory"] })
  ];
  a.notes = [
    newNote({ ntype: "question", text: "Who cut the lamp's fuel line?", pos: { order: 52 }, chars: ["d_jory", "d_ruan"], events: [a.events[2].id] }),
    newNote({ ntype: "theory", text: "Jory is running errands for Ruan to pay off a debt.", evidence: "p. 44: Jory has new boots and won't say where the money came from.", confidence: "medium", pos: { order: 55 }, chars: ["d_jory", "d_ruan"] }),
    newNote({ ntype: "quote", text: "A light that is only kept on calm nights is not a light at all.", pos: { order: 12 }, chars: ["d_tobias"] })
  ];
  return a;
}
