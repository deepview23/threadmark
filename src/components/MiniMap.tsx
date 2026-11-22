import type { Atlas } from "../types";
import { visChars, visRels, initials, trunc, relCat } from "../model";
import { CAT } from "../constants";

/** A static, lightweight preview of an atlas's character network. */
export default function MiniMap({ a, w, h, labels = false, maxK = 0.6, bg = "rgba(255,255,255,.9)", revealed = {} }: { a: Atlas; w: number; h: number; labels?: boolean; maxK?: number; bg?: string; revealed?: Record<string, true> }) {
  const cs = visChars(a);
  const rels = visRels(a);
  if (!cs.length) return <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />;
  const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = labels ? 44 : 24;
  const k = Math.min((w - pad * 2) / Math.max(1, maxX - minX), (h - pad * 2) / Math.max(1, maxY - minY), maxK);
  const ox = (w - (maxX - minX) * k) / 2 - minX * k, oy = (h - (maxY - minY) * k) / 2 - minY * k;
  const P = (c: { x: number; y: number }) => [c.x * k + ox, c.y * k + oy];
  const byId = new Map(cs.map((c) => [c.id, c]));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {rels.map((r) => {
        const A = byId.get(r.from), B = byId.get(r.to); if (!A || !B) return null;
        const [x1, y1] = P(A), [x2, y2] = P(B);
        return <line key={r.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={r.color || CAT[relCat(r)].color} strokeWidth={labels ? 2 : 1.6} opacity={0.8} strokeDasharray={r.status === "suspected" || r.status === "secret" ? "5 4" : undefined} />;
      })}
      {cs.map((c) => {
        const [x, y] = P(c); const r = labels ? 16 : c.importance === "main" ? 8 : 6;
        const hidden = c.spoiler === "major" && !revealed[c.id];
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r={r} fill={c.color} stroke={bg} strokeWidth={2} />
            {labels && <>
              <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" fontFamily="IBM Plex Sans, sans-serif">{hidden ? "?" : c.emoji || initials(c.name)}</text>
              <text x={x} y={y + 31} textAnchor="middle" fontSize={11.5} fontWeight={500} fill="currentColor" fontFamily="IBM Plex Sans, sans-serif">{hidden ? "Hidden spoiler" : trunc(c.name || "Unnamed", 18)}</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}
