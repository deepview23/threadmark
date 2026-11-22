import { useMemo } from "react";
import { useStore, useAtlas } from "../store";
import { Avatar, Empty, useVeiled } from "./ui";
import { visChars, visRels, visEvents, visNotes, relLabel, relCat, posText, trunc } from "../model";
import { CAT, BOARD_TYPES } from "../constants";
import type { Character } from "../types";
import { goto } from "../nav";

export default function ConnectionsView() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const cs = visChars(a), rs = visRels(a), es = visEvents(a), ns = visNotes(a);
  const byId = useMemo(() => new Map(cs.map((c) => [c.id, c])), [cs]);
  const { connA, connB } = s.ui;
  const A = byId.get(connA), B = byId.get(connB);
  const nm = (c?: Character) => (!c ? "?" : veiled(c) ? "Hidden spoiler" : c.name || "Unnamed");
  const adj = useMemo(() => { const m = new Map<string, string[]>(); cs.forEach((c) => m.set(c.id, [])); rs.forEach((r) => { m.get(r.from)?.push(r.to); m.get(r.to)?.push(r.from); }); return m; }, [cs, rs]);
  const degree = cs.map((c) => ({ c, d: new Set(adj.get(c.id)).size })).sort((x, y) => y.d - x.d);
  const maxD = Math.max(1, ...degree.map((x) => x.d));
  const pairs = useMemo(() => {
    const m = new Map<string, number>();
    es.forEach((e) => { const ids = [...new Set(e.chars)].filter((x) => byId.has(x)).sort(); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = ids[i] + "|" + ids[j]; m.set(k, (m.get(k) || 0) + 1); } });
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6);
  }, [es, byId]);
  const path = useMemo(() => {
    if (!A || !B || A.id === B.id) return null;
    const prev = new Map<string, string>(); const q = [A.id]; const seen = new Set([A.id]);
    while (q.length) { const x = q.shift()!; if (x === B.id) break; for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); prev.set(y, x); q.push(y); } }
    if (!seen.has(B.id)) return [];
    const out = [B.id]; let cur = B.id; while (cur !== A.id) { cur = prev.get(cur)!; out.unshift(cur); }
    return out;
  }, [A, B, adj]);
  const relBetween = (x: string, y: string) => rs.filter((r) => (r.from === x && r.to === y) || (r.from === y && r.to === x));
  const Who = ({ c }: { c?: Character }) => c ? <button className="lin-item" onClick={() => goto("char", c.id, { switchView: false })}><Avatar c={c} size={22} veiled={veiled(c)} />{nm(c)}</button> : null;
  if (cs.length < 2) return <div className="pane"><Empty title="Connections need a cast" text="Add at least two characters and a relationship or shared event to explore how people connect." /></div>;
  return (
    <div className="pane">
      <div className="toolbar">
        <label htmlFor="ca" className="muted">Character</label>
        <select id="ca" className="sm" value={connA} onChange={(e) => s.setUi({ connA: e.target.value })}><option value="">Choose…</option>{cs.map((c) => <option key={c.id} value={c.id}>{nm(c)}</option>)}</select>
        <label htmlFor="cb" className="muted">and</label>
        <select id="cb" className="sm" value={connB} onChange={(e) => s.setUi({ connB: e.target.value })}><option value="">anyone</option>{cs.filter((c) => c.id !== connA).map((c) => <option key={c.id} value={c.id}>{nm(c)}</option>)}</select>
        <span className="hint hide-phone">Pick one person to see their web, or two to see how they're linked.</span>
      </div>
      <div className="conn-grid">
        {A && B && (
          <section className="dcard" style={{ gridColumn: "span 12" }}>
            <h3>How {nm(A)} and {nm(B)} connect</h3>
            {path && path.length ? <div className="path">{path.map((id, i) => <span key={id} className="row" style={{ gap: 6 }}>{i > 0 && <span className="arrow">— {relBetween(path[i - 1], id).map(relLabel).join(", ") || "linked"} →</span>}<Who c={byId.get(id)} /></span>)}</div>
              : <p className="hint">No chain of relationships links them yet.</p>}
            <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
              <div><h4 className="hint">Shared events</h4><ul className="list">{es.filter((e) => e.chars.includes(A.id) && e.chars.includes(B.id)).map((e) => <li key={e.id}><button onClick={() => goto("event", e.id)}>{e.title || "Untitled"}<span className="sub">{posText(a, e.pos)}</span></button></li>)}</ul>
                {!es.some((e) => e.chars.includes(A.id) && e.chars.includes(B.id)) && <p className="hint">None yet.</p>}</div>
              <div><h4 className="hint">Notes about both</h4><ul className="list">{ns.filter((n) => n.chars.includes(A.id) && n.chars.includes(B.id)).map((n) => <li key={n.id}><button onClick={() => goto("note", n.id)}>{trunc(n.text || "Empty", 60)}<span className="sub">{n.ntype}</span></button></li>)}</ul>
                {!ns.some((n) => n.chars.includes(A.id) && n.chars.includes(B.id)) && <p className="hint">None yet.</p>}</div>
            </div>
          </section>
        )}
        {A && (
          <>
            <section className="dcard" style={{ gridColumn: "span 6" }}>
              <h3>{nm(A)}'s connections ({new Set(adj.get(A.id)).size})</h3>
              {rs.filter((r) => r.from === A.id || r.to === A.id).map((r) => { const o = byId.get(r.from === A.id ? r.to : r.from); const col = r.color || CAT[relCat(r)].color;
                return <button key={r.id} className="linkrow" style={{ ["--c" as any]: col }} onClick={() => goto("rel", r.id, { switchView: false })}><Avatar c={o!} size={22} veiled={veiled(o)} />{nm(o)}<span className="sub">{relLabel(r)} · {r.status}</span></button>; })}
              {!rs.some((r) => r.from === A.id || r.to === A.id) && <p className="hint">No relationships yet.</p>}
              <p className="hint">{(() => { const d1 = new Set(adj.get(A.id)); const d2 = new Set<string>(); d1.forEach((x) => adj.get(x)?.forEach((y) => { if (y !== A.id && !d1.has(y)) d2.add(y); })); return `${d2.size} more character${d2.size === 1 ? "" : "s"} are two steps away.`; })()}</p>
            </section>
            <section className="dcard" style={{ gridColumn: "span 6" }}>
              <h3>What changed over time</h3>
              {rs.filter((r) => (r.from === A.id || r.to === A.id) && r.changes.length).map((r) => { const o = byId.get(r.from === A.id ? r.to : r.from);
                return <div key={r.id}><div style={{ fontWeight: 600, fontSize: 13 }}>With {nm(o)}</div>{[...r.changes].sort((x, y) => (x.pos.order ?? 0) - (y.pos.order ?? 0)).map((c) => <div key={c.id} className="hint">{posText(a, c.pos) || "—"} · <b>{c.status}</b> {c.note}</div>)}</div>; })}
              {!rs.some((r) => (r.from === A.id || r.to === A.id) && r.changes.length) && <p className="hint">Log changes in a relationship (friends → rivals) from its details panel.</p>}
              <h3 style={{ marginTop: 8 }}>Open questions about {nm(A)}</h3>
              {ns.filter((n) => n.chars.includes(A.id) && BOARD_TYPES.includes(n.ntype) && n.status === "open").map((n) => <button key={n.id} className="linkrow" onClick={() => goto("note", n.id)}>{trunc(n.text || "Empty", 70)}<span className="sub">{n.ntype}</span></button>)}
              {!ns.some((n) => n.chars.includes(A.id) && BOARD_TYPES.includes(n.ntype) && n.status === "open") && <p className="hint">None open.</p>}
            </section>
          </>
        )}
        <section className="dcard" style={{ gridColumn: "span 4" }}>
          <h3>Most connected</h3>
          {degree.slice(0, 6).map(({ c, d }) => <button key={c.id} className="linkrow" onClick={() => s.setUi({ connA: c.id })}><Avatar c={c} size={22} veiled={veiled(c)} /><span style={{ minWidth: 90 }}>{trunc(nm(c), 18)}</span><span className="bar"><i style={{ width: (d / maxD) * 100 + "%" }} /></span><span className="sub">{d}</span></button>)}
        </section>
        <section className="dcard" style={{ gridColumn: "span 4" }}>
          <h3>Most isolated</h3>
          {degree.slice().reverse().filter((x) => x.d <= 1).slice(0, 6).map(({ c, d }) => <button key={c.id} className="linkrow" onClick={() => s.setUi({ connA: c.id })}><Avatar c={c} size={22} veiled={veiled(c)} />{nm(c)}<span className="sub">{d === 0 ? "no links" : "1 link"}</span></button>)}
          {!degree.some((x) => x.d <= 1) && <p className="hint">Everyone has at least two connections.</p>}
        </section>
        <section className="dcard" style={{ gridColumn: "span 4" }}>
          <h3>Appear together most</h3>
          {pairs.map(([k, n]) => { const [x, y] = k.split("|"); return <button key={k} className="linkrow" onClick={() => s.setUi({ connA: x, connB: y })}><Avatar c={byId.get(x)!} size={20} veiled={veiled(byId.get(x))} /><Avatar c={byId.get(y)!} size={20} veiled={veiled(byId.get(y))} />{trunc(nm(byId.get(x)), 12)} & {trunc(nm(byId.get(y)), 12)}<span className="sub">{n} event{n > 1 ? "s" : ""}</span></button>; })}
          {!pairs.length && <p className="hint">Tag characters on events to see who shares scenes.</p>}
        </section>
      </div>
    </div>
  );
}
