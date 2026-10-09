"""Check every bingo player on TempleOSRS.

Reports whether each RSN has a Temple profile and whether the player has synced
their collection log (and when it last synced).

Prints the results and writes roster-status.js next to this script, which
index.html loads to show each player's Temple status on the Teams list.

Run: python check_temple_roster.py   (needs: pip install requests)
Temple asks for gentle request rates, so this waits between lookups
(29 players takes about 6 minutes). GitHub Actions runs it every hour
(.github/workflows/roster.yml) and it only saves when a status changed; it does nothing once
the event in config.json has started.
"""
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

TEAMS = {
    "Thompy Thiccs": ["yaint thiccy", "Cenaras", "BIS Ben", "chmsst", "Wildhero",
                      "47demonsand", "piinktaco", "The Biplane", "ll Grub ll", "BenReported"],
    "The Desert Dogs": ["duhmass", "ndru", "Mspartam", "789", "Sparge",
                        "Roof Sniffa", "Exviped", "Bhnr", "Halfmeatball", "nafun"],
    "The Bakery": ["tv milk", "rpwh", "Im Lablabi", "nimbis", "Gpmorgnchase",
                   "spotttt", "Dead Naseeph", "LootBuster42", "PlE"],
}

URL = "https://templeosrs.com/api/player_info.php"
DELAY_SECONDS = 12
OUT = Path(__file__).with_name("roster-status.js")


def check(rsn):
    """Return a status dict: {"status": "synced"|"unsynced"|"missing"|"error", ...}."""
    try:
        r = requests.get(URL, params={"player": rsn, "cloginfo": 1}, timeout=15)
        data = r.json()
    except Exception as e:
        return {"status": "error", "error": str(e)}
    if not isinstance(data, dict) or "data" not in data or "error" in data:
        return {"status": "missing"}
    clog = data["data"].get("collection_log") or {}
    if str(clog.get("log_synced")) != "1":
        return {"status": "unsynced"}
    return {"status": "synced", "log_last_changed": clog.get("last_changed")}


def describe(s):
    if s["status"] == "synced":
        return f"clog synced, last changed {s['log_last_changed']}"
    return {"unsynced": "CLOG NOT SYNCED",
            "missing": "NO PROFILE (update them on templeosrs.com)",
            "error": f"ERROR ({s.get('error')})"}[s["status"]]


# Only needed before the event: once it starts, the board update records each player's log
# sync time from the group (state.json "sync"), and the Teams list shows that instead.
start = (json.loads(Path(__file__).with_name("config.json").read_text()) or {}).get("start")
if start and datetime.now(timezone.utc) > datetime.fromisoformat(start.replace("Z", "+00:00")):
    print("The event has started, so the roster isn't checked any more (the board update covers it).")
    raise SystemExit(0)

results = {}
for team, players in TEAMS.items():
    print(f"\n== {team} ==")
    for rsn in players:
        results[rsn] = check(rsn)
        print(f"  {rsn:<15} {describe(results[rsn])}")
        time.sleep(DELAY_SECONDS)

# Only save when someone's status changed, so the repo doesn't get a commit every hour. Sync
# times change whenever someone plays, so they aren't saved (during the event the board update
# has them). A lookup that failed keeps the player's last known status.
before = {}
if OUT.exists():
    m = re.search(r"=\s*(\{.*\});", OUT.read_text(encoding="utf-8"), re.S)
    before = json.loads(m.group(1)).get("players", {}) if m else {}
players = {}
for rsn, s in results.items():
    if s["status"] == "error" and rsn in before:
        players[rsn] = before[rsn]
    else:
        players[rsn] = {k: v for k, v in s.items() if k != "log_last_changed"}
if players == before:
    print("\nNo status changed, so roster-status.js is left as it is.")
    raise SystemExit(0)

payload = {"checked": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
           "players": players}
OUT.write_text("window.ROSTER_STATUS = " + json.dumps(payload, indent=1) + ";\n",
               encoding="utf-8")
print(f"\nWrote {OUT.name}")
