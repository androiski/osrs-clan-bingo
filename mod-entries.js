// Mod entries on the preview's sample board, so mods can try Mod entry before the event.
// A rough, in-page version of what update.js does with them for the real board:
// "done" entries count like a drop, "void" entries uncheck a completion.
// Each entry lands at the same number of hours into the event as its real time.

import {TILES, TILE_ITEMS} from "./data.js";
import {hoursOf} from "./board.js";

let cfg = null;
async function config(){
  if (!cfg) try { cfg = await (await fetch("config.json", {cache: "no-cache"})).json(); } catch { cfg = {}; }
  return cfg;
}

// The Worker's list, or [] when there's no Worker or it can't be reached.
export async function loadEntries(){
  const {mod_api: api} = await config();
  if (!api) return [];
  try {
    const list = await (await fetch(api.replace(/\/$/, "") + "/entries", {cache: "no-store"})).json();
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Applies the entries to sample data (changed in place).
export async function applyEntries(data, entries){
  const realStart = Date.parse((await config()).start);
  const day = h => `Day ${Math.floor(h / 24) + 1}, ${String(Math.floor(h % 24)).padStart(2, "0")}:${String(Math.round(h * 60) % 60).padStart(2, "0")}`;
  const hourOf = e => e.action === "void" ? e.h : (Date.parse(e.when) - realStart) / 3600e3;
  for (const e of entries.slice().sort((a, b) => hourOf(a) - hourOf(b))){
    const tile = TILES[e.tile], h = hourOf(e);
    if (!tile || !data.state[e.team] || !(h >= 0)) continue;
    const t = data.state[e.team], cur = t[e.tile];
    const drops = ((data.drops[e.tile] ||= {})[e.team] ||= []);
    if (e.action === "void"){
      if (!cur || !cur.done || Math.abs(hoursOf(cur.when) - e.h) > 0.02) continue;
      if (cur.id) drops.push({h: e.h, name: cur.item, id: cur.id, by: cur.by, kind: "other", voided: true});
      t[e.tile] = {done: false, progress: tile.target ? tile.target - 1 : 0};
      continue;
    }
    if (cur && cur.done && hoursOf(cur.when) <= h) continue;   // already done earlier
    const finish = () => { t[e.tile] = {done: true, by: e.by, when: day(h), item: e.item || "Marked done by a mod", id: e.itemId ?? undefined, progress: tile.target, manual: true}; };
    const rows = TILE_ITEMS[e.tile] || [];
    if (!tile.target || tile.s === "xp" || (tile.alone || []).includes(e.item)){ finish(); continue; }
    drops.push({h, name: e.item, id: e.itemId, by: e.by, kind: "progress", manual: true});
    const counted = drops.filter(d => d.kind === "progress" && d.h <= h);
    let progress = counted.length;
    if (rows.some(r => r[3])){   // Barrows: pieces of one brother
      const sets = {};
      for (const d of counted){ const r = rows.find(r => r[0] === d.name); if (r && r[3]) (sets[r[3]] ||= new Set()).add(d.name); }
      progress = Math.max(0, ...Object.values(sets).map(s => s.size));
    }
    if (progress >= tile.target){ drops.pop(); finish(); }
    else t[e.tile] = {done: false, progress};
  }
  return data;
}
