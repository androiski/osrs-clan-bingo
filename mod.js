// Mod panel: lets mods enter a completed tile by hand (from a screenshot) when TempleOSRS
// missed it. Opens from the lock button in the header. The password is checked by the
// Cloudflare Worker (worker/), never here, so it isn't in this public code. Saved entries
// reach the board when GitHub rebuilds it, usually within a couple of minutes.
// Only shown when config.json has mod_api (the Worker's address).

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const store = {
  get: (k, s = sessionStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = sessionStorage) => { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch {} },
};

let api = null;
try { api = ((await (await fetch("config.json", {cache: "no-cache"})).json()).mod_api || "").replace(/\/$/, "") || null; } catch {}

if (api){
  const btn = document.createElement("button");
  btn.className = "btn icon"; btn.type = "button"; btn.innerHTML = LOCK;
  btn.title = "Mod entry"; btn.setAttribute("aria-label", "Mod entry"); btn.setAttribute("aria-expanded", "false");
  document.querySelector(".controls").prepend(btn);

  const panel = document.createElement("aside");
  panel.className = "modpanel"; panel.hidden = true; panel.setAttribute("aria-label", "Mod entry");
  document.body.append(panel);

  let password = store.get("bingo-mod");
  const call = async (method, pathname, body) => {
    const res = await fetch(api + pathname, {method, headers: {"Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), {status: res.status});
    return data;
  };

  const open = show => {
    panel.hidden = !show; btn.setAttribute("aria-expanded", String(show));
    if (show) draw();
  };
  btn.onclick = () => open(panel.hidden);
  addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) open(false); });

  const head = `<div class="mhead"><h3>Mod entry</h3><button class="btn" type="button" data-close>Close</button></div>`;

  function draw(msg = ""){
    if (!password){
      panel.innerHTML = head + `<form class="mform" data-unlock>
        <p class="note">For mods: add a tile TempleOSRS missed, from the player's screenshot.</p>
        <label>Password<input type="password" name="pw" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Unlock</button><p class="mmsg" role="status">${esc(msg)}</p></form>`;
      panel.querySelector("input").focus();
    } else drawForm(msg);
    panel.querySelector("[data-close]").onclick = () => open(false);
    const unlock = panel.querySelector("[data-unlock]");
    if (unlock) unlock.onsubmit = async e => {
      e.preventDefault();
      const pw = unlock.pw.value;
      try { await call("POST", "/check", {password: pw}); password = pw; store.set("bingo-mod", pw); draw(); }
      catch (err){ draw(err.message); }
    };
  }

  const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const selectedTile = () => { const t = document.querySelector(".tile[aria-pressed=true]"); return t ? +t.dataset.i : 0; };

  async function drawForm(msg){
    const tileNow = selectedTile();
    panel.innerHTML = head + `<form class="mform" data-entry>
      <label>Team<select name="team">${TEAMS.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
      <label>Player<select name="by"></select></label>
      <label>Tile<select name="tile">${TILES.map((t, i) => `<option value="${i}"${i === tileNow ? " selected" : ""}>${esc(t.n)}</option>`).join("")}</select></label>
      <label data-item>Item<select name="item"></select></label>
      <p class="note" data-noitem hidden>No item for this tile: the entry marks it done.</p>
      <label>Time (your time zone)<input type="datetime-local" name="when" value="${localNow()}" required></label>
      <label><span>Note <span class="opt">(optional)</span></span><input name="note" maxlength="200" placeholder="e.g. screenshot in #bingo"></label>
      <label>Your name<input name="mod" maxlength="30" required value="${esc(store.get("bingo-mod-name", localStorage) || "")}"></label>
      <button class="btn" type="submit">Save entry</button>
      <p class="mmsg" role="status">${esc(msg)}</p>
    </form><h4>Entries</h4><div class="mlist">Loading…</div>
    <p class="note"><button class="linkish" type="button" data-lock>Lock</button></p>`;
    const f = panel.querySelector("[data-entry]");
    const fill = () => {
      const team = TEAMS.find(t => t.id === f.team.value);
      f.by.innerHTML = team.members.map(m => `<option>${esc(m)}</option>`).join("");
      const items = (TILE_ITEMS[+f.tile.value] || []).filter(r => r[2]);
      f.item.innerHTML = items.map(r => `<option value="${r[1]}">${esc(r[0])}</option>`).join("");
      panel.querySelector("[data-item]").hidden = !items.length;
      panel.querySelector("[data-noitem]").hidden = !!items.length;
    };
    f.team.onchange = fill; f.tile.onchange = fill; fill();
    f.onsubmit = async e => {
      e.preventDefault();
      const items = (TILE_ITEMS[+f.tile.value] || []).filter(r => r[2]);
      const row = items.find(r => String(r[1]) === f.item.value);
      const entry = {team: f.team.value, tile: +f.tile.value, by: f.by.value, when: new Date(f.when.value).toISOString(),
        item: row ? row[0] : null, itemId: row ? row[1] : null, note: f.note.value.trim() || null, mod: f.mod.value.trim()};
      store.set("bingo-mod-name", entry.mod, localStorage);
      try {
        const r = await call("POST", "/entries", {password, entry});
        drawForm(r.rebuild ? "Saved. The board updates in a minute or two." : "Saved. It shows on the board at the next update (within 30 minutes).");
      } catch (err){ if (err.status === 401){ password = null; store.set("bingo-mod", null); } draw(err.message); }
    };
    panel.querySelector("[data-lock]").onclick = () => { password = null; store.set("bingo-mod", null); draw(); };
    listEntries();
  }

  async function listEntries(){
    const box = panel.querySelector(".mlist");
    let list;
    try { list = await call("GET", "/entries"); } catch (err){ box.textContent = err.message; return; }
    if (!list.length){ box.textContent = "None yet."; return; }
    const fmt = iso => new Date(iso).toLocaleString(undefined, {weekday: "short", hour: "numeric", minute: "2-digit"});
    box.innerHTML = list.slice().sort((a, b) => Date.parse(b.when) - Date.parse(a.when)).map(e => {
      const team = TEAMS.find(t => t.id === e.team);
      return `<div class="mrow"><div><b>${esc(TILES[e.tile] ? TILES[e.tile].n : "?")}</b> · ${esc(team ? team.name : e.team)}<br>` +
        `${esc(e.by)}${e.item ? ` · ${esc(e.item)}` : ""} @ ${esc(fmt(e.when))}<br><span class="opt">by ${esc(e.mod)}${e.note ? ` · ${esc(e.note)}` : ""}</span></div>` +
        `<button class="btn" type="button" data-del="${esc(e.id)}">Remove</button></div>`;
    }).join("");
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Remove this entry?")) return;
      try {
        const r = await call("DELETE", `/entries/${encodeURIComponent(b.dataset.del)}`, {password});
        drawForm(r.rebuild ? "Removed. The board updates in a minute or two." : "Removed. The board catches up at the next update (within 30 minutes).");
      }
      catch (err){ drawForm(err.message); }
    });
  }
}
