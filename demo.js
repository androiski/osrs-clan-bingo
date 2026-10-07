// Demo modes, on sample data, for checking how the page looks at each stage.
// Lives only on the dev branch, so the published site has no way into them.
// live-data.js imports this module when it exists (on localhost, or with ?demo in the address).
//
//   ?demo=preview  before the start      ?demo=started  under way, nobody has a line
//   ?demo=won      a team has won        ?demo=ended    the event is over

import {TILES} from "./data.js";

const MODES = {preview: "before the bingo starts", started: "while the bingo is running",
  won: "once a team has won", ended: "after the bingo has ended"};
const asked = new URLSearchParams(location.search).get("demo");
export const mode = MODES[asked] ? asked : null;

export const banner = () =>
  `<h2>Demo</h2><p>This is how the page looks ${MODES[mode]}, using sample data. <a href="./">Back to the real page</a></p>`;

// Place the sample event in time around now. data is the sample-data.js export.
export function prepare(data){
  const now = Date.now(), startMs = now - data.nowH * 3600e3;
  const endMs = mode === "ended" ? now - 3600e3 : startMs + (data.nowH + 30) * 3600e3;
  if (mode === "started")   // nobody has a line yet: keep progress, take away completions
    for (const team of Object.values(data.state)) for (const [i, e] of Object.entries(team))
      if (e.done) team[i] = {done: false, progress: TILES[i].s === "xp" ? e.progress : 0};
  return {startMs, endMs, updatedMs: now - 4 * 60e3};
}

// Switcher in the footer.
const foot = document.getElementById("foot");
if (foot){
  const links = [["", "Real page"], ...Object.keys(MODES).map(m => [m, m[0].toUpperCase() + m.slice(1)])];
  foot.insertAdjacentHTML("afterbegin", `<p class="demos"><span>Demo:</span> ${links.map(([m, label]) =>
    `<a class="btn" href="./${m ? "?demo=" + m : ""}" aria-current="${(mode || "") === m ? "page" : "false"}">${label}</a>`).join(" ")}</p>`);
}
