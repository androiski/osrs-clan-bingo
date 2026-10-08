// Mod entry: lets mods manually edit a tile for a team. "Mark done" adds a completion
// TempleOSRS missed (from a screenshot); "Uncheck" undoes a completion (the drop that
// finished it stops counting, progress stays). It's a collapsible section at the bottom of the tile panel, for the selected
// tile. The password is checked by the Cloudflare Worker (worker/), never here, so it isn't
// in this public code. Saved entries reach the board when GitHub rebuilds it, usually
// within a couple of minutes. Only shown when config.json has mod_api (the Worker's address).

import {TEAMS, TILES, TILE_ITEMS} from "./data.js";
import {onDetail, entryOf, hoursOf, dayLabel} from "./board.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const store = {
  get: (k, s = sessionStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = sessionStorage) => { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch {} },
};

let api = null, startMs = NaN, endMs = NaN;   // entries must be timed within the event
try {
  const cfg = await (await fetch("config.json", {cache: "no-cache"})).json();
  api = (cfg.mod_api || "").replace(/\/$/, "") || null;
  startMs = Date.parse(cfg.start); endMs = Date.parse(cfg.end);
} catch {}

if (api){
  // One element, kept across redraws of the tile panel, so a half-filled form survives them.
  const box = document.createElement("details");
  box.className = "modbox";
  // The password is only kept in memory while the section is in use: it locks again after
  // every save, when the section is closed, and on reload. Nothing is stored in the browser.
  store.set("bingo-mod", null);   // clear what older versions kept in sessionStorage
  let password = null, tile = null, msg = "", mode = "done";

  const call = async (method, pathname, body) => {
    const res = await fetch(api + pathname, {method, headers: {"Content-Type": "application/json"},
      body: body ? JSON.stringify(body) : undefined});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), {status: res.status});
    return data;
  };
  // After a save or removal: lock again, and let the preview redraw with the change.
  const lock = () => { password = null; };
  const changed = () => { lock(); dispatchEvent(new Event("mod-entries-changed")); };
  // While a request is out: the button shows a spinner and can't be pressed again. The
  // section is redrawn afterwards either way, which puts the button back.
  // An error shown in place, so the form keeps what was typed; the button comes back.
  const fail = (f, btn, label, text) => { btn.disabled = false; btn.textContent = label; f.querySelector(".mmsg").textContent = text; };
  const busy = (btn, text) => { btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${text}`; };
  const say = text => { msg = text; draw(); };

  onDetail((panel, selected) => {
    panel.append(box);   // the panel's content was just replaced; put the section back
    if (selected !== tile){ tile = selected; msg = ""; draw(); }
  });
  box.addEventListener("toggle", () => { if (!box.open){ lock(); msg = ""; } draw(); });

  // datetime-local fields work in the viewer's time zone, without one in the text.
  const local = ms => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const whenText = ms => new Date(ms).toLocaleString(undefined, {weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit"});

  function draw(){
    const summary = `<summary>Mod entry</summary>`;
    if (!password){
      box.innerHTML = summary + `<form class="mform" data-unlock>
        <p class="note">For mods: manually edit a tile for a team.</p>
        ${Date.now() < startMs ? `<p class="note">Before the event, entries are only for testing: they show on the preview and never count.</p>` : ""}
        <label>Password<input type="password" name="pw" autocomplete="off" required></label>
        <button class="btn" type="submit">Unlock</button><p class="mmsg" role="status">${esc(msg)}</p></form>`;
      const f = box.querySelector("form");
      f.onsubmit = async e => {
        e.preventDefault();
        busy(f.querySelector("[type=submit]"), "Checking…");
        try { await call("POST", "/check", {password: f.pw.value}); password = f.pw.value; say(""); }
        catch (err){ say(err.message); }
      };
      return;
    }
    const items = (TILE_ITEMS[tile] || []).filter(r => r[2]);
    const modes = `<div class="mmode" role="radiogroup" aria-label="What to do">` +
      [["done", "Mark done"], ["void", "Uncheck"]].map(([v, l]) =>
        `<label><input type="radio" name="mode" value="${v}"${mode === v ? " checked" : ""}> ${l}</label>`).join("") + `</div>`;
    const teamSelect = `<label>Team<select name="team" required><option value="" selected disabled>Select team</option>` +
      `${TEAMS.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>`;
    if (mode === "void"){
      box.innerHTML = summary + `<form class="mform" data-entry>${modes}${teamSelect}
        <p class="note" data-current></p>
        <label><span>Note <span class="opt">(optional)</span></span><input name="note" maxlength="200" placeholder="e.g. drop wasn't legit"></label>
        <label>Your name<input name="mod" maxlength="30" required value="${esc(store.get("bingo-mod-name", localStorage) || "")}"></label>
        <div class="mbtns"><button class="btn" type="submit">Uncheck</button><button class="linkish" type="button" data-lock>Lock</button></div>
        <p class="note">Progress stays; the next qualifying drop completes it again.</p>
        <p class="mmsg" role="status">${esc(msg)}</p>
      </form><div class="mlist"></div>`;
      const f = box.querySelector("form");
      const show = () => {
        const e = f.team.value && entryOf(f.team.value, tile), done = e && e.done;
        box.querySelector("[data-current]").textContent = !f.team.value ? "" : done
          ? `Completed: ${e.item || "Done"}${e.by && e.by !== "Team" ? ` - ${e.by}` : ""} @ ${dayLabel(hoursOf(e.when))}`
          : "Not completed, so there's nothing to uncheck.";
        f.querySelector("[type=submit]").disabled = !done;
      };
      f.team.onchange = show; show();
      f.onsubmit = async ev => {
        ev.preventDefault();
        const e = entryOf(f.team.value, tile);
        if (!e || !e.done) return;
        const entry = {action: "void", team: f.team.value, tile, by: e.by || "Team", item: e.item || null, itemId: e.id ?? null,
          h: hoursOf(e.when), note: f.note.value.trim() || null, mod: f.mod.value.trim()};
        store.set("bingo-mod-name", entry.mod, localStorage);
        const btn = f.querySelector("[type=submit]");
        busy(btn, "Unchecking…");
        try {
          const r = await call("POST", "/entries", {password, entry});
          changed();
          say(r.rebuild ? "Unchecked. The board updates in a minute or two." : "Unchecked. It shows on the board at the next update (within 30 minutes).");
        } catch (err){ if (err.status === 401){ lock(); say(err.message); } else fail(f, btn, "Uncheck", err.message); }
      };
      wire(f);
      return;
    }
    box.innerHTML = summary + `<form class="mform" data-entry>${modes}${teamSelect}
      <label>Player<select name="by" required disabled><option value="" selected disabled>Select player</option></select></label>
      ${items.length ? `<label>Item<select name="item" required><option value="" selected disabled>Select item</option>` +
          `${items.map(r => `<option value="${r[1]}">${esc(r[0])}</option>`).join("")}</select></label>`
        : `<p class="note">No item for this tile: the entry marks it done.</p>`}
      <label>Time (your time zone)<input type="datetime-local" name="when" value="${local(Date.now())}" required${startMs ? ` min="${local(startMs)}" max="${local(endMs)}"` : ""}></label>
      ${startMs ? `<p class="note">Must be during the event: ${esc(whenText(startMs))} – ${esc(whenText(endMs))}.</p>` : ""}
      <label><span>Note <span class="opt">(optional)</span></span><input name="note" maxlength="200" placeholder="e.g. screenshot in #bingo"></label>
      <label>Your name<input name="mod" maxlength="30" required value="${esc(store.get("bingo-mod-name", localStorage) || "")}"></label>
      <div class="mbtns"><button class="btn" type="submit">Save entry</button><button class="linkish" type="button" data-lock>Lock</button></div>
      <p class="mmsg" role="status">${esc(msg)}</p>
    </form><div class="mlist"></div>`;
    const f = box.querySelector("form");
    // The browser itself blocks a time outside min/max; say why in the form too.
    f.when.addEventListener("invalid", () => {
      f.querySelector(".mmsg").textContent = f.when.value ? `That time is outside the event (${whenText(startMs)} – ${whenText(endMs)}).` : "Pick a time.";
    });
    f.team.onchange = () => {
      f.by.innerHTML = `<option value="" selected disabled>Select player</option>` +
        TEAMS.find(t => t.id === f.team.value).members.map(m => `<option>${esc(m)}</option>`).join("");
      f.by.disabled = false;
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const row = items.find(r => f.item && String(r[1]) === f.item.value);
      const btn = f.querySelector("[type=submit]"), at = new Date(f.when.value).getTime();
      if (!(at >= startMs && at <= endMs)) return fail(f, btn, "Save entry",
        `That time is outside the event (${whenText(startMs)} – ${whenText(endMs)}).`);
      const entry = {team: f.team.value, tile, by: f.by.value, when: new Date(at).toISOString(),
        item: row ? row[0] : null, itemId: row ? row[1] : null, note: f.note.value.trim() || null, mod: f.mod.value.trim()};
      store.set("bingo-mod-name", entry.mod, localStorage);
      busy(btn, "Saving…");
      try {
        const r = await call("POST", "/entries", {password, entry});
        changed();   // locks again; the next entry needs the password
        say(r.rebuild ? "Saved. The board updates in a minute or two." : "Saved. It shows on the board at the next update (within 30 minutes).");
      } catch (err){ if (err.status === 401){ lock(); say(err.message); } else fail(f, btn, "Save entry", err.message); }
    };
    wire(f);
  }

  // Shared by both forms: switching mode, Lock, and the list of entries.
  function wire(f){
    f.querySelectorAll("[name=mode]").forEach(r => r.onchange = () => { mode = r.value; msg = ""; draw(); });
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
    el.innerHTML = `<h4>Entries on this tile</h4>` + list.sort((a, b) => Date.parse(b.added) - Date.parse(a.added)).map(e => {
      const team = TEAMS.find(t => t.id === e.team);
      const what = e.action === "void"
        ? `Unchecked: ${e.item ? esc(e.item) : "completion"}${e.by !== "Team" ? ` - ${esc(e.by)}` : ""} @ ${esc(dayLabel(e.h))}`
        : `${esc(e.by)}${e.item ? ` · ${esc(e.item)}` : ""} @ ${esc(fmt(e.when))}`;
      return `<div class="mrow"><div><b>${esc(team ? team.name : e.team)}</b> · ${what}<br>` +
        `<span class="opt">by ${esc(e.mod)}${e.note ? ` · ${esc(e.note)}` : ""}</span></div>` +
        `<button class="btn" type="button" data-del="${esc(e.id)}">Remove</button></div>`;
    }).join("");
    // Two clicks to remove: the first turns the button into "Confirm remove" for a few seconds.
    // (No confirm() pop-up: some browsers and in-app views block it and silently answer no.)
    el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      if (!b.dataset.armed){
        b.dataset.armed = "1"; b.textContent = "Confirm remove"; b.classList.add("warn");
        setTimeout(() => { if (b.isConnected && !b.disabled){ delete b.dataset.armed; b.textContent = "Remove"; b.classList.remove("warn"); } }, 4000);
        return;
      }
      busy(b, "Removing…");
      try {
        const r = await call("DELETE", `/entries/${encodeURIComponent(b.dataset.del)}`, {password});
        changed();
        say(r.rebuild ? "Removed. The board updates in a minute or two." : "Removed. The board catches up at the next update (within 30 minutes).");
      } catch (err){ if (err.status === 401) lock(); say(err.message); }
    });
  }
}
