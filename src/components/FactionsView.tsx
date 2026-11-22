import { useStore, useAtlas } from "../store";
import { Avatar, Empty, Icon, useVeiled } from "./ui";
import { visFactions, visChars, visEvents } from "../model";
import { goto } from "../nav";

export default function FactionsView() {
  const a = useAtlas()!;
  const s = useStore();
  const veiled = useVeiled();
  const fs = visFactions(a), cs = visChars(a), es = visEvents(a);
  const fname = (id: string) => a.factions.find((f) => f.id === id);
  return (
    <div className="pane">
      <div className="toolbar">
        <button className="btn primary sm" onClick={() => s.addFaction()}><Icon name="plus" size={15} /> Faction or group</button>
        <span className="hint hide-phone">Families, kingdoms, teams, services, guilds, gangs. Members show as coloured clusters on the character map.</span>
      </div>
      {!fs.length ? <Empty title="Who belongs together?" text="Create groups such as families, houses, agencies or friend groups, then add members, allies and enemies."><button className="btn primary" onClick={() => s.addFaction()}>Create a group</button></Empty> : (
        <div className="fgrid">
          {fs.map((f) => {
            const members = cs.filter((c) => c.factionIds.includes(f.id));
            const v = veiled(f);
            const evCount = es.filter((e) => e.factions.includes(f.id)).length;
            return (
              <button key={f.id} className={"fcard" + (s.sel?.id === f.id ? " sel" : "")} onClick={() => goto("faction", f.id)}>
                <div className="band" style={{ background: f.color }} />
                <div className="fb">
                  <h3><span className="sym" style={{ background: f.color }}>{f.symbol || (f.name || "?").charAt(0).toUpperCase()}</span><span className={v ? "veiled" : ""}>{f.name || "Unnamed group"}</span></h3>
                  <div className="row"><span className="chip">{f.kind}</span>{evCount > 0 && <span className="chip">{evCount} event{evCount > 1 ? "s" : ""}</span>}</div>
                  {f.motto && <div className="muted" style={{ fontStyle: "italic" }}>“{f.motto}”</div>}
                  {f.desc && <div className={v ? "veiled" : ""} style={{ fontSize: 13 }}>{f.desc}</div>}
                  <div className="avs">{members.slice(0, 10).map((m) => <span key={m.id} className="av-chip"><Avatar c={m} size={16} veiled={veiled(m)} />{veiled(m) ? "?" : m.name.split(" ")[0]}</span>)}{!members.length && <span className="hint">No members yet</span>}</div>
                  {(f.allies.length > 0 || f.enemies.length > 0) && <div className="rel-chips">
                    {f.allies.map((x) => fname(x)).filter(Boolean).map((x) => <span key={x!.id} className="chip" style={{ color: "#16A34A" }}>allied · {x!.name}</span>)}
                    {f.enemies.map((x) => fname(x)).filter(Boolean).map((x) => <span key={x!.id} className="chip" style={{ color: "#DC2626" }}>against · {x!.name}</span>)}
                  </div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
