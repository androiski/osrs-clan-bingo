// Update job: reads the clan's TempleOSRS group, works out drops and progress, and writes
// data/state.json for the site. Runs every 30 minutes from GitHub Actions
// (.github/workflows/update.yml). Node 20+, no dependencies.
//
// Each run makes 3 requests to TempleOSRS:
//   group_member_info     every member's current KC and XP
//   group_recent_items    items new to someone's collection log, with the time they got them
//   group_collection_log  every member's item counts, to catch repeat drops
//
// Files in data/ (all committed, so git history is the audit trail):
//   counts.json   item counts at the start (the baseline repeat drops are measured from)
//   history.json  KC/XP at the start, then every change seen during the event
//   events.json   every drop counted, with player, item and time
//   state.json    what the site shows, rebuilt from the three files above each run

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {TEAMS, TILES, TRACK, TILE_ITEMS} from "./data.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.BINGO_DATA || path.join(ROOT, "data");   // overridable for test runs
const API = "https://templeosrs.com/api";
const GAP_MS = 13000;     // Temple asks for about 5 requests a minute
const PRE_START_H = 3;    // start taking the baseline this long before the event
const POST_END_H = 2;     // keep reading new log items this long after the end

const config = readJSON(process.env.BINGO_CONFIG || path.join(ROOT, "config.json"), {});
const log = (...a) => console.log(...a);

// ---- small helpers -------------------------------------------------------------------

function readJSON(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJSON(name, value){
  const file = path.join(DATA, name), text = JSON.stringify(value) + "\n";
  if (readText(file) !== text) fs.writeFileSync(file, text);
}
function readText(file){ try { return fs.readFileSync(file, "utf8"); } catch { return null; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).toLowerCase().replace(/[\s_\-]+/g, " ").trim();

let lastRequest = 0;
async function temple(url){
  const wait = lastRequest + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const res = await fetch(url, {headers: {"User-Agent": "runecraft-clan-bingo board (github.com/androiski/runecraft-clan-bingo)"}});
  if (!res.ok) throw new Error(`TempleOSRS ${res.status} for ${url}`);
  const body = await res.json();
  if (body.error) throw new Error(`TempleOSRS error for ${url}: ${JSON.stringify(body.error)}`);
  return body.data;
}

// Roster: Temple's spelling of a name -> our player and team.
const roster = new Map();
for (const t of TEAMS) for (const m of t.members) roster.set(norm(m), {rsn: m, team: t.id});
const teamOf = rsn => roster.get(norm(rsn));

// Every item the board cares about (qualifying or not), by ID.
const itemName = new Map();
for (const rows of Object.values(TILE_ITEMS)) for (const r of rows) itemName.set(r[1], r[0]);
const ACTS = [...new Set(Object.values(TRACK).flatMap(t => t.acts))];

// ---- main ----------------------------------------------------------------------------

async function main(){
  const {group_id: group, start: startISO, end: endISO} = config;
  if (!group || !startISO || !endISO){
    log("config.json needs group_id, start and end before anything is fetched. Nothing to do.");
    return;
  }
  const start = Date.parse(startISO) / 1000, end = Date.parse(endISO) / 1000;
  const now = Math.floor(Date.now() / 1000);
  if (!(start < end)) throw new Error("config.json: start must be before end (ISO 8601, e.g. 2026-10-13T00:00:00Z).");
  if (now < start - PRE_START_H * 3600 || now > end + POST_END_H * 3600){
    log("Outside the event window, so TempleOSRS isn't contacted.");
    return;
  }
  const live = now >= start;
  fs.mkdirSync(DATA, {recursive: true});
  log(live ? "Event running: checking for drops." : "Before the start: refreshing the baseline.");

  const members = await temple(`${API}/group_member_info.php?id=${group}&skills&bosses`);
  const recent = await temple(`${API}/collection-log/group_recent_items.php?group=${group}&count=200`);
  const clog = await temple(`${API}/collection-log/group_collection_log.php?group=${group}&categories=all&includecount=1`);

  const warnings = [];
  const inGroup = new Set(Object.values(members.memberlist || {}).map(m => norm(m.player)));
  const synced = new Set((clog.members || []).map(m => norm(m.player)));
  for (const t of TEAMS) for (const m of t.members){
    if (!inGroup.has(norm(m))) warnings.push(`${m} isn't in the TempleOSRS group`);
    else if (!synced.has(norm(m))) warnings.push(`${m} hasn't synced their collection log`);
  }
  warnings.forEach(w => log("  !", w));

  const history = updateHistory(readJSON(path.join(DATA, "history.json"), {baseline: {}, points: []}), members, live, now);
  const {counts, events} = updateDrops(
    readJSON(path.join(DATA, "counts.json"), {}), readJSON(path.join(DATA, "events.json"), []),
    recent, clog, live, now, start, end);

  writeJSON("history.json", history);
  writeJSON("counts.json", counts);
  writeJSON("events.json", events);
  writeJSON("state.json", buildState(history, events, start, end, now, warnings));
  log(`Done: ${events.length} drops counted so far.`);
}

// ---- KC and XP -----------------------------------------------------------------------

// history = {baseline: {rsn: {act: value}}, points: [[unixTime, {rsn: {act: value}}]]}
// Points only record values that changed, so the file stays small.
function updateHistory(history, members, live, now){
  const current = {};
  for (const m of Object.values(members.memberlist || {})){
    const p = teamOf(m.player);
    if (!p) continue;
    const v = {};
    for (const act of ACTS) v[act] = Math.max(0, Number((m.skills || {})[act] ?? (m.bosses || {})[act] ?? 0) || 0);
    current[p.rsn] = v;
  }
  if (!live){
    history.baseline = current;
    history.points = [];
    return history;
  }
  const latest = replay(history);
  const changes = {};
  for (const [rsn, v] of Object.entries(current)){
    if (!history.baseline[rsn]){
      // First seen after the start (e.g. joined the Temple group late): gains count from now.
      history.baseline[rsn] = v;
      log(`  ${rsn} first seen during the event; their KC/XP gains count from now.`);
      continue;
    }
    const diff = {};
    for (const act of ACTS) if (v[act] !== latest[rsn][act]) diff[act] = v[act];
    if (Object.keys(diff).length) changes[rsn] = diff;
  }
  if (Object.keys(changes).length) history.points.push([now, changes]);
  return history;
}

function replay(history, upTo = Infinity){
  const vals = JSON.parse(JSON.stringify(history.baseline));
  for (const [t, changes] of history.points){
    if (t > upTo) break;
    for (const [rsn, diff] of Object.entries(changes)) Object.assign(vals[rsn] ||= {}, diff);
  }
  return vals;
}

// ---- drops ---------------------------------------------------------------------------

// counts = {rsn: {itemId: count}} at the start. events = [{t, rsn, id, name, src}]
// src "new" comes from Temple's recent-items feed (real time of the drop);
// src "repeat" is a count that went up, timed to the run that noticed it.
function updateDrops(counts, events, recent, clog, live, now, start, end){
  const current = {};
  for (const m of clog.members || []){
    const p = teamOf(m.player);
    if (!p) continue;
    const c = {};
    for (const [id, n] of Object.entries(m.items || {})) if (itemName.has(+id)) c[id] = +n;
    current[p.rsn] = c;
  }
  if (!live) return {counts: current, events: []};

  const seen = new Set(events.map(e => `${e.rsn}|${e.id}|${e.t}`));
  for (const it of recent || []){
    const p = teamOf(it.player), t = +it.date_unix;
    if (!p || !itemName.has(+it.id) || t < start || t > end) continue;
    const key = `${p.rsn}|${+it.id}|${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({t, rsn: p.rsn, id: +it.id, name: itemName.get(+it.id), src: "new"});
    log(`  + ${itemName.get(+it.id)} - ${p.rsn} (new to their log)`);
  }

  for (const [rsn, c] of Object.entries(current)){
    if (!counts[rsn]){
      // Synced for the first time during the event: everything already in the log is
      // treated as the starting point, otherwise the whole log would look like drops.
      counts[rsn] = c;
      log(`  ${rsn} synced their log during the event; counting from now.`);
      continue;
    }
    for (const [id, n] of Object.entries(c)){
      const counted = events.filter(e => e.rsn === rsn && e.id === +id).length;
      const extra = n - (counts[rsn][id] || 0) - counted;
      if (extra <= 0) continue;
      if (now > end){
        log(`  ${rsn}: ${extra}x ${itemName.get(+id)} seen after the end, so not counted (check by hand).`);
        continue;
      }
      for (let k = 0; k < extra; k++) events.push({t: now, rsn, id: +id, name: itemName.get(+id), src: "repeat"});
      log(`  + ${extra}x ${itemName.get(+id)} - ${rsn} (repeat, count went up)`);
    }
  }
  events.sort((a, b) => a.t - b.t);
  return {counts, events};
}

// ---- what the site shows -------------------------------------------------------------

function buildState(history, events, start, end, now, warnings){
  const H = t => Math.round((t - start) / 36) / 100;   // hours since the start, 2 decimals
  const nowH = H(Math.min(now, end));
  const state = {}, dry = {}, drops = {}, byPlayer = {}, byAct = {};
  const times = [0, ...history.points.map(p => H(p[0]))];
  const snapshots = [replay(history, start), ...history.points.map(p => replay(history, p[0]))];
  const gain = (vals, rsn, acts) => acts.reduce((s, a) => s + Math.max(0, ((vals[rsn] || {})[a] || 0) - ((history.baseline[rsn] || {})[a] || 0)), 0);

  for (const team of TEAMS){
    state[team.id] = {};
    const mine = new Set(team.members);
    const teamEvents = events.filter(e => mine.has(e.rsn));

    TILES.forEach((tile, i) => {
      const rows = TILE_ITEMS[i] || [];
      const info = new Map(rows.map(r => [r[1], r]));
      const evs = teamEvents.filter(e => info.has(e.id));
      const track = TRACK[i];

      // KC/XP over time, and each player's share.
      let series = null;
      if (track){
        series = [];
        snapshots.forEach((vals, k) => {
          const v = team.members.reduce((s, m) => s + gain(vals, m, track.acts), 0);
          if (!series.length || series[series.length - 1][1] !== v) series.push([times[k], v]);
        });
        if (series[series.length - 1][0] < nowH) series.push([nowH, series[series.length - 1][1]]);
        (dry[i] ||= {})[team.id] = series;
        const latest = snapshots[snapshots.length - 1];
        (byPlayer[i] ||= {})[team.id] = team.members.map(m => [m, gain(latest, m, track.acts)])
          .filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
        // Per-boss totals for tiles tracking several bosses (their drop rates differ).
        if (track.acts.length > 1) (byAct[i] ||= {})[team.id] =
          Object.fromEntries(track.acts.map(a => [a, team.members.reduce((s, m) => s + gain(latest, m, [a]), 0)]));
      }

      // Completion.
      let done = null, progress = 0;
      if (tile.s === "xp"){
        const cross = series.find(p => p[1] >= tile.target);
        progress = series[series.length - 1][1];
        if (cross) done = {by: "Team", when: cross[0], item: `${Math.round(tile.target / 1000)}k reached`};
      } else if (rows.some(r => r[3])){
        // Barrows: four different pieces of one brother, from anyone on the team.
        const sets = {};
        for (const e of evs){
          const r = info.get(e.id);
          if (!r[2] || !r[3]) continue;
          const set = sets[r[3]] ||= new Set();
          set.add(e.id);
          progress = Math.max(progress, set.size);
          if (set.size >= 4){ done = {by: e.rsn, when: H(e.t), item: `${r[3]}'s set`, id: e.id, ev: e}; break; }
        }
      } else {
        for (const e of evs){
          const r = info.get(e.id);
          if (!r[2]) continue;
          if (!tile.target || (tile.alone || []).includes(r[0])){ done = {by: e.rsn, when: H(e.t), item: r[0], id: e.id, ev: e}; break; }
          progress++;
          if (progress >= tile.target){ done = {by: e.rsn, when: H(e.t), item: r[0], id: e.id, ev: e}; break; }
        }
      }
      if (done){ const {ev, ...d} = done; state[team.id][i] = {done: true, progress: tile.target, ...d}; }
      else if (progress) state[team.id][i] = {done: false, progress};

      // Every drop on this tile except the one that finished it.
      const list = evs.filter(e => !done || e !== done.ev).map(e => ({
        h: H(e.t), name: e.name, id: e.id, by: e.rsn, kind: info.get(e.id)[2] ? "progress" : "other"}));
      if (list.length) (drops[i] ||= {})[team.id] = list;
    });
  }
  return {updated: new Date(now * 1000).toISOString(), start: config.start, end: config.end,
    now_h: Math.max(0, nowH), warnings, state, dry, drops, byPlayer, byAct};
}

export {main, updateHistory, updateDrops, buildState};

// Run the job when started directly (node update.js), not when imported by a test.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(err => { console.error(err.message || err); process.exit(1); });
