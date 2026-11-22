/**
 * Links into the app from the website:
 *   /app/?demo=1                                  open the demo story
 *   /app/?import=/classics/pride-and-prejudice.threadmark.json   add a free classic (same site only)
 */
import { useStore } from "./store";
import { demoAtlas } from "./demo";

export async function handleDeepLink() {
  const q = new URLSearchParams(location.search);
  const s = useStore.getState();
  const clean = () => history.replaceState(null, "", location.pathname + location.hash);
  if (q.has("demo")) {
    const existing = s.atlases.find((a) => a.demo);
    if (existing) s.openAtlas(existing.id); else s.addExisting(demoAtlas());
    s.setView("canvas");
    s.toast("This is a demo story. Explore freely, nothing here is yours to lose.");
    clean();
    return;
  }
  const path = q.get("import");
  if (path) {
    clean();
    if (!/^\/classics\/[a-z0-9-]+\.threadmark\.json$/.test(path)) { s.toast("That link can't be opened."); return; }
    const existing = s.atlases.find((a) => (a as any).sourceUrl === path);
    if (existing) { s.openAtlas(existing.id); s.toast(`“${existing.title}” is already in your library`); return; }
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error();
      const raw = await res.json();
      if (!raw || !Array.isArray(raw.characters)) throw new Error();
      raw.sourceUrl = path;
      s.addExisting(raw, true);
      s.setView("dashboard");
      s.toast(`Added “${raw.title}”. Set the chapter you're on and everything later stays hidden.`);
    } catch {
      s.toast("Couldn't load that book. Check your connection and try the link again.");
    }
  }
}
