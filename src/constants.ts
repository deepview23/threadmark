export const PALETTE = ["#0F766E", "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#CA8A04", "#16A34A", "#0891B2", "#475569", "#9333EA", "#65A30D"];

export const CAT: Record<string, { name: string; color: string }> = {
  family: { name: "Family", color: "#A16A2B" },
  ally: { name: "Friendship / alliance", color: "#16A34A" },
  romance: { name: "Romantic", color: "#DB2777" },
  pro: { name: "Mentor / professional", color: "#2563EB" },
  conflict: { name: "Conflict", color: "#DC2626" },
  unknown: { name: "Unknown", color: "#6B7280" }
};

export const REL: Record<string, { label: string; short: string; cat: string; directed?: boolean }> = {
  parent: { label: "Parent of", short: "parent", cat: "family", directed: true },
  adoptive: { label: "Adoptive parent of", short: "adoptive parent", cat: "family", directed: true },
  step: { label: "Step-parent of", short: "step-parent", cat: "family", directed: true },
  partner: { label: "Partner / spouse", short: "partners", cat: "family" },
  sibling: { label: "Sibling", short: "siblings", cat: "family" },
  relative: { label: "Other relative", short: "relatives", cat: "family" },
  friend: { label: "Friend", short: "friends", cat: "ally" },
  ally: { label: "Ally", short: "allies", cat: "ally" },
  lover: { label: "Lover / romantic", short: "romance", cat: "romance" },
  mentor: { label: "Mentor to", short: "mentor", cat: "pro", directed: true },
  colleague: { label: "Colleague", short: "colleagues", cat: "pro" },
  works: { label: "Works for / serves", short: "works for", cat: "pro", directed: true },
  creator: { label: "Creator of", short: "created", cat: "pro", directed: true },
  rival: { label: "Rival", short: "rivals", cat: "conflict" },
  enemy: { label: "Enemy", short: "enemies", cat: "conflict" },
  unknown: { label: "Unknown / unresolved", short: "unknown", cat: "unknown" },
  custom: { label: "Custom", short: "", cat: "unknown" }
};
export const FAMILY_TYPES = ["parent", "adoptive", "step", "partner", "sibling", "relative"];
export const PARENT_TYPES = ["parent", "adoptive", "step"];

export const ROLES = ["protagonist", "antagonist", "ally", "mentor", "rival", "family member", "minor character", "unknown"];
export const IMPORTANCE = ["main", "supporting", "minor", "background"];
export const CSTATUS = ["alive", "dead", "missing", "presumed dead", "unknown", "transformed"];
export const SPOIL: Record<string, string> = { none: "No spoiler", mild: "Mild spoiler", major: "Major spoiler" };
export const DIRS: Record<string, string> = { mutual: "Mutual", oneway: "One-way (from → to)", unclear: "Unclear" };
export const RSTATUS = ["current", "past", "secret", "suspected", "broken", "complicated"];
export const SIGNIF = ["minor", "important", "central"];
export const ETYPES: Record<string, string> = {
  meeting: "#2563EB", reveal: "#7C3AED", betrayal: "#DC2626", "turning point": "#B7791F", battle: "#EA580C", conflict: "#F97316",
  journey: "#0891B2", discovery: "#16A34A", birth: "#0F766E", death: "#475569", "world event": "#64748B", custom: "#6B7280"
};
export const EIMP = ["minor", "major", "pivotal"];
export const TONES = ["", "hopeful", "tense", "tragic", "joyful", "ominous", "bittersweet", "triumphant", "mysterious"];
export const NTYPES: Record<string, string> = {
  observation: "#2563EB", theory: "#7C3AED", prediction: "#DB2777", question: "#EA580C", foreshadowing: "#B7791F",
  quote: "#16A34A", "favourite scene": "#0891B2", "confusing detail": "#DC2626", comparison: "#475569"
};
export const BOARD_TYPES = ["theory", "prediction", "question"];
export const NSTATUS = ["open", "confirmed", "disproven"] as const;
export const PLACE_KINDS: Record<string, string> = {
  city: "🏙", kingdom: "👑", country: "🗺", house: "🏠", school: "🏫", building: "🏛", room: "🚪", ship: "⛵", planet: "🪐", wilderness: "🌲", sea: "🌊", custom: "📍"
};
export const FACTION_KINDS = ["family", "kingdom / nation", "team", "guild", "school", "company", "intelligence service", "religion", "criminal organisation", "friend group", "military", "custom"];
export const TYPES = ["Book", "Series", "Manga", "TV", "Film", "Game", "Podcast", "Other"];
export const UNITS = ["Page", "Chapter", "Episode", "Volume", "Percent"];
export const RSTAT = ["Reading", "Paused", "Finished", "Rewatching", "Not started"];
