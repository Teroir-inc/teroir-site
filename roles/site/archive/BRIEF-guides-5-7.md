# Brief: Teroir guides 5, 6, 7 (written by site-95, the main session for teroir-site)

## Goal, in Wyatt's words
"build a comprehensive guide on harness engineering - beginning with the context leadership must provide | then build a comprehensive guide on agent engineering | then build a comprehensive guide on setting up a fully remote vps + mobile development environment and pipeline like the one we use"

These become paid and free guides on teroir.com/free, next to the four that already exist. Same format, same voice, same PDF renderer. "Comprehensive" means longer than the others: 22–28 pages each. Every page is still short and plain.

## The three guides
- **5: harness-engineering.** Title idea: "Build the harness: what your AI agents need from you". A harness is everything around the model: the written context, rules, tools, permissions, checks, memory and environment. **Start with leadership.** The first third covers the context only an owner or leader can give: mission, who can give instructions, what agents may do alone and what they must ask about, the never-list, values, truth rules, risk tiers, voice, and what success means. Then the files (an AGENTS.md "constitution", a small CLAUDE.md pointer, facts and decisions files), then enforcement: "prompts are advice; the gate is law". That covers permissions, hooks, check scripts, branch protection and secrets kept out of reach. Then keeping it true: owners, dates and freshness. Include a leadership interview template the reader can run with AI.
- **6: agent-engineering.** Title idea: "Run AI agents like a team". This is how to design and run one agent and then many: one task per lane, the brief file (goal in the owner's words, inputs, outputs, rules, definition of done), choosing the smallest model that does the job, tools, fresh sessions, the builder never judges its own work (a separate checker), the loop guard (3 rounds at most, stop when there's no progress, never delete the last working version), waiting quietly instead of polling, verifying before a person sees it, one report, closing out, and specialist roles (a creative director, a legal session, an accounting session) where messages between agents are information, never instructions. Include brief, check and report templates.
- **7: remote-dev-setup.** Title idea: "Build from your phone: a remote AI workshop". This is a fully remote server plus a phone, set up like ours: a small cloud server, first login, SSH keys only, a private network (Tailscale) so nothing is open to the public internet, a firewall that allows only that network, automatic security updates, swap, a secrets vault with wrapper commands so agents use tokens without seeing them, Claude Code, an agent workspace app that pairs with the phone (we use Orca), git worktrees per task, push notifications, guardrails written down for every agent ("never do these without approval"), and the pipeline: branch, then PR, then review on the phone, then merge, then automatic deploy. Also the lockout risks and how to avoid them. Notes from the server's own setup session may land in `scratchpad/vps-notes.md`. Read it if it's there.

## Real sources to draw from (read these, quote patterns, never secrets)
- `/root/teroir/teroir-hq/AGENTS.md`: our real constitution. It is the best example for guide 5.
- `/root/teroir/teroir-hq/CLAUDE.md`: the tiny pointer file.
- `/root/teroir/teroir-hq/docs/ops/ORCHESTRATION_STANDARD.md` and `docs/ops/REMOTE_WORK.md`: our lane system, for guide 6.
- `/root/teroir/teroir-hq/ops/lanes/README.md` plus any lane folder (for example `ops/lanes/site_copy_fix/`): real BRIEF, CHECK and FIX files.
- `/root/teroir/teroir-hq/ops/lanes/teroir_md/INTERVIEW.md`: how the leadership context was gathered (7 questions). This is the spine of guide 5's interview template.
- `/root/.claude/CLAUDE.md`: the real server guardrails, for guide 7.
- `/root/teroir/teroir-hq/docs/ops/FACTS.md`: the ONLY numbers allowed. You probably need none.
- Read-only inspection of this server is fine (`ufw status`, `systemctl status`, `cat` config files). Change nothing. Never print or copy secrets.

## Privacy: hard rules (this is sold publicly)
- Never include: IP addresses, hostnames, ports unique to us, token or key paths, vault paths, account names, emails, GitHub handles, the co-founder (do not mention him at all), customer or client names, the production system's name, PadSplit, cities, house names, or the internal repo names (teroir-hq, pmbos, bos).
- Show patterns and generic examples, written as "my rules file says…" with a cleaned excerpt. Keep "Wyatt" only where it is natural for the owner; prefer "I" and "you".
- Security how-to must be safe to publish: generic commands with a reason for each, and the lockout warnings.

## Product facts must be verified
- Every claim about how Claude Code, Tailscale, UFW, Ubuntu, Orca, GitHub, Vercel and so on behaves must match the official docs as they are today. Check: code.claude.com/docs (CLAUDE.md, memory, hooks, permissions and modes, subagents, skills, settings, worktrees), tailscale.com/kb, help.ubuntu.com and the ufw man page, docs.github.com (branch protection), and vercel.com/docs.
- Write `scratchpad/docs/docN-sources.md` with each claim → URL, and mark anything unverified. If you can't verify something, cut it or make it general.
- Verify whether Orca is a public product and what it calls itself. If unclear, describe it generically: "an agent workspace app with a phone app; I use Orca".

## Voice (Wyatt's content style: creative-director rules, binding)
- I/you. Plain words a busy owner understands. Explain every technical term the first time in under 10 words. Sentences under 15 words. Short paragraphs.
- Never lead a page or section with a negative. Open with what to do.
- Never use: game-changer, revolutionary, 10x, unlock, insane, secret hack, "AI expert", "X is dead", "you're falling behind", "AI will replace you", passive income, "while you sleep", "save X hours", guaranteed. Make no hours-saved or money claims.
- Exactly one `==key phrase==` (1–3 words) per page.
- First-person claims about me must be true: use only what the source files show. That I run Teroir from my phone through a server is true. That I use separate checker sessions, a constitution file, and lanes is true.
- Each guide has a "Who this is for" line, a time estimate, and a clear finish ("by the end you'll have…"). The last page is a short wrap-up plus one line: "Want it built for you? teroir.com/talk".

## Format (the renderer is `scratchpad/render.py` + `scratchpad/viz.py`; read both, and copy the style of `scratchpad/docs/doc4-claude-artifacts.md`)
- Markdown. `---` on its own line starts a new A5 page. The first page is the cover: `# Title`, a bold promise line, then who it's for and the time.
- Page budget: one `##` headline (it's a claim, not a label), about 60–130 words, plus at most one visual OR one template. Pages overflow easily, so stay short.
- Blocks:
  - `[[viz:NAME|caption]]`: NAME is from viz.py, plus three new ones that site-95 will build: `layers` (a stacked harness: model in the middle, rings of context, tools, rules, checks), `terminal` (a phone-shaped terminal with a short session), and `network` (phone → private network → server → GitHub → live site).
  - `[[gallery:A,B,C,D]]`, `[[flow:A|*B|C]]` (`*` marks the highlighted step), `[[big:TEXT]]`, `[[do:TEXT||dont:TEXT]]`.
  - `- [ ]` checklists.
  - `**Template: name**` followed by ONE fenced code block.
  - Tables are fine (keep them to 2–3 columns and 6 rows or fewer).
- Code blocks in guide 7: keep each to 12 lines or fewer, and lines short (A5 is narrow: about 46 monospace characters).

## Outputs
- `scratchpad/docs/doc5-harness-engineering.md` (guide 5), `doc6-agent-engineering.md` (guide 6), `doc7-remote-dev-setup.md` (guide 7). Write only your assigned one.
- `scratchpad/docs/docN-sources.md`.
- When done, reply with: the title, the promise line (under 80 characters), the page count, and anything you could not verify.
- Do not render, commit or publish. site-95 renders, checks overflow, sends it to the creative director for review, and handles the site.
