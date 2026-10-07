// Loads data/state.json (written every 30 minutes by update.js) and starts the board.
// Falls back to the sample data when there's no live data yet, or with ?sample in the address.

function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
}

(async () => {
  const status = document.getElementById("status");
  let live = null;
  if (!new URLSearchParams(location.search).has("sample")){
    try {
      const res = await fetch("data/state.json", {cache: "no-cache"});
      if (res.ok) live = await res.json();
    } catch {}
  }

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
    const startedAlready = ms <= Date.now();
    tick();
    const id = setInterval(() => {
      tick();
      // Reload once when it reaches zero, so the live board appears (not if it had already passed).
      if (!startedAlready && ms <= Date.now()){ clearInterval(id); setTimeout(() => location.reload(), 2000); }
    }, 1000);
  }
  const when = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short"});
  if (live){
    Object.assign(window, {state: live.state, dry: live.dry, drops: live.drops, byPlayer: live.byPlayer, NOW_H: live.now_h});
    const startMs = Date.parse(live.start), endMs = Date.parse(live.end);
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(live.updated)) / 60000));
    const updated = mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    status.textContent = Date.now() < startMs ? `Starts ${when(startMs)}`
      : Date.now() > endMs ? `Ended ${when(endMs)} · final results`
      : `Updated ${updated} · refreshes every 30 minutes`;
    if (Date.now() < startMs){
      const banner = document.getElementById("banner");
      banner.innerHTML = `<h2>Starting soon</h2><div class="timer" role="timer" aria-label="Time until the bingo starts"></div>` +
        `<p class="when">Starts <b>${when(startMs)}</b> (your time). Drops count from then.</p>`;
      countdown(banner.querySelector(".timer"), startMs);
      banner.hidden = false;
    }
  } else {
    await loadScript("sample-data.js");
    let starts = "", startMs = 0;
    try { const cfg = await (await fetch("config.json", {cache: "no-cache"})).json();
      if (cfg.start){ startMs = Date.parse(cfg.start); starts = `Starts ${when(startMs)}`; } } catch {}
    status.textContent = starts ? starts.trim() : "Sample data";
    const banner = document.getElementById("banner");
    banner.innerHTML = `<h2>Preview</h2><p>This page is a preview with sample data, to show how it could look.</p>` +
      (startMs ? `<div class="timer" role="timer" aria-label="Time until the bingo starts"></div>` +
        `<p class="when">The bingo starts <b>${when(startMs)}</b> (your time), and the board goes live then.</p>` : "");
    if (startMs) countdown(banner.querySelector(".timer"), startMs);
    banner.hidden = false;
  }
  start();
})();
