// Made-up event data so the board can be previewed before the event.
// live-data.js loads it when there is no live data yet (and for the demo modes on dev).
// Default export: {state, dry, drops, byPlayer, nowH}, the same shape live-data.js builds
// from state.json.

import {TEAMS, TILES, TRACK, TILE_ITEMS} from "./data.js";
import {valueAt} from "./board.js";

function sample(){
  const d = (by, when, item, extra) => Object.assign({done:true, by, when, item}, extra||{});
  const p = (progress, note) => ({done:false, progress, note});
  return {
    tt:{
      0:d("Cenaras","Day 1, 19:40","Ring of endurance",{id:24844}),
      5:d("BIS Ben","Day 3, 22:15","Venator shard",{id:27614,progress:3,note:"BIS Ben 2, Wildhero 1"}),
      10:d("yaint thiccy","Day 2, 01:05","Sanguinesti staff",{id:22481}),
      11:d("The Biplane","Day 4, 17:30","Araxyte fang",{id:29799}),
      12:d("Team","Day 5, 09:12","500k reached",{progress:500000}),
      15:d("chmsst","Day 2, 14:48","Tanzanite fang",{id:12922}),
      20:d("piinktaco","Day 3, 11:20","Crystal tool seed",{id:23953}),
      13:p(2,"Wildhero: 2/4 Dharok's")
    },
    dd:{
      1:d("ndru","Day 1, 23:02","Enhanced crystal weapon seed",{id:25859}),
      6:d("Mspartam","Day 2, 20:10","Elder venator fang",{id:33634}),
      16:d("Sparge","Day 3, 15:44","Golden tench",{id:22840}),
      18:d("Roof Sniffa","Day 4, 02:31","Inquisitor's mace",{id:24417}),
      21:d("Exviped","Day 4, 21:55","Eye of Ayak",{id:31115}),
      24:d("Bhnr","Day 5, 18:03","Primordial crystal",{id:13231}),
      3:d("Sparge","Day 4, 08:20","Heron",{id:13320}),
      20:d("789","Day 2, 19:45","Crystal tool seed",{id:23953}),
      5:p(1,"halfmeatball 1"),
      11:p(1,"duhmass: 1 hally piece"),
      12:p(312400)
    },
    bk:{
      3:d("tv milk","Day 2, 12:12","Chompy chick",{id:13071}),
      13:d("rpwh","Day 3, 20:40","Verac's set",{id:4755,progress:4}),
      14:d("nimbis","Day 1, 16:25","Pharaoh's sceptre",{id:26945}),
      17:d("spotttt","Day 4, 13:13","Dragon limbs",{id:21918}),
      22:d("Gpmorgnchase","Day 5, 00:50","Twisted buckler",{id:21000}),
      23:d("LootBuster42","Day 3, 09:37","Zenyte shard",{id:19529}),
      20:d("rpwh","Day 5, 10:02","Crystal tool seed",{id:23953}),
      1:p(2,"im lablabi: 2 armour seeds"),
      12:p(188000)
    }
  };
}


// Sample: hours since the event started, and team totals gained since then.
const NOW_H = 4*24 + 20;
function sampleDry(){
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rcFinal = {tt:540000, dd:312400, bk:188000};
  const out = {};
  for (const i of Object.keys(TRACK)){
    out[i] = {};
    TEAMS.forEach((t,k)=>{
      const rand = rng(+i*31 + k*7 + 1);
      const pts = [[0,0]]; let h = 0, v = 0;
      const got = ((state[t.id]||{})[i]||{}).done;
      const rate = (rand() < .15 && !got ? 0 : .5 + rand()*2.5) * (TRACK[i].unit === "XP" && TILES[i].s !== "xp" ? 900 : 1);
      while (h < NOW_H){
        h = Math.min(NOW_H, h + 1 + rand()*7);
        if (rand() < .55) v += Math.round(rate * (1 + rand()*5));
        pts.push([h, v]);
      }
      if (TILES[i].s === "xp"){
        const scale = rcFinal[t.id] / Math.max(v,1);
        pts.forEach(p=>p[1] = Math.round(p[1]*scale));
        // Thompy Thiccs hit the target at Day 5, 09:12 in the sample board.
        const doneH = t.id === "tt" ? 4*24 + 9.2 : null;
        if (doneH){
          const at = pts.findIndex(p=>p[0] > doneH);
          pts.splice(at, 0, [doneH, 500000]);
          pts.forEach((p,k)=>{ if (k < at) p[1] = Math.min(p[1], 499000); else if (k > at) p[1] = Math.max(p[1], 500000); });
        }
      }
      out[i][t.id] = pts;
    });
  }
  return out;
}

// Sample drops during the event, per tile and team. kind: "progress" counts toward the tile
// without finishing it, "other" is a drop from the same boss that doesn't count.
// The finishing drop itself comes from the board state.
function sampleDrops(){
  const H = (day, hh, mm) => (day-1)*24 + hh + mm/60;
  const it = (tile, name) => TILE_ITEMS[tile].find(r=>r[0] === name);
  const prog = (tile, name, by, h) => ({h, name, id: it(tile, name)[1], by, kind:"progress"});
  const out = {
    5:{tt:[prog(5,"Venator shard","BIS Ben",H(1,21,10)), prog(5,"Venator shard","Wildhero",H(2,18,35))],
       dd:[prog(5,"Venator shard","Halfmeatball",H(4,13,5))]},
    11:{dd:[prog(11,"Noxious point","duhmass",H(3,4,50))]},
    1:{bk:[prog(1,"Crystal armour seed","Im Lablabi",H(2,9,15)), prog(1,"Crystal armour seed","Im Lablabi",H(4,22,40))]},
    13:{bk:[prog(13,"Verac's helm","rpwh",H(1,20,5)), prog(13,"Karil's coif","tv milk",H(2,1,30)), prog(13,"Verac's brassard","rpwh",H(2,15,0)),
            prog(13,"Verac's plateskirt","rpwh",H(3,11,25)), prog(13,"Ahrim's staff","nimbis",H(4,6,10))],
        tt:[prog(13,"Dharok's helm","Wildhero",H(2,13,40)), prog(13,"Torag's hammers","Cenaras",H(3,2,15)), prog(13,"Dharok's greataxe","Wildhero",H(4,19,0))]}
  };
  // A few drops that don't count, from the same boss, for each team that's been there.
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (const i of Object.keys(TRACK)){
    const pool = (TILE_ITEMS[i]||[]).filter(r=>!r[2]);
    if (!pool.length) continue;
    TEAMS.forEach((t,k)=>{
      const pts = dry[i][t.id], rand = rng(+i*53 + k*11 + 5);
      if (!pts[pts.length-1][1]) return;
      const n = Math.floor(rand()*3.2);
      for (let j = 0; j < n; j++){
        const pick = pool[Math.floor(rand()*pool.length)];
        const h = 6 + rand()*(NOW_H-6);
        if (!valueAt(pts, h)) continue;
        const team = TEAMS[k].members;
        ((out[i] ||= {})[t.id] ||= []).push({h, name:pick[0], id:pick[1], by:team[Math.floor(rand()*team.length)], kind:"other"});
      }
    });
  }
  return out;
}


// Sample: how each team's total splits across its players. Live, this is each
// player's own gain from their TempleOSRS datapoints.
function samplePlayers(){
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const out = {};
  for (const i of Object.keys(TRACK)){
    out[i] = {};
    TEAMS.forEach((t,k)=>{
      const pts = dry[i][t.id], total = pts[pts.length-1][1], rand = rng(+i*97 + k*13 + 3);
      // Anyone who got a drop here must have played it.
      const active = new Set([((state[t.id]||{})[i]||{}).by, ...((drops[i]||{})[t.id]||[]).map(d=>d.by)]);
      const w = t.members.map(m=> active.has(m) ? 2 + rand()*3 : rand() < .5 ? .2 + rand()**2 * 3 : 0);
      const sum = w.reduce((a,b)=>a+b, 0) || 1;
      let left = total;
      const rows = t.members.map((m,j)=>[m, Math.floor(total * w[j] / sum)]);
      rows.forEach(r=>left -= r[1]);
      const top = rows.reduce((a,b)=> b[1] > a[1] ? b : a);
      top[1] += left;
      out[i][t.id] = rows.filter(r=>r[1] > 0).sort((a,b)=>b[1]-a[1]);
    });
  }
  return out;
}

const state = sample();
const dry = sampleDry();
const drops = sampleDrops();
const byPlayer = samplePlayers();

export default {state, dry, drops, byPlayer, nowH: NOW_H};
