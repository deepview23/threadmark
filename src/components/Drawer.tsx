import { useStore, useAtlas } from "../store";
import { AreaF, Avatar, CheckF, ConfirmButton, Icon, NumF, Picks, SelectF, Swatches, TextF, fileToPortrait, useToggleList, useVeiled } from "./ui";
import { KIND_LABEL, listFor, posText, unitLower, visChars, visEvents, visNotes, visPlaces, visFactions, relLabel, relCat, initials, uid, trunc, isFuture } from "../model";
import { CAT, CSTATUS, DIRS, EIMP, ETYPES, FACTION_KINDS, IMPORTANCE, NSTATUS, NTYPES, PLACE_KINDS, REL, ROLES, RSTATUS, SIGNIF, SPOIL, TONES, BOARD_TYPES } from "../constants";
import type { Atlas, Character, Faction, Note, Place, Relationship, StoryEvent } from "../types";
import { goto } from "../nav";

const spoilOpts = Object.entries(SPOIL) as [string, string][];

export default function Drawer() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const sel = s.sel!;
  const it = listFor(a, sel.kind).find((x: any) => x.id === sel.id);
  if (!it) return null;
  const v = veiled(it);
  return (
    <>
      <div className="dr-head">
        <span className="dr-kind">{sel.kind === "char" ? "Character dossier" : KIND_LABEL[sel.kind]}</span>
        <button className="btn icon ghost" onClick={() => s.setSel(null)} aria-label="Close details"><Icon name="close" /></button>
      </div>
      <div className="dr-body">
        {v && <div className="veil-banner"><span>Marked as a major spoiler.</span><button className="btn sm" onClick={() => s.reveal(it.id)}>Reveal</button></div>}
        <div className={v ? "veiled" : ""} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sel.kind === "char" && <CharForm a={a} c={it} />}
          {sel.kind === "rel" && <RelForm a={a} r={it} />}
          {sel.kind === "event" && <EventForm a={a} e={it} />}
          {sel.kind === "place" && <PlaceForm a={a} p={it} />}
          {sel.kind === "faction" && <FactionForm a={a} f={it} />}
          {sel.kind === "note" && <NoteForm a={a} n={it} />}
        </div>
      </div>
    </>
  );
}

const charItems = (a: Atlas, veiled: (x: any) => boolean) => visChars(a).map((c) => ({ id: c.id, label: veiled(c) ? "Hidden spoiler" : trunc(c.name || "Unnamed", 20), c }));

function CharForm({ a, c }: { a: Atlas; c: Character }) {
  const s = useStore();
  const veiled = useVeiled();
  const focusNew = s.focusNew;
  const k = "char" as const;
  const rels = a.relationships.filter((r) => (r.from === c.id || r.to === c.id) && !isFuture(a, r.first));
  const evs = visEvents(a).filter((e) => e.chars.includes(c.id));
  const ns = visNotes(a).filter((n) => n.chars.includes(c.id));
  const places = visPlaces(a).filter((p) => p.chars.includes(c.id));
  const fs = visFactions(a);
  const toggleFaction = useToggleList(k, c.id, "factionIds");
  const setCustom = (fn: (cf: { key: string; value: string }[]) => void) => s.mutate((d) => { const x = d.characters.find((y) => y.id === c.id); if (x) fn(x.custom); });
  return (
    <>
      <div className="dossier">
        <div className="pp">
          <Avatar c={c} size={58} />
          <label title="Upload a portrait" aria-label="Upload a portrait"><Icon name="image" size={13} /><input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const url = await fileToPortrait(f); s.mutate((d) => { const x = d.characters.find((y) => y.id === c.id); if (x) x.portrait = url; }); } catch { s.toast("That image couldn't be read."); }
          }} /></label>
        </div>
        <div style={{ minWidth: 0 }}>
          <h2>{c.name || "New character"}</h2>
          <div className="muted">{[c.titles, c.role, c.importance, c.status].filter(Boolean).join(" · ")}</div>
          {c.portrait && <button className="btn ghost sm" style={{ padding: "0 4px", minHeight: 0 }} onClick={() => s.mutate((d) => { const x = d.characters.find((y) => y.id === c.id); if (x) x.portrait = ""; })}>Remove portrait</button>}
        </div>
      </div>
      <TextF kind={k} id={c.id} path="name" label="Name" value={c.name} ph="Who is this?" autoFocus={focusNew} />
      <div className="f2"><TextF kind={k} id={c.id} path="aliases" label="Also known as" value={c.aliases} ph="Nicknames, codenames" /><TextF kind={k} id={c.id} path="titles" label="Titles" value={c.titles} ph="Colonel, Lady, Dr" /></div>
      <div className="f2"><TextF kind={k} id={c.id} path="pronouns" label="Pronouns" value={c.pronouns} /><TextF kind={k} id={c.id} path="emoji" label="Avatar emoji or initials" value={c.emoji} ph={initials(c.name)} /></div>
      <div className="f"><label>Colour</label><Swatches kind={k} id={c.id} path="color" value={c.color} /></div>
      <div className="f2"><SelectF kind={k} id={c.id} path="role" label="Role" value={c.role} options={ROLES} /><SelectF kind={k} id={c.id} path="importance" label="Importance" value={c.importance} options={IMPORTANCE} /></div>
      <div className="f2"><SelectF kind={k} id={c.id} path="status" label="Status" value={c.status} options={CSTATUS} /><SelectF kind={k} id={c.id} path="spoiler" label="Spoiler level" value={c.spoiler} options={spoilOpts} /></div>
      <TextF kind={k} id={c.id} path="short" label="One-line description" value={c.short} ph="How you'd describe them in a sentence" />
      <AreaF kind={k} id={c.id} path="backstory" label="Backstory" value={c.backstory} rows={4} ph="Where they come from, what shaped them" />
      <div className="f2"><NumF kind={k} id={c.id} path="first.order" label={`First appears (${unitLower(a)})`} value={c.first.order} /><TextF kind={k} id={c.id} path="tags" label="Tags" value={c.tags} ph="comma, separated" /></div>
      <div className="f"><label>Factions & groups</label><Picks items={fs.map((f) => ({ id: f.id, label: f.name || "Unnamed", color: f.color }))} chosen={c.factionIds} onToggle={toggleFaction} empty="No factions yet. Create them in Factions & groups." /></div>
      <details className="sect">
        <summary>Inner life</summary>
        <AreaF kind={k} id={c.id} path="traits" label="Traits" value={c.traits} rows={2} />
        <AreaF kind={k} id={c.id} path="motivations" label="Motivations" value={c.motivations} rows={2} />
        <AreaF kind={k} id={c.id} path="fears" label="Fears" value={c.fears} rows={2} />
        <AreaF kind={k} id={c.id} path="secrets" label="Secrets" value={c.secrets} rows={2} />
        <AreaF kind={k} id={c.id} path="beliefs" label="Beliefs" value={c.beliefs} rows={2} />
        <AreaF kind={k} id={c.id} path="skills" label="Skills, powers, possessions" value={c.skills} rows={2} />
      </details>
      <details className="sect">
        <summary>Character arc</summary>
        <AreaF kind={k} id={c.id} path="arcStart" label="At the beginning" value={c.arcStart} rows={2} />
        <AreaF kind={k} id={c.id} path="arcTurns" label="Turning points" value={c.arcTurns} rows={2} />
        <AreaF kind={k} id={c.id} path="arcNow" label="Where they are now" value={c.arcNow} rows={2} />
        <AreaF kind={k} id={c.id} path="arcPredicted" label="How I think it ends (prediction)" value={c.arcPredicted} rows={2} />
      </details>
      <details className="sect">
        <summary>Custom fields ({c.custom.length})</summary>
        {c.custom.map((cf, i) => (
          <div className="custom-row" key={i}>
            <input type="text" aria-label="Field name" placeholder="Field" value={cf.key} onChange={(e) => setCustom((l) => { l[i].key = e.target.value; })} />
            <input type="text" aria-label="Field value" placeholder="Value" value={cf.value} onChange={(e) => setCustom((l) => { l[i].value = e.target.value; })} />
            <button className="btn icon ghost" aria-label="Remove field" onClick={() => setCustom((l) => { l.splice(i, 1); })}><Icon name="close" size={14} /></button>
          </div>
        ))}
        <button className="btn sm" onClick={() => setCustom((l) => { l.push({ key: "", value: "" }); })}>+ Add field</button>
      </details>
      <AreaF kind={k} id={c.id} path="notes" label="My notes" value={c.notes} rows={3} ph="Anything else, with page numbers" />
      <CheckF kind={k} id={c.id} path="pinned" label="Pin in place on the map (auto-arrange won't move it)" value={c.pinned} />
      <div className="sect">
        <h4>Relationships ({rels.length}) <button className="btn sm" onClick={() => s.addRel(c.id)}>+ Add</button></h4>
        {rels.map((r) => { const o = a.characters.find((x) => x.id === (r.from === c.id ? r.to : r.from)); if (!o) return null; const col = r.color || CAT[relCat(r)].color;
          const dir = REL[r.type]?.directed ? (r.from === c.id ? relLabel(r) : `${relLabel(r)} (of ${c.name.split(" ")[0] || "them"})`) : relLabel(r);
          return <button key={r.id} className="linkrow" style={{ ["--c" as any]: col }} onClick={() => goto("rel", r.id, { switchView: false })}><Avatar c={o} size={22} veiled={veiled(o)} />{veiled(o) ? "Hidden spoiler" : o.name || "Unnamed"}<span className="sub">{dir}</span></button>; })}
      </div>
      <div className="sect">
        <h4>Appears in ({evs.length}) <button className="btn sm" onClick={() => s.addEvent()}>+ Event</button></h4>
        {evs.map((e) => <button key={e.id} className="linkrow" style={{ ["--c" as any]: ETYPES[e.etype] }} onClick={() => goto("event", e.id)}>{e.title || "Untitled"}<span className="sub">{posText(a, e.pos)}</span></button>)}
      </div>
      {places.length > 0 && <div className="sect"><h4>Places</h4>{places.map((p) => <button key={p.id} className="linkrow" onClick={() => goto("place", p.id)}>{p.emoji || PLACE_KINDS[p.kind]} {p.name}</button>)}</div>}
      <div className="sect">
        <h4>Notes & theories ({ns.length}) <button className="btn sm" onClick={() => s.addNote("theory")}>+ Theory</button></h4>
        {ns.map((n) => <button key={n.id} className="linkrow" style={{ ["--c" as any]: NTYPES[n.ntype] }} onClick={() => goto("note", n.id)}>{trunc(n.text || "Empty", 48)}<span className="sub">{n.ntype}</span></button>)}
      </div>
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("char", c.id)}>Delete character</ConfirmButton></div>
    </>
  );
}

function RelForm({ a, r }: { a: Atlas; r: Relationship }) {
  const s = useStore();
  const veiled = useVeiled();
  const k = "rel" as const;
  const copts: [string, string][] = visChars(a).map((c) => [c.id, veiled(c) ? "Hidden spoiler" : c.name || "Unnamed"]);
  const setChanges = (fn: (l: Relationship["changes"]) => void) => s.mutate((d) => { const x = d.relationships.find((y) => y.id === r.id); if (x) fn(x.changes); });
  const A = a.characters.find((c) => c.id === r.from), B = a.characters.find((c) => c.id === r.to);
  return (
    <>
      <div className="dossier">{A && <Avatar c={A} size={40} veiled={veiled(A)} />}<span className="muted">—</span>{B && <Avatar c={B} size={40} veiled={veiled(B)} />}<h2 style={{ fontSize: 19 }}>{relLabel(r)}</h2></div>
      <div className="f2"><SelectF kind={k} id={r.id} path="from" label="From" value={r.from} options={copts} /><SelectF kind={k} id={r.id} path="to" label="To" value={r.to} options={copts} /></div>
      <div className="row"><button className="btn sm ghost" onClick={() => s.mutate((d) => { const x = d.relationships.find((y) => y.id === r.id); if (x) [x.from, x.to] = [x.to, x.from]; })}>⇄ Swap direction</button><span className="hint">For “Parent of” or “Mentor to”, From is the parent or mentor.</span></div>
      <div className="f"><label htmlFor={"rt" + r.id}>Type</label>
        <select id={"rt" + r.id} value={r.type} onChange={(e) => s.mutate((d) => { const x = d.relationships.find((y) => y.id === r.id); if (x) x.type = e.target.value; })}>
          {Object.entries(CAT).map(([ck, cv]) => <optgroup key={ck} label={cv.name}>{Object.entries(REL).filter(([, v]) => v.cat === ck).map(([rk, v]) => <option key={rk} value={rk}>{v.label}</option>)}</optgroup>)}
        </select></div>
      <TextF kind={k} id={r.id} path="label" label="Label on the map (optional)" value={r.label} ph="e.g. secretly related, former allies" />
      <div className="f2"><SelectF kind={k} id={r.id} path="direction" label="Direction" value={r.direction} options={Object.entries(DIRS) as [string, string][]} /><SelectF kind={k} id={r.id} path="status" label="Status" value={r.status} options={RSTATUS} /></div>
      <div className="f2"><SelectF kind={k} id={r.id} path="significance" label="Significance" value={r.significance} options={SIGNIF} /><SelectF kind={k} id={r.id} path="spoiler" label="Spoiler level" value={r.spoiler} options={spoilOpts} /></div>
      <div className="f2"><NumF kind={k} id={r.id} path="first.order" label={`Starts at (${unitLower(a)})`} value={r.first.order} /><NumF kind={k} id={r.id} path="end.order" label={`Ends at (${unitLower(a)})`} value={r.end.order} /></div>
      <AreaF kind={k} id={r.id} path="desc" label="How they interact" value={r.desc} rows={4} ph="What's between them, recurring dynamics" />
      <AreaF kind={k} id={r.id} path="evidence" label="Evidence" value={r.evidence} rows={2} ph="Quote or scene, with page number" />
      <div className="f"><label>Line colour</label>
        <div className="swatches"><button className={"sw" + (!r.color ? " on" : "")} style={{ background: CAT[relCat(r)].color }} title="By type" aria-label="Colour by type" onClick={() => s.mutate((d) => { const x = d.relationships.find((y) => y.id === r.id); if (x) x.color = ""; })} />
          {["#16A34A", "#DC2626", "#DB2777", "#2563EB", "#7C3AED", "#EA580C", "#6B7280"].map((col) => <button key={col} className={"sw" + (r.color === col ? " on" : "")} style={{ background: col }} aria-label={"Colour " + col} onClick={() => s.mutate((d) => { const x = d.relationships.find((y) => y.id === r.id); if (x) x.color = col; })} />)}</div></div>
      <div className="sect">
        <h4>How it changes over time</h4>
        {r.changes.map((c, i) => (
          <div className="change" key={c.id}>
            <input type="number" aria-label={`At ${unitLower(a)}`} placeholder={a.unit === "Page" ? "p." : "at"} value={c.pos.order ?? ""} onChange={(e) => setChanges((l) => { l[i].pos.order = e.target.value === "" ? null : Number(e.target.value); })} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <select aria-label="Status at this point" value={c.status} onChange={(e) => setChanges((l) => { l[i].status = e.target.value; })}>{["", ...RSTATUS, "friends", "allies", "rivals", "enemies", "lovers", "estranged"].map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select>
              <input type="text" aria-label="What changed" placeholder="What changed" value={c.note} onChange={(e) => setChanges((l) => { l[i].note = e.target.value; })} />
            </div>
            <button className="btn icon ghost" aria-label="Remove change" onClick={() => setChanges((l) => { l.splice(i, 1); })}><Icon name="close" size={14} /></button>
          </div>
        ))}
        <button className="btn sm" onClick={() => setChanges((l) => { l.push({ id: uid("chg"), pos: { order: a.progress.order, label: "" }, status: r.status, note: "" }); })}>+ Log a change</button>
      </div>
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("rel", r.id)}>Delete relationship</ConfirmButton></div>
    </>
  );
}

function EventForm({ a, e }: { a: Atlas; e: StoryEvent }) {
  const s = useStore();
  const veiled = useVeiled();
  const k = "event" as const;
  const tChars = useToggleList(k, e.id, "chars"), tPlaces = useToggleList(k, e.id, "locations"), tFac = useToggleList(k, e.id, "factions");
  const ordered = visEvents(a).slice().sort((x, y) => (x.pos.order ?? -1e9) - (y.pos.order ?? -1e9) || x.createdAt - y.createdAt);
  const i = ordered.findIndex((x) => x.id === e.id);
  const prev = ordered[i - 1], next = ordered[i + 1];
  return (
    <>
      <TextF kind={k} id={e.id} path="title" label="What happened" value={e.title} ph="e.g. The first meeting at the harbour" autoFocus={s.focusNew} />
      <div className="f2"><SelectF kind={k} id={e.id} path="etype" label="Type" value={e.etype} options={Object.keys(ETYPES)} /><SelectF kind={k} id={e.id} path="importance" label="Importance" value={e.importance} options={EIMP} /></div>
      <div className="f2"><NumF kind={k} id={e.id} path="pos.order" label={`Where in the book (${unitLower(a)})`} value={e.pos.order} /><TextF kind={k} id={e.id} path="pos.label" label="Or a label" value={e.pos.label} ph="e.g. Prologue, Background" /></div>
      <div className="f2"><TextF kind={k} id={e.id} path="storyTime" label="When it happened in the story" value={e.storyTime} ph="e.g. Winter 1968" /><NumF kind={k} id={e.id} path="storyOrder" label="Story year or sort number" value={e.storyOrder} ph="1968" /></div>
      <div className="f2"><SelectF kind={k} id={e.id} path="tone" label="Emotional tone" value={e.tone} options={TONES.map((t) => [t, t ? t.charAt(0).toUpperCase() + t.slice(1) : "—"] as [string, string])} /><SelectF kind={k} id={e.id} path="spoiler" label="Spoiler level" value={e.spoiler} options={spoilOpts} /></div>
      <div className="f"><label>Who was involved</label><Picks items={charItems(a, veiled)} chosen={e.chars} onToggle={tChars} empty="Add characters first." /></div>
      <div className="f"><label>Where</label><Picks items={visPlaces(a).map((p) => ({ id: p.id, label: p.name || "Unnamed", color: p.color }))} chosen={e.locations} onToggle={tPlaces} empty="No locations yet." /></div>
      {visFactions(a).length > 0 && <div className="f"><label>Groups involved</label><Picks items={visFactions(a).map((f) => ({ id: f.id, label: f.name || "Unnamed", color: f.color }))} chosen={e.factions} onToggle={tFac} /></div>}
      <AreaF kind={k} id={e.id} path="desc" label="Description" value={e.desc} rows={4} />
      <AreaF kind={k} id={e.id} path="notes" label="My notes & theories" value={e.notes} rows={2} />
      <div className="sect">
        <h4>Before & after</h4>
        <div className="navrow">
          <button className="btn sm" disabled={!prev} onClick={() => prev && goto("event", prev.id)}>← {prev ? trunc(prev.title || "Untitled", 18) : "Nothing before"}</button>
          <button className="btn sm" disabled={!next} onClick={() => next && goto("event", next.id)}>{next ? trunc(next.title || "Untitled", 18) : "Nothing after"} →</button>
        </div>
        <button className="btn sm" onClick={() => s.addNote("theory", { events: [e.id], chars: e.chars })}>+ Theory about this event</button>
      </div>
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("event", e.id)}>Delete event</ConfirmButton></div>
    </>
  );
}

function PlaceForm({ a, p }: { a: Atlas; p: Place }) {
  const s = useStore();
  const veiled = useVeiled();
  const k = "place" as const;
  const tChars = useToggleList(k, p.id, "chars");
  const toggleLink = (other: string) => s.mutate((d) => {
    const A = d.places.find((x) => x.id === p.id)!, B = d.places.find((x) => x.id === other)!; if (!A || !B) return;
    if (A.links.includes(other)) { A.links = A.links.filter((x) => x !== other); B.links = B.links.filter((x) => x !== p.id); }
    else { A.links.push(other); B.links.push(p.id); }
  });
  const evs = visEvents(a).filter((e) => e.locations.includes(p.id));
  return (
    <>
      <div className="dossier"><span className="pin-ico" style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 26, background: p.color + "22" }}>{p.emoji || PLACE_KINDS[p.kind]}</span><h2>{p.name || "New location"}</h2></div>
      <TextF kind={k} id={p.id} path="name" label="Name" value={p.name} ph="e.g. Moscow Centre" autoFocus={s.focusNew} />
      <div className="f2"><SelectF kind={k} id={p.id} path="kind" label="Kind" value={p.kind} options={Object.keys(PLACE_KINDS)} /><TextF kind={k} id={p.id} path="emoji" label="Icon (emoji)" value={p.emoji} ph={PLACE_KINDS[p.kind]} /></div>
      <div className="f"><label>Colour</label><Swatches kind={k} id={p.id} path="color" value={p.color} /></div>
      <AreaF kind={k} id={p.id} path="desc" label="Description" value={p.desc} rows={3} />
      <AreaF kind={k} id={p.id} path="secrets" label="Secrets & theories" value={p.secrets} rows={2} />
      <div className="f2"><NumF kind={k} id={p.id} path="first.order" label={`First appears (${unitLower(a)})`} value={p.first.order} /><SelectF kind={k} id={p.id} path="spoiler" label="Spoiler level" value={p.spoiler} options={spoilOpts} /></div>
      <div className="f"><label>Characters associated</label><Picks items={charItems(a, veiled)} chosen={p.chars} onToggle={tChars} /></div>
      <div className="f"><label>Connected to</label><Picks items={visPlaces(a).filter((x) => x.id !== p.id).map((x) => ({ id: x.id, label: x.name || "Unnamed", color: x.color }))} chosen={p.links} onToggle={toggleLink} empty="Add another location to connect them." /></div>
      <div className="sect"><h4>Events here ({evs.length}) <button className="btn sm" onClick={() => s.addEvent()}>+ Event</button></h4>{evs.map((e) => <button key={e.id} className="linkrow" style={{ ["--c" as any]: ETYPES[e.etype] }} onClick={() => goto("event", e.id)}>{e.title || "Untitled"}<span className="sub">{posText(a, e.pos)}</span></button>)}</div>
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("place", p.id)}>Delete location</ConfirmButton></div>
    </>
  );
}

function FactionForm({ a, f }: { a: Atlas; f: Faction }) {
  const s = useStore();
  const veiled = useVeiled();
  const k = "faction" as const;
  const members = a.characters.filter((c) => c.factionIds.includes(f.id)).map((c) => c.id);
  const toggleMember = (cid: string) => s.mutate((d) => { const c = d.characters.find((x) => x.id === cid); if (!c) return; c.factionIds = c.factionIds.includes(f.id) ? c.factionIds.filter((x) => x !== f.id) : [...c.factionIds, f.id]; });
  const toggleSide = (side: "allies" | "enemies") => (oid: string) => s.mutate((d) => {
    const A = d.factions.find((x) => x.id === f.id)!, B = d.factions.find((x) => x.id === oid)!; if (!A || !B) return;
    const other = side === "allies" ? "enemies" : "allies";
    if (A[side].includes(oid)) { A[side] = A[side].filter((x) => x !== oid); B[side] = B[side].filter((x) => x !== f.id); }
    else { A[side].push(oid); if (!B[side].includes(f.id)) B[side].push(f.id); A[other] = A[other].filter((x) => x !== oid); B[other] = B[other].filter((x) => x !== f.id); }
  });
  const others = visFactions(a).filter((x) => x.id !== f.id).map((x) => ({ id: x.id, label: x.name || "Unnamed", color: x.color }));
  return (
    <>
      <div className="dossier"><span className="sym" style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 24, color: "#fff", background: f.color }}>{f.symbol || (f.name || "?").charAt(0).toUpperCase()}</span><h2>{f.name || "New group"}</h2></div>
      <TextF kind={k} id={f.id} path="name" label="Name" value={f.name} ph="e.g. House Stark, the KGB" autoFocus={s.focusNew} />
      <div className="f2"><SelectF kind={k} id={f.id} path="kind" label="Kind" value={f.kind} options={FACTION_KINDS} /><TextF kind={k} id={f.id} path="symbol" label="Symbol (emoji or letter)" value={f.symbol} /></div>
      <div className="f"><label>Colour</label><Swatches kind={k} id={f.id} path="color" value={f.color} /></div>
      <TextF kind={k} id={f.id} path="motto" label="Motto" value={f.motto} />
      <AreaF kind={k} id={f.id} path="desc" label="Description" value={f.desc} rows={3} />
      <AreaF kind={k} id={f.id} path="goals" label="Goals" value={f.goals} rows={2} />
      <AreaF kind={k} id={f.id} path="secrets" label="Secrets" value={f.secrets} rows={2} />
      <AreaF kind={k} id={f.id} path="hierarchy" label="Hierarchy" value={f.hierarchy} rows={2} ph="Who answers to whom" />
      <div className="f2"><NumF kind={k} id={f.id} path="first.order" label={`First appears (${unitLower(a)})`} value={f.first.order} /><SelectF kind={k} id={f.id} path="spoiler" label="Spoiler level" value={f.spoiler} options={spoilOpts} /></div>
      <div className="f"><label>Members</label><Picks items={charItems(a, veiled)} chosen={members} onToggle={toggleMember} /></div>
      <div className="f"><label>Allies</label><Picks items={others} chosen={f.allies} onToggle={toggleSide("allies")} empty="Create another group to mark allies." /></div>
      <div className="f"><label>Enemies</label><Picks items={others} chosen={f.enemies} onToggle={toggleSide("enemies")} empty="Create another group to mark enemies." /></div>
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("faction", f.id)}>Delete group</ConfirmButton></div>
    </>
  );
}

function NoteForm({ a, n }: { a: Atlas; n: Note }) {
  const s = useStore();
  const veiled = useVeiled();
  const k = "note" as const;
  const board = BOARD_TYPES.includes(n.ntype);
  const tC = useToggleList(k, n.id, "chars"), tE = useToggleList(k, n.id, "events"), tP = useToggleList(k, n.id, "locations"), tF = useToggleList(k, n.id, "factions");
  return (
    <>
      <SelectF kind={k} id={n.id} path="ntype" label="Type" value={n.ntype} options={Object.keys(NTYPES)} />
      <AreaF kind={k} id={n.id} path="text" label={n.ntype === "quote" ? "Quote" : n.ntype === "theory" ? "My theory" : "Note"} value={n.text} rows={5} autoFocus={s.focusNew}
        ph={n.ntype === "theory" ? "I think…" : n.ntype === "question" ? "Why did…?" : n.ntype === "prediction" ? "By the end…" : ""} />
      {board && <>
        <AreaF kind={k} id={n.id} path="evidence" label="Supporting evidence" value={n.evidence} rows={3} ph="Scenes, quotes and page numbers that back this up" />
        <div className="f2"><SelectF kind={k} id={n.id} path="status" label="Status" value={n.status} options={[...NSTATUS]} /><SelectF kind={k} id={n.id} path="confidence" label="Confidence" value={n.confidence} options={["low", "medium", "high"]} /></div>
      </>}
      <div className="f2"><NumF kind={k} id={n.id} path="pos.order" label={`Where in the book (${unitLower(a)})`} value={n.pos.order} /><TextF kind={k} id={n.id} path="pos.label" label="Or a label" value={n.pos.label} /></div>
      <div className="f"><label>About these characters</label><Picks items={charItems(a, veiled)} chosen={n.chars} onToggle={tC} /></div>
      {visEvents(a).length > 0 && <div className="f"><label>Events</label><Picks items={visEvents(a).map((e) => ({ id: e.id, label: trunc(e.title || "Untitled", 24), color: ETYPES[e.etype] }))} chosen={n.events} onToggle={tE} /></div>}
      {visPlaces(a).length > 0 && <div className="f"><label>Locations</label><Picks items={visPlaces(a).map((p) => ({ id: p.id, label: p.name || "Unnamed", color: p.color }))} chosen={n.locations} onToggle={tP} /></div>}
      {visFactions(a).length > 0 && <div className="f"><label>Groups</label><Picks items={visFactions(a).map((f) => ({ id: f.id, label: f.name || "Unnamed", color: f.color }))} chosen={n.factions} onToggle={tF} /></div>}
      <div className="sect"><ConfirmButton onConfirm={() => s.deleteItem("note", n.id)}>Delete note</ConfirmButton></div>
    </>
  );
}
