// Loads data/state.json (written every 30 minutes by update.js) and starts the board.
// Falls back to the sample data when there's no live data yet.
// Also runs the results box under the title: countdown, "started", the winner, or the
// chosen team's place and player contributions.
//
// If demo.js is present (it's kept off the published branch), it can swap in demo
// states of the page; see that file.

function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

(async () => {
  const status = document.getElementById("status");
  const box = document.getElementById("countdown");
  const banner = document.getElementById("banner");
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local || new URLSearchParams(location.search).has("demo")){
    try { await loadScript("demo.js"); } catch {}   // not on the published site
  }
  const demo = window.bingoDemo && window.bingoDemo.mode;

  const when = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short"});
  const ordinal = n => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");

  // ---- load: live data, a demo, or the sample preview ----
  let startMs = 0, endMs = 0, updatedMs = 0, mode;   // "live" | "demo" | "preview"
  let live = null;
  if (!demo){
    try {
      const res = await fetch("data/state.json", {cache: "no-cache"});
      if (res.ok) live = await res.json();
    } catch {}
  }
  if (live){
    mode = "live";
    Object.assign(window, {state: live.state, dry: live.dry, drops: live.drops, byPlayer: live.byPlayer, NOW_H: live.now_h});
    startMs = Date.parse(live.start); endMs = Date.parse(live.end); updatedMs = Date.parse(live.updated);
  } else {
    await loadScript("sample-data.js");
    try { const cfg = await (await fetch("config.json", {cache: "no-cache"})).json(); if (cfg.start) startMs = Date.parse(cfg.start); } catch {}
    mode = "preview";
    if (demo && demo !== "preview"){
      mode = "demo";
      ({startMs, endMs, updatedMs} = window.bingoDemo.prepare());
    }
  }

  // ---- status line and banner ----
  const mins = Math.max(0, Math.round((Date.now() - updatedMs) / 60000));
  const updated = mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  status.textContent = mode === "preview" ? (startMs ? `Starts ${when(startMs)}` : "Sample data")
    : Date.now() < startMs ? `Starts ${when(startMs)}`
    : Date.now() > endMs ? `Ended ${when(endMs)} · final results`
    : `Updated ${updated} · refreshes every 30 minutes`;
  if (mode !== "live"){
    banner.innerHTML = demo ? window.bingoDemo.banner()
      : `<h2>Preview</h2><p>This page is a preview with sample data, to show how it could look.</p>`;
    banner.hidden = false;
  }

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
  }

  // ---- results: the winner, or the chosen team's place and players ----
  const plural = (n, w) => `<b>${n}</b> ${w}${n === 1 ? "" : "s"}`;
  const playerCards = team => `<div class="roll">${playerStats(team).map(p => `<div><b class="who">${p.name}</b>` +
    `<span>${plural(p.tiles, "tile")} · ${plural(p.drops, "drop")}</span>` +
    (p.work.length ? `<span class="work">${p.work.slice(0, 4).map(w => `<i>${w.icon ? `<img src="${w.icon}" alt="">` : ""}${w.text}</i>`).join("")}</span>` : "") +
    (p.icons.length ? `<span class="got">${p.icons.map(i => `<img src="${i.src}" alt="${i.name}" title="${i.name}">`).join("")}</span>` : "") +
    `</div>`).join("")}</div>`;
  const names = team => team.members.length > 1 ? team.members.slice(0, -1).join(", ") + " and " + team.members.at(-1) : team.members[0];

  let stopFireworks = null;
  window.renderResults = function(){
    const now = Date.now();
    if (mode === "preview" || now < startMs) return;   // the countdown is showing instead
    const ranked = ranking();
    const winner = ranked[0] && ranked[0].first ? ranked[0] : null;
    const ended = now > endMs;
    const chosen = view !== "all" ? ranked.find(r => r.t.id === view) : winner;

    if (!chosen){
      if (ended) announce("", "The bingo has ended", 0, "", "No team completed a line.");
      else announce("go", "The Bingo Has Started!", endMs, "Time until the bingo ends",
        `Ends <b>${when(endMs)}</b> (your time). First team to complete a line wins.`);
      return;
    }
    const place = ranked.indexOf(chosen) + 1, isWinner = chosen === winner;
    const title = isWinner ? `${chosen.t.name} won!`
      : winner || ended ? `${chosen.t.name} came ${ordinal(place)}`
      : `${chosen.t.name} are ${ordinal(place)} so far`;
    const sub = chosen.first ? `First line completed @ ${dayLabel(hoursOf(chosen.first.when))}`
      : `${chosen.best} of 5 on their best line · ${plural(chosen.tiles, "tile")}`;
    announce(isWinner ? "win" : "team", title, 0, "", sub);
    box.style.setProperty("--c", colorVar(chosen.t.id));
    box.insertAdjacentHTML("beforeend",
      `<p class="congrats">${isWinner ? `Congrats to ${names(chosen.t)}!` : "Player contributions"}</p>` +
      playerCards(chosen.t) +
      (stopFireworks ? `<p class="hint">Click anywhere to stop the fireworks.</p>` : ""));
  };

  start();

  if (startMs > Date.now()){
    announce("", "Bingo starts in", startMs, "Time until the bingo starts",
      `<b>${when(startMs)}</b> (your time). ${mode === "live" ? "Drops count from then." : "The board goes live then."}`);
  } else if (mode !== "preview"){
    renderResults();
    const top = ranking()[0];
    if (top && top.first){
      // Fireworks for the winner; some bursts are shaped like the items the team finished.
      const icons = [...new Set(playerStats(top.t).flatMap(p => p.icons.map(i => i.src)))].slice(0, 10);
      stopFireworks = fireworks(getComputedStyle(document.documentElement).getPropertyValue(`--${top.t.id}`).trim(), icons);
      if (stopFireworks){
        renderResults();   // adds the "click to stop" hint
        const off = () => { stopFireworks(); stopFireworks = null; box.querySelector(".hint")?.remove();
          removeEventListener("pointerdown", off); removeEventListener("keydown", off); };
        addEventListener("pointerdown", off); addEventListener("keydown", off);
      }
    }
  }
})();
