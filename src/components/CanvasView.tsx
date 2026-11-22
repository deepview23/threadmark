import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap as RFMiniMap, Handle, Position, useReactFlow, applyNodeChanges,
  useInternalNode, BaseEdge, EdgeLabelRenderer, ConnectionMode, MarkerType,
  type Node, type Edge, type NodeProps, type EdgeProps, type NodeChange, type OnConnectStartParams
} from "@xyflow/react";
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceCenter, forceX, forceY } from "d3-force";
import { useStore, useAtlas } from "../store";
import { Avatar, Icon, useVeiled } from "./ui";
import { visChars, visRels, visFactions, relLabel, relCat, trunc } from "../model";
import { CAT, REL, IMPORTANCE, PARENT_TYPES, FAMILY_TYPES } from "../constants";
import type { Character, Relationship, Atlas } from "../types";
import { registerFocuser } from "../nav";

type CharData = { c: Character; dim: boolean; veiled: boolean; fcolors: string[] };
type ClusterData = { name: string; color: string };
type RelData = { r: Relationship; offset: number; dim: boolean; veiled: boolean; showLabel: boolean };

const W = (c: Character) => (c.importance === "main" ? 222 : 196);
const H = 58;

function CharNode({ data }: NodeProps<Node<CharData>>) {
  const { c, veiled } = data;
  const sub = veiled ? "major spoiler · tap to reveal" : [c.role, c.status !== "alive" ? c.status : "", c.short].filter(Boolean).join(" · ");
  return (
    <div className={"cnode" + (c.importance === "main" ? " main" : "") + (c.status === "dead" ? " dead" : "") + (data.dim ? " dimmed" : "")}>
      <Handle type="target" position={Position.Left} className="hide" isConnectable={false} />
      <Avatar c={c} size={40} veiled={veiled} />
      <div className="txt">
        <div className="nm">{veiled ? "Hidden spoiler" : c.name || "Unnamed"}</div>
        <div className="rl">{trunc(sub, 60)}</div>
        {data.fcolors.length > 0 && <div className="tags">{data.fcolors.slice(0, 5).map((col, i) => <i key={i} style={{ background: col }} />)}</div>}
      </div>
      {c.pinned && <span className="pin" title="Pinned" />}
      <Handle type="source" position={Position.Right} className="knob" title="Drag onto another character to connect" />
    </div>
  );
}
function ClusterNode({ data }: NodeProps<Node<ClusterData>>) {
  return <div className="cluster" style={{ width: "100%", height: "100%", borderColor: data.color, background: data.color + "12", position: "relative" }}><span style={{ background: data.color }}>{data.name}</span></div>;
}

/** Point where the line from a node's centre toward (px,py) leaves its rectangle. */
function exitPoint(cx: number, cy: number, w: number, h: number, px: number, py: number) {
  const dx = px - cx, dy = py - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min(dx ? (w / 2 + 3) / Math.abs(dx) : Infinity, dy ? (h / 2 + 3) / Math.abs(dy) : Infinity);
  return t >= 1 ? [cx, cy] : [cx + dx * t, cy + dy * t];
}
function RelEdge({ id, source, target, data, selected, markerEnd }: EdgeProps<Edge<RelData>>) {
  const sN = useInternalNode(source), tN = useInternalNode(target);
  const setSel = useStore((s) => s.setSel);
  if (!sN || !tN || !data) return null;
  const sw = sN.measured.width ?? 200, sh = sN.measured.height ?? H, tw = tN.measured.width ?? 200, th = tN.measured.height ?? H;
  const sx0 = sN.internals.positionAbsolute.x + sw / 2, sy0 = sN.internals.positionAbsolute.y + sh / 2;
  const tx0 = tN.internals.positionAbsolute.x + tw / 2, ty0 = tN.internals.positionAbsolute.y + th / 2;
  const { r, offset } = data;
  const dx = tx0 - sx0, dy = ty0 - sy0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const cx = (sx0 + tx0) / 2 + nx * offset * 2, cy = (sy0 + ty0) / 2 + ny * offset * 2;
  const [sx, sy] = exitPoint(sx0, sy0, sw, sh, offset ? cx : tx0, offset ? cy : ty0);
  const [ex, ey] = exitPoint(tx0, ty0, tw, th, offset ? cx : sx0, offset ? cy : sy0);
  const path = offset ? `M${sx},${sy} Q${cx},${cy} ${ex},${ey}` : `M${sx},${sy} L${ex},${ey}`;
  const mx = offset ? 0.25 * sx + 0.5 * cx + 0.25 * ex : (sx + ex) / 2, my = offset ? 0.25 * sy + 0.5 * cy + 0.25 * ey : (sy + ey) / 2;
  const cat = relCat(r), col = r.color || CAT[cat].color;
  const dashed = r.direction === "unclear" || r.status === "suspected" || r.status === "secret" || r.type === "adoptive" || r.type === "step";
  const width = r.significance === "central" ? 3.2 : r.significance === "minor" ? 1.4 : 2.2;
  const faded = r.status === "past" || r.status === "broken";
  const double = FAMILY_TYPES.includes(r.type) && !PARENT_TYPES.includes(r.type);
  const op = data.dim ? 0.15 : faded ? 0.45 : 1;
  const da = dashed ? "8 6" : undefined;
  return (
    <>
      {selected && <BaseEdge path={path} style={{ stroke: "var(--accent)", strokeWidth: width + 7, opacity: 0.25 }} />}
      {double ? (
        <>
          <BaseEdge id={id} path={path} interactionWidth={18} style={{ stroke: col, strokeWidth: width + 3.6, strokeDasharray: da, opacity: op }} />
          <BaseEdge path={path} interactionWidth={0} style={{ stroke: "var(--bg)", strokeWidth: Math.max(1.3, width - 0.5), strokeDasharray: da, opacity: op }} />
        </>
      ) : <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={18} style={{ stroke: col, strokeWidth: width, strokeDasharray: da, opacity: op }} />}
      {data.showLabel && (
        <EdgeLabelRenderer>
          <div className={"elabel nodrag nopan" + (selected ? " sel" : "")} style={{ transform: `translate(-50%,-50%) translate(${mx}px,${my}px)`, borderColor: col, opacity: data.dim ? 0.2 : 1 }}
            onClick={(e) => { e.stopPropagation(); setSel({ kind: "rel", id: r.id }); }}>
            {data.veiled ? "spoiler" : trunc(relLabel(r), 30)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { char: CharNode, cluster: ClusterNode };
const edgeTypes = { rel: RelEdge };

export default function CanvasView() {
  return <ReactFlowProvider><Canvas /></ReactFlowProvider>;
}

function Canvas() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const { showLabels, showClusters, showMinimap, filterFaction, filterImp } = s.ui;
  const vc = useMemo(() => visChars(a), [a]);
  const rels = useMemo(() => visRels(a), [a]);
  const factions = useMemo(() => visFactions(a), [a]);
  const fColor = useMemo(() => new Map(factions.map((f) => [f.id, f.color])), [factions]);
  const match = useCallback((c: Character) => (!filterFaction || c.factionIds.includes(filterFaction)) && (!filterImp || c.importance === filterImp), [filterFaction, filterImp]);
  const build = useCallback((prev: Node<CharData>[]) => {
      const m = new Map(prev.map((n) => [n.id, n]));
      return vc.map((c) => {
        const p = m.get(c.id);
        return {
          ...(p || {}), id: c.id, type: "char",
          position: p?.dragging ? p.position : { x: c.x, y: c.y },
          data: { c, dim: !match(c), veiled: veiled(c), fcolors: c.factionIds.map((f) => fColor.get(f)).filter(Boolean) as string[] },
          selected: s.sel?.kind === "char" && s.sel.id === c.id ? true : p?.selected ?? false
        } as Node<CharData>;
      });
  }, [vc, match, veiled, fColor, s.sel]);
  const [nodes, setNodes] = useState<Node<CharData>[]>(() => build([]));
  // keep React Flow's node list in step with the atlas (preserving measurements and selection)
  useEffect(() => { setNodes((prev) => build(prev)); }, [build]);
  const nodeCount = nodes.length;

  const clusters = useMemo<Node<ClusterData>[]>(() => {
    if (!showClusters) return [];
    const pos = new Map(nodes.map((n) => [n.id, n]));
    let idx = 0;
    return factions.map((f) => {
      const members = vc.filter((c) => c.factionIds.includes(f.id)).map((c) => pos.get(c.id)).filter(Boolean) as Node<CharData>[];
      if (members.length < 2) return null;
      const xs = members.map((n) => n.position.x), ys = members.map((n) => n.position.y);
      const xe = members.map((n) => n.position.x + (n.measured?.width ?? W(n.data.c))), ye = members.map((n) => n.position.y + (n.measured?.height ?? H));
      const pad = 26 + (idx++) * 18;
      const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad - 4, w = Math.max(...xe) - x + pad, h = Math.max(...ye) - y + pad;
      return { id: "cluster_" + f.id, type: "cluster", position: { x, y }, data: { name: f.name || "Unnamed group", color: f.color }, draggable: false, selectable: false, focusable: false, zIndex: -1, width: w, height: h, measured: { width: w, height: h }, style: { width: w, height: h } } as Node<ClusterData>;
    }).filter(Boolean) as Node<ClusterData>[];
  }, [nodes, factions, vc, showClusters]);

  const edges = useMemo<Edge<RelData>[]>(() => {
    const pairN: Record<string, number> = {}, pairI: Record<string, number> = {};
    rels.forEach((r) => { const k = [r.from, r.to].sort().join("|"); pairN[k] = (pairN[k] || 0) + 1; });
    const byId = new Map(vc.map((c) => [c.id, c]));
    return rels.map((r) => {
      const k = [r.from, r.to].sort().join("|"); const i = (pairI[k] = (pairI[k] || 0) + 1) - 1; const n = pairN[k];
      const offset = (i - (n - 1) / 2) * 42 * (r.from < r.to ? 1 : -1);
      const directed = r.direction === "oneway" || (REL[r.type]?.directed && r.direction !== "unclear");
      const col = r.color || CAT[relCat(r)].color;
      const A = byId.get(r.from)!, B = byId.get(r.to)!;
      return {
        id: r.id, source: r.from, target: r.to, type: "rel", selected: s.sel?.kind === "rel" && s.sel.id === r.id,
        markerEnd: directed ? { type: MarkerType.ArrowClosed, color: col, width: 18, height: 18 } : undefined,
        data: { r, offset, dim: !(match(A) && match(B)), veiled: veiled(r), showLabel: showLabels }
      };
    });
  }, [rels, vc, match, veiled, showLabels, s.sel, nodeCount]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns) as Node<CharData>[]), []);

  // connecting by dragging the + knob onto another card
  const connectFrom = useRef<string | null>(null);
  const onConnectStart = useCallback((_: unknown, p: OnConnectStartParams) => { connectFrom.current = p.nodeId; }, []);
  const onConnectEnd = useCallback((e: MouseEvent | TouchEvent) => {
    const from = connectFrom.current; connectFrom.current = null; if (!from) return;
    const pt = "changedTouches" in e ? e.changedTouches[0] : e;
    const p = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
    const hit = nodes.find((n) => p.x >= n.position.x && p.x <= n.position.x + (n.measured?.width ?? 200) && p.y >= n.position.y && p.y <= n.position.y + (n.measured?.height ?? H));
    if (hit && hit.id !== from) useStore.getState().addRel(from, hit.id);
  }, [nodes, rf]);

  // expose centre / focus helpers for quick-add and search
  useEffect(() => {
    useStore.setState({
      canvasCenter: () => {
        const r = wrap.current?.getBoundingClientRect(); if (!r) return { x: 0, y: 0 };
        const p = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        return { x: p.x - 100, y: p.y - 29 };
      }
    });
    registerFocuser("canvas", (id) => {
      const c = useStore.getState().atlas()?.characters.find((x) => x.id === id); if (!c) return;
      rf.setCenter(c.x + 100, c.y + 29, { zoom: Math.max(rf.getZoom(), 0.9), duration: 400 });
    });
    return () => { useStore.setState({ canvasCenter: null }); registerFocuser("canvas", undefined); };
  }, [rf]);

  const arrange = () => {
    s.mutate((d) => autoLayout(d));
    setTimeout(() => rf.fitView({ padding: 0.2, duration: 400, maxZoom: 1.1 }), 60);
  };

  return (
    <div className="flow-wrap" ref={wrap} onDoubleClick={(e) => {
      if (!(e.target as Element).classList?.contains("react-flow__pane")) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      s.addChar({ x: p.x - 100, y: p.y - 29 });
    }}>
      <div className="toolbar float">
        <button className="btn primary sm" onClick={() => s.addChar()}><Icon name="plus" size={15} /> Character</button>
        <button className="btn sm" onClick={() => s.addRel()}><Icon name="plus" size={15} /> Relationship</button>
        <span className="sep hide-phone" />
        <button className="btn sm" onClick={arrange} title="Arrange the map automatically"><Icon name="layout" size={15} /> <span className="hide-phone">Auto-arrange</span></button>
        <label className="check hide-phone"><input type="checkbox" checked={showLabels} onChange={(e) => s.setUi({ showLabels: e.target.checked })} /> Labels</label>
        <label className="check hide-phone"><input type="checkbox" checked={showClusters} onChange={(e) => s.setUi({ showClusters: e.target.checked })} /> Groups</label>
        <label className="check hide-phone"><input type="checkbox" checked={showMinimap} onChange={(e) => s.setUi({ showMinimap: e.target.checked })} /> Minimap</label>
        {factions.length > 0 && <select className="sm" aria-label="Highlight a faction" value={filterFaction} onChange={(e) => s.setUi({ filterFaction: e.target.value })}><option value="">All groups</option>{factions.map((f) => <option key={f.id} value={f.id}>{f.name || "Unnamed"}</option>)}</select>}
        <select className="sm" aria-label="Highlight by importance" value={filterImp} onChange={(e) => s.setUi({ filterImp: e.target.value })}><option value="">Any importance</option>{IMPORTANCE.map((i) => <option key={i}>{i}</option>)}</select>
      </div>
      <ReactFlow
        nodes={[...clusters, ...nodes] as Node[]} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={() => s.pushHistory()}
        onNodeDragStop={(_, __, dragged) => {
          const moved = new Map(dragged.map((n) => [n.id, n.position]));
          s.mutate((d) => d.characters.forEach((c) => { const p = moved.get(c.id); if (p) { c.x = Math.round(p.x); c.y = Math.round(p.y); } }), { history: false });
        }}
        onNodeClick={(e, n) => { if (e.shiftKey || e.metaKey || e.ctrlKey) return; if (n.type === "char") s.setSel({ kind: "char", id: n.id }); }}
        onEdgeClick={(_, e) => s.setSel({ kind: "rel", id: e.id })}
        onPaneClick={() => { if (s.sel) s.setSel(null); }}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodesDelete={(del) => { const ids = del.filter((n) => n.type === "char").map((n) => n.id); if (!ids.length) return; ids.forEach((id) => s.deleteItem("char", id)); }}
        onEdgesDelete={(del) => del.forEach((e) => s.deleteItem("rel", e.id))}
        deleteKeyCode={["Delete", "Backspace"]}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        zoomOnDoubleClick={false}
        minZoom={0.15} maxZoom={2.5}
        fitView fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
      >
        <Background gap={22} size={1.2} color="var(--line)" />
        <Controls position="top-right" showInteractive={false} />
        {showMinimap && <RFMiniMap position="bottom-right" pannable zoomable nodeColor={(n) => (n.type === "char" ? (n.data as CharData).c.color : "transparent")} nodeStrokeWidth={0} maskColor="rgba(120,130,140,.15)" />}
      </ReactFlow>
      <div className="legend">
        {Object.values(CAT).map((v) => <span key={v.name}><i style={{ borderColor: v.color }} />{v.name}</span>)}
        <span><i style={{ borderTopStyle: "dashed", borderColor: "var(--muted)" }} />Suspected / secret</span>
      </div>
      {!vc.length && (
        <div className="flow-empty"><div><h3>Who have you met so far?</h3><p>Double-click anywhere on the map, or press <kbd>N</kbd>, to add your first character.</p><button className="btn primary" onClick={() => s.addChar()}>Add a character</button></div></div>
      )}
    </div>
  );
}

/** Force-directed arrangement of the visible characters (pinned ones stay put). */
export function autoLayout(a: Atlas) {
  const cs = visChars(a); if (cs.length < 2) return;
  const ids = new Set(cs.map((c) => c.id));
  const nodes = cs.map((c) => ({ id: c.id, x: c.x + 100, y: c.y + 29, fx: c.pinned ? c.x + 100 : undefined, fy: c.pinned ? c.y + 29 : undefined })) as any[];
  const links = a.relationships.filter((r) => ids.has(r.from) && ids.has(r.to)).map((r) => ({ source: r.from, target: r.to }));
  const sim = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-1100))
    .force("link", forceLink(links).id((d: any) => d.id).distance(250).strength(0.5))
    .force("collide", forceCollide(130).strength(1))
    .force("x", forceX(0).strength(0.04))
    .force("y", forceY(0).strength(0.07))
    .force("center", forceCenter(0, 0))
    .stop();
  for (let i = 0; i < 400; i++) sim.tick();
  const pos = new Map(nodes.map((n) => [n.id, n]));
  cs.forEach((c) => { if (c.pinned) return; const n = pos.get(c.id)!; c.x = Math.round(n.x - 100); c.y = Math.round(n.y - 29); });
}
