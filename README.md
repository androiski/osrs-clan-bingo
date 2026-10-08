# Runecraft Clan Bingo 2026

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
Every bingo drop is also screenshotted with the Clan Events plugin and submitted to the
mods: screenshots are the primary verification, and the board tracks progress live.

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
- **A Bingo ends it.** Once a team completes a line, nothing after that moment counts. The
  job keeps checking for `verify_hours` (config.json, default 3) to catch drops that
  happened before the Bingo but were synced late, then saves the results as final and
  switches off both scheduled workflows (re-enable them from the Actions tab if needed).
  The roster check stops as soon as there's a Bingo.

It writes, to `data/`:

- `counts.json` - item counts at the start
- `history.json` - KC/XP at the start, then only the values that changed each run
- `events.json` - every drop counted (player, item, time)
- `state.json` - what the site shows, rebuilt from the three above

Every run is a commit, so git history is the audit trail.

### Mod entries

Screenshots are the primary verification, so mods can add a tile TempleOSRS missed straight
from the page: select the tile, then open "Mod entry" at the bottom of the tile panel
(team → player → item → time). It's locked by a password that a small Cloudflare Worker checks, so the password
isn't in this public repo. An entry counts like a drop at that time, and the board rebuilds
within a couple of minutes (`.github/workflows/mod-entry.yml`). Setup: `worker/README.md`.

### When tiles were completed

The site's Timeline lists every completed tile in order. How exact each time is depends on
how the drop reached TempleOSRS:

| How it shows up | Time recorded | Accuracy |
|---|---|---|
| Item new to the player's collection log | TempleOSRS's timestamp from the recent-items feed | Exact, with Automatically sync Collection Log on |
| Repeat drop (player already had it) | The run (every 30 min) that first saw the count go up | Up to 30 min late, plus however long the player takes to reopen that log page |
| XP tiles | The first run where the team's gain passes the target | Only as fresh as each player's last TempleOSRS update (Auto-Update runs on logout), so it can be hours late |
| Count tiles (3 shards, seeds, hally pieces) and Barrows | The drop that finished it, by the rules above | Same as that drop |

Progress (KC/XP) is measured from the baseline taken in the 3 hours before the start. The
chart gets a point whenever a run sees a team's total change, so each point is really "the
first run after that player's last TempleOSRS update". A player who first syncs their log
during the event only counts drops from then on.

So first-time drops are exact, while repeat drops and XP are rounded up to the next run.
Close finishes are checked by hand against screenshots.

## Files

- `index.html`, `style.css`, `board.js`, `fireworks.js` - the site (plain HTML/CSS/JS as ES modules,
  no build step). `live-data.js` is the entry point
- `data.js` - teams, tiles, rules, which drops count and which hiscores each tile charts.
  Shared by the site and `update.js`
- `live-data.js` - loads `data/state.json`; falls back to `sample-data.js` (made-up data)
  when there's no live data yet, or with `?sample` in the address
- `config.json` - TempleOSRS group ID and event start/end (ISO 8601 UTC, e.g.
  `2026-10-13T00:00:00Z`). The job does nothing until all three are set
- `check_temple_roster.py` - checks every player's TempleOSRS profile and log sync, and
  writes `roster-status.js` for the Teams list (`pip install requests`)

## Running it

- Preview: `python -m http.server`, then open http://localhost:8000 (the scripts are ES modules,
  so opening index.html straight from disk won't work)
- Run the job by hand: `node update.js` (Node 20+), or "Run workflow" in the Actions tab
- Scheduled runs are skipped while the repo is private

## Ideas for later

- **RuneProfile** (runeprofile.com, RuneLite plugin + unofficial API) as an extra check on
  drop timing. Skipped for the 2026 event: it has the same blind spot as Temple for repeat
  drops (players still have to open the log page) and would mean asking everyone to install
  a second plugin. Worth a look if close finishes keep coming down to timing - first confirm
  what its API returns (per-drop timestamps for repeats? item counts?).
