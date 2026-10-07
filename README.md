# OSRS Clan Bingo 2026

Live board for the clan bingo: 3 teams, a 5x5 board, tracked from TempleOSRS.
The first team to complete a row, column or diagonal wins.

## How it works

```
Players (RuneLite + TempleOSRS plugin)
        │  drops and stats sent to TempleOSRS
        ▼
TempleOSRS clan group
        │  3 requests every 30 min
        ▼
update.js (GitHub Actions) ──► data/*.json (saved to this repo)
                                      │
                                      ▼
                         index.html (GitHub Pages) reads data/state.json
```

There's no server. A scheduled GitHub Actions job reads the clan's TempleOSRS group,
works out what each team has done, and saves the result as JSON in this repo. The site
is static and just loads that file.

### What players need to do

In the TempleOSRS RuneLite plugin, turn on **Automatically sync Collection Log** and
**Auto-Update**, then open their collection log and click through every page before the
start. During the event, after a drop they already had, they open that log page again.

### The update job (`update.js`)

Every 30 minutes (`.github/workflows/update.yml`) it makes 3 read-only requests:

| Request | Gives us | Used for |
|---|---|---|
| `group_member_info.php?skills&bosses` | every member's current KC and XP | progress charts, the Runecraft tile |
| `collection-log/group_recent_items.php` | items new to someone's log, with the exact time | first-time drops |
| `collection-log/group_collection_log.php?includecount=1` | every member's item counts | repeat drops (a count went up) |

- **Before the start** (from 3 hours before), each run refreshes a baseline of everyone's
  counts, KC and XP.
- **During the event**, new log items come from the recent-items feed with real times.
  A count that rose more than the drops already recorded is a repeat drop, timed to that run.
  KC/XP gains are measured against the baseline.
- Someone who first syncs mid-event gets a fresh baseline, so their old log isn't counted.
  Repeat drops noticed after the end are logged for organisers, not counted.
- Outside the event window it doesn't contact TempleOSRS at all.

It writes, to `data/`:

- `counts.json` - item counts at the start
- `history.json` - KC/XP at the start, then only the values that changed each run
- `events.json` - every drop counted (player, item, time)
- `state.json` - what the site shows, rebuilt from the three above

Every run is a commit, so git history is the audit trail.

## Files

- `index.html`, `style.css`, `board.js` - the site (plain HTML/CSS/JS, no build step)
- `data.js` - teams, tiles, rules, which drops count and which hiscores each tile charts.
  Shared by the site and `update.js`
- `live-data.js` - loads `data/state.json`; falls back to `sample-data.js` (made-up data)
  when there's no live data yet, or with `?sample` in the address
- `config.json` - TempleOSRS group ID and event start/end (ISO 8601 UTC, e.g.
  `2026-10-13T00:00:00Z`). The job does nothing until all three are set
- `check_temple_roster.py` - checks every player's TempleOSRS profile and log sync, and
  writes `roster-status.js` for the Teams list (`pip install requests`)

## Running it

- Preview: `python -m http.server`, then open http://localhost:8000
- Run the job by hand: `node update.js` (Node 20+), or "Run workflow" in the Actions tab
- Scheduled runs are skipped while the repo is private
