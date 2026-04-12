# Git Guide for Asma — SaveRx.ai

A step-by-step guide to pulling the latest code, making style/layout changes, and pushing them back to GitHub.

---

## Prerequisites

Before you start, make sure you have:

1. **Git installed** — check by running `git --version` in your terminal. If not installed, download from [git-scm.com](https://git-scm.com)
2. **A GitHub account** — sign up at [github.com](https://github.com) if you don't have one
3. **Collaborator access** — ask your dad (Vajih) to add your GitHub username as a collaborator at:
   `github.com/vajih/saverx → Settings → Collaborators → Add people`
4. **A code editor** — [VS Code](https://code.visualstudio.com) is recommended

---

## First Time Setup (Clone the Repo)

If you've never worked on this project before, clone it to your computer:

```bash
# Navigate to where you want to store the project (e.g. your Desktop or Documents)
cd ~/Desktop

# Clone the repository
git clone https://github.com/vajih/saverx.git

# Move into the project folder
cd saverx
```

You only need to do this **once**. After that, use `git pull` (see below) to get updates.

---

## Every Time You Start Working

Before touching any files, **always pull the latest changes** first. This prevents conflicts.

```bash
# Make sure you're in the project folder
cd ~/Desktop/saverx   # adjust path if you saved it elsewhere

# Pull the latest code from GitHub
git pull origin main
```

You should see something like:
```
Already up to date.
```
or a list of files that were updated. Either is fine — you're now in sync.

---

## Making Your Style & Layout Changes

Open the project in VS Code:

```bash
code .
```

The main files you'll be working with for style and layout:

| File | Purpose |
|------|---------|
| `assets/css/tokens.css` | Design tokens — colors, spacing, font sizes. Change values here to affect the whole site. |
| `assets/css/components.css` | Component styles — cards, buttons, nav, footer, etc. |
| `assets/styles.css` | Global/legacy styles |
| `index.html` | Homepage layout |
| `drugs/*.html` | Individual drug pages (358 files) |
| `templates/index.html` | Template used to generate drug pages |

### Tips
- Changes to `tokens.css` will cascade site-wide automatically (all pages use CSS variables from it)
- Changes to `components.css` affect shared components across all pages
- Test your changes locally by opening any `.html` file directly in your browser, or run a local server:
  ```bash
  python3 -m http.server 8080
  # Then open http://localhost:8080 in your browser
  ```

---

## Saving & Pushing Your Changes to GitHub

Once you're happy with your changes:

### Step 1 — Check what you changed

```bash
git status
```

This shows all modified, new, or deleted files. Green = staged, red = not yet staged.

### Step 2 — Stage your changes

To stage everything you changed:

```bash
git add .
```

Or to stage specific files only:

```bash
git add assets/css/tokens.css assets/css/components.css
```

### Step 3 — Commit with a message

Write a short description of what you changed:

```bash
git commit -m "Update color palette and card layout styles"
```

Good commit message examples:
- `"Tighten spacing on drug page hero section"`
- `"Update font sizes and button border radius"`
- `"Redesign footer layout for mobile"`

### Step 4 — Push to GitHub

```bash
git push origin main
```

You'll be asked for your GitHub username and password the first time. Use a **Personal Access Token** instead of your password (GitHub no longer accepts passwords for pushes):
- Generate one at: `github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token`
- Give it `repo` scope and copy it — paste it when prompted for your password

---

## Handling Conflicts

If your dad has pushed changes while you were working, you may get a conflict error when pushing. Fix it like this:

```bash
# Pull the latest changes (with rebase to keep history clean)
git pull origin main --rebase

# If there are conflicts, Git will tell you which files to fix.
# Open those files, look for <<<<< and >>>>> markers, resolve them,
# then run:
git add .
git rebase --continue

# Then push
git push origin main
```

If you're unsure about a conflict, just ask your dad before pushing.

---

## Quick Reference Cheat Sheet

```bash
# Start of every session — get latest code
git pull origin main

# Check what files you've changed
git status

# See exactly what changed in a file
git diff assets/css/tokens.css

# Stage + commit + push (the full flow)
git add .
git commit -m "Your description here"
git push origin main

# Undo all local changes if something went wrong (⚠️ this discards your work)
git checkout .
```

---

## Getting Help

- Git docs: [git-scm.com/docs](https://git-scm.com/docs)
- GitHub guides: [docs.github.com](https://docs.github.com)
- Or just ask your dad! 😊
