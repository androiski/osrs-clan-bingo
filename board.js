// Scoring and drawing: board, scores, tile panel, progress chart, rosters, theme.

import {TEAMS, SOURCES, TILES, TILE_ICON, TRACK, ACT_NAMES, ACT_ICON, TILE_ITEMS, CLOG_SECTION, person, people} from "./data.js";

// The event data being shown (live or sample), set once by live-data.js through setData().
let state = {}, dry = {}, drops = {}, byPlayer = {}, byAct = {}, NOW_H = 0;
let liveSync = null;   // during the event: each player's log sync status, from the board update
export function setData(d){ ({state, dry, drops, byPlayer} = d); byAct = d.byAct || {}; NOW_H = d.nowH; liveSync = d.sync || null; }

function tileIcon(i){
  if (TILES[i].s === "xp") return TRACK[i].icon;
  if (typeof TILE_ICON[i] === "number") return ICON(TILE_ICON[i]);
  const row = (TILE_ITEMS[i]||[]).find(r=>r[0] === TILE_ICON[i]);
  return row ? ICON(row[1]) : null;
}
const tileFace = (i, tile) => { const src = tileIcon(i);
  return `${src ? `<img class="tico" src="${src}" alt="" loading="lazy">` : ""}<span class="tname"><span class="full">${tile.n}</span><span class="short">${tile.short || tile.n}</span></span>`; };

let view = "all", selected = null;   // the tile shown in the panel; null = none (click it again to deselect)
// Icon for a tracked boss (its pet) or skill, and the distinct icons for a tile's tracking.
const actIcon = act => { const ic = ACT_ICON[act]; return typeof ic === "number" ? ICON(ic) : ic; };
const trackIcons = tr => [...new Set(tr.acts.map(actIcon).filter(Boolean))]
  .map(src => `<img class="aico" src="${src}" alt="">`).join("");
// A team's icon (chompy bird, greyhound, cake), sized by the class.
const teamIco = (t, cls = "tico-s") => t.icon ? `<img class="${cls}" src="${ICON(t.icon)}" alt="">` : "";
const colorVar = id => `var(--${id})`;
const fmt = n => n >= 1000 ? Math.round(n/1000) + "k" : String(n);

const LINES = [];
for (let r=0;r<5;r++) LINES.push([0,1,2,3,4].map(c=>r*5+c));
for (let c=0;c<5;c++) LINES.push([0,1,2,3,4].map(r=>r*5+c));
LINES.push([0,6,12,18,24],[4,8,12,16,20]);

// Sortable key for a completion time. Sample data uses "Day N, HH:MM".
// Live data gives hours since the start as a number.
function whenKey(when){
  if (typeof when === "number") return when*60 + 1440;
  const m = /Day (\d+), (\d+):(\d+)/.exec(when || "");
  return m ? (+m[1])*1440 + (+m[2])*60 + (+m[3]) : Infinity;
}

// Points: 1 per tile, plus 3 per completed line (any row, column or diagonal of 5). The
// team with the most points when time runs out wins; on a tie, whoever reached that score
// first. reached = when the team's last tile was completed (its score hasn't changed since).
const LINE_POINTS = 3;
function stats(tid){
  const t = state[tid] || {};
  const done = i => t[i] && t[i].done;
  const tiles = TILES.filter((_,i)=>done(i)).length;
  const lines = LINES.filter(l=>l.every(done)).length;
  const reached = Math.max(-Infinity, ...TILES.map((_,i)=>done(i) ? whenKey(t[i].when) : -Infinity));
  return {tiles, lines, points: tiles + LINE_POINTS * lines, reached};
}

// Teams in order: most points, then whoever got there first, then most tiles.
function ranking(){
  return TEAMS.map(t=>({t, ...stats(t.id)}))
    .sort((a,b)=> b.points-a.points || a.reached-b.reached || b.tiles-a.tiles);
}

// Points a completed tile earned when it was done: 1, plus 3 for each line it finished.
function tilePoints(tid, i){
  const t = state[tid] || {}, k = whenKey((t[i] || {}).when);
  const doneBy = j => t[j] && t[j].done && whenKey(t[j].when) <= k;
  return 1 + LINE_POINTS * LINES.filter(l=>l.includes(i) && l.every(doneBy)).length;
}

function renderScores(){
  const ranked = ranking();
  document.getElementById("scores").innerHTML = ranked.map((r,i)=>`
    <div class="score" style="--c:${colorVar(r.t.id)}">
      <span class="rank">#${i+1}</span>
      <h2>${teamIco(r.t, "tico-m")}${r.t.name}</h2>
      <div class="nums"><span><b>${r.points}</b>${r.points === 1 ? "point" : "points"}</span>
        <span><b>${r.tiles}</b>${r.tiles === 1 ? "tile" : "tiles"}</span><span><b>${r.lines}</b>${r.lines === 1 ? "line" : "lines"}</span></div>
      <div class="bar" aria-hidden="true"><i style="width:${r.tiles / TILES.length * 100}%"></i></div>
    </div>`).join("");
}

function renderViewbar(){
  const vb = document.getElementById("viewbar");
  vb.innerHTML = '<span>Show</span>' +
    `<button class="btn" data-view="all" aria-pressed="${view==="all"}">All teams</button>` +
    TEAMS.map(t=>`<button class="btn" data-team data-view="${t.id}" style="--c:${colorVar(t.id)}" aria-pressed="${view===t.id}">${teamIco(t)}${t.name}</button>`).join("");
  vb.querySelectorAll("button").forEach(b=>b.onclick=()=>{view=b.dataset.view;render();});
}

function progressText(tile, entry){
  if (!entry || entry.progress == null) return "";
  if (tile.s === "xp") return `${fmt(entry.progress)} / ${fmt(tile.target)}`;
  if (tile.target) return `${Math.min(entry.progress,tile.target)} / ${tile.target}`;
  return "";
}

function renderBoard(){
  const board = document.getElementById("board");
  board.innerHTML = TILES.map((tile,i)=>{
    const src = SOURCES[tile.s];
    if (view === "all"){
      const pips = TEAMS.map(t=>{
        const e = (state[t.id]||{})[i];
        const cls = e && e.done ? "done" : (e && e.progress ? "part" : "");
        return `<span class="pip ${cls}" style="--c:${colorVar(t.id)}"></span>`;
      }).join("");
      // Fill with the colour of each team that has completed it; stripes when more than one has.
      const doneBy = TEAMS.filter(t=>((state[t.id]||{})[i]||{}).done);
      let fill = "";
      if (doneBy.length === 1) fill = ` style="--c:${colorVar(doneBy[0].id)}"`;
      else if (doneBy.length > 1){
        const w = 10;
        const stops = doneBy.map((t,k)=>`color-mix(in srgb,var(--tile) 45%,${colorVar(t.id)}) ${k*w}px ${(k+1)*w}px`).join(",");
        fill = ` style="background:repeating-linear-gradient(135deg,${stops})"`;
      }
      return `<button class="tile${doneBy.length?" done":""}"${fill} data-i="${i}" aria-pressed="${selected===i}"><span class="src">${src.mark}</span>${tileFace(i, tile)}<span class="pips">${pips}</span></button>`;
    }
    const e = (state[view]||{})[i];
    const done = e && e.done;
    const prog = !done ? progressText(tile, e) : "";
    return `<button class="tile ${done?"done":""}" style="--c:${colorVar(view)}" data-i="${i}" aria-pressed="${selected===i}"><span class="src">${src.mark}</span>${tileFace(i, tile)}${prog?`<span class="tprog">${prog}</span>`:""}</button>`;
  }).join("");
  board.querySelectorAll(".tile").forEach(b=>b.onclick=()=>{selected = selected === +b.dataset.i ? null : +b.dataset.i; render();});
}

// The tile panel's summary: what counts (item icons, or the skill for XP tiles), and the
// collection log section or hiscore it's tracked from.
function tileSummary(i, tile, src){
  const tr = TRACK[i];
  let first;
  if (tile.s === "xp") first = `<span class="lbl">Hiscores</span><span class="ics">${trackIcons(tr)}${tile.n}</span>`;
  else {
    const rows = (TILE_ITEMS[i] || []).filter(r => r[2]), MAX = 10;
    first = `<span class="lbl">Collection log</span><span class="ics">` +
      rows.slice(0, MAX).map(r => `<img class="cico" src="${ICON(r[1])}" alt="${r[0]}" title="${r[0]}">`).join("") +
      (rows.length > MAX ? `<span class="more">+${rows.length - MAX} more</span>` : "") + `</span>`;
  }
  // Skill stand-ins (e.g. Agility XP for the Sepulchre) aren't part of how the tile is
  // tracked, so they get no icon here.
  const icons = tr && !tr.proxy ? trackIcons(tr) : "";
  return `<div class="sum"><p>${first}</p>` +
    `<p><span class="lbl">Tracked by</span><span>${icons}${CLOG_SECTION[i] || src.label}</span></p></div>`;
}

function renderDetail(){
  const el = document.getElementById("detail");
  el.hidden = selected == null;
  el.closest(".main").classList.toggle("nodetail", selected == null);
  if (selected == null){ el.innerHTML = ""; return; }
  const tile = TILES[selected], src = SOURCES[tile.s];
  const tIco = tileIcon(selected);
  const rows = TILE_ITEMS[selected] || [];
  const brotherOf = name => (rows.find(r=>r[0] === name) || [])[3];
  const ico = d => `<img class="ico" src="${ICON(d.id)}" alt="${qtyName(d)}" title="${got(qtyName(d), d.by, d.h)}">`;

  // Drops so far that count toward the tile. Barrows tracks every brother at once until one set is whole.
  function progressLines(t, e){
    const pd = ((drops[selected]||{})[t.id]||[]).filter(d=>d.kind === "progress");
    if (e && e.done && !pd.length) return "";
    if (e && e.done && e.id) pd.push({name:e.item, id:e.id, by:e.by, h:hoursOf(e.when), qty:e.qty});
    pd.sort((a,b)=>a.h-b.h);
    if (!pd.length) return "";
    if (rows.some(r=>r[3])){
      const sets = {};
      for (const d of pd){ const b = brotherOf(d.name); if (!b) continue;
        const set = sets[b] ||= new Map(); if (!set.has(d.name)) set.set(d.name, d); }
      return Object.entries(sets).sort((a,b)=>b[1].size - a[1].size)
        .map(([b,set])=>`<div class="pl"><span>${b} ${set.size}/4</span>${[...set.values()].map(ico).join("")}</div>`).join("");
    }
    const pIco = tile.countIcon ? d => ico({...d, id: tile.countIcon}) : ico;
    return `<div class="pl"><span>${tile.count ? tile.count + " " : ""}${tile.target ? `${Math.min(qtySum(pd), tile.target)}/${tile.target}` : `${qtySum(pd)}/${qtySum(pd)}`}</span>${pd.map(pIco).join("")}</div>`;
  }

  el.innerHTML = `<h3>${tIco ? `<img class="hico" src="${tIco}" alt="">` : ""}<span>${tile.n}</span></h3>${tileSummary(selected, tile, src)}` +
    (tile.rule ? `<p class="rule">${tile.rule}</p>` : "") +
    TEAMS.map(t=>{
      const e = (state[t.id]||{})[selected];
      const isSet = rows.some(r=>r[3]);
      const prog = e && e.done ? (isSet || !tile.target ? "" : progressLines(t, e)) : progressLines(t);
      let st;
      if (e && e.done){
        const dIco = e.id ? ICON(e.id) : tile.s === "xp" ? tIco : null;
        st = `<div class="st ok">${dIco ? `<img class="ico" src="${dIco}" alt="">` : ""}${got(e.item || "Done", byNames(selected, t.id, e) || e.by, e.when)}${e.manual ? ` <span class="modtag" title="Entered by a mod from a screenshot">mod</span>` : ""}</div>${prog ? `<div class="st">${prog}</div>` : ""}`;
      }
      else if (prog) st = `<div class="st">${prog}</div>`;
      else if (tile.s === "xp" && e && e.progress) st = `<div class="st">${progressText(tile,e)}</div>`;
      else st = `<div class="st empty">-</div>`;
      return `<div class="trow" style="--c:${colorVar(t.id)}"><div class="tn">${teamIco(t)}${t.name}</div>${st}</div>`;
    }).join("");
  if (afterDetail) afterDetail(el, selected);
}

// mod.js adds its entry form to the bottom of the tile panel through this.
let afterDetail = null;
let started = false;
export const onDetail = fn => { afterDetail = fn; if (started) renderDetail(); };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// TempleOSRS times are UTC ("2026-10-08 18:20:23"); shown in the viewer's time: a day and time
// in the last week, otherwise just the date.
function syncedWhen(text){
  const at = Date.parse((text || "").replace(" ", "T") + "Z");
  if (!at) return "";
  const d = new Date(at), recent = Date.now() - at < 6 * 86400e3;
  return recent ? `, last ${d.toLocaleString(undefined, {weekday: "short", hour: "numeric", minute: "2-digit"})}`
    : `, last ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? "" : " " + d.getFullYear()}`;
}
function rosterChip(s){
  if (!s) return `<span class="chip">Not checked</span>`;
  if (s.status === "synced") return `<span class="chip ok">Log synced${syncedWhen(s.log_last_changed)}</span>`;
  if (s.status === "unsynced") return `<span class="chip warn">Log not synced</span>`;
  if (s.status === "missing") return `<span class="chip bad">No Temple profile</span>`;
  if (s.status === "notingroup") return `<span class="chip bad">Not in group</span>`;
  return `<span class="chip">Check failed</span>`;
}

// One line per person; someone with a second account gets each account's status. A person
// counts as synced once all their accounts are, and otherwise takes their worst status.
function renderRosters(){
  // During the event the board update has each player's status from the group; before it,
  // the roster check's (roster-status.js).
  const rs = liveSync ? {players: liveSync, live: true} : window.ROSTER_STATUS;
  const accounts = (rs && rs.players) || {};
  const accountsOf = p => TEAMS.flatMap(t=>t.members).filter(m=>person(m) === p);
  const RANK = {notingroup: 0, missing: 0, error: 1, unsynced: 2, synced: 3};
  const players = Object.fromEntries(TEAMS.flatMap(people).map(p=>{
    const ss = accountsOf(p).map(m=>accounts[m]);
    return [p, ss.some(s=>!s) ? undefined : ss.reduce((a, b)=>RANK[b.status] < RANK[a.status] ? b : a)];
  }));
  const all = TEAMS.flatMap(people);
  const count = st => all.filter(m=>players[m] && players[m].status === st).length;
  // "2026-10-08 18:55 UTC" -> "Wed 11:55 AM (2 h ago)", in the viewer's time.
  const at = rs && rs.checked && Date.parse(rs.checked.replace(" ", "T").replace(" UTC", "Z"));
  const mins = Math.round((Date.now() - at) / 60000);
  const checked = !at ? (rs && rs.checked) : new Date(at).toLocaleString(undefined, {weekday: "short", hour: "numeric", minute: "2-digit"}) +
    ` (${mins < 1 ? "just now" : mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`})`;
  document.getElementById("rosterNote").textContent = rs && rs.live
    ? `From TempleOSRS at the last board update: when each player's collection log last synced. After a repeat bingo drop, open that log page and sync it again.`
    : rs
    ? `Checked on TempleOSRS every hour, last updated ${checked}.${count("synced")} of ${all.length} players have synced their collection log${count("missing") ? "," : " and"} ${count("unsynced")} haven't${count("missing") ? `, and ${count("missing")} ${count("missing") === 1 ? "has" : "have"} no Temple profile` : ""}. Anyone not synced should follow step 1 above before the start.`
    : "Temple status hasn't been checked yet. Run check_temple_roster.py to fill this in.";
  document.getElementById("rosters").innerHTML = TEAMS.map(t=>{
    const ps = people(t), synced = ps.filter(m=>players[m] && players[m].status === "synced").length;
    const line = p => {
      const accs = accountsOf(p);
      if (accs.length === 1) return `<li><span>${p}</span>${rosterChip(accounts[p])}</li>`;
      return `<li class="multi"><span>${p}</span><span class="accs">` +
        accs.map(a=>`<span class="acc"><small>${a}</small>${rosterChip(accounts[a])}</span>`).join("") + `</span></li>`;
    };
    return `
    <div class="roster" style="--c:${colorVar(t.id)}">
      <h3>${teamIco(t)}${t.name} (${rs ? `${synced}/${ps.length} synced` : ps.length})</h3>
      <ul>${ps.map(line).join("")}</ul>
    </div>`;
  }).join("");
}

function renderLegend(){
  document.getElementById("legend").innerHTML = Object.values(SOURCES).map(s=>
    `<div><b><code>${s.mark}</code> ${s.label}</b>${s.detail}</div>`).join("");
}

// A stackable seen several at once is one drop with qty (missing means 1).
const qtySum = list => list.reduce((s, d) => s + (d.qty || 1), 0);
const qtyName = d => d.qty > 1 ? `${d.name} ×${d.qty}` : d.name;
const got = (item, by, when) => `${item}${by && by !== "Team" ? ` - ${by}` : ""} @ ${dayLabel(typeof when === "number" ? when : hoursOf(when))}`;
// Who got a tile: the finisher, plus anyone whose drops it needed. Count tiles take the drops
// that made up the target; Barrows only the pieces of the set that was finished. XP tiles
// are a team effort, so nobody is named.
function helpers(i, tid, e){
  const tile = TILES[i];
  if (!e || !e.done || !e.by || e.by === "Team") return [];
  if (!tile.target || tile.s === "xp" || (tile.alone || []).includes(e.item)) return [e.by];
  const doneH = hoursOf(e.when), rows = TILE_ITEMS[i] || [];
  let pd = ((drops[i] || {})[tid] || []).filter(d => d.kind === "progress" && d.h <= doneH).sort((a, b) => a.h - b.h);
  if (rows.some(r => r[3])){
    const brother = (e.item || "").replace(/'s set$/, ""), seen = new Set();
    pd = pd.filter(d => (rows.find(r => r[0] === d.name) || [])[3] === brother && !seen.has(d.name) && seen.add(d.name));
  } else { let n = e.qty || 1; pd = pd.filter(d => n < tile.target && (n += d.qty || 1)); }
  return [...new Set([...pd.map(d => d.by), e.by])];
}
const byNames = (i, tid, e) => helpers(i, tid, e).join(", ");

const hoursOf = when => { const k = whenKey(when); return k === Infinity ? null : k/60 - 24; };
const dayLabel = h => { const total = Math.round(h*60), hh = Math.floor(total/60), mm = total % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`; };
const valueAt = (pts, h) => { let v = 0; for (const p of pts){ if (p[0] > h) break; v = p[1]; } return v; };
const fmtN = (n, unit) => unit === "XP" && n >= 1000 ? Math.round(n/1000) + "k" : n.toLocaleString("en-GB");

// Item icons by item ID, served by RuneLite.
const ICON = id => `https://static.runelite.net/cache/item/icon/${id}.png`;

function niceMax(v){
  if (v <= 0) return {max:5, step:1};
  const raw = v / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1,2,2.5,5,10].map(k=>k*mag).find(s=>s >= raw);
  return {max: Math.ceil(v/step)*step, step};
}

function renderDry(){
  const el = document.getElementById("dry");
  el.hidden = selected == null;
  if (selected == null){ el.innerHTML = ""; return; }
  const tile = TILES[selected], tr = TRACK[selected];
  const teamDrops = t => ((drops[selected]||{})[t.id]||[]).slice().sort((a,b)=>a.h-b.h);

  if (!tr){
    // No hiscore to chart: just say who got it and when.
    const rows = TEAMS.map(t=>{
      const e = (state[t.id]||{})[selected];
      const cell = e && e.done
        ? `${e.id ? `<img class="ico" src="${ICON(e.id)}" alt="">` : ""}${got(e.item || "Done", byNames(selected, t.id, e) || e.by, e.when)}`
        : `<span class="muted">-</span>`;
      return `<tr><td><span class="sw" style="--c:${colorVar(t.id)}"></span> ${t.name}</td><td>${cell}</td></tr>`;
    }).join("");
    el.innerHTML = `<h3>Progress</h3>
      <p class="dsub">Not on the hiscores, so no KC to chart.</p>
      <table><thead><tr><th>Team</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    return;
  }

  const series = TEAMS.map(t=>{
    const e = (state[t.id]||{})[selected];
    const pts = dry[selected][t.id];
    // XP tiles are done when the total crosses the target; item tiles when the drop came in.
    const cross = tile.s === "xp" ? pts.find(p=>p[1] >= tile.target) : null;
    const doneH = tile.s === "xp" ? (cross ? cross[0] : null) : (e && e.done ? hoursOf(e.when) : null);
    return {t, e, pts, doneH, doneV: doneH == null ? null : valueAt(pts, doneH), total: pts[pts.length-1][1], drops: teamDrops(t)};
  });
  const actText = tr.acts.map(a=>ACT_NAMES[a]||a).join(" + ");
  const target = tile.s === "xp" ? tile.target : null;

  const W = Math.max(280, el.clientWidth - 32), H = 240;
  const m = {l: tr.unit === "XP" ? 44 : 36, r: 16, t: 16, b: 24};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xMax = Math.max(24, Math.ceil(NOW_H/24)*24);
  const {max: yMax, step} = niceMax(Math.max(target||0, ...series.map(s=>s.total)) * 1.05);
  const x = h => m.l + h/xMax*iw, y = v => m.t + ih - v/yMax*ih;

  let grid = "", axis = "";
  for (let v = 0; v <= yMax + 1e-9; v += step){
    grid += `<line x1="${m.l}" x2="${m.l+iw}" y1="${y(v)}" y2="${y(v)}"/>`;
    axis += `<text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${fmtN(v, tr.unit)}</text>`;
  }
  const hStep = [1,2,3,6,12,24].find(st=>st/xMax*iw >= 56) || 24;
  for (let h = 0; h <= xMax; h += hStep){
    axis += `<text x="${x(h)}" y="${H-6}" text-anchor="middle">${h}h</text>`;
    if (h) grid += `<line class="v" x1="${x(h)}" x2="${x(h)}" y1="${m.t}" y2="${m.t+ih}"/>`;
  }
  const tgt = target ? `<g class="target"><line x1="${m.l}" x2="${m.l+iw}" y1="${y(target)}" y2="${y(target)}"/><text x="${m.l+4}" y="${y(target)-5}">Target ${fmtN(target, tr.unit)}</text></g>` : "";

  // Icon markers sit on the team's line at the time of the drop. Sizes: completion > counts toward it > other drop.
  const SIZE = {done:[14,24], progress:[11,18], other:[9,15]};
  // Mod entries get a square instead of a circle; a drop a mod unchecked gets an X over it.
  const marker = (kind, cx, cy, src, label, manual, voided) => {
    const [r, w] = SIZE[kind];
    const shape = manual ? `<rect x="${cx-r}" y="${cy-r}" width="${2*r}" height="${2*r}" rx="2"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
    const k = r * 0.8;
    return `<g class="mk ${kind}${manual ? " manual" : ""}${voided ? " voided" : ""}"><title>${label}${manual ? " (mod entry)" : ""}</title>${shape}` +
      (src ? `<image href="${src}" x="${cx-w/2}" y="${cy-w/2+1}" width="${w}" height="${w-2}"/>` : "") +
      (voided ? `<path class="x" d="M${cx-k},${cy-k}L${cx+k},${cy+k}M${cx+k},${cy-k}L${cx-k},${cy+k}"/>` : "") + `</g>`;
  };

  // Step lines: a total holds until the next update. The table below names each line.
  const lines = series.map(s=>{
    let d = `M${x(s.pts[0][0])},${y(s.pts[0][1])}`;
    for (let k = 1; k < s.pts.length; k++) d += `H${x(s.pts[k][0])}V${y(s.pts[k][1])}`;
    const others = s.drops.filter(dr=>dr.kind !== "done")
      .map(dr=>marker(dr.kind, x(dr.h), y(valueAt(s.pts, dr.h)), ICON(dr.id),
        `${got(qtyName(dr), dr.by, dr.h)}${dr.voided ? " (unchecked by a mod)" : dr.kind === "other" ? " (doesn't count)" : ""}`, dr.manual, dr.voided)).join("");
    let done = "";
    if (s.doneH != null){
      const src = tile.s === "xp" ? tr.icon : (s.e.id ? ICON(s.e.id) : null);
      const label = tile.s === "xp" ? got(`${fmtN(tile.target, "XP")} reached`, null, s.doneH) : got(s.e.item, byNames(selected, s.t.id, s.e) || s.e.by, s.e.when);
      done = marker("done", x(s.doneH), y(s.doneV), src, label, s.e.manual);
    }
    return `<g class="series" style="--c:${colorVar(s.t.id)}"><path d="${d}"/>${others}${done}</g>`;
  }).join("");

  const rows = series.map(s=>{
    // Status: the item's icon (its name on hover), who got it and when.
    const gotIt = s.doneH == null ? ""
      : tile.s === "xp" ? `<img class="ico" src="${tr.icon}" alt="" title="${fmtN(tile.target, "XP")} reached">${dayLabel(s.doneH)}`
      : `${s.e.id ? `<img class="ico" src="${ICON(s.e.id)}" alt="${s.e.item}" title="${s.e.item} (${fmtN(s.doneV, tr.unit)} ${tr.unit})">` : ""}` +
        `${byNames(selected, s.t.id, s.e) ? `${byNames(selected, s.t.id, s.e)} · ` : ""}${dayLabel(hoursOf(s.e.when))}`;
    // Each player's gain, with icons for every drop they got here (the finishing one included).
    const all = [...s.drops.filter(dr=>dr.kind !== "done"),
      ...(s.e && s.e.done && s.e.id ? [{name:s.e.item, id:s.e.id, by:s.e.by, h:hoursOf(s.e.when), qty:s.e.qty, kind:"done"}] : [])];
    const icons = m => all.filter(dr=>dr.by === m).sort((a,b)=>a.h-b.h).map(dr=>
      `<img class="ico ${dr.kind}" src="${ICON(dr.id)}" alt="${qtyName(dr)}" title="${got(qtyName(dr), dr.by, dr.h)}${dr.voided ? " (unchecked by a mod)" : dr.kind === "other" ? " (doesn't count)" : ""}">`).join("");
    const who = ((byPlayer[selected]||{})[s.t.id]||[]);
    const split = who.length ? `<tr class="who"><td colspan="3">${who.map(([m,v])=>`<span>${m} <b>${fmtN(v, tr.unit)}</b>${icons(m)}</span>`).join('<i>·</i>')}</td></tr>` : "";
    return `<tr class="team"><td><span class="sw" style="--c:${colorVar(s.t.id)}"></span> ${teamIco(s.t)}${s.t.name}</td>` +
      `<td class="n">${fmtN(s.total, tr.unit)}</td><td>${gotIt || "-"}</td></tr>${split}`;
  }).join("");


  el.innerHTML = `<h3>Progress</h3>
    <p class="dsub">${trackIcons(tr)}${tr.label || actText + (tr.unit === "KC" ? " KC" : "")}${tr.proxy ? `. ${tr.proxy}` : ""}</p>
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr.unit} gained over time for each team on ${tile.n}">
        <g class="grid">${grid}</g><g class="axis">${axis}</g>${tgt}
        <line class="cross" y1="${m.t}" y2="${m.t+ih}" visibility="hidden"/>
        <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>
        ${lines}
      </svg>
      <div class="tip" hidden></div>
    </div>
    <table><thead><tr><th>Team</th><th class="n">${tr.unit}</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;

  const svg = el.querySelector("svg"), cross = el.querySelector(".cross"), tip = el.querySelector(".tip");
  const move = ev => {
    if (ev.target.closest(".mk")) return;
    const rect = svg.getBoundingClientRect(), sx = (ev.clientX - rect.left) * W / rect.width;
    if (sx < m.l || sx > m.l + iw) return;
    const h = Math.max(0, Math.min(NOW_H, (sx - m.l) / iw * xMax));
    const px = x(h);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    tip.innerHTML = `<div class="t">${dayLabel(h)}</div>` + series.slice().sort((a,b)=>valueAt(b.pts,h)-valueAt(a.pts,h))
      .map(s=>`<div><span class="sw" style="--c:${colorVar(s.t.id)}"></span>${s.t.name}: <b>${fmtN(valueAt(s.pts,h), tr.unit)}</b></div>`).join("");
    tip.hidden = false;
    const left = px * rect.width / W;
    tip.style.left = (left > rect.width/2 ? left - tip.offsetWidth - 10 : left + 10) + "px";
  };
  const hide = ()=>{ tip.hidden = true; cross.setAttribute("visibility","hidden"); };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", hide);
}


// live-data.js redraws the results box under the title whenever the board redraws,
// so it follows the chosen team.
let afterRender = null;
export const onRender = fn => { afterRender = fn; };
export const getView = () => view;

// Every completed tile in the order it was done (for the chosen team, or all teams); a tile
// that finished a line is tagged with the line bonus (+3 each). Clicking one selects that tile.
function renderTimeline(){
  const el = document.getElementById("timeline");
  if (!el) return;   // an old cached index.html without the section
  const list = [];
  for (const t of TEAMS){
    if (view !== "all" && view !== t.id) continue;
    TILES.forEach((_, i)=>{
      const e = (state[t.id]||{})[i];
      if (e && e.done && whenKey(e.when) !== Infinity) list.push({t, i, e, k:whenKey(e.when), pts:tilePoints(t.id, i)});
    });
  }
  el.hidden = !list.length;
  if (!list.length){ el.innerHTML = ""; return; }
  list.sort((a,b)=>a.k-b.k);
  el.innerHTML = `<h3>Timeline</h3><ol>` +
    list.map(({t, i, e, pts})=>{
      const tile = TILES[i], src = e.id ? ICON(e.id) : tileIcon(i);
      return `<li><button type="button" data-i="${i}" aria-pressed="${selected===i}" title="${e.item ? e.item : tile.n}">` +
        `<span class="when">${dayLabel(hoursOf(e.when))}</span>` +
        `<span class="who"><span class="sw" style="--c:${colorVar(t.id)}"></span>${teamIco(t)}${view === "all" ? `<span class="tname">${t.name}</span>` : ""}</span>` +
        `<span class="what">${src ? `<img class="ico" src="${src}" alt="">` : ""}${tile.n}${pts > 1 ? ` <span class="btag" title="Finished ${(pts-1)/LINE_POINTS === 1 ? "a line" : `${(pts-1)/LINE_POINTS} lines`}">+${pts-1}</span>` : ""}</span>` +
        `<span class="by">${byNames(i, t.id, e)}</span></button></li>`;
    }).join("") + `</ol>`;
  el.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{selected=+b.dataset.i;render();});
}

function render(){
  renderScores(); renderViewbar(); renderBoard(); renderDetail(); renderDry(); renderTimeline();
  if (afterRender) afterRender();
}


const themeBtn = document.getElementById("themeBtn");
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? "dark" : "light")) === "dark";
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function renderThemeBtn(){
  const label = isDark() ? "Switch to light mode" : "Switch to dark mode";
  themeBtn.innerHTML = isDark() ? SUN : MOON;
  themeBtn.setAttribute("aria-label", label);
  themeBtn.title = label;
}
themeBtn.onclick = () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("bingo-theme", next); } catch(e){}
  renderThemeBtn();
};
darkQuery.addEventListener("change", renderThemeBtn);

// Each player's bingo stats, tile by tile: what they put in (KC/XP on that tile's boss or
// skill) and what they got there (every drop, the finishing one marked). The KC shows even
// when they also got the drop. Tiles they finished come first, then by share of the team's
// effort. Players best first.
// Final stats: one card per person. Someone with a second account (ALT_OF in data.js) gets
// totals for both, plus each account's own stats (accounts) to show under them.
function playerStats(team){
  const t = state[team.id] || {};
  return people(team).map(m => {
    const accs = team.members.filter(a => person(a) === m);
    const all = statsFor(accs);
    return {name: m, ...all, accounts: accs.length > 1 ? accs.map(a => ({name: a, ...statsFor([a])})) : null};
  }).sort((a, b) => b.tiles - a.tiles || b.drops - a.drops || b.effort - a.effort);

  // What these accounts did, tile by tile.
  function statsFor(accs){
    const mine = a => accs.includes(a);
    const parts = [];
    let dropsGot = 0, effort = 0;
    TILES.forEach((tile, i) => {
      const e = t[i], tr = TRACK[i];
      const items = ((drops[i] || {})[team.id] || []).filter(d => mine(d.by))
        .map(d => ({src: ICON(d.id), name: qtyName(d), qty: d.qty || 1, counts: d.kind !== "other", finished: false}));
      // A tile counts for everyone who helped get it (see helpers); the finishing item shows
      // only on the player who got it.
      const finished = helpers(i, team.id, e).some(mine);
      if (finished && mine(e.by)) items.unshift({src: e.id ? ICON(e.id) : tileIcon(i), name: e.item || tile.n, counts: true, finished: true});
      dropsGot += qtySum(items);
      let amount = "", share = 0;
      if (tr){
        const rows = ((byPlayer[i] || {})[team.id]) || [], got = rows.filter(r => mine(r[0])).reduce((sum, r) => sum + r[1], 0);
        if (got){
          amount = `${fmtN(got, tr.unit)} ${tr.unit}`;
          share = got / (rows.reduce((sum, r) => sum + r[1], 0) || 1);
        }
      }
      if (!amount && !items.length) return;
      effort += share;
      const ic = tr && ACT_ICON[tr.acts[0]];
      const label = tr ? (tr.short || (ACT_NAMES[tr.acts[0]] || tr.acts[0]).replace(/ XP$/, "")) : tile.n;
      parts.push({tile: tile.n, label, amount, items, finished, share, done: finished ? (e.id ? ICON(e.id) : tileIcon(i)) : null,
        icon: ic ? (typeof ic === "number" ? ICON(ic) : ic) : tileIcon(i)});
    });
    parts.sort((a, b) => b.finished - a.finished || b.items.length - a.items.length || b.share - a.share);
    const icons = parts.filter(x => x.finished).map(x => ({src: x.done, name: x.tile}));
    return {tiles: icons.length, drops: dropsGot, parts, icons, effort};
  }
}

// Called by live-data.js once the event data has loaded.
export function start(){
  started = true;
  renderThemeBtn(); renderRosters(); renderLegend(); render();
  let lastDryW = 0;
  new ResizeObserver(()=>{ const w = document.getElementById("dry").clientWidth; if (w !== lastDryW){ lastDryW = w; renderDry(); } })
    .observe(document.getElementById("dry"));
}

// A team's entry for a tile (mod.js uses it to show what an Uncheck would undo).
export const entryOf = (teamId, i) => (state[teamId] || {})[i] || null;
// A team's drops on a tile, not counting the one that finished it (mod.js lists them).
export const dropsOf = (teamId, i) => ((drops[i] || {})[teamId] || []).slice();

export {render, ranking, stats, playerStats, teamIco, colorVar, dayLabel, hoursOf, whenKey, valueAt, LINES, ICON};
