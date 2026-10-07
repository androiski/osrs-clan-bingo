// Demo modes, on sample data, for checking how the page looks at each stage.
// Lives only on the dev branch, so the published site has no way into them.
// live-data.js imports this module when it exists (on localhost, or with ?demo in the address).
//
//   ?demo=preview  before the start      ?demo=started  under way, nobody has a line
//   ?demo=won      a team has won        ?demo=ended    the event is over
//   &team=tt|dd|bk with won/ended picks which team wins (default: whoever the sample has)

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";
import {LINES, whenKey} from "./board.js";

const MODES = {preview: "before the bingo starts", started: "while the bingo is running",
  won: "once a team has won", ended: "after the bingo has ended"};
const params = new URLSearchParams(location.search);
export const mode = MODES[params.get("demo")] ? params.get("demo") : null;
const winnerId = TEAMS.some(t => t.id === params.get("team")) ? params.get("team") : null;

export const banner = () => {
  const team = winnerId && TEAMS.find(t => t.id === winnerId);
  const what = team ? (mode === "ended" ? `after the bingo has ended with ${team.name} winning` : `when ${team.name} win`) : MODES[mode];
  return `<h2>Demo</h2><p>This is how the page looks ${what}, using sample data. <a href="./">Back to the real page</a></p>`;
};

// Place the sample event in time around now. data is the sample-data.js export.
export function prepare(data){
  const now = Date.now(), startMs = now - data.nowH * 3600e3;
  const endMs = mode === "ended" ? now - 3600e3 : startMs + (data.nowH + 30) * 3600e3;
  if (mode === "started")   // nobody has a line yet: keep progress, take away completions
    for (const team of Object.values(data.state)) for (const [i, e] of Object.entries(team))
      if (e.done) team[i] = {done: false, progress: TILES[i].s === "xp" ? e.progress : 0};
  if (winnerId && (mode === "won" || mode === "ended")) makeWinner(data, winnerId);
  return {startMs, endMs, updatedMs: now - 4 * 60e3};
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
  const modeLinks = [["", "Real page"], ...Object.keys(MODES).map(m => [m, m[0].toUpperCase() + m.slice(1)])]
    .map(([m, label]) => link(m ? `?demo=${m}` : "", label, (mode || "") === m && !winnerId)).join(" ");
  const winLinks = TEAMS.map(t => link(`?demo=won&team=${t.id}`, `${t.name} wins`, mode === "won" && winnerId === t.id)).join(" ");
  foot.insertAdjacentHTML("afterbegin", `<p class="demos"><span>Demo:</span> ${modeLinks}</p><p class="demos"><span>Winner:</span> ${winLinks}</p>`);
}
