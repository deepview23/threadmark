import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Character, Kind } from "../types";
import { initials, cap } from "../model";
import { PALETTE } from "../constants";

/* ---------- icons (inline, so they work offline) ---------- */
const P: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  canvas: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="M8.2 7.2l7.6 0.6M7 8.3l1.5 7.4M16.3 10l-5.5 6.2" /></>,
  family: <><rect x="9" y="2.5" width="6" height="4.5" rx="1" /><rect x="3" y="17" width="6" height="4.5" rx="1" /><rect x="15" y="17" width="6" height="4.5" rx="1" /><path d="M12 7v5M6 17v-5h12v5" /></>,
  timeline: <><path d="M3 12h18" /><circle cx="7" cy="12" r="2" /><circle cx="13" cy="12" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 10V6M13 14v4M19 10V6" /></>,
  places: <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  factions: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  notes: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v4h4M8 12h8M8 16h6" /></>,
  connections: <><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M7.3 11l9.4-5M7.3 13l9.4 5" /></>,
  layout: <><path d="M4 4h6v6H4zM14 14h6v6h-6z" /><path d="M10 7h4a3 3 0 0 1 3 3v4" /></>,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7M12 17h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;
}

/* ---------- avatars ---------- */
export function useVeiled() {
  const revealed = useStore((s) => s.revealed);
  return (item: { id: string; spoiler?: string } | undefined | null) => !!item && item.spoiler === "major" && !revealed[item.id];
}
export function Avatar({ c, size = 28, veiled }: { c: Pick<Character, "name" | "emoji" | "portrait" | "color">; size?: number; veiled?: boolean }) {
  const style = { width: size, height: size, background: c.color, fontSize: Math.max(9, size * 0.4) };
  if (veiled) return <span className="av" style={style}>?</span>;
  if (c.portrait) return <span className="av" style={style}><img src={c.portrait} alt="" /></span>;
  return <span className="av" style={style}>{c.emoji || initials(c.name)}</span>;
}

/* ---------- form fields bound to an atlas item ---------- */
type Setter = (v: any) => void;
function useEditor(apply: Setter) {
  const pushed = useRef(false);
  const mutate = useStore((s) => s.mutate);
  const pushHistory = useStore((s) => s.pushHistory);
  return {
    onFocus: () => { pushed.current = false; },
    live: (v: any) => { if (!pushed.current) { pushHistory(); pushed.current = true; } mutate(() => apply(v), { history: false }); },
    once: (v: any) => { mutate(() => apply(v)); }
  };
}
export function useItemSetter(kind: Kind, id: string) {
  return (path: string) => (v: any) => {
    const a = useStore.getState().atlas(); if (!a) return;
    const list: any = { char: "characters", rel: "relationships", event: "events", place: "places", faction: "factions", note: "notes" }[kind];
    return (d: any) => {
      const it = d[list].find((x: any) => x.id === id); if (!it) return;
      const ks = path.split("."); let t = it;
      for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
      t[ks[ks.length - 1]] = v;
    };
  };
}
interface FieldProps { kind: Kind; id: string; path: string; label: string; value: any; ph?: string; autoFocus?: boolean }
function makeApply(kind: Kind, id: string, path: string) {
  const list: any = { char: "characters", rel: "relationships", event: "events", place: "places", faction: "factions", note: "notes" }[kind];
  return (v: any) => (d: any) => {
    const it = d[list].find((x: any) => x.id === id); if (!it) return;
    const ks = path.split("."); let t = it;
    for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
    t[ks[ks.length - 1]] = v;
  };
}
function useField(kind: Kind, id: string, path: string) {
  const pushed = useRef(false);
  const mutate = useStore((s) => s.mutate);
  const pushHistory = useStore((s) => s.pushHistory);
  const apply = makeApply(kind, id, path);
  return {
    onFocus: () => { pushed.current = false; },
    live: (v: any) => { if (!pushed.current) { pushHistory(); pushed.current = true; } mutate(apply(v), { history: false }); },
    once: (v: any) => mutate(apply(v))
  };
}
const fid = (id: string, path: string) => `f-${id}-${path.replace(/\./g, "-")}`;
export function TextF({ kind, id, path, label, value, ph, autoFocus }: FieldProps) {
  const f = useField(kind, id, path);
  return <div className="f"><label htmlFor={fid(id, path)}>{label}</label>
    <input id={fid(id, path)} type="text" value={value ?? ""} placeholder={ph} autoFocus={autoFocus} onFocus={f.onFocus} onChange={(e) => f.live(e.target.value)} /></div>;
}
export function AreaF({ kind, id, path, label, value, ph, rows = 3, autoFocus }: FieldProps & { rows?: number }) {
  const f = useField(kind, id, path);
  return <div className="f"><label htmlFor={fid(id, path)}>{label}</label>
    <textarea id={fid(id, path)} rows={rows} value={value ?? ""} placeholder={ph} autoFocus={autoFocus} onFocus={f.onFocus} onChange={(e) => f.live(e.target.value)} /></div>;
}
export function NumF({ kind, id, path, label, value, ph }: FieldProps) {
  const f = useField(kind, id, path);
  return <div className="f"><label htmlFor={fid(id, path)}>{label}</label>
    <input id={fid(id, path)} type="number" inputMode="decimal" value={value ?? ""} placeholder={ph} onFocus={f.onFocus}
      onChange={(e) => f.live(e.target.value === "" ? null : Number(e.target.value))} /></div>;
}
export function SelectF({ kind, id, path, label, value, options }: FieldProps & { options: [string, string][] | string[] }) {
  const f = useField(kind, id, path);
  const opts = (options as any[]).map((o) => (Array.isArray(o) ? o : [o, cap(o) || "—"]));
  return <div className="f"><label htmlFor={fid(id, path)}>{label}</label>
    <select id={fid(id, path)} value={value ?? ""} onChange={(e) => f.once(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}
export function CheckF({ kind, id, path, label, value }: FieldProps) {
  const f = useField(kind, id, path);
  return <label className="check"><input type="checkbox" checked={!!value} onChange={(e) => f.once(e.target.checked)} /> {label}</label>;
}
export function Swatches({ kind, id, path, value }: { kind: Kind; id: string; path: string; value: string }) {
  const f = useField(kind, id, path);
  return <div className="swatches">{PALETTE.map((p) => <button key={p} type="button" className={"sw" + (value === p ? " on" : "")} style={{ background: p }} onClick={() => f.once(p)} aria-label={"Colour " + p} />)}</div>;
}
/** Toggle chips for linking to characters / places / factions / events. */
export function Picks({ items, chosen, onToggle, empty }: { items: { id: string; label: string; color?: string; c?: Character }[]; chosen: string[]; onToggle: (id: string) => void; empty?: string }) {
  if (!items.length) return <span className="hint">{empty || "Nothing to link yet."}</span>;
  return <div className="picks">{items.map((it) => (
    <button key={it.id} type="button" className={"pick" + (chosen.includes(it.id) ? " on" : "")} aria-pressed={chosen.includes(it.id)} onClick={() => onToggle(it.id)}>
      {it.c ? <Avatar c={it.c} size={20} /> : <span className="dot" style={{ background: it.color || "var(--muted)" }} />}{it.label}
    </button>))}</div>;
}
export function useToggleList(kind: Kind, id: string, path: string) {
  const mutate = useStore((s) => s.mutate);
  const list: any = { char: "characters", rel: "relationships", event: "events", place: "places", faction: "factions", note: "notes" }[kind];
  return (val: string) => mutate((d: any) => {
    const it = d[list].find((x: any) => x.id === id); if (!it) return;
    const arr: string[] = it[path]; const i = arr.indexOf(val);
    if (i < 0) arr.push(val); else arr.splice(i, 1);
  });
}

/** A button that asks for a second click before doing something destructive. */
export function ConfirmButton({ onConfirm, children, className = "btn sm danger", armedText = "Click again to delete" }: { onConfirm: () => void; children: ReactNode; className?: string; armedText?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={className + (armed ? " armed" : "")} onClick={(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? armedText : children}</button>;
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="panel-empty"><h3>{title}</h3><p>{text}</p>{children}</div>;
}

export function Toast() {
  const msg = useStore((s) => s.toastMsg), key = useStore((s) => s.toastKey);
  const [on, setOn] = useState(false);
  useEffect(() => { if (!key) return; setOn(true); const t = setTimeout(() => setOn(false), 2400); return () => clearTimeout(t); }, [key]);
  return <div className={"toast" + (on ? " on" : "")} role="status" aria-live="polite">{msg}</div>;
}

export function ModalShell({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><button className="btn icon ghost" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
      {children}
    </div></div>;
}

/** Resize an uploaded image to a small square data URL (keeps the atlas light). */
export function fileToPortrait(file: File, size = 192): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas"); cv.width = cv.height = size;
        const ctx = cv.getContext("2d")!; const s = Math.min(img.width, img.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        res(cv.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = rej; img.src = r.result as string;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const slug = (s: string) => (s || "atlas").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "atlas";
