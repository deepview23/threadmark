import { useStore, useAtlas } from "../store";
import { Avatar, Empty, Icon, useVeiled } from "./ui";
import { visNotes, posText, isFuture } from "../model";
import { NTYPES, BOARD_TYPES, NSTATUS } from "../constants";
import type { Note } from "../types";
import { goto } from "../nav";

export default function NotesView() {
  const a = useAtlas()!;
  const s = useStore();
  const all = visNotes(a);
  const f = s.ui.noteFilter;
  const ns = all.filter((n) => !f || n.ntype === f);
  const board = ns.filter((n) => BOARD_TYPES.includes(n.ntype));
  const other = ns.filter((n) => !BOARD_TYPES.includes(n.ntype));
  return (
    <div className="pane">
      <div className="toolbar">
        <button className="btn primary sm" onClick={() => s.addNote("observation")}><Icon name="plus" size={15} /> Note</button>
        <button className="btn sm" onClick={() => s.addNote("theory")}>+ Theory</button>
        <button className="btn sm" onClick={() => s.addNote("question")}>+ Question</button>
        <button className="btn sm" onClick={() => s.addNote("quote")}>+ Quote</button>
        <button className="btn sm hide-phone" onClick={() => s.addNote("foreshadowing")}>+ Clue</button>
        <select className="sm" aria-label="Filter notes" value={f} onChange={(e) => s.setUi({ noteFilter: e.target.value })}><option value="">All types</option>{Object.keys(NTYPES).map((t) => <option key={t}>{t}</option>)}</select>
        <span className="hint hide-phone">Facts you've recorded and theories you're testing are kept apart.</span>
      </div>
      {!all.length ? <Empty title="What are you wondering about?" text="Capture observations, quotes, clues, questions and theories. Theories move from Open to Confirmed or Disproven as you read."><button className="btn primary" onClick={() => s.addNote("theory")}>Add a theory</button></Empty> : <>
        {(board.length > 0 || !f || BOARD_TYPES.includes(f)) && <>
          <h3 className="section-h">Theory board</h3>
          <div className="board">
            {NSTATUS.map((st) => { const l = board.filter((n) => n.status === st); return (
              <div className="bcol" key={st}><h3>{st} <span>{l.length}</span></h3>{l.map((n) => <NoteCard key={n.id} n={n} />)}{!l.length && <p className="hint">Nothing here yet.</p>}</div>
            ); })}
          </div>
        </>}
        {other.length > 0 && <><h3 className="section-h">Observations, quotes & clues</h3><div className="ngrid">{other.map((n) => <NoteCard key={n.id} n={n} />)}</div></>}
      </>}
    </div>
  );
}

function NoteCard({ n }: { n: Note }) {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const c = NTYPES[n.ntype] || "#6B7280";
  const who = n.chars.map((id) => a.characters.find((x) => x.id === id)).filter((x) => x && !isFuture(a, x.first));
  const board = BOARD_TYPES.includes(n.ntype);
  const conf = { low: "●○○", medium: "●●○", high: "●●●" }[n.confidence];
  return (
    <div className={"ncard" + (n.ntype === "quote" ? " quote" : "") + (s.sel?.id === n.id ? " sel" : "")} style={{ ["--c" as any]: c }} onClick={() => goto("note", n.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") goto("note", n.id); }}>
      <div className="row"><span className="chip" style={{ color: c }}>{n.ntype}</span>{posText(a, n.pos) && <span className="chip">{posText(a, n.pos)}</span>}</div>
      <div className="txt">{n.ntype === "quote" && n.text ? `“${n.text}”` : n.text || <span className="muted">Empty note. Click to write.</span>}</div>
      {board && n.evidence && <div className="hint">Evidence: {n.evidence}</div>}
      <div className="nfoot">
        {who.map((w) => <span key={w!.id} className="av-chip"><Avatar c={w!} size={16} veiled={veiled(w)} />{veiled(w) ? "?" : w!.name.split(" ")[0]}</span>)}
        {board && <span className="conf" title={"Confidence: " + n.confidence}>{conf}</span>}
        {board && <span className="spacer" />}
        {board && n.status !== "confirmed" && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); s.mutate((d) => { const x = d.notes.find((y) => y.id === n.id); if (x) x.status = "confirmed"; }); }}>✓ Confirm</button>}
        {board && n.status !== "disproven" && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); s.mutate((d) => { const x = d.notes.find((y) => y.id === n.id); if (x) x.status = "disproven"; }); }}>✗ Disprove</button>}
        {board && n.status !== "open" && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); s.mutate((d) => { const x = d.notes.find((y) => y.id === n.id); if (x) x.status = "open"; }); }}>Reopen</button>}
      </div>
    </div>
  );
}
