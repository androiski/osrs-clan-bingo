// Cloudflare Worker for mod entries, which manually edit a tile for a team:
//   "done"  a completion TempleOSRS missed (e.g. from a screenshot). The update job treats it
//           like a drop, so count tiles, Barrows sets and the Bingo all work as usual.
//   "void"  unchecks a completion (the drop that finished the tile stops counting; progress
//           stays, and the next qualifying drop completes it again).
//
//   GET    /entries          the list (public, so the update job and the page can read it)
//   POST   /check            {password} -> 200 if right; the mod panel uses it to unlock
//   POST   /entries          {password, entry} -> saves it, then asks GitHub to rebuild the board
//   DELETE /entries/<id>     {password} -> removes it, then asks GitHub to rebuild
//
// Settings (see worker/README.md): KV namespace ENTRIES; secrets MOD_PASSWORD and
// GITHUB_TOKEN; vars ALLOWED_ORIGINS and GITHUB_REPO.

const MAX_FAILS = 10;          // wrong passwords allowed per IP per hour
const LIST = "entries";

export default {
  async fetch(req, env){
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json", "Cache-Control": "no-store"}});
    if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});

    const url = new URL(req.url), parts = url.pathname.split("/").filter(Boolean);
    const list = async () => JSON.parse(await env.ENTRIES.get(LIST) || "[]");

    if (req.method === "GET" && parts[0] === "entries") return json(await list());

    // Everything else needs the password.
    let body = {};
    try { body = await req.json(); } catch {}
    const ip = req.headers.get("CF-Connecting-IP") || "unknown", failKey = `fails:${ip}`;
    const fails = +(await env.ENTRIES.get(failKey) || 0);
    if (fails >= MAX_FAILS) return json({error: "Too many wrong passwords. Try again in an hour."}, 429);
    if (!env.MOD_PASSWORD || !(await same(String(body.password || ""), env.MOD_PASSWORD))){
      await env.ENTRIES.put(failKey, String(fails + 1), {expirationTtl: 3600});
      return json({error: "Wrong password."}, 401);
    }

    if (req.method === "POST" && parts[0] === "check") return json({ok: true});

    if (req.method === "POST" && parts[0] === "entries"){
      const entry = clean(body.entry);
      if (typeof entry === "string") return json({error: entry}, 400);
      entry.id = crypto.randomUUID();
      entry.added = new Date().toISOString();
      const all = await list();
      all.push(entry);
      await env.ENTRIES.put(LIST, JSON.stringify(all));
      return json({ok: true, entry, rebuild: await rebuild(env)});
    }

    if (req.method === "DELETE" && parts[0] === "entries" && parts[1]){
      const all = await list(), left = all.filter(e => e.id !== parts[1]);
      if (left.length === all.length) return json({error: "No such entry."}, 404);
      await env.ENTRIES.put(LIST, JSON.stringify(left));
      return json({ok: true, rebuild: await rebuild(env)});
    }

    return json({error: "Not found."}, 404);
  },
};

// Checks the fields and keeps only the known ones. Returns an error message if it's wrong.
function clean(e){
  if (!e || typeof e !== "object") return "Missing entry.";
  const str = (v, n) => typeof v === "string" && v.trim() && v.length <= n ? v.trim() : null;
  if (e.action === "void"){
    const out = {action: "void", team: str(e.team, 10), tile: Number.isInteger(e.tile) && e.tile >= 0 && e.tile < 25 ? e.tile : null,
      by: str(e.by, 20), h: Number.isFinite(e.h) ? e.h : null, item: e.item == null ? null : str(e.item, 60),
      itemId: Number.isInteger(e.itemId) ? e.itemId : null, note: e.note == null || e.note === "" ? null : str(e.note, 200), mod: str(e.mod, 30)};
    if (!out.team || out.tile == null || !out.by || out.h == null || !out.mod) return "Team, tile, the completion and your name are needed.";
    if (e.note && !out.note) return "The note is too long.";
    return out;
  }
  const out = {
    action: "done", team: str(e.team, 10), tile: Number.isInteger(e.tile) && e.tile >= 0 && e.tile < 25 ? e.tile : null,
    by: str(e.by, 20), when: str(e.when, 30),
    item: e.item == null ? null : str(e.item, 60), itemId: e.itemId == null ? null : Number.isInteger(e.itemId) ? e.itemId : NaN,
    note: e.note == null || e.note === "" ? null : str(e.note, 200), mod: str(e.mod, 30),
  };
  if (!out.team || out.tile == null || !out.by || !out.when || !out.mod) return "Team, tile, player, time and your name are needed.";
  if (Number.isNaN(Date.parse(out.when))) return "That time isn't valid.";
  if (Number.isNaN(out.itemId)) return "That item isn't valid.";
  if (e.note && !out.note) return "The note is too long.";
  return out;
}

// Constant-time compare, so the password can't be guessed from response times.
async function same(a, b){
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

// Asks GitHub to run the board update now (repository_dispatch), so the entry shows within a
// minute or two instead of at the next half-hourly run.
async function rebuild(env){
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return false;
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {"Authorization": `Bearer ${env.GITHUB_TOKEN}`, "Accept": "application/vnd.github+json",
      "User-Agent": "runecraft-clan-bingo-mods", "Content-Type": "application/json"},
    body: JSON.stringify({event_type: "mod-entry"}),
  });
  return res.ok;
}
