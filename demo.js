// Demo modes, on sample data, for checking how the page looks at each stage.
// Lives only on the dev branch, so the published site has no way into them.
// live-data.js imports this module when it exists (on localhost, or with ?demo in the address).
//
//   ?demo=preview  before the start      ?demo=started  under way, nobody has a line
//   ?demo=won      a team has won        ?demo=ended    the event is over
//   &team=tt|dd|bk with won/ended picks which team wins (default: whoever the sample has)
//
// If config.json has mod_api (the mods Worker), the real mod entries are applied on top of
// the sample, at the same number of hours into the event, so mods can try them out before
// the event has any real data. Reload the page after saving one.

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";
import {LINES, whenKey, hoursOf} from "./board.js";
import {loadEntries, applyEntries} from "./mod-entries.js";

const MODES = {preview: "before the bingo starts", started: "during the bingo",
  won: "once a team has won", ended: "after the bingo has ended"};
const params = new URLSearchParams(location.search);
export const mode = MODES[params.get("demo")] ? params.get("demo") : null;
const winnerId = TEAMS.some(t => t.id === params.get("team")) ? params.get("team") : null;

// The real mod entries, applied on top of the sample (preview mode does this in live-data.js).
const modEntries = mode && mode !== "preview" ? await loadEntries() : [];

export const banner = () => {
  const team = winnerId && TEAMS.find(t => t.id === winnerId);
  const what = team ? (mode === "ended" ? `after the bingo, with ${team.name} winning,` : `when ${team.name} win`) : MODES[mode];
  return `<h2>Demo</h2><p>This is how the page is expected to look ${what} using fake data. <a href="./">Back to the real page</a></p>`;
};

// Place the sample event in time around now. data is the sample-data.js export.
export async function prepare(data){
  const now = Date.now();
  if (mode === "started"){   // nobody has a line yet: keep progress, take away completions
    for (const team of Object.values(data.state)) for (const [i, e] of Object.entries(team))
      if (e.done) team[i] = {done: false, progress: TILES[i].s === "xp" ? e.progress : 0};
    await applyEntries(data, modEntries);
    const startMs = now - data.nowH * 3600e3;
    return {startMs, endMs: startMs + (data.nowH + 30) * 3600e3, updatedMs: now - 4 * 60e3};
  }
  if (winnerId) makeWinner(data, winnerId);
  await applyEntries(data, modEntries);
  // Like the real thing: tracking stops at the Bingo, and the results are final VERIFY_H later.
  // "won" is mid-check (1 h after the Bingo); "ended" is after the results are final.
  const b = cutAtBingo(data);
  const since = mode === "ended" ? VERIFY_H + 2 : 1;
  const startMs = now - (b + since) * 3600e3;
  return {startMs, endMs: startMs + Math.max(72, b + 24) * 3600e3, updatedMs: now - 4 * 60e3,
    finalMs: startMs + (b + VERIFY_H) * 3600e3};
}

const VERIFY_H = 3;   // config.json verify_hours

// Drop everything after the first Bingo: later completions, drops and chart points. Returns
// the Bingo's hour.
function cutAtBingo(data){
  let b = Infinity;
  for (const t of Object.values(data.state)) for (const line of LINES)
    if (line.every(i => t[i] && t[i].done)) b = Math.min(b, Math.max(...line.map(i => hoursOf(t[i].when))));
  if (b === Infinity) return data.nowH;
  for (const byTeam of Object.values(data.drops)) for (const id of Object.keys(byTeam))
    byTeam[id] = byTeam[id].filter(d => d.h <= b);
  for (const byTeam of Object.values(data.dry)) for (const [id, pts] of Object.entries(byTeam)){
    const kept = pts.filter(p => p[0] <= b);
    if (kept.length) kept.push([b, kept[kept.length - 1][1]]);
    byTeam[id] = kept;
  }
  for (const [id, t] of Object.entries(data.state)) for (const [i, e] of Object.entries(t)){
    if (!e.done || hoursOf(e.when) <= b) continue;
    const pts = (data.dry[i] || {})[id];   // XP tiles keep what they had at the Bingo
    t[i] = {done: false, progress: TILES[i].s === "xp" && pts && pts.length ? pts[pts.length - 1][1] : 0};
  }
  data.nowH = b;
  return b;
}

// Rearrange the sample so `id` is the only team with a full line: break everyone's finished
// lines, then finish the line that team was closest to, over Day 4.
function makeWinner(data, id){
  for (const team of TEAMS){
    const t = data.state[team.id] ||= {};
    for (const line of LINES) if (line.every(i => t[i] && t[i].done)){
      const last = line.reduce((a, i) => whenKey(t[i].when) > whenKey(t[a].when) ? i : a);
      t[last] = {done: false, progress: 0};
    }
  }
  const team = TEAMS.find(t => t.id === id), t = data.state[id];
  const best = LINES.reduce((a, l) => l.filter(i => t[i] && t[i].done).length > a.filter(i => t[i] && t[i].done).length ? l : a);
  let hour = 9;
  best.forEach((i, k) => {
    if (t[i] && t[i].done) return;
    const by = team.members[(i + k) % team.members.length], when = `Day 4, ${String(hour++).padStart(2, "0")}:${String(10 + k * 7).padStart(2, "0")}`;
    if (TILES[i].s === "xp"){ t[i] = {done: true, by: "Team", when, item: "500k reached", progress: TILES[i].target}; return; }
    const row = (TILE_ITEMS[i] || []).find(r => r[2]);
    t[i] = {done: true, by, when, item: row ? row[0] : TILES[i].n, id: row ? row[1] : undefined, progress: TILES[i].target};
  });
}

// Switcher in the footer.
const foot = document.getElementById("foot");
if (foot){
  const link = (href, label, current) => `<a class="btn" href="./${href}" aria-current="${current ? "page" : "false"}">${label}</a>`;
  const modeLinks = [["", "Real page"], ["?demo=preview", "Preview"], ["?demo=started", "Start/Ongoing"], ["?demo=ended", "Ended"]]
    .map(([href, label]) => link(href, label, (mode || "") === (href.split("=")[1] || "") && !winnerId)).join(" ");
  const winLinks = TEAMS.map(t => link(`?demo=won&team=${t.id}`, `${t.name} wins`, mode === "won" && winnerId === t.id)).join(" ");
  foot.insertAdjacentHTML("afterbegin", `<p class="demos"><span>Demo:</span> ${modeLinks}</p><p class="demos"><span>Winner:</span> ${winLinks}</p>`);
}
