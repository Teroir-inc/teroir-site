# /vision #82 launch runbook (durable copy of session cron dff70c94)

Fri 11-27 /vision launch. orchestrator-81 approved #82 at head 4e5daf3: the earlier 460f492 plus a CSS-only breathing fix. Any other head needs their OK again. No copy changes before launch.
Server rule (11-22): run every heavy step (the test suites, the Playwright tour and perf checks, renders) as `heavy-run -- <cmd>`.
1. In /root/orca/workspaces/teroir-site/site: git fetch, then confirm PR #82's head is exactly 4e5daf3. If it differs, stop and ask orchestrator-81.
2. Merge origin/main into vision-world only if main has moved (if that adds a merge commit, tell orchestrator-81 it's a main-only merge before merging the PR). Rebuild with python3 scripts/vision_world.py && python3 scripts/vision_build.py and confirm the rebuild leaves no diff. Run scripts/check_copy.py, then the suites in /root/.local/share/site-95 (tg td tw tm tn ty tq; e.g. heavy-run -- node tg.js $PWD /root/.local/share/site-95/guide_key.txt; check the arg usage line at the top of each) via heavy-run, and leakcheck.sh. All must pass (count "ok" vs "FAIL" lines; check the exit code, not tail's).
3. Note the current prod deployment id (rollback). Then teroir-gh pr ready 82 and teroir-gh pr merge 82 --merge, and wait for the production deploy to be READY.
4. Verify live on https://teroir.com/vision:
   - 200;
   - the Agents card "…Soon, bring the agent you already use, and every agent will work inside your rules.";
   - the Records card "…records will give a before and after number.";
   - no "PM.BOS", "pre-seed", "$1.25M" or "raising";
   - /vision/world.svg serves;
   - ?tour=1 runs with no JS errors at 390x844, with no screencast gaps over 0.5 s (heavy-run -- /opt/browser/venv/bin/python /root/scratch-site/perf3.py ...);
   - reduced-motion stills render;
   - teroir.com /, /talk, /property-management and the 4 city pages are 200.
5. Send orchestrator-81 the live check and rollback id, tell pipeline-35 it's live, and log DONE in /root/orchestration/LOG.md.
6. After launch (needs orchestrator-81's OK before pushing): move @keyframes vwbreathe in vision/vision.css to the top level so tour mode works under reduced motion.
7. After launch, target the week of 11-30 (orchestrator-81 11-22): draft a /vision update from teroir-hq AGENTS.md §1 "North star" (trust broker, owner-controlled proof, sovereignty by design). Leave out PM.BOS, the internal order, the "hardware signers" and "no lock-in" claims (until FACTS backs them), and never write "data broker". Grade 6-8, only claims true today (future tense for what isn't built; check FACTS.md and pmbos code). Draft on a new branch, don't push to main. Run check_copy, then an independent copy reviewer (a fresh agent that didn't write it: FACTS, grade, results-first, voice, no permanence/date promises). Send the result to orchestrator-81, who decides.

8. After launch (approved by orchestrator-81 11-23): footer "© 2026 Teroir", no city. Branch footer-nocity (fa78729) already has every other page and generator. Rebase it on the new main, then also change scripts/vision_template.html (the footer, and "Founder · Palo Alto, CA" if present), rebuild vision.html, run check_copy and the suites, then PR and merge. Verify live that no page says Palo Alto.
9. Also waiting: booking PR #89 (independent review), North star draft vision-northstar 2ef50d6 (copy review), /talk Pick-a-time draft talk-booking 7a7f5de (placeholder URL until Wyatt signs up on Cal.com).
10. North star (vision-northstar 279beb9): APPROVED by orchestrator-81 11-23 as written, grade 3.2 kept. HOLD the merge until orchestrator-81 relays Wyatt's yes (apply any edit he sends). Then, after launch: rebase on the new main, rebuild, run check_copy and the suites via heavy-run, merge, verify live, report to orchestrator-81.
11. /talk Pick-a-time (talk-booking efb89d7): APPROVED. Ship once Wyatt's Cal.com link replaces __BOOKING_URL__ AND #89 passes its independent review.
