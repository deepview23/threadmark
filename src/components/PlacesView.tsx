import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, useReactFlow, applyNodeChanges, useInternalNode, BaseEdge, ConnectionMode, type Node, type Edge, type NodeProps, type EdgeProps, type NodeChange, type OnConnectStartParams } from "@xyflow/react";
import { useStore, useAtlas } from "../store";
import { Icon, useVeiled } from "./ui";
import { visPlaces, visEvents } from "../model";
import { PLACE_KINDS } from "../constants";
import type { Place } from "../types";
import { registerFocuser } from "../nav";

type PData = { p: Place; veiled: boolean; events: number; people: number };
const PW = 200, PH = 60;

function PlaceNode({ data }: NodeProps<Node<PData>>) {
  const { p } = data;
  return (
    <div className="pnode">
      <Handle type="target" position={Position.Left} className="hide" isConnectable={false} />
      <span className="pin-ico" style={{ background: p.color + "22", color: p.color }}>{p.emoji || PLACE_KINDS[p.kind] || "📍"}</span>
      <div style={{ minWidth: 0 }}>
        <div className="nm">{data.veiled ? "Hidden spoiler" : p.name || "Unnamed place"}</div>
        <div className="rl">{p.kind}{data.people ? ` · ${data.people} people` : ""}{data.events ? ` · ${data.events} events` : ""}</div>
      </div>
      <Handle type="source" position={Position.Right} className="knob" title="Drag onto another place to connect" />
    </div>
  );
}
function LinkEdge({ source, target, selected }: EdgeProps) {
  const sN = useInternalNode(source), tN = useInternalNode(target);
  if (!sN || !tN) return null;
  const s = { x: sN.internals.positionAbsolute.x + (sN.measured.width ?? PW) / 2, y: sN.internals.positionAbsolute.y + (sN.measured.height ?? PH) / 2 };
  const t = { x: tN.internals.positionAbsolute.x + (tN.measured.width ?? PW) / 2, y: tN.internals.positionAbsolute.y + (tN.measured.height ?? PH) / 2 };
  return <BaseEdge path={`M${s.x},${s.y} L${t.x},${t.y}`} interactionWidth={16} style={{ stroke: selected ? "var(--accent)" : "var(--muted)", strokeWidth: 2.2, strokeDasharray: "2 6", strokeLinecap: "round" }} />;
}
const nodeTypes = { place: PlaceNode };
const edgeTypes = { link: LinkEdge };

export default function PlacesView() { return <ReactFlowProvider><Board /></ReactFlowProvider>; }

function Board() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const ps = useMemo(() => visPlaces(a), [a]);
  const evs = useMemo(() => visEvents(a), [a]);
  const build = useCallback((prev: Node<PData>[]) => {
      const m = new Map(prev.map((n) => [n.id, n]));
      return ps.map((p) => {
        const o = m.get(p.id);
        return { ...(o || {}), id: p.id, type: "place", position: o?.dragging ? o.position : { x: p.x, y: p.y }, selected: s.sel?.kind === "place" && s.sel.id === p.id ? true : o?.selected ?? false,
          data: { p, veiled: veiled(p), events: evs.filter((e) => e.locations.includes(p.id)).length, people: p.chars.length } } as Node<PData>;
      });
  }, [ps, evs, veiled, s.sel]);
  const [nodes, setNodes] = useState<Node<PData>[]>(() => build([]));
  useEffect(() => { setNodes((prev) => build(prev)); }, [build]);
  const nodeCount = nodes.length;
  const edges = useMemo<Edge[]>(() => {
    const ids = new Set(ps.map((p) => p.id)); const seen = new Set<string>(); const out: Edge[] = [];
    ps.forEach((p) => p.links.forEach((l) => { if (!ids.has(l)) return; const k = [p.id, l].sort().join("|"); if (seen.has(k)) return; seen.add(k); out.push({ id: "ln_" + k, source: p.id, target: l, type: "link" }); }));
    return out;
  }, [ps, nodeCount]);
  const onNodesChange = useCallback((c: NodeChange[]) => setNodes((ns) => applyNodeChanges(c, ns) as Node<PData>[]), []);
  const from = useRef<string | null>(null);
  const onConnectEnd = useCallback((e: MouseEvent | TouchEvent) => {
    const f = from.current; from.current = null; if (!f) return;
    const pt = "changedTouches" in e ? e.changedTouches[0] : e;
    const p = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
    const hit = nodes.find((n) => p.x >= n.position.x && p.x <= n.position.x + (n.measured?.width ?? PW) && p.y >= n.position.y && p.y <= n.position.y + (n.measured?.height ?? PH));
    if (hit && hit.id !== f) s.mutate((d) => { const A = d.places.find((x) => x.id === f)!, B = d.places.find((x) => x.id === hit.id)!; if (!A.links.includes(B.id)) A.links.push(B.id); if (!B.links.includes(A.id)) B.links.push(A.id); });
  }, [nodes, rf, s]);
  useEffect(() => {
    useStore.setState({ placesCenter: () => { const r = wrap.current?.getBoundingClientRect(); if (!r) return { x: 0, y: 0 }; const p = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); return { x: p.x - PW / 2, y: p.y - PH / 2 }; } });
    registerFocuser("places", (id) => { const p = useStore.getState().atlas()?.places.find((x) => x.id === id); if (p) rf.setCenter(p.x + PW / 2, p.y + PH / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: 400 }); });
    return () => { useStore.setState({ placesCenter: null }); registerFocuser("places", undefined); };
  }, [rf]);
  return (
    <div className="flow-wrap" ref={wrap} onDoubleClick={(e) => { if (!(e.target as Element).classList?.contains("react-flow__pane")) return; const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }); s.addPlace({ x: p.x - PW / 2, y: p.y - PH / 2 }); }}>
      <div className="toolbar float">
        <button className="btn primary sm" onClick={() => s.addPlace()}><Icon name="plus" size={15} /> Location</button>
        <span className="hint hide-phone">An abstract world map: drag places where they feel right, and drag a place's ＋ onto another to connect them.</span>
      </div>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
        onNodeDragStart={() => s.pushHistory()}
        onNodeDragStop={(_, __, dragged) => { const m = new Map(dragged.map((n) => [n.id, n.position])); s.mutate((d) => d.places.forEach((p) => { const q = m.get(p.id); if (q) { p.x = Math.round(q.x); p.y = Math.round(q.y); } }), { history: false }); }}
        onNodeClick={(_, n) => s.setSel({ kind: "place", id: n.id })}
        onEdgeClick={(_, e) => { const [x, y] = e.id.slice(3).split("|"); s.openModal({ type: "unlinkPlaces", props: { x, y } }); }}
        onPaneClick={() => { if (s.sel) s.setSel(null); }}
        onConnectStart={(_: unknown, p: OnConnectStartParams) => { from.current = p.nodeId; }} onConnectEnd={onConnectEnd}
        connectionMode={ConnectionMode.Loose} zoomOnDoubleClick={false} deleteKeyCode={null}
        fitView fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }} minZoom={0.15} proOptions={{ hideAttribution: true }}>
        <Background gap={22} size={1.2} color="var(--line)" />
        <Controls position="top-right" showInteractive={false} />
      </ReactFlow>
      {!ps.length && <div className="flow-empty"><div><h3>Where does the story happen?</h3><p>Add cities, houses, ships, rooms or planets. Double-click the board or press <kbd>L</kbd>.</p><button className="btn primary" onClick={() => s.addPlace()}>Add a location</button></div></div>}
    </div>
  );
}
