import { Fragment, useEffect, useState } from "react";
import { useStore, useAtlas, type Theme } from "../store";
import { ConfirmButton, ModalShell, downloadText, slug } from "./ui";
import { PALETTE, TYPES, UNITS, RSTAT } from "../constants";
import { listBackups, readBackup } from "../storage";
import { demoAtlas } from "../demo";
import { InstallTip } from "./Library";
import type { Atlas } from "../types";

export default function Modals() {
  const m = useStore((s) => s.modal);
  const close = () => useStore.getState().openModal(null);
  if (!m) return null;
  switch (m.type) {
    case "newAtlas": return <AtlasForm onClose={close} />;
    case "atlasSettings": return <AtlasForm onClose={close} edit />;
    case "import": return <ImportModal onClose={close} />;
    case "export": return <ExportModal onClose={close} />;
    case "settings": return <SettingsModal onClose={close} />;
    case "shortcuts": return <ShortcutsModal onClose={close} />;
    case "unlinkPlaces": return <UnlinkModal onClose={close} {...m.props} />;
    default: return null;
  }
}

function AtlasForm({ onClose, edit }: { onClose: () => void; edit?: boolean }) {
  const s = useStore();
  const a = useAtlas();
  const src: Partial<Atlas> = edit && a ? a : { title: "", creator: "", type: "Book", unit: "Page", status: "Reading", cover: PALETTE[s.atlases.length % PALETTE.length] };
  const [f, setF] = useState({ title: src.title || "", creator: src.creator || "", type: src.type || "Book", unit: src.unit || "Page", status: src.status || "Reading", cover: src.cover || PALETTE[0] });
  const save = () => {
    if (edit && a) { s.mutate((d) => { Object.assign(d, { ...f, title: f.title.trim() || d.title }); }); onClose(); return; }
    const n = s.createAtlas({ ...f, title: f.title.trim() || "Untitled story" });
    onClose(); s.openAtlas(n.id); s.setView("canvas");
  };
  return (
    <ModalShell title={edit ? "Atlas settings" : "New story atlas"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="f"><label htmlFor="m-title">Title</label><input id="m-title" type="text" autoFocus value={f.title} placeholder="e.g. The Spy and the Traitor" onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="f"><label htmlFor="m-creator">Author or creator</label><input id="m-creator" type="text" value={f.creator} onChange={(e) => setF({ ...f, creator: e.target.value })} /></div>
        <div className="f2">
          <div className="f"><label htmlFor="m-type">Type</label><select id="m-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="f"><label htmlFor="m-unit">Track progress by</label><select id="m-unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="f"><label htmlFor="m-status">Status</label><select id="m-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{RSTAT.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="f"><label>Cover colour</label><div className="swatches">{PALETTE.map((p) => <button type="button" key={p} className={"sw" + (f.cover === p ? " on" : "")} style={{ background: p }} aria-label={"Cover " + p} onClick={() => setF({ ...f, cover: p })} />)}</div></div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
          {edit && a && <ConfirmButton className="btn danger" onConfirm={() => { s.removeAtlas(a.id); onClose(); s.toast("Atlas deleted"); }}>Delete atlas</ConfirmButton>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{edit ? "Save" : "Create atlas"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [text, setText] = useState("");
  const doImport = () => {
    let o: any; try { o = JSON.parse(text); } catch { return s.toast("That isn't valid JSON."); }
    const list = Array.isArray(o) ? o : Array.isArray(o?.atlases) ? o.atlases : [o];
    const valid = list.filter((x: any) => x && typeof x === "object" && Array.isArray(x.characters));
    if (!valid.length) return s.toast("That doesn't look like a Threadmark atlas.");
    valid.forEach((x: any, i: number) => s.addExisting(x, i === valid.length - 1 && valid.length === 1));
    onClose(); s.toast(valid.length === 1 ? `Imported “${valid[0].title}”` : `Imported ${valid.length} atlases`);
  };
  return (
    <ModalShell title="Import" onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>Choose a <b>.threadmark.json</b> file (or a full library backup), or paste its contents.</p>
      <input type="file" accept=".json,application/json" aria-label="Choose a file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
      <textarea className="code" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"title": "…", "characters": [ … ]}' aria-label="Atlas JSON" />
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={doImport} disabled={!text.trim()}>Import</button></div>
    </ModalShell>
  );
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const a = useAtlas();
  const s = useStore();
  if (!a) return null;
  const json = JSON.stringify(a, null, 2);
  return (
    <ModalShell title={`Export “${a.title}”`} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>Your atlas is stored only on this device. Download a copy to keep a backup, move it to another device, or share it with a friend who uses Threadmark.</p>
      <div className="row">
        <button className="btn primary" onClick={() => { downloadText(slug(a.title) + ".threadmark.json", json); s.toast("Downloaded"); }}>Download this atlas</button>
        <button className="btn" onClick={() => { downloadText("threadmark-library-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ app: "Threadmark", version: 1, atlases: s.atlases }, null, 2)); s.toast("Library backup downloaded"); }}>Back up whole library</button>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(json).then(() => s.toast("Copied"), () => s.toast("Copy didn't work here"))}>Copy JSON</button>
      </div>
      <p className="hint">On iPhone, the download opens the Share sheet: choose <b>Save to Files</b> (iCloud Drive works well).</p>
    </ModalShell>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [backups, setBackups] = useState<Awaited<ReturnType<typeof listBackups>>>([]);
  useEffect(() => { listBackups().then(setBackups); }, []);
  const themes: [Theme, string][] = [["system", "Match my device"], ["light", "Paper (light)"], ["dark", "Night reading (dark)"], ["sepia", "Sepia"]];
  return (
    <ModalShell title="Settings" onClose={onClose} wide>
      <div className="settings-sec">
        <h3>Appearance</h3>
        <div className="seg" role="group" aria-label="Theme">{themes.map(([t, l]) => <button key={t} className={s.theme === t ? "on" : ""} onClick={() => s.setTheme(t)}>{l}</button>)}</div>
      </div>
      <div className="settings-sec">
        <h3>Your data</h3>
        <p style={{ margin: 0 }}>Everything is stored privately on this device and works offline. Nothing is uploaded anywhere.</p>
        <p className="hint">{s.persisted ? "✓ Your browser has agreed to keep this data safe from automatic clean-up." : "Tip: install Threadmark to your Home Screen or Dock so your device keeps its data permanently."}</p>
        <div className="row">
          <button className="btn" onClick={() => { downloadText("threadmark-library-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ app: "Threadmark", version: 1, atlases: s.atlases }, null, 2)); s.toast("Library backup downloaded"); }}>Download a full backup</button>
          <button className="btn" onClick={() => { onClose(); s.openModal({ type: "import" }); }}>Restore from a file</button>
          <button className="btn ghost" onClick={() => { s.addExisting(demoAtlas()); onClose(); s.toast("Demo atlas added"); }}>Add the demo atlas</button>
        </div>
      </div>
      <div className="settings-sec">
        <h3>Automatic daily snapshots</h3>
        <p className="hint" style={{ marginTop: -4 }}>Threadmark keeps a snapshot of each atlas for each of the last 7 days you used it. Restoring adds the snapshot as a copy, so nothing is overwritten.</p>
        {backups.length ? <ul className="list">{backups.slice(0, 20).map((b) => (
          <li key={b.key}><button onClick={async () => { const at = await readBackup(b.key); if (!at) return; at.title = `${at.title} (restored ${new Date(b.at).toLocaleDateString()})`; s.addExisting(at, false); s.toast("Snapshot restored as a copy"); }}>
            <span>{b.title}</span><span className="sub">{new Date(b.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.counts} · Restore</span></button></li>))}</ul>
          : <p className="hint">No snapshots yet. They're created as you work.</p>}
      </div>
      <div className="settings-sec">
        <h3>Install</h3>
        <InstallTip />
        <p className="hint">Installed, Threadmark opens in its own window, works without internet, and updates itself when a new version is available.</p>
      </div>
      <div className="settings-sec"><h3>About</h3><p className="hint">Threadmark 1.0 · Read the story. Map the threads. Press <kbd>?</kbd> inside an atlas for keyboard shortcuts.</p></div>
    </ModalShell>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [["N", "New character"], ["R", "New relationship"], ["E", "New event"], ["L", "New location"], ["T", "New theory or note"], ["/  or  Ctrl/⌘ F", "Search"], ["Ctrl/⌘ Z", "Undo"], ["Ctrl/⌘ Shift Z", "Redo"], ["Esc", "Close the panel"], ["Double-click map", "Add a character there"], ["Drag a card's ＋", "Connect two characters"], ["Shift-drag on map", "Select several cards"], ["Delete / Backspace", "Delete selected cards on the map"], ["?", "Show this list"]];
  return <ModalShell title="Keyboard shortcuts" onClose={onClose}><div className="kbd-grid">{rows.map(([k, l]) => <Fragment key={k}><kbd>{k}</kbd><span>{l}</span></Fragment>)}</div></ModalShell>;
}

function UnlinkModal({ onClose, x, y }: { onClose: () => void; x: string; y: string }) {
  const a = useAtlas(); const s = useStore();
  if (!a) return null;
  const A = a.places.find((p) => p.id === x), B = a.places.find((p) => p.id === y);
  return (
    <ModalShell title="Connection" onClose={onClose}>
      <p style={{ margin: 0 }}>{A?.name || "?"} ↔ {B?.name || "?"}</p>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>Keep</button>
        <button className="btn danger" onClick={() => { s.mutate((d) => { d.places.forEach((p) => { if (p.id === x) p.links = p.links.filter((l) => l !== y); if (p.id === y) p.links = p.links.filter((l) => l !== x); }); }); onClose(); }}>Remove connection</button>
      </div>
    </ModalShell>
  );
}
