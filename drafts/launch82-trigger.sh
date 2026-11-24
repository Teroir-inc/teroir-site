#!/bin/bash
# Durable trigger for the #82 /vision launch (survives the 11-24 restart). Skips if #82 is already merged.
s=$(/usr/local/bin/teroir-gh pr view 82 -R Teroir-inc/teroir-site --json state -q .state 2>/dev/null)
echo "$(date -u +%FT%H:%MZ) site-a5 launch82 trigger: state=$s" >> /root/orchestration/LOG.md
[ "$s" = MERGED ] && exit 0
/root/.config/orca/cli/bin/orca terminal send --terminal term_56397711-f176-4ed1-ab39-01c19f6c4b9f --text "Launch time: run the #82 /vision launch runbook in /root/.local/share/site-95/launch-82.md (head must be 4e5daf3). If session cron 48dc2d73 already started it, ignore this." --enter
