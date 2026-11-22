export type Spoiler = "none" | "mild" | "major";
export interface Pos { order: number | null; label: string }

export interface CustomField { key: string; value: string }

export interface Character {
  id: string;
  name: string;
  aliases: string;
  titles: string;
  pronouns: string;
  emoji: string;
  portrait: string; // data URL, small
  color: string;
  role: string;
  importance: string;
  status: string;
  factionIds: string[];
  tags: string;
  short: string;
  backstory: string;
  traits: string;
  motivations: string;
  fears: string;
  secrets: string;
  beliefs: string;
  skills: string;
  arcStart: string;
  arcTurns: string;
  arcNow: string;
  arcPredicted: string;
  notes: string;
  custom: CustomField[];
  first: Pos;
  spoiler: Spoiler;
  x: number;
  y: number;
  pinned: boolean;
  createdAt: number;
}

export interface RelChange { id: string; pos: Pos; status: string; note: string }

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type: string;
  label: string;
  direction: "mutual" | "oneway" | "unclear";
  status: string;
  significance: string;
  desc: string;
  evidence: string;
  first: Pos;
  end: Pos;
  changes: RelChange[];
  color: string; // optional override, "" = by type
  spoiler: Spoiler;
  createdAt: number;
}

export interface StoryEvent {
  id: string;
  title: string;
  etype: string;
  importance: string;
  tone: string;
  pos: Pos;
  storyTime: string;
  storyOrder: number | null;
  chars: string[];
  locations: string[];
  factions: string[];
  desc: string;
  notes: string;
  spoiler: Spoiler;
  createdAt: number;
}

export interface Place {
  id: string;
  name: string;
  kind: string;
  emoji: string;
  color: string;
  desc: string;
  secrets: string;
  chars: string[];
  links: string[]; // connected location ids (undirected; stored on both)
  first: Pos;
  spoiler: Spoiler;
  x: number;
  y: number;
  createdAt: number;
}

export interface Faction {
  id: string;
  name: string;
  kind: string;
  symbol: string;
  color: string;
  motto: string;
  desc: string;
  goals: string;
  secrets: string;
  hierarchy: string;
  allies: string[];
  enemies: string[];
  first: Pos;
  spoiler: Spoiler;
  createdAt: number;
}

export interface Note {
  id: string;
  ntype: string;
  text: string;
  evidence: string;
  status: "open" | "confirmed" | "disproven";
  confidence: "low" | "medium" | "high";
  chars: string[];
  events: string[];
  locations: string[];
  factions: string[];
  pos: Pos;
  createdAt: number;
}

export interface Atlas {
  id: string;
  title: string;
  creator: string;
  type: string;
  unit: string;
  status: string;
  archived: boolean;
  cover: string;
  progress: Pos;
  veil: boolean;
  demo: boolean;
  characters: Character[];
  relationships: Relationship[];
  events: StoryEvent[];
  places: Place[];
  factions: Faction[];
  notes: Note[];
  createdAt: number;
  updatedAt: number;
  openedAt: number;
}

export type Kind = "char" | "rel" | "event" | "place" | "faction" | "note";
export interface Sel { kind: Kind; id: string }
export type View = "dashboard" | "canvas" | "family" | "timeline" | "places" | "factions" | "notes" | "connections";
