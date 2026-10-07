# OSRS Clan Bingo 2026

Live board for the clan bingo: 3 teams, a 5x5 board, tracked from TempleOSRS.

- `index.html`, `style.css`, `board.js` - the site (plain HTML/CSS/JS, no build step)
- `data.js` - teams, tiles, rules, and which drops / hiscores count for each tile
- `live-data.js` - loads `data/state.json`; falls back to `sample-data.js` (made-up data)
  when there's no live data yet, or with `?sample` in the address
- `update.js` - the update job: reads the clan's TempleOSRS group (3 requests per run),
  works out drops and KC/XP gains, and writes `data/`. Run every 30 minutes by
  `.github/workflows/update.yml` (skipped while the repo is private)
- `config.json` - TempleOSRS group ID and event start/end (ISO 8601 UTC, e.g.
  `2026-10-13T00:00:00Z`). The job does nothing until all three are set
- `check_temple_roster.py` - checks every player's TempleOSRS profile and collection log
  sync, and writes `roster-status.js` for the Teams list (`pip install requests`)

Preview locally with `python -m http.server` and open http://localhost:8000.
