// Mod entry: lets mods enter a completed tile by hand (from a screenshot) when TempleOSRS
// missed it. It's a collapsible section at the bottom of the tile panel, for the selected
// tile. The password is checked by the Cloudflare Worker (worker/), never here, so it isn't
// in this public code. Saved entries reach the board when GitHub rebuilds it, usually
// within a couple of minutes. Only shown when config.json has mod_api (the Worker's address).

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";
import {onDetail} from "./board.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const store = {
  get: (k, s = sessionStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = sessionStorage) => { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch {} },
};

let api = null;
try { api = ((await (await fetch("config.json", {cache: "no-cache"})).json()).mod_api || "").replace(/\/$/, "") || null; } catch {}

if (api){
  // One element, kept across redraws of the tile panel, so a half-filled form survives them.
  const box = document.createElement("details");
  box.className = "modbox";
  let password = store.get("bingo-mod"), tile = null, msg = "";

  const call = async (method, pathname, body) => {
    const res = await fetch(api + pathname, {method, headers: {"Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), {status: res.status});
    return data;
  };
  const lock = () => { password = null; store.set("bingo-mod", null); };
  const say = text => { msg = text; draw(); };

  onDetail((panel, selected) => {
    panel.append(box);   // the panel's content was just replaced; put the section back
    if (selected !== tile){ tile = selected; msg = ""; draw(); }
  });
  box.addEventListener("toggle", () => { if (box.open) draw(); });

  const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function draw(){
    const summary = `<summary>Mod entry</summary>`;
    if (!password){
      box.innerHTML = summary + `<form class="mform" data-unlock>
        <p class="note">For mods: add this tile for a team when TempleOSRS missed it, from the player's screenshot.</p>
        <label>Password<input type="password" name="pw" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Unlock</button><p class="mmsg" role="status">${esc(msg)}</p></form>`;
      const f = box.querySelector("form");
      f.onsubmit = async e => {
        e.preventDefault();
        try { await call("POST", "/check", {password: f.pw.value}); password = f.pw.value; store.set("bingo-mod", password); say(""); }
        catch (err){ say(err.message); }
      };
      return;
    }
    const items = (TILE_ITEMS[tile] || []).filter(r => r[2]);
    box.innerHTML = summary + `<form class="mform" data-entry>
      <label>Team<select name="team">${TEAMS.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>
      <label>Player<select name="by"></select></label>
      ${items.length ? `<label>Item<select name="item">${items.map(r => `<option value="${r[1]}">${esc(r[0])}</option>`).join("")}</select></label>`
        : `<p class="note">No item for this tile: the entry marks it done.</p>`}
      <label>Time (your time zone)<input type="datetime-local" name="when" value="${localNow()}" required></label>
      <label><span>Note <span class="opt">(optional)</span></span><input name="note" maxlength="200" placeholder="e.g. screenshot in #bingo"></label>
      <label>Your name<input name="mod" maxlength="30" required value="${esc(store.get("bingo-mod-name", localStorage) || "")}"></label>
      <div class="mbtns"><button class="btn" type="submit">Save entry</button><button class="linkish" type="button" data-lock>Lock</button></div>
      <p class="mmsg" role="status">${esc(msg)}</p>
    </form><div class="mlist"></div>`;
    const f = box.querySelector("form");
    const fill = () => { f.by.innerHTML = TEAMS.find(t => t.id === f.team.value).members.map(m => `<option>${esc(m)}</option>`).join(""); };
    f.team.onchange = fill; fill();
    f.onsubmit = async e => {
      e.preventDefault();
      const row = items.find(r => f.item && String(r[1]) === f.item.value);
      const entry = {team: f.team.value, tile, by: f.by.value, when: new Date(f.when.value).toISOString(),
        item: row ? row[0] : null, itemId: row ? row[1] : null, note: f.note.value.trim() || null, mod: f.mod.value.trim()};
      store.set("bingo-mod-name", entry.mod, localStorage);
      try {
        const r = await call("POST", "/entries", {password, entry});
        say(r.rebuild ? "Saved. The board updates in a minute or two." : "Saved. It shows on the board at the next update (within 30 minutes).");
      } catch (err){ if (err.status === 401) lock(); say(err.message); }
    };
    box.querySelector("[data-lock]").onclick = () => { lock(); say(""); };
    listEntries();
  }

  // This tile's entries, newest first, each with a Remove button.
  async function listEntries(){
    const el = box.querySelector(".mlist");
    let list;
    try { list = (await call("GET", "/entries")).filter(e => e.tile === tile); } catch (err){ el.textContent = err.message; return; }
    if (!list.length) return;
    const fmt = iso => new Date(iso).toLocaleString(undefined, {weekday: "short", hour: "numeric", minute: "2-digit"});
    el.innerHTML = `<h4>Entries on this tile</h4>` + list.sort((a, b) => Date.parse(b.when) - Date.parse(a.when)).map(e => {
      const team = TEAMS.find(t => t.id === e.team);
      return `<div class="mrow"><div><b>${esc(team ? team.name : e.team)}</b> · ${esc(e.by)}${e.item ? ` · ${esc(e.item)}` : ""} @ ${esc(fmt(e.when))}<br>` +
        `<span class="opt">by ${esc(e.mod)}${e.note ? ` · ${esc(e.note)}` : ""}</span></div>` +
        `<button class="btn" type="button" data-del="${esc(e.id)}">Remove</button></div>`;
    }).join("");
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Remove this entry?")) return;
      try {
        const r = await call("DELETE", `/entries/${encodeURIComponent(b.dataset.del)}`, {password});
        say(r.rebuild ? "Removed. The board updates in a minute or two." : "Removed. The board catches up at the next update (within 30 minutes).");
      } catch (err){ if (err.status === 401) lock(); say(err.message); }
    });
  }
}
