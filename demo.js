// Demo modes, on sample data, for checking how the page looks at each stage.
// Lives only on the dev branch, so the published site has no way into them.
// live-data.js imports this module when it exists (on localhost, or with ?demo in the address).
//
//   ?demo=preview  before the start      ?demo=started  under way
//   ?demo=won      time is up, a team won (late drops still being checked)
//   ?demo=ended    the results are final
//   &team=tt|dd|bk with won/ended picks which team wins (default: whoever the sample has)
//
// If config.json has mod_api (the mods Worker), the real mod entries are applied on top of
// the sample, at the same number of hours into the event, so mods can try them out before
// the event has any real data. Reload the page after saving one.

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";
import {LINES} from "./board.js";
import {loadEntries, applyEntries} from "./mod-entries.js";

const MODES = {preview: "before the bingo starts", started: "during the bingo",
  won: "once time is up", ended: "after the results are final"};
const params = new URLSearchParams(location.search);
export const mode = MODES[params.get("demo")] ? params.get("demo") : null;
const winnerId = TEAMS.some(t => t.id === params.get("team")) ? params.get("team") : null;

// The real mod entries, applied on top of the sample (preview mode does this in live-data.js).
const modEntries = mode && mode !== "preview" ? await loadEntries() : [];

export const banner = () => {
  const team = winnerId && TEAMS.find(t => t.id === winnerId);
  const what = team ? `${MODES[mode]}, with ${team.name} winning,` : MODES[mode];
  return `<h2>Demo</h2><p>This is how the page is expected to look ${what} using fake data. <a href="./">Back to the real page</a></p>`;
};

// Place the sample event in time around now. data is the sample-data.js export.
export async function prepare(data){
  const now = Date.now();
  if (mode === "started"){   // under way: the sample as it is, with time left
    await applyEntries(data, modEntries);
    const startMs = now - data.nowH * 3600e3;
    return {startMs, endMs: startMs + (data.nowH + 30) * 3600e3, updatedMs: now - 4 * 60e3};
  }
  await applyEntries(data, modEntries);
  if (winnerId) makeWinner(data, winnerId);   // after the entries, so the chosen team still wins
  // Like the real thing: the sample's last hour is the end, and the results are final
  // VERIFY_H later. "won" is mid-check (1 h after the end); "ended" is after that.
  const since = mode === "ended" ? VERIFY_H + 2 : 1;
  const startMs = now - (data.nowH + since) * 3600e3, endMs = startMs + data.nowH * 3600e3;
  return {startMs, endMs, updatedMs: now - 4 * 60e3, finalMs: endMs + VERIFY_H * 3600e3};
}

const VERIFY_H = 3;   // config.json verify_hours

// Give team `id` the most points (1 per tile, +3 per line): finish its closest lines, one
// tile at a time over Day 4, until it's ahead of everyone.
function makeWinner(data, id){
  const done = (t, i) => t[i] && t[i].done;
  const points = t => TILES.filter((_, i) => done(t, i)).length + 3 * LINES.filter(l => l.every(i => done(t, i))).length;
  const team = TEAMS.find(t => t.id === id), t = data.state[id] ||= {};
  const others = () => Math.max(...TEAMS.filter(x => x.id !== id).map(x => points(data.state[x.id] || {})));
  let k = 0;
  while (points(t) <= others() && k < 25){
    const line = LINES.filter(l => !l.every(i => done(t, i)))
      .sort((a, b) => b.filter(i => done(t, i)).length - a.filter(i => done(t, i)).length)[0];
    if (!line) break;
    const i = line.find(i => !done(t, i));
    const by = team.members[(i + k) % team.members.length];
    const when = `Day 4, ${String(Math.min(23, 6 + k)).padStart(2, "0")}:${String((10 + k * 7) % 60).padStart(2, "0")}`;
    if (TILES[i].s === "xp") t[i] = {done: true, by: "Team", when, item: "500k reached", progress: TILES[i].target};
    else {
      const row = (TILE_ITEMS[i] || []).find(r => r[2]);
      t[i] = {done: true, by, when, item: row ? row[0] : TILES[i].n, id: row ? row[1] : undefined, progress: TILES[i].target};
    }
    k++;
  }
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
