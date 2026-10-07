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

  if (live){
    Object.assign(window, {state: live.state, dry: live.dry, drops: live.drops, byPlayer: live.byPlayer, NOW_H: live.now_h});
    const startMs = Date.parse(live.start), endMs = Date.parse(live.end);
    const when = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"});
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(live.updated)) / 60000));
    const updated = mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    status.textContent = Date.now() < startMs ? `Starts ${when(startMs)}`
      : Date.now() > endMs ? `Ended ${when(endMs)} · final results`
      : `Updated ${updated} · refreshes every 30 minutes`;
  } else {
    await loadScript("sample-data.js");
    status.textContent = "Sample data. The event hasn't started yet.";
  }
  start();
})();
