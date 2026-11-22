import { useMemo, useRef, useState } from "react";
import { useStore, useAtlas } from "../store";
import { Icon, Avatar, useVeiled } from "./ui";
import { visChars, visEvents, visRels, visNotes, visPlaces, visFactions, cap, trunc } from "../model";
import type { Kind, Character } from "../types";
import { goto } from "../nav";

export default function TopBar() {
  const a = useAtlas();
  const s = useStore();
  return (
    <header className="top">
      {a ? (
        <>
          <button className="btn ghost sm" onClick={s.goHome} aria-label="Back to library"><Icon name="back" /> <span className="hide-phone">Library</span></button>
          <div className="crumb">{a.title} {a.demo && <span className="chip demo">Demo</span>}</div>
          <div className="spacer hide-phone" />
          <Search />
          <button className="btn icon ghost hide-phone" onClick={s.undo} title="Undo (Ctrl/⌘+Z)" aria-label="Undo" disabled={!s.past.length}><Icon name="undo" /></button>
          <button className="btn icon ghost hide-phone" onClick={s.redo} title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo" disabled={!s.future.length}><Icon name="redo" /></button>
        </>
      ) : (
        <>
          <div className="brand"><img src={import.meta.env.BASE_URL + "favicon.png"} alt="" />Threadmark</div>
          <div className="crumb muted hide-phone">Read the story. Map the threads.</div>
          <div className="spacer" />
        </>
      )}
      <button className="btn icon ghost" onClick={() => s.openModal({ type: "settings" })} title="Settings" aria-label="Settings"><Icon name="settings" /></button>
    </header>
  );
}

interface Hit { k: Kind; id: string; t: string; s: string; c?: Character }

function Search() {
  const a = useAtlas()!;
  const veiled = useVeiled();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase(); if (!t) return [];
    const has = (...v: (string | undefined)[]) => v.some((x) => (x || "").toLowerCase().includes(t));
    const out: Hit[] = [];
    visChars(a).filter((c) => !veiled(c) && has(c.name, c.aliases, c.titles, c.short, c.backstory, c.traits, c.tags, c.notes, c.secrets, c.motivations)).forEach((c) => out.push({ k: "char", id: c.id, t: c.name || "Unnamed", s: "Character", c }));
    visEvents(a).filter((e) => !veiled(e) && has(e.title, e.desc, e.notes, e.storyTime)).forEach((e) => out.push({ k: "event", id: e.id, t: e.title || "Untitled event", s: "Event" }));
    visPlaces(a).filter((p) => !veiled(p) && has(p.name, p.desc, p.secrets)).forEach((p) => out.push({ k: "place", id: p.id, t: p.name || "Unnamed place", s: "Location" }));
    visFactions(a).filter((f) => !veiled(f) && has(f.name, f.desc, f.goals, f.motto)).forEach((f) => out.push({ k: "faction", id: f.id, t: f.name || "Unnamed group", s: "Faction" }));
    visRels(a).filter((r) => !veiled(r) && has(r.label, r.desc, r.evidence)).forEach((r) => {
      const A = a.characters.find((c) => c.id === r.from), B = a.characters.find((c) => c.id === r.to);
      out.push({ k: "rel", id: r.id, t: `${A?.name || "?"} – ${B?.name || "?"}`, s: "Relationship" });
    });
    visNotes(a).filter((n) => has(n.text, n.evidence)).forEach((n) => out.push({ k: "note", id: n.id, t: trunc(n.text, 60), s: cap(n.ntype) }));
    return out.slice(0, 16);
  }, [q, a, veiled]);
  const pick = (h: Hit) => { goto(h.k, h.id); setOpen(false); setQ(""); ref.current?.blur(); };
  return (
    <div className={"search" + (open ? " open" : "")}>
      <span className="ico"><Icon name="search" size={15} /></span>
      <input id="q" ref={ref} type="search" placeholder="Search  ( / )" aria-label="Search this atlas" autoComplete="off" value={q}
        onChange={(e) => { setQ(e.target.value); setAct(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAct((x) => Math.min(hits.length - 1, x + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAct((x) => Math.max(0, x - 1)); }
          else if (e.key === "Enter" && hits[act]) pick(hits[act]);
        }} />
      {open && q.trim() && (
        <div className="qres">
          {hits.length ? hits.map((h, i) => (
            <button key={h.k + h.id} className={i === act ? "act" : ""} onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
              {h.c ? <Avatar c={h.c} size={22} /> : <span className="dot" style={{ background: "var(--muted)", margin: "0 6px" }} />}
              <span>{h.t}</span><span className="k">{h.s}</span>
            </button>)) : <p className="hint" style={{ padding: 8 }}>No matches for “{q}”.</p>}
        </div>
      )}
    </div>
  );
}
