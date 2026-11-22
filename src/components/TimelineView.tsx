import { useStore, useAtlas } from "../store";
import { Avatar, Empty, Icon, useVeiled } from "./ui";
import { visEvents, visChars, visPlaces, visFactions, posText, isFuture, countHidden, trunc } from "../model";
import { ETYPES, EIMP } from "../constants";
import { goto } from "../nav";

export default function TimelineView() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const { tlMode, tlChar, tlPlace, tlFaction, tlType, tlImp } = s.ui;
  const ord = (o: number | null) => (o == null ? -1e9 : o);
  let evs = visEvents(a).filter((e) => (!tlChar || e.chars.includes(tlChar)) && (!tlPlace || e.locations.includes(tlPlace)) && (!tlFaction || e.factions.includes(tlFaction)) && (!tlType || e.etype === tlType) && (!tlImp || e.importance === tlImp));
  if (tlMode === "reading") evs.sort((x, y) => ord(x.pos.order) - ord(y.pos.order) || x.createdAt - y.createdAt);
  else evs.sort((x, y) => (x.storyOrder ?? 1e12) - (y.storyOrder ?? 1e12) || ord(x.pos.order) - ord(y.pos.order));
  const cs = visChars(a), ps = visPlaces(a), fs = visFactions(a);
  const filtered = !!(tlChar || tlPlace || tlFaction || tlType || tlImp);
  const here = a.progress.order != null && tlMode === "reading";
  let placed = false;
  const cols: JSX.Element[] = [];
  const marker = (k: string) => <div key={k} className="tl-here" data-l={`You are here · ${posText(a, a.progress)}`} />;
  evs.forEach((e) => {
    if (here && !placed && e.pos.order != null && e.pos.order > a.progress.order!) { cols.push(marker("here")); placed = true; }
    const c = ETYPES[e.etype] || ETYPES.custom, v = veiled(e);
    const who = e.chars.map((id) => a.characters.find((x) => x.id === id)).filter((x) => x && !isFuture(a, x.first)) as typeof cs;
    const where = e.locations.map((id) => a.places.find((p) => p.id === id)).filter(Boolean) as typeof ps;
    const top = tlMode === "story" ? e.storyTime || (e.storyOrder != null ? String(e.storyOrder) : "Undated") : posText(a, e.pos) || "Background";
    const meta = [tlMode === "story" ? posText(a, e.pos) : e.storyTime, where.map((p) => p.name).join(", "), e.tone].filter(Boolean).join(" · ");
    cols.push(
      <div key={e.id} className={"tl-col " + e.importance} style={{ ["--c" as any]: c }}>
        <div className="tl-pos">{top}</div><div className="tl-dot" />
        <button className={"tl-card" + (s.sel?.id === e.id ? " sel" : "")} style={{ ["--c" as any]: c }} onClick={() => goto("event", e.id)}>
          <span className="row"><span className="chip" style={{ color: c }}>{e.etype}</span>{e.importance === "pivotal" && <span className="chip">pivotal</span>}</span>
          <h4 className={v ? "veiled" : ""}>{e.title || "Untitled event"}</h4>
          {meta && <span className="tl-meta">{meta}</span>}
          {e.desc && <p className={v ? "veiled" : ""}>{e.desc}</p>}
          {who.length > 0 && <span className="avs">{who.slice(0, 6).map((w) => <span key={w.id} className="av-chip"><Avatar c={w} size={16} veiled={veiled(w)} />{veiled(w) ? "?" : trunc(w.name.split(" ")[0], 12)}</span>)}</span>}
        </button>
      </div>
    );
  });
  if (here && !placed && evs.length) cols.push(marker("here-end"));
  return (
    <div className="pane">
      <div className="toolbar">
        <button className="btn primary sm" onClick={() => s.addEvent()}><Icon name="plus" size={15} /> Event</button>
        <div className="seg" role="group" aria-label="Timeline order">
          <button className={tlMode === "reading" ? "on" : ""} onClick={() => s.setUi({ tlMode: "reading" })}>Reading order</button>
          <button className={tlMode === "story" ? "on" : ""} onClick={() => s.setUi({ tlMode: "story" })}>Story chronology</button>
        </div>
        <select className="sm" aria-label="Filter by character" value={tlChar} onChange={(e) => s.setUi({ tlChar: e.target.value })}><option value="">Everyone</option>{cs.map((c) => <option key={c.id} value={c.id}>{veiled(c) ? "Hidden spoiler" : c.name || "Unnamed"}</option>)}</select>
        {ps.length > 0 && <select className="sm" aria-label="Filter by location" value={tlPlace} onChange={(e) => s.setUi({ tlPlace: e.target.value })}><option value="">Anywhere</option>{ps.map((p) => <option key={p.id} value={p.id}>{p.name || "Unnamed"}</option>)}</select>}
        {fs.length > 0 && <select className="sm" aria-label="Filter by faction" value={tlFaction} onChange={(e) => s.setUi({ tlFaction: e.target.value })}><option value="">Any group</option>{fs.map((f) => <option key={f.id} value={f.id}>{f.name || "Unnamed"}</option>)}</select>}
        <select className="sm" aria-label="Filter by type" value={tlType} onChange={(e) => s.setUi({ tlType: e.target.value })}><option value="">All types</option>{Object.keys(ETYPES).map((t) => <option key={t}>{t}</option>)}</select>
        <select className="sm" aria-label="Filter by importance" value={tlImp} onChange={(e) => s.setUi({ tlImp: e.target.value })}><option value="">Any importance</option>{EIMP.map((t) => <option key={t}>{t}</option>)}</select>
        {filtered && <button className="btn ghost sm" onClick={() => s.setUi({ tlChar: "", tlPlace: "", tlFaction: "", tlType: "", tlImp: "" })}>Clear filters</button>}
      </div>
      <p className="hint">{tlMode === "reading" ? "The order you read about things." : "The order things actually happened, using each event's story year or sort number. Flashbacks move to where they belong."}</p>
      {!evs.length ? (
        filtered ? <Empty title="No events match" text="Try clearing the filters." /> :
          <Empty title="What just happened?" text="Log plot points, meetings, reveals and world events. Each one can name the characters, places and groups involved."><button className="btn primary" onClick={() => s.addEvent()}>Add an event</button></Empty>
      ) : <div className="tl-track"><div className="tl-row">{cols}</div></div>}
      {countHidden(a) > 0 && a.veil && a.progress.order != null && <p className="hint">Anything after {posText(a, a.progress)} is hidden. Untick “Hide what comes later” to see it.</p>}
    </div>
  );
}
