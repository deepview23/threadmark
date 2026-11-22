import { useStore, useAtlas } from "../store";
import MiniMap from "./MiniMap";
import { Avatar, useVeiled } from "./ui";
import { ProgressInput } from "./AtlasShell";
import { InstallTip } from "./Library";
import { visChars, visRels, visEvents, visNotes, visPlaces, visFactions, posText, unitLower, trunc, cap } from "../model";
import { BOARD_TYPES, ETYPES, NTYPES } from "../constants";
import { goto } from "../nav";
import type { Kind } from "../types";

export default function Dashboard() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const cs = visChars(a), rs = visRels(a), es = visEvents(a), ns = visNotes(a), ps = visPlaces(a), fs = visFactions(a);
  const name = (c: { name: string; id: string; spoiler: string }) => (veiled(c) ? "Hidden spoiler" : c.name || "Unnamed");
  type R = { k: Kind; id: string; t: string; s: string; at: number; c?: any };
  const recent: R[] = [
    ...cs.map((c) => ({ k: "char" as Kind, id: c.id, t: name(c), s: "Character", at: c.createdAt, c })),
    ...es.map((e) => ({ k: "event" as Kind, id: e.id, t: veiled(e) ? "Hidden spoiler" : e.title || "Untitled event", s: "Event", at: e.createdAt })),
    ...ps.map((p) => ({ k: "place" as Kind, id: p.id, t: p.name || "Unnamed place", s: "Location", at: p.createdAt })),
    ...ns.map((n) => ({ k: "note" as Kind, id: n.id, t: trunc(n.text || "Empty note", 46), s: cap(n.ntype), at: n.createdAt }))
  ].sort((x, y) => y.at - x.at).slice(0, 6);
  const spotlight = [...cs.filter((c) => c.importance === "main"), ...cs.filter((c) => c.importance === "supporting")].slice(0, 6);
  const latest = es.filter((e) => e.pos.order != null).sort((x, y) => (y.pos.order! - x.pos.order!))[0];
  const open = ns.filter((n) => BOARD_TYPES.includes(n.ntype) && n.status === "open").slice(0, 6);
  const linked = new Set<string>(); rs.forEach((r) => { linked.add(r.from); linked.add(r.to); });
  const gaps: [string, () => void][] = [];
  const orphans = cs.filter((c) => !linked.has(c.id));
  const noBack = cs.filter((c) => !c.backstory && !c.short);
  const emptyNotes = ns.filter((n) => !n.text.trim());
  if (orphans.length) gaps.push([`${orphans.length} character${orphans.length > 1 ? "s have" : " has"} no relationships yet`, () => goto("char", orphans[0].id)]);
  if (noBack.length) gaps.push([`${noBack.length} character${noBack.length > 1 ? "s have" : " has"} no backstory`, () => goto("char", noBack[0].id)]);
  if (emptyNotes.length) gaps.push([`${emptyNotes.length} unfinished note${emptyNotes.length > 1 ? "s" : ""}`, () => goto("note", emptyNotes[0].id)]);
  if (cs.length >= 3 && !es.length) gaps.push(["No timeline events yet", () => s.setView("timeline")]);
  if (a.progress.order == null) gaps.push(["Set where you are to turn on spoiler hiding", () => document.getElementById("prog-d")?.focus()]);
  return (
    <div className="dash">
      <section className="d-hero dcard" onClick={() => s.setView("canvas")} role="button" tabIndex={0} aria-label="Open the character map" onKeyDown={(e) => { if (e.key === "Enter") s.setView("canvas"); }}>
        <span className="cap">Character map →</span>
        {cs.length ? <MiniMap a={a} w={760} h={300} labels maxK={0.9} bg="var(--surface)" revealed={s.revealed} /> : (
          <div className="flow-empty" onClick={(e) => e.stopPropagation()}><div><h3>Who have you met so far?</h3><p>Add your first character to start the map.</p><button className="btn primary" onClick={() => s.addChar()}>Add a character</button></div></div>
        )}
      </section>
      <section className="tiles">
        <button className="tile" onClick={() => s.setView("canvas")}><b>{cs.length}</b><span>Characters · {rs.length} links</span></button>
        <button className="tile" onClick={() => s.setView("timeline")}><b>{es.length}</b><span>Events</span></button>
        <button className="tile" onClick={() => s.setView("places")}><b>{ps.length}</b><span>Locations</span></button>
        <button className="tile" onClick={() => s.setView("factions")}><b>{fs.length}</b><span>Factions & groups</span></button>
        <button className="tile" onClick={() => s.setView("notes")} style={{ gridColumn: "span 2" }}><b>{ns.length}</b><span>Notes, quotes & theories</span></button>
      </section>
      <section className="dcard span4">
        <h3>Where you are</h3>
        <div className="row" style={{ flexWrap: "nowrap" }}><label htmlFor="prog-d" className="muted" style={{ whiteSpace: "nowrap" }}>I'm at {unitLower(a)}</label><ProgressInput id="prog-d" /></div>
        <label className="check"><input type="checkbox" checked={a.veil} onChange={(e) => s.mutate((d) => { d.veil = e.target.checked; })} /> Hide anything tagged from later</label>
        {latest && <div className="hint">Latest event: <a href="#" onClick={(e) => { e.preventDefault(); goto("event", latest.id); }}>{veiled(latest) ? "Hidden spoiler" : latest.title || "Untitled"}</a> ({posText(a, latest.pos)})</div>}
        <div className="qadd">
          <button className="btn sm" onClick={() => s.addChar()}>+ Character</button>
          <button className="btn sm" onClick={() => s.addRel()}>+ Relationship</button>
          <button className="btn sm" onClick={() => s.addEvent()}>+ Event</button>
          <button className="btn sm" onClick={() => { s.setView("places"); setTimeout(() => useStore.getState().addPlace(), 60); }}>+ Location</button>
          <button className="btn sm" onClick={() => s.addNote("theory")}>+ Theory</button>
          <button className="btn sm" onClick={() => s.addNote("quote")}>+ Quote</button>
        </div>
      </section>
      <section className="dcard span4">
        <h3>Character spotlight</h3>
        {spotlight.length ? <ul className="list">{spotlight.map((c) => <li key={c.id}><button onClick={() => goto("char", c.id)}><Avatar c={c} size={26} veiled={veiled(c)} /><span>{name(c)}</span><span className="sub">{c.role}</span></button></li>)}</ul>
          : <p className="hint">Mark characters as main or supporting to see them here.</p>}
      </section>
      <section className="dcard span4">
        <h3>Recently added</h3>
        {recent.length ? <ul className="list">{recent.map((r) => <li key={r.k + r.id}><button onClick={() => goto(r.k, r.id)}>{r.c ? <Avatar c={r.c} size={26} veiled={veiled(r.c)} /> : <span className="dot" style={{ background: "var(--muted)", margin: "0 8px" }} />}<span>{r.t}</span><span className="sub">{r.s}</span></button></li>)}</ul>
          : <p className="hint">Nothing yet.</p>}
      </section>
      <section className="dcard span6">
        <h3>Open questions & theories</h3>
        {open.length ? <ul className="list">{open.map((n) => <li key={n.id}><button onClick={() => goto("note", n.id)}><span className="dot" style={{ background: NTYPES[n.ntype] }} /><span>{trunc(n.text || "Empty", 80)}</span><span className="sub">{n.ntype}</span></button></li>)}</ul>
          : <p className="hint">No open questions. Press <kbd>T</kbd> to add a theory.</p>}
      </section>
      <section className="dcard span6">
        <h3>Gaps to fill</h3>
        {gaps.length ? <ul className="list">{gaps.map(([t, f]) => <li key={t}><button onClick={f}><span className="dot" style={{ background: "var(--brass)", margin: "0 6px" }} />{t}</button></li>)}</ul> : <p className="hint">Your atlas is in good shape.</p>}
        {latest && <div className="hint" style={{ marginTop: 4 }}>Last thing that happened: <span className="dot" style={{ background: ETYPES[latest.etype] }} /> {veiled(latest) ? "Hidden spoiler" : latest.title}</div>}
      </section>
      <section className="span12"><InstallTip /></section>
    </div>
  );
}
