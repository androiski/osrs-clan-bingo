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

  const until = ms => { const d = Math.round((ms - Date.now()) / 86400000); return d > 1 ? `, in ${d} days` : d === 1 ? ", tomorrow" : ""; };
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
      banner.innerHTML = `<h2>Starting soon</h2><p>The bingo starts <b>${when(startMs)}</b> (your time)${until(startMs)}. Drops count from then.</p>`;
      banner.hidden = false;
    }
  } else {
    await loadScript("sample-data.js");
    let starts = "", startMs = 0;
    try { const cfg = await (await fetch("config.json", {cache: "no-cache"})).json();
      if (cfg.start){ startMs = Date.parse(cfg.start); starts = `Starts ${when(startMs)}`; } } catch {}
    status.textContent = starts ? starts.trim() : "Sample data";
    const banner = document.getElementById("banner");
    banner.innerHTML = `<h2>Preview: sample data</h2><p>Everything on this board is made up, to show how it will look. ` +
      `${startMs ? `The bingo starts <b>${when(startMs)}</b> (your time)${until(startMs)}, and the board goes live then.` : "The board goes live when the bingo starts."}</p>`;
    banner.hidden = false;
  }
  start();
})();
