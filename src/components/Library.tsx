import { useMemo } from "react";
import { useStore } from "../store";
import MiniMap from "./MiniMap";
import { ConfirmButton, downloadText, slug } from "./ui";
import { RSTAT } from "../constants";
import { demoAtlas } from "../demo";
import { posText } from "../model";
import type { Atlas } from "../types";

export default function Library() {
  const s = useStore();
  const { libQ, libStatus, libShowArchived } = s.ui;
  const list = useMemo(() => {
    const q = libQ.trim().toLowerCase();
    return s.atlases
      .filter((a) => (libShowArchived ? true : !a.archived))
      .filter((a) => !libStatus || a.status === libStatus)
      .map((a) => {
        if (!q) return { a, match: "" };
        if ((a.title + " " + a.creator).toLowerCase().includes(q)) return { a, match: "" };
        const c = a.characters.find((c) => (c.name + " " + c.aliases).toLowerCase().includes(q) && c.spoiler !== "major");
        if (c) return { a, match: c.name };
        const p = a.places.find((p) => p.name.toLowerCase().includes(q));
        if (p) return { a, match: p.name };
        const e = a.events.find((e) => e.title.toLowerCase().includes(q) && e.spoiler !== "major");
        if (e) return { a, match: e.title };
        return null;
      })
      .filter(Boolean)
      .sort((x, y) => (y!.a.openedAt || 0) - (x!.a.openedAt || 0)) as { a: Atlas; match: string }[];
  }, [s.atlases, libQ, libStatus, libShowArchived]);

  if (!s.atlases.length) return <section className="lib"><Welcome /></section>;
  const archivedCount = s.atlases.filter((a) => a.archived).length;
  return (
    <section className="lib">
      <div className="lib-head">
        <div><h1>Your story atlases</h1><p>Each atlas starts blank. You add the people you meet and what happens, at your own pace, so nothing is ever spoiled.</p></div>
        <div className="row"><button className="btn primary" onClick={() => s.openModal({ type: "newAtlas" })}>New atlas</button><button className="btn" onClick={() => s.openModal({ type: "import" })}>Import</button></div>
      </div>
      <div className="lib-tools">
        <input type="search" placeholder="Search titles, characters, places…" aria-label="Search all atlases" value={libQ} onChange={(e) => s.setUi({ libQ: e.target.value })} />
        <select className="sm" aria-label="Filter by status" value={libStatus} onChange={(e) => s.setUi({ libStatus: e.target.value })}><option value="">Any status</option>{RSTAT.map((r) => <option key={r}>{r}</option>)}</select>
        {archivedCount > 0 && <label className="check"><input type="checkbox" checked={libShowArchived} onChange={(e) => s.setUi({ libShowArchived: e.target.checked })} /> Show archived ({archivedCount})</label>}
      </div>
      <div className="lib-grid">
        {list.map(({ a, match }) => <AtlasCard key={a.id} a={a} match={match} />)}
        {!list.length && <p className="muted">No atlases match.</p>}
      </div>
    </section>
  );
}

function AtlasCard({ a, match }: { a: Atlas; match: string }) {
  const s = useStore();
  const opened = a.openedAt ? new Date(a.openedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <article className="acard" onClick={() => s.openAtlas(a.id)} onKeyDown={(e) => { if (e.key === "Enter") s.openAtlas(a.id); }} tabIndex={0} aria-label={"Open " + a.title}>
      <div className="acover" style={{ background: `linear-gradient(135deg, ${a.cover}, ${a.cover}cc 60%, ${a.cover}88)` }}><MiniMap a={a} w={300} h={124} bg={a.cover} revealed={s.revealed} /></div>
      <div className="abody">
        <div className="row"><span className="chip">{a.type}</span><span className="chip">{a.status}</span>{a.demo && <span className="chip demo">Demo</span>}{a.archived && <span className="chip">Archived</span>}</div>
        <h3>{a.title}</h3>
        <div className="muted">{a.creator}{a.progress.order != null ? ` · at ${posText(a, a.progress)}` : ""}</div>
        {match && <div className="match">Matches <b>{match}</b></div>}
        <div className="astats"><span><b>{a.characters.length}</b> characters</span><span><b>{a.relationships.length}</b> links</span><span><b>{a.events.length}</b> events</span></div>
        <div className="hint">Opened {opened}</div>
      </div>
      <div className="aact" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost sm" onClick={() => s.duplicateAtlas(a.id)}>Duplicate</button>
        <button className="btn ghost sm" onClick={() => { downloadText(slug(a.title) + ".threadmark.json", JSON.stringify(a, null, 2)); s.toast("Exported " + a.title); }}>Export</button>
        <button className="btn ghost sm" onClick={() => s.updateAtlasById(a.id, (d) => { d.archived = !d.archived; })}>{a.archived ? "Unarchive" : "Archive"}</button>
        <span className="spacer" />
        <ConfirmButton className="btn ghost sm danger" onConfirm={() => { s.removeAtlas(a.id); s.toast("Atlas deleted"); }}>Delete</ConfirmButton>
      </div>
    </article>
  );
}

function Welcome() {
  const s = useStore();
  const demo = useMemo(() => demoAtlas(), []);
  return (
    <div className="welcome">
      <div>
        <h2>Read the story. Map the threads.</h2>
        <p className="muted">Threadmark is a private, visual reader's companion. As you read, you build a living map of characters, relationships, families, events, locations and theories. It never fills anything in for you, so it can't spoil a thing, and everything stays on this device.</p>
        <ol>
          <li>Name the story.</li>
          <li>Add the people you meet: who they are, where they come from.</li>
          <li>Draw how they connect, log what happens, and test your theories.</li>
        </ol>
        <div className="row">
          <button className="btn primary" onClick={() => s.openModal({ type: "newAtlas" })}>Start a blank atlas</button>
          <button className="btn" onClick={() => { s.addExisting(demoAtlas()); s.toast("Demo atlas added. Delete it whenever you like."); }}>Explore a demo first</button>
          <button className="btn ghost" onClick={() => s.openModal({ type: "import" })}>Import</button>
        </div>
        <InstallTip />
      </div>
      <div><MiniMap a={demo} w={460} h={300} labels maxK={0.8} bg="var(--surface)" /><p className="hint" style={{ textAlign: "center" }}>A tiny fictional demo: a lighthouse family and their smuggler rivals.</p></div>
    </div>
  );
}

export function InstallTip() {
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone);
  if (standalone) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div className="install-tip" style={{ marginTop: 18 }}>
      <span>📲</span>
      <span>{ios ? <>Install it: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>. It then opens full screen and works offline.</>
        : <>Install it as an app: in Safari choose <b>File → Add to Dock</b>; in Chrome or Edge click the <b>install</b> icon in the address bar.</>}</span>
    </div>
  );
}
