# SaveRx.ai — Developer Collaboration Workflow

**For:** Vajih + Asma working on the same repo with VSCode, GitHub, and Claude Code
**Written:** April 11, 2026
**Why this exists:** Asma downloaded the repo a few days ago and has been building in parallel at `saverxapril2026.vercel.app` while Vajih kept shipping to production. That is the exact problem this doc solves so it does not happen again.

---

## 1. The core rule

**One repo. One `main`. Everyone branches.**

No more "I'll download a copy and work on it separately." That path leads to divergent codebases, lost work, and painful manual merges. From now on, every change — design, content, code — lands through a branch and a pull request against the shared GitHub repo.

---

## 2. One-time setup (both Vajih and Asma)

### 2a. Clone the repo fresh

```bash
cd ~/code
git clone https://github.com/<your-org>/saverx.ai.git saverx
cd saverx
```

If you already have a working copy, commit or stash your changes first, then:

```bash
git remote -v                # confirm origin points to the shared repo
git fetch origin
git checkout main
git pull origin main
```

### 2b. VSCode extensions (install both)

- **GitHub Pull Requests and Issues** (GitHub.vscode-pull-request-github) — review PRs inside VSCode
- **GitLens** (eamodio.gitlens) — see who changed what, line-by-line blame
- **Live Share** (ms-vsliveshare.vsliveshare) — optional, for pair programming
- **Prettier** — code formatting consistency
- **Error Lens** — inline errors, reduces back-and-forth with Claude Code

### 2c. Git identity

```bash
git config user.name  "Vajih Khan"      # or "Asma Khan"
git config user.email "vajihkhan@gmail.com"  # or asmabkhan@gmail.com
```

### 2d. Shared `.gitignore` sanity check

Confirm these are ignored (never commit):
- `.env`, `.env.local`
- `node_modules/`
- `.venv/`
- `data/saverx-leads.csv` (PII)
- `.DS_Store`
- `.vercel/`

---

## 3. Branching strategy (simple, 2-person friendly)

```
main                    ← production. always deployable. never commit directly.
 ├── feat/asma-design-tokens
 ├── feat/vajih-cookie-banner
 ├── fix/vajih-category-typo
 └── content/asma-new-drug-page
```

**Branch naming:**
- `feat/<name>-<short-desc>` — new features or design changes
- `fix/<name>-<short-desc>` — bug fixes
- `content/<name>-<short-desc>` — drug content, copy, SEO
- `chore/<name>-<short-desc>` — dependencies, tooling

Putting the author's name in the branch makes it obvious whose work is whose when you look at the GitHub branch list.

### Daily flow

```bash
# Start of each work session
git checkout main
git pull origin main

# Start new work
git checkout -b feat/asma-design-tokens

# ... make changes, use Claude Code, test locally ...

git add -A
git commit -m "feat: port Asma's warm cream tokens to tokens.css"
git push -u origin feat/asma-design-tokens

# Open PR on GitHub
```

**Never**:
- `git push --force` on `main`
- commit to `main` directly
- merge your own PR without reading the diff one more time

---

## 4. Pull request discipline

Every change goes through a PR, even small ones. This is not bureaucracy — it is how the other person sees what you shipped, learns the codebase, and catches regressions.

### PR template (paste into description)

```markdown
## What
One sentence on what this PR does.

## Why
Link to the motivation — email, doc, or one-liner.

## Screenshots / proof
(if UI) attach before/after. (if backend) paste a curl or console output.

## Checklist
- [ ] Tested on homepage
- [ ] Tested on one drug page
- [ ] Tested on mobile width (375px)
- [ ] No console errors
- [ ] No inline styles introduced
- [ ] Claude Code prompt used is linked or pasted below

## Claude Code prompt used
(paste the prompt you gave Claude so the other person can reproduce or extend)
```

### Review rules

- **Vajih reviews Asma's PRs. Asma reviews Vajih's PRs.** Two eyes, always.
- Reviewer checks the diff, not just the description. GitHub's "Files changed" tab is your friend.
- If something is unclear, leave a comment instead of rewriting it silently.
- Small PRs merge fast. Aim for <400 lines changed per PR when possible. Big design migrations are the exception — split them into phases.

---

## 5. Avoiding merge conflicts

The single biggest cause of merge pain is two people editing the same file at the same time. Avoid it with:

1. **Claim your files in Slack / iMessage before you start.** "I'm editing `assets/css/tokens.css` and `index.html` for the next hour." Quick and effective.
2. **Rebase on `main` before you push.** Keeps history linear and surfaces conflicts on your machine, where you can fix them calmly.
   ```bash
   git fetch origin
   git rebase origin/main
   # resolve any conflicts
   git push --force-with-lease
   ```
   Use `--force-with-lease`, never plain `--force`, so you can't accidentally overwrite the other person.
3. **Prefer small, focused PRs.** A 20-file PR that touches every drug page will always conflict with something. A 3-file PR almost never will.
4. **The injection scripts under `scripts/_add-*.mjs` are the right pattern.** When you need to change all 361 drug pages, write an idempotent Node script, commit the script + the result in one PR, and re-run is safe. Manual find/replace across 361 files is a merge-conflict factory.

---

## 6. Where production, staging, and experiments live

| Environment | Branch | URL | Who deploys |
|---|---|---|---|
| **Production** | `main` | saverx.ai | Cloudflare Pages auto-deploys on push to `main` |
| **Staging / preview** | any branch | Cloudflare Pages preview URL per branch | Automatic on push |
| **Asma's Next.js redesign** | its own repo for now | saverxapril2026.vercel.app | Asma's Vercel |

**The plan:** do not try to merge the Next.js redesign back into the static repo. Instead, port Asma's *design decisions* (tokens, components, page sections) into the static repo via the 3-phase migration in `ASMA_DESIGN_ADOPTION.md`. Keep the Next.js repo as a visual reference and design lab.

**Preview URLs for reviewing:** every PR gets a Cloudflare preview URL automatically. Always review Asma's design PRs on the preview URL, not on localhost, so you see what visitors will see.

---

## 7. When to use Claude Code vs Copilot

Both are useful. They are good at different things.

**Use Claude Code (in the terminal, in the repo root) for:**
- Multi-file edits ("update the nav dropdown on every drug page")
- Running scripts, tests, and git commands
- Reading a whole file or folder to understand context before editing
- Long-form prompts pasted from markdown (`CATEGORY_FIX_PROMPT.md`, `COOKIE_BANNER_PROMPT.md`, `ASMA_DESIGN_ADOPTION.md`)
- Tasks where you need planning + execution, not just autocomplete
- Anything that involves Cloudflare Pages deploy, wrangler, or Apps Script

**Use Copilot (inline in VSCode) for:**
- Single-line autocompletion while you type
- Fast, local "write the next 10 lines" moments
- Small refactors where you already know what you want
- Commit message suggestions

Rule of thumb: if you would write more than 2 sentences of instructions, open Claude Code. If you would write 0 sentences, let Copilot autocomplete.

---

## 8. Sharing Claude Code prompts between the two of you

Claude Code is only as good as the prompts you give it. The best prompts in this repo are already saved as markdown files:

- `CATEGORY_FIX_PROMPT.md`
- `COOKIE_BANNER_PROMPT.md`
- `VISITOR_ID_AND_BEHAVIOR_LOG_PROMPT.md`
- `ASMA_DESIGN_ADOPTION.md`
- `STRATEGY_APRIL_2026.md`

**Convention:** every time one of you writes a prompt longer than ~200 words, save it as a markdown file in the repo root (or under `docs/prompts/` if we start accumulating many) and commit it. Then either of you can:

```bash
# Feed the saved prompt directly into Claude Code
claude < ASMA_DESIGN_ADOPTION.md
```

Or open it in VSCode, copy the relevant section, and paste into Claude Code.

Benefits:
1. Reproducible — the prompt is version-controlled alongside the code it produced
2. Teachable — the other person can read the prompt and learn the pattern
3. Iterative — when a prompt works, you can refine and re-run it
4. Forensic — if something breaks months later, the commit points to the prompt that generated it

---

## 9. Commit message conventions

Use a prefix so `git log --oneline` is scannable:

- `feat:` new feature
- `fix:` bug fix
- `style:` CSS, tokens, visual only
- `content:` drug data, copy, SEO
- `docs:` markdown files
- `chore:` deps, tooling, cleanup
- `data:` lead CSV updates, Apps Script changes

Examples:
```
feat: add 7-tile category grid to homepage
fix: cookie banner escape key closes modal
style: port Asma's warm cream palette to tokens.css
content: add repatha insurance-tier accordion
docs: ASMA_DESIGN_ADOPTION migration plan
```

Keep the subject under 72 characters. If you need to explain more, add a blank line then a paragraph.

---

## 10. The weekly cadence

**Monday morning, 20 minutes, on a call or in Slack:**
- What shipped last week (scan `git log --since="1 week ago" --oneline`)
- What's on each person's plate this week
- What depends on what (so you don't both touch the same file)
- Any blockers Claude Code can help unblock

**Friday afternoon, 10 minutes:**
- Merge any remaining PRs that are approved
- Deploy check — visit saverx.ai on desktop and mobile, click through 3 drug pages, confirm no regressions
- Close the week clean — no dangling unmerged branches older than 7 days

---

## 11. Emergency playbook

**"I committed to main by accident"**
```bash
git log --oneline          # find the last good commit
git reset --soft <hash>    # undo the commit, keep the changes staged
git checkout -b feat/my-fix
git commit -m "feat: ..."
git push -u origin feat/my-fix
```
Do NOT `git push --force` on main. Call the other person first.

**"I have a merge conflict and I'm scared"**
```bash
git status                 # see which files conflict
# Open each file in VSCode — it has a built-in conflict UI
# Pick "Accept Current" / "Accept Incoming" / "Accept Both" per conflict
git add <file>
git rebase --continue      # or git merge --continue
```
If totally stuck: `git rebase --abort` or `git merge --abort` gets you back to safety.

**"saverx.ai looks broken in production"**
1. Open the Cloudflare Pages dashboard → Deployments
2. Find the last known good deployment
3. Click "Rollback to this deployment" — it's one click, instant
4. Then fix the issue in a branch, PR, merge

**"I lost my local changes"**
```bash
git reflog                 # shows every HEAD move for the last 90 days
git checkout <hash>        # go back to any prior state
```
Git almost never actually loses work. Reflog is your safety net.

---

## 12. Onboarding Claude Code for a new prompt (the 5-minute ritual)

Every time one of you starts a non-trivial task with Claude Code, do this first:

1. `git checkout main && git pull` — start from current production
2. `git checkout -b feat/<name>-<desc>` — your own branch
3. Open the repo in VSCode, open a terminal, run `claude`
4. First message to Claude: paste or reference the relevant markdown (`CLAUDE.md` is auto-loaded; reference `ROADMAP.md`, `ASMA_DESIGN_ADOPTION.md`, etc.)
5. Give Claude the task AND the definition-of-done (what "finished" looks like)
6. Let Claude run. Watch the diffs. Push back when it drifts.
7. When done, `git diff main` to see the full scope of changes before committing.

---

## 13. Things we do NOT do

- No force-push to main.
- No committing `.env` or anything in `data/saverx-leads.csv`.
- No "I'll just edit the production page directly in the Cloudflare dashboard." Every change goes through the repo.
- No manual find/replace across all 361 drug pages. Write an injection script.
- No silent refactors in the other person's in-flight PR. Comment on it.
- No merging your own PR without reading the diff one more time.
- No deploying on a Friday evening before a vacation.

---

## 14. The mindset

You two are building a business together, not just a website. The workflow above is boring on purpose — the goal is that code shipping becomes the least interesting part of your week, so your energy goes into strategy, content, partnerships, and user research.

The repo is the source of truth. The branch is the unit of work. The PR is the conversation. Claude Code is the hands. You two are the judgment.

---

*Questions, exceptions, and edge cases — add them to this file via a PR. This doc itself is version-controlled.*
