import { useEffect, useMemo } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, BaseEdge, getStraightPath, useReactFlow, type Node, type Edge, type NodeProps, type EdgeProps } from "@xyflow/react";
import { useStore, useAtlas } from "../store";
import { Avatar, Empty, Icon, useVeiled } from "./ui";
import { visChars, visRels, visFactions } from "../model";
import { CAT, PARENT_TYPES } from "../constants";
import type { Atlas, Character, Relationship } from "../types";
import { goto } from "../nav";

const FW = 186, FH = 54, GAP = 34, CGAP = 70, ROWH = 150;
const FAM = CAT.family.color;
type FamData = { c: Character; dim: boolean; sel: boolean; veiled: boolean; hasKids: boolean; collapsed: boolean };

function FamNode({ data }: NodeProps<Node<FamData>>) {
  const toggle = useStore((s) => s.setUi);
  const collapsed = useStore((s) => s.ui.famCollapsed);
  const c = data.c;
  return (
    <div className={"fnode" + (data.sel ? " sel" : "") + (data.dim ? " dimmed" : "") + (c.status === "dead" ? " dead" : "")}>
      <Handle id="t" type="target" position={Position.Top} className="hide" />
      <Handle id="ts" type="source" position={Position.Top} className="hide" />
      <Handle id="l" type="target" position={Position.Left} className="hide" />
      <Handle id="r" type="source" position={Position.Right} className="hide" />
      <Handle id="b" type="source" position={Position.Bottom} className="hide" />
      <Avatar c={c} size={36} veiled={data.veiled} />
      <div style={{ minWidth: 0 }}>
        <div className="nm">{data.veiled ? "Hidden spoiler" : c.name || "Unnamed"}</div>
        <div className="rl">{[c.role, c.status !== "alive" ? c.status : ""].filter(Boolean).join(" · ")}</div>
      </div>
      {data.hasKids && <button className="collapse nodrag" title={data.collapsed ? "Show descendants" : "Hide descendants"} aria-label={data.collapsed ? "Expand branch" : "Collapse branch"}
        onClick={(e) => { e.stopPropagation(); toggle({ famCollapsed: data.collapsed ? collapsed.filter((x) => x !== c.id) : [...collapsed, c.id] }); }}>{data.collapsed ? "+" : "−"}</button>}
    </div>
  );
}
function UnionNode() {
  return <div className="union"><Handle id="t" type="target" position={Position.Top} className="hide" /><Handle id="b" type="source" position={Position.Bottom} className="hide" /></div>;
}
function DoubleEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<{ dashed: boolean; dim: boolean }>>) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const da = data?.dashed ? "7 5" : undefined, op = data?.dim ? 0.15 : 1;
  return <><BaseEdge path={path} style={{ stroke: FAM, strokeWidth: 6, strokeDasharray: da, opacity: op }} /><BaseEdge path={path} style={{ stroke: "var(--surface)", strokeWidth: 2, strokeDasharray: da, opacity: op }} /></>;
}
const nodeTypes = { fam: FamNode, union: UnionNode };
const edgeTypes = { dbl: DoubleEdge };

interface FamGraph { ids: Set<string>; PR: Relationship[]; PT: Relationship[]; SB: Relationship[] }
function famGraph(a: Atlas): FamGraph {
  const vr = visRels(a);
  const PR = vr.filter((r) => PARENT_TYPES.includes(r.type));
  const PT = vr.filter((r) => r.type === "partner");
  const SB = vr.filter((r) => r.type === "sibling");
  const ids = new Set<string>(); [...PR, ...PT, ...SB].forEach((r) => { ids.add(r.from); ids.add(r.to); });
  return { ids, PR, PT, SB };
}
const parentsOf = (g: FamGraph, id: string) => g.PR.filter((r) => r.to === id).map((r) => r.from);
const childrenOf = (g: FamGraph, id: string) => g.PR.filter((r) => r.from === id).map((r) => r.to);
const partnersOf = (g: FamGraph, id: string) => g.PT.filter((r) => r.from === id || r.to === id).map((r) => (r.from === id ? r.to : r.from));

function lineageSet(g: FamGraph, id: string) {
  const set = new Set([id]);
  const up = (x: string) => parentsOf(g, x).forEach((p) => { if (!set.has(p)) { set.add(p); up(p); } });
  const down = (x: string) => childrenOf(g, x).forEach((c) => { if (!set.has(c)) { set.add(c); down(c); } });
  up(id); down(id);
  parentsOf(g, id).forEach((p) => childrenOf(g, p).forEach((c) => set.add(c)));
  partnersOf(g, id).forEach((p) => set.add(p));
  g.SB.forEach((r) => { if (r.from === id) set.add(r.to); if (r.to === id) set.add(r.from); });
  return set;
}

function layout(a: Atlas, g: FamGraph, hidden: Set<string>) {
  const ids = [...g.ids].filter((i) => !hidden.has(i));
  const idSet = new Set(ids);
  const gen: Record<string, number> = {}; ids.forEach((i) => (gen[i] = 0));
  const PR = g.PR.filter((r) => idSet.has(r.from) && idSet.has(r.to)), PT = g.PT.filter((r) => idSet.has(r.from) && idSet.has(r.to)), SB = g.SB.filter((r) => idSet.has(r.from) && idSet.has(r.to));
  for (let it = 0; it < 80; it++) {
    let ch = false;
    PR.forEach((r) => { if (gen[r.to] < gen[r.from] + 1 && gen[r.from] < 40) { gen[r.to] = gen[r.from] + 1; ch = true; } });
    [...PT, ...SB].forEach((r) => { const m = Math.max(gen[r.from], gen[r.to]); if (gen[r.from] !== m || gen[r.to] !== m) { gen[r.from] = gen[r.to] = m; ch = true; } });
    if (!ch) break;
  }
  const rows: Record<number, string[]> = {}; ids.forEach((i) => (rows[gen[i]] = rows[gen[i]] || []).push(i));
  const gens = Object.keys(rows).map(Number).sort((x, y) => x - y);
  const pos: Record<string, { x: number; y: number }> = {};
  const nm = (id: string) => a.characters.find((c) => c.id === id)?.name || "";
  const adj = (list: Relationship[], id: string) => list.filter((r) => r.from === id || r.to === id).map((r) => (r.from === id ? r.to : r.from));
  gens.forEach((gg, gi) => {
    const row = rows[gg], inRow = new Set(row);
    const key = (id: string) => { const ps = PR.filter((r) => r.to === id).map((r) => r.from).filter((p) => pos[p]); return ps.length ? ps.reduce((s, p) => s + pos[p].x, 0) / ps.length : null; };
    const sorted = [...row].sort((x, y) => { const kx = key(x), ky = key(y); if (kx != null && ky != null && kx !== ky) return kx - ky; if (kx == null && ky != null) return 1; if (ky == null && kx != null) return -1; return nm(x).localeCompare(nm(y)); });
    const seen = new Set<string>(); const clusters: string[][] = [];
    sorted.forEach((st) => {
      if (seen.has(st)) return; const cl: string[] = []; const q = [st]; seen.add(st);
      while (q.length) { const cur = q.shift()!; cl.push(cur);
        adj(PT, cur).filter((x) => inRow.has(x) && !seen.has(x)).forEach((x) => { seen.add(x); q.unshift(x); });
        adj(SB, cur).filter((x) => inRow.has(x) && !seen.has(x)).forEach((x) => { seen.add(x); q.push(x); }); }
      clusters.push(cl);
    });
    let cursor = 0; const keyed: [string, number][] = [];
    clusters.forEach((cl, ci) => { if (ci) cursor += CGAP - GAP; cl.forEach((id) => { pos[id] = { x: cursor + FW / 2, y: gi * ROWH }; cursor += FW + GAP; const k = key(id); if (k != null) keyed.push([id, k]); }); });
    if (keyed.length) { const shift = keyed.reduce((s, [id, k]) => s + k - pos[id].x, 0) / keyed.length; row.forEach((id) => (pos[id].x += shift)); }
  });
  return { pos, PR, PT, SB };
}

export default function FamilyView() {
  const a = useAtlas()!;
  const s = useStore();
  const g = useMemo(() => famGraph(a), [a]);
  const mode = s.ui.famMode;
  const modes: [typeof mode, string][] = [["tree", "Family tree"], ["lineage", "Lineage chart"], ["household", "Households"], ["faction", "Factions"]];
  return (
    <div className="pane">
      <div className="toolbar">
        <button className="btn primary sm" onClick={() => s.addRel()}><Icon name="plus" size={15} /> Family link</button>
        <div className="seg" role="group" aria-label="Family view">{modes.map(([m, l]) => <button key={m} className={mode === m ? "on" : ""} onClick={() => s.setUi({ famMode: m })}>{l}</button>)}</div>
        <span className="hint hide-phone">Built from Parent, Partner and Sibling relationships. Select someone to highlight their bloodline. Double line = partners · dashed = uncertain, secret, adoptive or step.</span>
      </div>
      {mode === "tree" && (g.ids.size ? <div style={{ flex: 1, minHeight: 420, position: "relative", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}><div style={{ position: "absolute", inset: 0 }}><ReactFlowProvider><Tree g={g} /></ReactFlowProvider></div></div>
        : <Empty title="No family links yet" text="Add a relationship of type Parent, Partner or Sibling and the tree draws itself."><button className="btn primary" onClick={() => s.addRel()}>Add a family link</button></Empty>)}
      {mode === "lineage" && <Lineage g={g} />}
      {mode === "household" && <Households g={g} />}
      {mode === "faction" && <Households g={g} byFaction />}
    </div>
  );
}

function Tree({ g }: { g: FamGraph }) {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const rf = useReactFlow();
  const collapsed = s.ui.famCollapsed;
  const hidden = useMemo(() => {
    const h = new Set<string>();
    const down = (x: string) => childrenOf(g, x).forEach((c) => { if (!h.has(c)) { h.add(c); down(c); } });
    collapsed.forEach((id) => { if (g.ids.has(id)) down(id); });
    return h;
  }, [g, collapsed]);
  const L = useMemo(() => layout(a, g, hidden), [a, g, hidden]);
  const selId = s.sel?.kind === "char" && L.pos[s.sel.id] ? s.sel.id : null;
  const hl = selId ? lineageSet(g, selId) : null;
  const isPartner = (x: string, y: string) => L.PT.some((r) => (r.from === x && r.to === y) || (r.from === y && r.to === x));
  const dashed = (r: Relationship) => r.status === "suspected" || r.status === "secret" || r.type === "adoptive" || r.type === "step" || r.direction === "unclear";

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []; const edges: Edge[] = [];
    Object.entries(L.pos).forEach(([id, p]) => {
      const c = a.characters.find((x) => x.id === id); if (!c) return;
      nodes.push({ id, type: "fam", position: { x: p.x - FW / 2, y: p.y }, draggable: false, connectable: false,
        data: { c, dim: !!hl && !hl.has(id), sel: selId === id, veiled: veiled(c), hasKids: childrenOf(g, id).length > 0, collapsed: collapsed.includes(id) } });
    });
    const unions = new Map<string, string>();
    L.PT.forEach((r) => {
      const A = L.pos[r.from], B = L.pos[r.to]; if (!A || !B) return;
      const [l, rr] = A.x <= B.x ? [r.from, r.to] : [r.to, r.from];
      edges.push({ id: "pt_" + r.id, source: l, target: rr, sourceHandle: "r", targetHandle: "l", type: "dbl", data: { dashed: dashed(r), dim: !!hl && !(hl.has(r.from) && hl.has(r.to)) } });
    });
    const kids: Record<string, Relationship[]> = {}; L.PR.forEach((r) => (kids[r.to] = kids[r.to] || []).push(r));
    Object.entries(kids).forEach(([cid, rs]) => {
      const ps = rs.map((r) => r.from).filter((p) => L.pos[p]);
      const on = (from: string[]) => !hl || (hl.has(cid) && from.every((f) => hl.has(f)));
      const style = (r: Relationship, from: string[]) => ({ stroke: FAM, strokeWidth: 2.2, strokeDasharray: dashed(r) ? "7 5" : undefined, opacity: on(from) ? 1 : 0.15 });
      if (ps.length === 2 && isPartner(ps[0], ps[1])) {
        const key = [...ps].sort().join("|");
        let u = unions.get(key);
        if (!u) {
          u = "u_" + key; unions.set(key, u);
          const A = L.pos[ps[0]], B = L.pos[ps[1]];
          nodes.push({ id: u, type: "union", position: { x: (A.x + B.x) / 2 - 1, y: A.y + FH / 2 }, draggable: false, selectable: false, connectable: false, data: {} });
        }
        edges.push({ id: "pc_" + cid + u, source: u, target: cid, sourceHandle: "b", targetHandle: "t", type: "smoothstep", style: style(rs[0], ps), pathOptions: { borderRadius: 6 } } as Edge);
      } else rs.filter((r) => L.pos[r.from]).forEach((r) => edges.push({ id: "pc_" + r.id, source: r.from, target: cid, sourceHandle: "b", targetHandle: "t", type: "smoothstep", style: style(r, [r.from]) } as Edge));
    });
    L.SB.forEach((r) => {
      const pa = parentsOf(g, r.from), pb = parentsOf(g, r.to); if (pa.some((p) => pb.includes(p))) return;
      edges.push({ id: "sb_" + r.id, source: r.from, target: r.to, sourceHandle: "ts", targetHandle: "t", type: "smoothstep", style: { stroke: FAM, strokeWidth: 1.8, strokeDasharray: "3 5", opacity: !hl || (hl.has(r.from) && hl.has(r.to)) ? 1 : 0.15 } });
    });
    return { nodes, edges };
  }, [L, a, hl, selId, veiled, collapsed, g]);

  useEffect(() => { const t = setTimeout(() => rf.fitView({ padding: 0.2, maxZoom: 1.1, duration: 250 }), 50); return () => clearTimeout(t); }, [Object.keys(L.pos).length, rf]);

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      onNodeClick={(_, n) => { if (n.type === "fam") s.setSel({ kind: "char", id: n.id }); }}
      onPaneClick={() => s.setSel(null)} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }} minZoom={0.15} proOptions={{ hideAttribution: true }}>
      <Background gap={22} size={1.2} color="var(--line)" />
      <Controls position="top-right" showInteractive={false} />
    </ReactFlow>
  );
}

function Lineage({ g }: { g: FamGraph }) {
  const a = useAtlas()!;
  const veiled = useVeiled();
  if (!g.ids.size) return <Empty title="No family links yet" text="Add Parent or Partner relationships to see the lineage chart." />;
  const byId = new Map(a.characters.map((c) => [c.id, c]));
  const roots = [...g.ids].filter((id) => !parentsOf(g, id).length);
  const done = new Set<string>();
  const item = (c: Character) => <button className="lin-item" onClick={() => goto("char", c.id, { switchView: false })}><Avatar c={c} size={22} veiled={veiled(c)} />{veiled(c) ? "Hidden spoiler" : c.name}</button>;
  const render = (id: string, depth: number): JSX.Element | null => {
    if (done.has(id) || depth > 30) return null; done.add(id);
    const c = byId.get(id); if (!c) return null;
    const partners = partnersOf(g, id).filter((p) => !done.has(p));
    partners.forEach((p) => done.add(p));
    const kids = [...new Set([id, ...partners].flatMap((x) => childrenOf(g, x)))];
    return (
      <li key={id}>
        {item(c)}{partners.map((p) => byId.get(p)).filter(Boolean).map((p) => <span key={p!.id}> <span className="sp">&amp;</span> {item(p!)}</span>)}
        {kids.length > 0 && <ul>{kids.map((k) => render(k, depth + 1))}</ul>}
      </li>
    );
  };
  const tops = roots.map((r) => render(r, 0)).filter(Boolean);
  const rest = [...g.ids].filter((id) => !done.has(id)).map((id) => render(id, 0)).filter(Boolean);
  return <div className="lineage"><ul>{tops}{rest}</ul><p className="hint" style={{ marginTop: 10 }}>Each person is listed with their partner; children are indented beneath them.</p></div>;
}

function Households({ g, byFaction }: { g: FamGraph; byFaction?: boolean }) {
  const a = useAtlas()!;
  const veiled = useVeiled();
  const s = useStore();
  const cs = visChars(a);
  const fs = visFactions(a).filter((f) => (byFaction ? true : f.kind === "family"));
  type House = { key: string; name: string; color: string; symbol: string; members: Character[]; fid?: string };
  const houses: House[] = fs.map((f) => ({ key: f.id, fid: f.id, name: f.name || "Unnamed", color: f.color, symbol: f.symbol, members: cs.filter((c) => c.factionIds.includes(f.id)) }));
  if (!byFaction) {
    const placed = new Set(houses.flatMap((h) => h.members.map((m) => m.id)));
    const bySurname = new Map<string, Character[]>();
    cs.filter((c) => !placed.has(c.id) && g.ids.has(c.id)).forEach((c) => { const sn = (c.name.trim().split(/\s+/).pop() || "Unknown"); bySurname.set(sn, [...(bySurname.get(sn) || []), c]); });
    bySurname.forEach((m, sn) => houses.push({ key: "sn_" + sn, name: "House of " + sn, color: FAM, symbol: "", members: m }));
  }
  if (!houses.length) return <Empty title={byFaction ? "No factions yet" : "No households yet"} text={byFaction ? "Create factions and add characters to them to see them grouped here." : "Create a faction of kind “family”, or add family links, to see households."}><button className="btn primary" onClick={() => { s.setView("factions"); setTimeout(() => useStore.getState().addFaction(), 60); }}>Create a faction</button></Empty>;
  const relWithin = (m: Character[]) => { const ids = new Set(m.map((x) => x.id)); return visRels(a).filter((r) => ids.has(r.from) && ids.has(r.to)); };
  return (
    <div className="households">
      {houses.map((h) => (
        <div className="house" key={h.key} style={{ ["--c" as any]: h.color }}>
          <h3>{h.symbol && <span>{h.symbol}</span>}{h.name}{h.fid && <button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={() => goto("faction", h.fid!, { switchView: false })}>Edit</button>}</h3>
          <ul className="list">{h.members.map((c) => <li key={c.id}><button onClick={() => goto("char", c.id, { switchView: false })}><Avatar c={c} size={26} veiled={veiled(c)} /><span>{veiled(c) ? "Hidden spoiler" : c.name}</span><span className="sub">{c.role}</span></button></li>)}</ul>
          {!h.members.length && <p className="hint">No members yet.</p>}
          {relWithin(h.members).length > 0 && <p className="hint">{relWithin(h.members).length} relationship{relWithin(h.members).length > 1 ? "s" : ""} inside this group</p>}
        </div>
      ))}
    </div>
  );
}
