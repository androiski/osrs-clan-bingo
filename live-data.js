// Loads data/state.json (written every 30 minutes by update.js) and starts the board.
// Falls back to the sample data when there's no live data yet, or with ?sample in the address.
// Also runs the announcement box under the title: countdown, "started", or the winner.

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
  let live = null;
  if (!new URLSearchParams(location.search).has("sample")){
    try {
      const res = await fetch("data/state.json", {cache: "no-cache"});
      if (res.ok) live = await res.json();
    } catch {}
  }

  const when = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short"});

  // Countdown boxes (days / hours / mins / secs) that tick every second.
  function countdown(el, ms){
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
    const id = setInterval(() => {
      tick();
      // Reload once when it reaches zero, so the page moves on (not if it had already passed).
      if (!passedAlready && ms <= Date.now()){ clearInterval(id); setTimeout(() => location.reload(), 2000); }
    }, 1000);
  }
  function announce(cls, title, ms, label, note){
    box.className = `countdown ${cls}`;
    box.innerHTML = `<h2>${title}</h2>` +
      (ms ? `<div class="timer" role="timer" aria-label="${label}"></div>` : "") +
      (note ? `<p class="when">${note}</p>` : "");
    if (ms) countdown(box.querySelector(".timer"), ms);
    box.hidden = false;
  }

  let startMs = 0, endMs = 0;
  if (live){
    Object.assign(window, {state: live.state, dry: live.dry, drops: live.drops, byPlayer: live.byPlayer, NOW_H: live.now_h});
    startMs = Date.parse(live.start); endMs = Date.parse(live.end);
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(live.updated)) / 60000));
    const updated = mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    status.textContent = Date.now() < startMs ? `Starts ${when(startMs)}`
      : Date.now() > endMs ? `Ended ${when(endMs)} · final results`
      : `Updated ${updated} · refreshes every 30 minutes`;
  } else {
    await loadScript("sample-data.js");
    try { const cfg = await (await fetch("config.json", {cache: "no-cache"})).json();
      if (cfg.start) startMs = Date.parse(cfg.start); } catch {}
    status.textContent = startMs ? `Starts ${when(startMs)}` : "Sample data";
    const banner = document.getElementById("banner");
    banner.innerHTML = `<h2>Preview</h2><p>This page is a preview with sample data, to show how it could look.</p>`;
    banner.hidden = false;
  }

  start();

  if (startMs > Date.now()){
    announce("", "Bingo starts in", startMs, "Time until the bingo starts",
      `<b>${when(startMs)}</b> (your time). ${live ? "Drops count from then." : "The board goes live then."}`);
  } else if (live){
    // The first team to finish a line wins.
    const winner = TEAMS.map(t => ({t, first: stats(t.id).first})).filter(r => r.first)
      .sort((a, b) => whenKey(a.first.when) - whenKey(b.first.when))[0];
    if (winner){
      announce("win", `${winner.t.name} ${Date.now() > endMs ? "won" : "has won"}!`, 0, "",
        `First line completed @ ${dayLabel(hoursOf(winner.first.when))}`);
      box.style.setProperty("--c", colorVar(winner.t.id));
      fireworks([getComputedStyle(document.documentElement).getPropertyValue(`--${winner.t.id}`).trim(), "#f0d48a", "#ffffff"]);
    } else if (Date.now() <= endMs){
      announce("go", "The Bingo Has Started!", endMs, "Time until the bingo ends",
        `Ends <b>${when(endMs)}</b> (your time). First team to complete a line wins.`);
    } else {
      announce("", "The bingo has ended", 0, "", "No team completed a line.");
    }
  }
})();
