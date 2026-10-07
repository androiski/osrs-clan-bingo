// Entry point. Loads data/state.json (written every 30 minutes by update.js) and starts the
// board. Before there's live data it shows an empty board, with sample data one click away.
// Also runs the results box under the title: countdown, "started", the winner, or the
// chosen team's place and player contributions.
//
// If demo.js is present (it's kept off the published branch), it can swap in demo
// states of the page; see that file.

import {TEAMS, TRACK} from "./data.js";
import {setData, start, render, onRender, getView, ranking, playerStats, teamIco, colorVar,
  dayLabel, hoursOf, whenKey, LINES} from "./board.js";
import {fireworks} from "./fireworks.js";

const status = document.getElementById("status");
const box = document.getElementById("countdown");
const banner = document.getElementById("banner");

let demo = null;
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
if (local || new URLSearchParams(location.search).has("demo")){
  try { demo = await import("./demo.js"); } catch {}   // not on the published site
}
const demoMode = demo && demo.mode;

const when = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short"});
const ordinal = n => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");

// ---- load: live data, a demo, or the preview ----
// The preview (before there's any live data) shows an empty board, with a button in the
// Preview box that fills it with sample data.
let startMs = 0, endMs = 0, updatedMs = 0, mode;   // "live" | "demo" | "preview"
let live = null;
if (!demoMode){
  try {
    const res = await fetch("data/state.json", {cache: "no-cache"});
    if (res.ok) live = await res.json();
  } catch {}
}
const emptyData = () => ({state: {}, drops: {}, byPlayer: {}, nowH: 0,
  dry: Object.fromEntries(Object.keys(TRACK).map(i => [i, Object.fromEntries(TEAMS.map(t => [t.id, [[0, 0]]]))]))});
let sample = null;
async function loadSample(){
  if (sample) return sample;
  sample = (await import("./sample-data.js")).default;
  // The preview shouldn't show anyone winning: break any finished line in the sample
  // data by taking away its last tile.
  if (!demoMode || demoMode === "preview") for (const team of TEAMS){
    const t = sample.state[team.id] || {};
    for (const line of LINES) if (line.every(i => t[i] && t[i].done)){
      const last = line.reduce((a, i) => whenKey(t[i].when) > whenKey(t[a].when) ? i : a);
      t[last] = {done: false, progress: 0};
    }
  }
  return sample;
}

let data, sampleShown = false;
if (live){
  mode = "live";
  data = {state: live.state, dry: live.dry, drops: live.drops, byPlayer: live.byPlayer, nowH: live.now_h};
  startMs = Date.parse(live.start); endMs = Date.parse(live.end); updatedMs = Date.parse(live.updated);
} else {
  try { const cfg = await (await fetch("config.json", {cache: "no-cache"})).json(); if (cfg.start) startMs = Date.parse(cfg.start); if (cfg.end) endMs = Date.parse(cfg.end); } catch {}
  mode = "preview";
  if (demoMode && demoMode !== "preview"){
    mode = "demo";
    data = await loadSample();
    ({startMs, endMs, updatedMs} = demo.prepare(data));
  } else if (demoMode === "preview"){
    data = await loadSample(); sampleShown = true;
  } else {
    data = emptyData();
  }
}
setData(data);

// ---- status line, banner and layout ----
const since = ms => {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ${mins % 60} min ago`;
};
const clock = ms => new Date(ms).toLocaleTimeString(undefined, {hour: "numeric", minute: "2-digit"});
// Under the title: the event's dates, plus how fresh the data is while it runs.
const dates = () => startMs && endMs
  ? `${new Date(startMs).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"})} – ${when(endMs)}`
  : startMs ? `Starts ${when(startMs)}` : "";
function renderStatus(){
  const now = Date.now();
  status.textContent = [dates(),
    mode === "preview" || now < startMs ? "" : now > endMs ? "final results" : `updated ${since(updatedMs)}`]
    .filter(Boolean).join(" · ");
  for (const el of document.querySelectorAll("[data-since]")) el.textContent = `${clock(updatedMs)} (${since(updatedMs)})`;
}
setInterval(renderStatus, 30000);

function renderBanner(){
  if (demoMode && mode === "demo") banner.innerHTML = demo.banner();
  else banner.innerHTML = sampleShown
    ? `<h2>Preview</h2><p>Everything below is sample data, to show how the board could look.</p>` +
      `<p><button class="btn" type="button" data-sample="off">Hide preview</button></p>`
    : `<h2>Preview</h2><p>The board below fills in once the bingo starts.</p>` +
      `<p><button class="btn" type="button" data-sample="on">Click to show preview</button></p>`;
  banner.hidden = false;
}
banner.addEventListener("click", async e => {
  const b = e.target.closest("[data-sample]");
  if (!b) return;
  sampleShown = b.dataset.sample === "on";
  setData(sampleShown ? await loadSample() : emptyData());
  renderBanner(); render();
});
if (mode !== "live") renderBanner();
if (mode === "preview" || Date.now() < startMs){
  // Before the start, show the Teams list (who has synced their log) right under the
  // "open your collection log" notice.
  document.querySelector(".callout").after(document.querySelector("section.rosters"));
}
if (mode === "preview"){
  // The Teams list is real; the board below it is empty or sample data. Put the Preview
  // box between them so it's clear where that starts.
  document.querySelector("section.rosters").after(banner);
}

// Live: check for new data every 5 minutes and reload when the update job has saved some.
if (mode === "live" && Date.now() < endMs + 3 * 3600e3) setInterval(async () => {
  try {
    const res = await fetch("data/state.json", {cache: "no-cache"});
    if (res.ok && (await res.json()).updated !== live.updated) location.reload();
  } catch {}
}, 5 * 60e3);

// ---- countdown ----
let timerId = 0;
function countdown(el, ms){
  clearInterval(timerId);
  const parts = [["days", 86400], ["hours", 3600], ["mins", 60], ["secs", 1]];
  el.innerHTML = parts.map(([n]) => `<div><b data-u="${n}">0</b><span>${n}</span></div>`).join("");
  const tick = () => {
    let left = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    for (const [n, size] of parts){
      const v = Math.floor(left / size); left -= v * size;
      el.querySelector(`[data-u="${n}"]`).textContent = n === "days" ? v : String(v).padStart(2, "0");
    }
  };
  const passedAlready = ms <= Date.now();
  tick();
  timerId = setInterval(() => {
    tick();
    // Reload once when it reaches zero, so the page moves on (not if it had already passed).
    if (!passedAlready && ms <= Date.now() && mode === "live"){ clearInterval(timerId); setTimeout(() => location.reload(), 2000); }
  }, 1000);
}
function announce(cls, title, ms, label, note){
  box.className = `countdown ${cls}`;
  box.style.removeProperty("--c");
  box.innerHTML = `<h2>${title}</h2>` +
    (ms ? `<div class="timer" role="timer" aria-label="${label}"></div>` : "") +
    (note ? `<p class="when">${note}</p>` : "");
  if (ms) countdown(box.querySelector(".timer"), ms); else clearInterval(timerId);
  box.hidden = false;
  renderStatus();   // fills in "last updated"
}

// ---- fireworks for the winner: any click stops them, a button starts them again ----
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let fireworksArgs = null, stopFireworks = null;
function playFireworks(){
  if (stopFireworks || !fireworksArgs) return;
  stopFireworks = fireworks(...fireworksArgs);
  if (!stopFireworks) return;
  addEventListener("pointerdown", haltFireworks); addEventListener("keydown", haltFireworks);
  renderResults();
}
function haltFireworks(e){
  if (e && e.target.closest && e.target.closest("[data-fireworks]")) return;
  stopFireworks(); stopFireworks = null;
  removeEventListener("pointerdown", haltFireworks); removeEventListener("keydown", haltFireworks);
  renderResults();
}
box.addEventListener("click", e => { if (e.target.closest("[data-fireworks]")) playFireworks(); });
const fireworksControl = () => !fireworksArgs || reduceMotion ? ""
  : stopFireworks ? `<p class="hint">Click anywhere to stop the fireworks.</p>`
  : `<p class="hint"><button class="btn" type="button" data-fireworks>Play fireworks</button></p>`;

// ---- results: the winner, or the chosen team's place and players ----
const plural = (n, w) => `<b>${n}</b> ${w}${n === 1 ? "" : "s"}`;
const playerCards = team => `<div class="roll">${playerStats(team).map(p => `<div><b class="who">${p.name}</b>` +
  `<span>${plural(p.tiles, "tile")} · ${plural(p.drops, "drop")}</span>` +
  (p.parts.length ? `<span class="work">${p.parts.map(x => `<i title="${x.tile}"><img src="${x.icon}" alt="">` +
    `<em>${x.label}${x.amount ? ` <b>${x.amount}</b>` : ""}</em>` +
    (x.items.length ? `<span class="drops">` : "") + x.items.map(it => `<img class="drop${it.finished ? " fin" : ""}${it.counts ? "" : " other"}" src="${it.src}" alt="${it.name}" ` +
      `title="${it.name}${it.finished ? " (finished the tile)" : it.counts ? "" : " (doesn't count)"}">`).join("") +
    (x.items.length ? `</span>` : "") + `</i>`).join("")}</span>` : "") +
  `</div>`).join("")}</div>`;
const names = team => team.members.length > 1 ? team.members.slice(0, -1).join(", ") + " and " + team.members.at(-1) : team.members[0];

function renderResults(){
  const now = Date.now();
  if (mode === "preview" || now < startMs) return;   // the countdown is showing instead
  const ranked = ranking();
  const winner = ranked[0] && ranked[0].first ? ranked[0] : null;
  const ended = now > endMs;
  const view = getView();
  const chosen = view !== "all" ? ranked.find(r => r.t.id === view) : winner;

  if (!chosen){
    if (ended) announce("", "The bingo has ended", 0, "", "No team completed a line.");
    else announce("go", "The Bingo Has Started!", endMs, "Time until the bingo ends",
      `Ends <b>${when(endMs)}</b>. First team to complete a line wins.<br>` +
      `Last updated <b data-since></b>`);
    return;
  }
  const place = ranked.indexOf(chosen) + 1, isWinner = chosen === winner;
  const title = isWinner ? `${chosen.t.name} won!`
    : winner || ended ? `${chosen.t.name} came ${ordinal(place)}`
    : `${chosen.t.name} are ${ordinal(place)} so far`;
  const sub = chosen.first ? `First line completed @ ${dayLabel(hoursOf(chosen.first.when))}`
    : `${chosen.best} of 5 on their best line · ${plural(chosen.tiles, "tile")}`;
  announce(isWinner ? "win" : "team", `${teamIco(chosen.t, "tico-l")}${title}`, 0, "", sub);
  box.style.setProperty("--c", colorVar(chosen.t.id));
  box.insertAdjacentHTML("beforeend",
    `<p class="congrats">${isWinner ? `Congrats to ${names(chosen.t)}!` : "Player contributions"}</p>` +
    playerCards(chosen.t) + fireworksControl());
}
onRender(() => { renderResults(); renderStatus(); });

start();

if (startMs > Date.now()){
  announce("", "Bingo starts in", startMs, "Time until the bingo starts",
    `<b>${when(startMs)}</b>`);
} else if (mode !== "preview"){
  const top = ranking()[0];
  if (top && top.first){
    // Some bursts are shaped like the items the winning team finished.
    const icons = [...new Set(playerStats(top.t).flatMap(p => p.icons.map(i => i.src)))].slice(0, 10);
    fireworksArgs = [getComputedStyle(document.documentElement).getPropertyValue(`--${top.t.id}`).trim(), icons];
    // Play them automatically the first time someone sees the win, not on every refresh.
    const seenKey = `bingo-fireworks-${top.t.id}-${startMs}`;
    let seen = false;
    try { seen = mode === "live" && sessionStorage.getItem(seenKey) === "1"; sessionStorage.setItem(seenKey, "1"); } catch {}
    if (!seen) playFireworks();
  }
  renderResults();
}
