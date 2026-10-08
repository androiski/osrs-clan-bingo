// Makes the preview's made-up raw data, data/preview/{history,events}.json, from the
// sample board in sample-data.js. Those files are the same kind update.js keeps for the
// real event, so `node update.js --preview` builds the preview board with the real rules
// (plus the mod entries). Run once with `node make-preview.js`; the output is committed.
//
// The sample runs over about five days; its times are squeezed into the real event.

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

// sample-data.js imports board.js, which expects a browser page: give it a stand-in.
const any = new Proxy(function(){}, {get: (_, k) => k === Symbol.toPrimitive ? () => "" : any, apply: () => any});
Object.assign(globalThis, {document: any, matchMedia: any, localStorage: any, addEventListener: any, window: globalThis});

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const {TEAMS, TRACK, TILE_ITEMS} = await import("./data.js");
const {whenKey} = await import("./board.js");
const sample = (await import("./sample-data.js")).default;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));

const start = Date.parse(config.start) / 1000, end = Date.parse(config.end) / 1000;
const scale = (end - start) / 3600 / sample.nowH;               // sample hours -> event hours
const at = h => Math.round(start + Math.min(h * scale, (end - start) / 3600 - 0.01) * 3600);
const hoursOf = when => typeof when === "number" ? when : whenKey(when) / 60 - 24;

// KC/XP: each tracked tile's team total over time, split between that team's players by
// their share of the final total, and between the tile's bosses evenly.
const BASE = 100;   // everyone starts with some KC/XP already
const value = {};   // value[rsn][act] = [[t, v]] gains over time
for (const [i, byTeam] of Object.entries(sample.dry || {})){
  const acts = (TRACK[i] || {}).acts;
  if (!acts) continue;
  for (const [teamId, series] of Object.entries(byTeam)){
    const rows = ((sample.byPlayer[i] || {})[teamId]) || [];
    const total = rows.reduce((s, r) => s + r[1], 0) || 1;
    for (const [rsn, gain] of rows) for (const act of acts){
      const share = gain / total / acts.length;
      const mine = ((value[rsn] ||= {})[act] ||= []);
      if (mine.length) continue;   // another tile already set this player's total for the act
      for (const [h, v] of series) mine.push([at(h), Math.round(v * share)]);
    }
  }
}
const baseline = {}, times = new Set();
for (const t of TEAMS) for (const rsn of t.members){
  baseline[rsn] = {};
  for (const act of Object.keys(value[rsn] || {})) baseline[rsn][act] = BASE;
  for (const pts of Object.values(value[rsn] || {})) for (const [t] of pts) if (t > start) times.add(t);
}
const points = [];
const last = {};
for (const t of [...times].sort((a, b) => a - b)){
  const changes = {};
  for (const [rsn, acts] of Object.entries(value)) for (const [act, pts] of Object.entries(acts)){
    let v = 0;
    for (const [pt, pv] of pts){ if (pt > t) break; v = pv; }
    const now = BASE + v, key = `${rsn}|${act}`;
    if (last[key] !== now && now !== BASE){ (changes[rsn] ||= {})[act] = now; last[key] = now; }
  }
  if (Object.keys(changes).length) points.push([t, changes]);
}

// Drops: every sample drop, plus the drop that finished each tile.
const name = new Map();
for (const rows of Object.values(TILE_ITEMS)) for (const r of rows) name.set(r[1], r[0]);
const events = [];
const add = (h, rsn, id) => { if (id && name.has(id)) events.push({t: at(h), rsn, id, name: name.get(id), src: "new"}); };
for (const byTeam of Object.values(sample.drops || {})) for (const list of Object.values(byTeam))
  for (const d of list) add(d.h, d.by, d.id);
for (const tiles of Object.values(sample.state)) for (const e of Object.values(tiles))
  if (e.done && e.id && e.by !== "Team") add(hoursOf(e.when), e.by, e.id);
events.sort((a, b) => a.t - b.t);

const dir = path.join(ROOT, "data", "preview");
fs.mkdirSync(dir, {recursive: true});
fs.writeFileSync(path.join(dir, "history.json"), JSON.stringify({baseline, points}) + "\n");
fs.writeFileSync(path.join(dir, "events.json"), JSON.stringify(events) + "\n");
console.log(`Preview data: ${points.length} KC/XP updates, ${events.length} drops.`);
