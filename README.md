# OSRS Clan Bingo 2026

Live board for the clan bingo: 3 teams, a 5x5 board, tracked from TempleOSRS.

- `index.html`, `style.css`, `board.js` - the site (plain HTML/CSS/JS, no build step)
- `data.js` - teams, tiles, rules, and which drops / hiscores count for each tile
- `sample-data.js` - made-up event data used until the live feed is in place
- `check_temple_roster.py` - checks every player's TempleOSRS profile and collection log
  sync, and writes `roster-status.js` for the Teams list (`pip install requests`)

Preview locally with `python -m http.server` and open http://localhost:8000.
