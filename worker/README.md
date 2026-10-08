# Mod entries Worker (Cloudflare)

Lets mods add a completed tile by hand from the bingo page ("Mod entry" at the bottom of the
tile panel),
for when TempleOSRS missed it. The mod password is checked here, never in the public site.

How an entry flows: mod saves it on the page → this Worker stores it (Cloudflare KV) →
the Worker asks GitHub to run `.github/workflows/mod-entry.yml` → that rebuilds
`data/state.json` with the entry counted like a drop → the page picks it up on its next
refresh (every 5 minutes). Every half-hourly update also reads the entries, and saves a
copy to `data/mod-entries.json` (so git history records them too).

## One-time setup

Needs a free Cloudflare account and Node. From this `worker/` folder:

1. `npx wrangler login`
2. `npx wrangler kv namespace create ENTRIES` and paste the `id` it prints into
   `wrangler.toml` (replacing `REPLACE_WITH_KV_NAMESPACE_ID`).
3. `npx wrangler secret put MOD_PASSWORD` and type the password the mods will use.
4. A GitHub token so the Worker can trigger the rebuild: on GitHub, Settings → Developer
   settings → Fine-grained tokens → new token, only for `androiski/runecraft-clan-bingo`,
   with **Contents: Read and write**. Then `npx wrangler secret put GITHUB_TOKEN` and
   paste it. (Optional: without it, entries still show at the next half-hourly update.)
5. `npx wrangler deploy`. It prints the Worker's address, like
   `https://runecraft-bingo-mods.<you>.workers.dev`.
6. Put that address in `config.json` as `"mod_api"` and push. "Mod entry" then appears
   in the tile panel.

To change the password later, run step 3 again. Ten wrong passwords from one address
lock it out for an hour.

## Entries

Two kinds, both with the mod's name and an optional note:

- **Mark done**: team, tile, player, item (left out for the XP tile, which it just marks
  done) and time. On the board it counts exactly like a drop at that time: a single item
  finishes a normal tile, three shards finish the shards tile, and so on.
- **Uncheck**: undoes a team's completion of a tile (say a drop wasn't legit). The drop
  that finished it stops counting and is shown as unchecked; any other progress stays,
  and the next qualifying drop completes the tile again.

Entries after the first Bingo don't count. Removing an entry undoes it.
