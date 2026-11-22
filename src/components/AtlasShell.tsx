import { useStore, useAtlas } from "../store";
import { Icon } from "./ui";
import type { View } from "../types";
import { countHidden, posText, unitLower, visChars, visEvents, visNotes, visPlaces, visFactions, num } from "../model";
import Dashboard from "./Dashboard";
import CanvasView from "./CanvasView";
import FamilyView from "./FamilyView";
import TimelineView from "./TimelineView";
import PlacesView from "./PlacesView";
import FactionsView from "./FactionsView";
import NotesView from "./NotesView";
import ConnectionsView from "./ConnectionsView";
import Drawer from "./Drawer";

export const VIEWS: [View, string, string][] = [
  ["dashboard", "Dashboard", "dashboard"], ["canvas", "Character map", "canvas"], ["family", "Family tree", "family"], ["timeline", "Timeline", "timeline"],
  ["places", "Locations", "places"], ["factions", "Factions & groups", "factions"], ["notes", "Notes & theories", "notes"], ["connections", "Connections", "connections"]
];
const SHORT: Record<string, string> = { dashboard: "Home", canvas: "Map", family: "Family", timeline: "Timeline", places: "Places", factions: "Groups", notes: "Notes", connections: "Links" };

export default function AtlasShell() {
  const a = useAtlas()!;
  const s = useStore();
  const counts: Partial<Record<View, number>> = { canvas: visChars(a).length, timeline: visEvents(a).length, places: visPlaces(a).length, factions: visFactions(a).length, notes: visNotes(a).length };
  const hidden = countHidden(a);
  return (
    <div className={"atlas" + (s.sel ? " has-drawer" : "")}>
      <nav className="rail" aria-label="Atlas views">
        <div className="tabs">
          {VIEWS.map(([v, l, ic]) => (
            <button key={v} className={"tab" + (s.view === v ? " on" : "")} onClick={() => s.setView(v)}><Icon name={ic} size={17} />{l}{counts[v] ? <span className="n">{counts[v]}</span> : null}</button>
          ))}
        </div>
        <div className="box">
          <label className="lbl" htmlFor="prog">I'm at {unitLower(a)}</label>
          <ProgressInput />
          <label className="check"><input type="checkbox" checked={a.veil} onChange={(e) => s.mutate((d) => { d.veil = e.target.checked; })} /> Hide what comes later</label>
          <p className="hint">{a.progress.order == null ? "Set your position to hide anything tagged from later in the story." : hidden ? `${hidden} item${hidden > 1 ? "s" : ""} hidden beyond ${posText(a, a.progress)}` : "Nothing hidden"}</p>
        </div>
        <div className="box">
          <div className="lbl">Quick add</div>
          <button className="btn sm" onClick={() => s.addChar()}>Character <kbd>N</kbd></button>
          <button className="btn sm" onClick={() => s.addRel()}>Relationship <kbd>R</kbd></button>
          <button className="btn sm" onClick={() => s.addEvent()}>Event <kbd>E</kbd></button>
          <button className="btn sm" onClick={() => { s.setView("places"); setTimeout(() => useStore.getState().addPlace(), 60); }}>Location <kbd>L</kbd></button>
          <button className="btn sm" onClick={() => s.addNote("theory")}>Theory or note <kbd>T</kbd></button>
        </div>
        <div className="box">
          <button className="btn ghost sm" onClick={() => s.openModal({ type: "atlasSettings" })}>Atlas settings</button>
          <button className="btn ghost sm" onClick={() => s.openModal({ type: "export" })}>Export / back up</button>
          <button className="btn ghost sm" onClick={() => s.openModal({ type: "shortcuts" })}>Keyboard shortcuts <kbd>?</kbd></button>
        </div>
      </nav>
      <main className="main">
        {s.view === "dashboard" && <Dashboard />}
        {s.view === "canvas" && <CanvasView />}
        {s.view === "family" && <FamilyView />}
        {s.view === "timeline" && <TimelineView />}
        {s.view === "places" && <PlacesView />}
        {s.view === "factions" && <FactionsView />}
        {s.view === "notes" && <NotesView />}
        {s.view === "connections" && <ConnectionsView />}
      </main>
      <aside className="drawer" aria-label="Details">{s.sel && <Drawer />}</aside>
      <nav className="bottom-tabs" aria-label="Atlas views">
        {VIEWS.map(([v, , ic]) => <button key={v} className={s.view === v ? "on" : ""} onClick={() => s.setView(v)}><Icon name={ic} size={19} />{SHORT[v]}</button>)}
      </nav>
    </div>
  );
}

export function ProgressInput({ id = "prog" }: { id?: string }) {
  const a = useAtlas()!;
  const mutate = useStore((s) => s.mutate);
  return <input id={id} type="number" min={0} inputMode="numeric" placeholder="e.g. 42" value={a.progress.order ?? ""}
    onChange={(e) => mutate((d) => { d.progress.order = num(e.target.value); })} aria-label={`Current ${unitLower(a)}`} />;
}
