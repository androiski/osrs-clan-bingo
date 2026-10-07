// Scoring and drawing: board, scores, tile panel, progress chart, rosters, theme.

import {TEAMS, SOURCES, TILES, TILE_ICON, TRACK, ACT_NAMES, ACT_ICON, TILE_ITEMS, DRY} from "./data.js";

// The event data being shown (live or sample), set once by live-data.js through setData().
let state = {}, dry = {}, drops = {}, byPlayer = {}, byAct = {}, NOW_H = 0;
export function setData(d){ ({state, dry, drops, byPlayer} = d); byAct = d.byAct || {}; NOW_H = d.nowH; }

// How dry a team is on a tile, from its KC on each tracked boss and the drop rates in DRY.
// rate: drops' worth of KC (1 = average); chance: probability of having had no luck this long.
// Without a per-boss split (the sample data), all KC is counted against the first boss.
function dryness(i, teamId, kc){
  const d = DRY[i], tr = TRACK[i];
  if (!d || !kc) return null;
  const split = (byAct[i] || {})[teamId];
  const total = split ? Object.values(split).reduce((a, b) => a + b, 0) || 1 : 1;
  const kcOf = act => split ? kc * (split[act] || 0) / total : (act === tr.acts[0] ? kc : 0);
  if (d.barrows){   // a full set of any one brother: 4 specific pieces, 6 brothers
    const piece = 1 - Math.pow(1 - d.barrows, kc), set = Math.pow(piece, 4);
    return {chance: Math.pow(1 - set, 6), rate: null, approx: true};
  }
  let alone = 0, count = 0;
  for (const [act, r] of Object.entries(d.rates)){ alone += kcOf(act) * (r.alone || 0); count += kcOf(act) * (r.count || 0); }
  const n = d.target || 1;
  let short = 1;   // chance of fewer than n counted drops (Poisson)
  if (count > 0){ short = 0; let term = Math.exp(-count); for (let j = 0; j < n; j++){ short += term; term *= count / (j + 1); } }
  return {chance: Math.exp(-alone) * short, rate: alone + count / n, approx: !!d.approx};
}
// e.g. "1.5× rate · 78% would have it by now" (the share of teams that'd have been luckier)
const fmtDry = x => {
  if (!x) return "";
  const pct = (1 - x.chance) * 100, p = pct < 1 ? "<1%" : pct > 99 ? ">99%" : `${Math.round(pct)}%`;
  const rate = x.rate == null ? "" : `${x.rate < 0.1 ? "<0.1" : x.rate.toFixed(1)}× rate · `;
  return `${x.approx ? "≈ " : ""}${rate}${p} would have it by now`;
};

function tileIcon(i){
  if (TILES[i].s === "xp") return TRACK[i].icon;
  if (typeof TILE_ICON[i] === "number") return ICON(TILE_ICON[i]);
  const row = (TILE_ITEMS[i]||[]).find(r=>r[0] === TILE_ICON[i]);
  return row ? ICON(row[1]) : null;
}
const tileFace = (i, tile) => { const src = tileIcon(i);
  return `${src ? `<img class="tico" src="${src}" alt="" loading="lazy">` : ""}<span class="tname"><span class="full">${tile.n}</span><span class="short">${tile.short || tile.n}</span></span>`; };

let view = "all", selected = 12;
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

// First team to complete a full row, column or diagonal wins. A line counts as
// complete at the time its last tile was completed.
function stats(tid){
  const t = state[tid] || {};
  const done = i => t[i] && t[i].done;
  const tiles = TILES.filter((_,i)=>done(i)).length;
  const best = Math.max(...LINES.map(l=>l.filter(done).length));
  let first = null;
  for (const l of LINES){
    if (!l.every(done)) continue;
    const last = l.reduce((a,i)=> whenKey(t[i].when) > whenKey(t[a].when) ? i : a);
    if (!first || whenKey(t[last].when) < whenKey(first.when)) first = {when:t[last].when};
  }
  return {tiles, best, first};
}

// Teams in finishing order: first line soonest, then closest to a line, then most tiles.
function ranking(){
  return TEAMS.map(t=>({t, ...stats(t.id)}))
    .sort((a,b)=> (a.first ? whenKey(a.first.when) : Infinity) - (b.first ? whenKey(b.first.when) : Infinity)
      || b.best-a.best || b.tiles-a.tiles);
}

function renderScores(){
  const ranked = ranking();
  document.getElementById("scores").innerHTML = ranked.map((r,i)=>`
    <div class="score${r.first?" won":""}" style="--c:${colorVar(r.t.id)}">
      <span class="rank">#${i+1}</span>
      <h2>${teamIco(r.t, "tico-m")}${r.t.name}</h2>
      ${r.first
        ? `<div class="bingo">Bingo! Line completed @ ${dayLabel(hoursOf(r.first.when))}</div>`
        : `<div class="nums"><span><b>${r.tiles}</b>${r.tiles === 1 ? "tile" : "tiles"}</span></div>
      <div class="bar" title="${r.best} of 5 on their best line"><i style="width:${r.best/5*100}%"></i></div>`}
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
  board.querySelectorAll(".tile").forEach(b=>b.onclick=()=>{selected=+b.dataset.i;render();});
}

// The tile panel's summary: what counts for the tile, and where it's tracked from.
function tileSummary(i, tile, src){
  const tr = TRACK[i];
  let counts;
  if (tile.s === "xp") counts = `${trackIcons(tr)}${tile.n.replace(/ XP$/, "")} XP gained by the team`;
  else {
    const rows = (TILE_ITEMS[i] || []).filter(r => r[2]), MAX = 10;
    counts = rows.slice(0, MAX).map(r => `<img class="cico" src="${ICON(r[1])}" alt="${r[0]}" title="${r[0]}">`).join("") +
      (rows.length > MAX ? `<span class="more">+${rows.length - MAX} more</span>` : "");
  }
  // Skill stand-ins (e.g. Agility XP for the Sepulchre) aren't part of how the tile is
  // tracked, so they get no icon here.
  const icons = tr && !tr.proxy ? trackIcons(tr) : "";   // the boss/skill, as icons only
  return `<div class="sum"><p><span class="lbl">Counts</span><span class="ics">${counts}</span></p>` +
    `<p><span class="lbl">Tracked by</span><span>${icons}${src.label}</span></p></div>`;
}

function renderDetail(){
  const el = document.getElementById("detail");
  const tile = TILES[selected], src = SOURCES[tile.s];
  const tIco = tileIcon(selected);
  const rows = TILE_ITEMS[selected] || [];
  const brotherOf = name => (rows.find(r=>r[0] === name) || [])[3];
  const ico = d => `<img class="ico" src="${ICON(d.id)}" alt="${d.name}" title="${got(d.name, d.by, d.h)}">`;

  // Drops so far that count toward the tile. Barrows tracks every brother at once until one set is whole.
  function progressLines(t, e){
    const pd = ((drops[selected]||{})[t.id]||[]).filter(d=>d.kind === "progress");
    if (e && e.done && !pd.length) return "";
    if (e && e.done && e.id) pd.push({name:e.item, id:e.id, by:e.by, h:hoursOf(e.when)});
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
    return `<div class="pl"><span>${tile.count ? tile.count + " " : ""}${pd.length}/${tile.target || pd.length}</span>${pd.map(pIco).join("")}</div>`;
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
        st = `<div class="st ok">${dIco ? `<img class="ico" src="${dIco}" alt="">` : ""}${got(e.item || "Done", e.by, e.when)}</div>${prog ? `<div class="st">${prog}</div>` : ""}`;
      }
      else if (prog) st = `<div class="st">${prog}</div>`;
      else if (tile.s === "xp" && e && e.progress) st = `<div class="st">${progressText(tile,e)}</div>`;
      else st = `<div class="st empty">-</div>`;
      return `<div class="trow" style="--c:${colorVar(t.id)}"><div class="tn">${teamIco(t)}${t.name}</div>${st}</div>`;
    }).join("");
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function rosterChip(s){
  if (!s) return `<span class="chip">Not checked</span>`;
  if (s.status === "synced"){
    const d = (s.log_last_changed || "").match(/^(\d{4})-(\d\d)-(\d\d)/);
    const when = d ? `, last ${+d[3]} ${MONTHS[+d[2]-1]}${d[1] === String(new Date().getFullYear()) ? "" : " " + d[1]}` : "";
    return `<span class="chip ok">Log synced${when}</span>`;
  }
  if (s.status === "unsynced") return `<span class="chip warn">Log not synced</span>`;
  if (s.status === "missing") return `<span class="chip bad">No Temple profile</span>`;
  return `<span class="chip">Check failed</span>`;
}

function renderRosters(){
  const rs = window.ROSTER_STATUS;
  const players = (rs && rs.players) || {};
  const all = TEAMS.flatMap(t=>t.members);
  const count = st => all.filter(m=>players[m] && players[m].status === st).length;
  document.getElementById("rosterNote").textContent = rs
    ? `Checked on TempleOSRS ${rs.checked}. ${count("synced")} of ${all.length} players have synced their collection log${count("missing") ? "," : " and"} ${count("unsynced")} haven't${count("missing") ? `, and ${count("missing")} ${count("missing") === 1 ? "has" : "have"} no Temple profile` : ""}. Anyone not synced should install the plugin and sync/open their collection log before the start.`
    : "Temple status hasn't been checked yet. Run check_temple_roster.py to fill this in.";
  document.getElementById("rosters").innerHTML = TEAMS.map(t=>{
    const synced = t.members.filter(m=>players[m] && players[m].status === "synced").length;
    return `
    <div class="roster" style="--c:${colorVar(t.id)}">
      <h3>${teamIco(t)}${t.name} (${rs ? `${synced}/${t.members.length} synced` : t.members.length})</h3>
      <ul>${t.members.map(m=>`<li><span>${m}</span>${rosterChip(players[m])}</li>`).join("")}</ul>
    </div>`;
  }).join("");
}

function renderLegend(){
  document.getElementById("legend").innerHTML = Object.values(SOURCES).map(s=>
    `<div><b><code>${s.mark}</code> ${s.label}</b>${s.detail}</div>`).join("");
}

const got = (item, by, when) => `${item}${by && by !== "Team" ? ` - ${by}` : ""} @ ${dayLabel(typeof when === "number" ? when : hoursOf(when))}`;
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
  const tile = TILES[selected], tr = TRACK[selected];
  const teamDrops = t => ((drops[selected]||{})[t.id]||[]).slice().sort((a,b)=>a.h-b.h);

  if (!tr){
    // No hiscore to chart: just say who got it and when.
    const rows = TEAMS.map(t=>{
      const e = (state[t.id]||{})[selected];
      const cell = e && e.done
        ? `${e.id ? `<img class="ico" src="${ICON(e.id)}" alt="">` : ""}${got(e.item || "Done", e.by, e.when)}`
        : `<span class="muted">-</span>`;
      return `<tr><td><span class="sw" style="--c:${colorVar(t.id)}"></span> ${t.name}</td><td>${cell}</td></tr>`;
    }).join("");
    el.innerHTML = `<h3>Progress</h3>
      <p class="dsub">Not on the hiscores, so no KC to chart.</p>
      <table><thead><tr><th>Team</th><th>Got it</th></tr></thead><tbody>${rows}</tbody></table>`;
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
  const marker = (kind, cx, cy, src, label) => {
    const [r, w] = SIZE[kind];
    return `<g class="mk ${kind}"><title>${label}</title><circle cx="${cx}" cy="${cy}" r="${r}"/>` +
      (src ? `<image href="${src}" x="${cx-w/2}" y="${cy-w/2+1}" width="${w}" height="${w-2}"/>` : "") + `</g>`;
  };

  // Step lines: a total holds until the next update. The table below names each line.
  const lines = series.map(s=>{
    let d = `M${x(s.pts[0][0])},${y(s.pts[0][1])}`;
    for (let k = 1; k < s.pts.length; k++) d += `H${x(s.pts[k][0])}V${y(s.pts[k][1])}`;
    const others = s.drops.filter(dr=>dr.kind !== "done")
      .map(dr=>marker(dr.kind, x(dr.h), y(valueAt(s.pts, dr.h)), ICON(dr.id),
        `${got(dr.name, dr.by, dr.h)}${dr.kind === "other" ? " (doesn't count)" : ""}`)).join("");
    let done = "";
    if (s.doneH != null){
      const src = tile.s === "xp" ? tr.icon : (s.e.id ? ICON(s.e.id) : null);
      const label = tile.s === "xp" ? got(`${fmtN(tile.target, "XP")} reached`, null, s.doneH) : got(s.e.item, s.e.by, s.e.when);
      done = marker("done", x(s.doneH), y(s.doneV), src, label);
    }
    return `<g class="series" style="--c:${colorVar(s.t.id)}"><path d="${d}"/>${others}${done}</g>`;
  }).join("");

  const rows = series.map(s=>{
    const status = s.doneH != null
      ? (tile.s === "xp" ? `<img class="ico" src="${tr.icon}" alt="">${got(`${fmtN(tile.target, "XP")} reached`, null, s.doneH)}`
        : `${s.e.id ? `<img class="ico" src="${ICON(s.e.id)}" alt="">` : ""}${got(s.e.item || "Done", s.e.by, s.e.when)} (${fmtN(s.doneV, tr.unit)} ${tr.unit})`)
      : (fmtDry(dryness(selected, s.t.id, s.total)) || "-");
    // Each player's gain, with icons for every drop they got here (the finishing one included).
    const all = [...s.drops.filter(dr=>dr.kind !== "done"),
      ...(s.e && s.e.done && s.e.id ? [{name:s.e.item, id:s.e.id, by:s.e.by, h:hoursOf(s.e.when), kind:"done"}] : [])];
    const icons = m => all.filter(dr=>dr.by === m).sort((a,b)=>a.h-b.h).map(dr=>
      `<img class="ico ${dr.kind}" src="${ICON(dr.id)}" alt="${dr.name}" title="${got(dr.name, dr.by, dr.h)}${dr.kind === "other" ? " (doesn't count)" : ""}">`).join("");
    const who = ((byPlayer[selected]||{})[s.t.id]||[]);
    const split = who.length ? `<tr class="who"><td colspan="3">${who.map(([m,v])=>`<span>${m} <b>${fmtN(v, tr.unit)}</b>${icons(m)}</span>`).join('<i>·</i>')}</td></tr>` : "";
    return `<tr class="team"><td><span class="sw" style="--c:${colorVar(s.t.id)}"></span> ${teamIco(s.t)}${s.t.name}</td><td class="n">${fmtN(s.total, tr.unit)}</td><td>${status}</td></tr>${split}`;
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
    <table><thead><tr><th>Team</th><th class="n">${tr.unit} gained</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` +
    (DRY[selected] ? `<p class="drynote">` + (DRY[selected].barrows
        ? `How many teams would have a full set of one brother after this many chests (rough).`
        : `× rate: how many drops' worth of ${tr.unit} the team has put in (1× is average). "Would have it by now": the share of teams that would have finished the tile with this much ${tr.unit}.`) +
      (DRY[selected].approx ? ` ≈ marks a rough estimate: raid drop chances depend on points, team size and invocations.` : "") + `</p>` : "");

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

function render(){
  renderScores(); renderViewbar(); renderBoard(); renderDetail(); renderDry();
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
function playerStats(team){
  const t = state[team.id] || {};
  return team.members.map(m => {
    const parts = [];
    let dropsGot = 0, effort = 0;
    TILES.forEach((tile, i) => {
      const e = t[i], tr = TRACK[i];
      const items = ((drops[i] || {})[team.id] || []).filter(d => d.by === m)
        .map(d => ({src: ICON(d.id), name: d.name, counts: d.kind !== "other", finished: false}));
      const finished = !!(e && e.done && e.by === m);
      if (finished) items.unshift({src: e.id ? ICON(e.id) : tileIcon(i), name: e.item || tile.n, counts: true, finished: true});
      dropsGot += items.length;
      let amount = "", share = 0;
      if (tr){
        const rows = ((byPlayer[i] || {})[team.id]) || [], row = rows.find(r => r[0] === m);
        if (row && row[1]){
          amount = `${fmtN(row[1], tr.unit)} ${tr.unit}`;
          share = row[1] / (rows.reduce((sum, r) => sum + r[1], 0) || 1);
        }
      }
      if (!amount && !items.length) return;
      effort += share;
      const ic = tr && ACT_ICON[tr.acts[0]];
      const label = tr ? (tr.short || (ACT_NAMES[tr.acts[0]] || tr.acts[0]).replace(/ XP$/, "")) : tile.n;
      parts.push({tile: tile.n, label, amount, items, finished, share,
        icon: ic ? (typeof ic === "number" ? ICON(ic) : ic) : tileIcon(i)});
    });
    parts.sort((a, b) => b.finished - a.finished || b.items.length - a.items.length || b.share - a.share);
    const icons = parts.filter(x => x.finished).map(x => ({src: x.items[0].src, name: x.tile}));
    return {name: m, tiles: icons.length, drops: dropsGot, parts, icons, effort};
  }).sort((a, b) => b.tiles - a.tiles || b.drops - a.drops || b.effort - a.effort);
}

// Called by live-data.js once the event data has loaded.
export function start(){
  renderThemeBtn(); renderRosters(); renderLegend(); render();
  let lastDryW = 0;
  new ResizeObserver(()=>{ const w = document.getElementById("dry").clientWidth; if (w !== lastDryW){ lastDryW = w; renderDry(); } })
    .observe(document.getElementById("dry"));
}

export {render, ranking, stats, playerStats, teamIco, colorVar, dayLabel, hoursOf, whenKey, valueAt, LINES, ICON};
