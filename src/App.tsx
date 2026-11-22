import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import { useStore } from "./store";
import { Toast } from "./components/ui";
import TopBar from "./components/TopBar";
import Library from "./components/Library";
import AtlasShell from "./components/AtlasShell";
import Modals from "./components/Modals";
import { initSync } from "./sync";
import { initLicence } from "./license";
import { initSignup } from "./signup";
import { handleDeepLink } from "./deeplink";

const MOVED_TO = (import.meta.env.VITE_MOVED_TO as string | undefined) || "";

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const curId = useStore((s) => s.curId);
  const theme = useStore((s) => s.theme);
  const [needRefresh, setNeedRefresh] = useState<null | (() => void)>(null);

  useEffect(() => { useStore.getState().init().then(async () => { await initLicence(); await initSignup(); handleDeepLink(); initSync(); }); }, []);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === "system") delete r.dataset.theme; else r.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const update = registerSW({ onNeedRefresh() { setNeedRefresh(() => () => update(true)); }, onOfflineReady() { useStore.getState().toast("Ready to work offline"); } });
  }, []);
  useShortcuts();

  if (!loaded) return <div style={{ display: "grid", placeItems: "center", height: "100%" }} className="muted">Opening your library…</div>;
  return (
    <>
      <TopBar />
      {curId ? <AtlasShell /> : <Library />}
      <Modals />
      <Toast />
      {MOVED_TO && <div className="moved-bar" role="alert"><div><b>Threadmark has moved to a new address.</b> This old version won't get updates. Your books are safe: if you use sync, open the new app and enter your sync code. If not, export each book here (Settings) and import it there.</div><a className="btn sm primary" href={MOVED_TO}>Open the new app</a></div>}
      {needRefresh && <div className="update-bar"><span>A new version of Threadmark is ready.</span><button className="btn sm primary" onClick={() => needRefresh()}>Update</button><button className="btn sm ghost" onClick={() => setNeedRefresh(null)}>Later</button></div>}
    </>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const t = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
      if (e.key === "Escape") {
        if (s.modal) return; // modal handles its own Escape
        if (typing) { t.blur(); return; }
        if (s.sel) s.setSel(null);
        return;
      }
      if (!s.curId || s.modal) return;
      if ((e.metaKey || e.ctrlKey) && !typing) {
        const k = e.key.toLowerCase();
        if (k === "z") { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
        if (k === "y") { e.preventDefault(); s.redo(); return; }
        if (k === "f") { e.preventDefault(); document.getElementById("q")?.focus(); return; }
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") s.addChar();
      else if (k === "r") s.addRel();
      else if (k === "e") s.addEvent();
      else if (k === "l") { s.setView("places"); setTimeout(() => useStore.getState().addPlace(), 60); }
      else if (k === "t") s.addNote("theory");
      else if (k === "/") document.getElementById("q")?.focus();
      else if (e.key === "?") s.openModal({ type: "shortcuts" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
