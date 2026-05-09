# GitHub Achievement Unlocker - Badge Automation Toolkit

Automate and manage GitHub profile achievement workflows with a CLI + local web dashboard.

If you searched for phrases like:
- GitHub achievement unlocker
- GitHub badge automation tool
- Earn pull shark quickdraw galaxy brain
- GitHub achievements script
- GitHub profile badges automation

This project is built for exactly that use case.

## What This Tool Does

This toolkit helps you:
- run achievement workflows from the terminal or the browser dashboard
- track local progress and operation history per GitHub account
- estimate API usage before running
- stop active runs safely (cooperative cancel)
- manage tier-based milestones (Default, Bronze, Silver, Gold)

Dashboard is local-first. Token values stay on your machine.

## Credits and Project Lineage

This work is based on and improved from the original project by `n0`:
- Original profile: [n0](https://github.com/n0)
- Original repository: [n0/GitHub-Achievement-CLI](https://github.com/n0/GitHub-Achievement-CLI)

This fork/version adds UX and operational improvements, such as:
- local Next.js dashboard (runs on port **3000** via `npm run web:dev`)
- contextual strip for repo account, REST rate limit, live job polling
- achievement cards with clearer tier/progress UX, finished-tier protection, and badge artwork
- cooperative **Stop run** for active jobs (respects in-flight GitHub requests)
- history tables with pagination
- `postinstall` bootstrap that creates `.env` from `.env.example` when missing

## Supported Achievements (Current)

| Achievement | Description | Tiers |
| --- | --- | --- |
| Pair Extraordinaire | Coauthored commits on merged pull requests | 1 / 10 / 24 / 48 |
| Pull Shark | Opened PRs that get merged | 2 / 16 / 128 / 1024 |
| Galaxy Brain | Accepted answers in Discussions | 2 / 8 / 16 / 32 |
| Quickdraw | Close issue within 5 minutes | 1 |
| YOLO | Merge PR without review | 1 |
| Starstruck | Stars on target repo (poll + helper support) | 16 / 128 / 512 / 4096 |
| Public Sponsor | Verify public sponsorship state | 1 |

## Badge Icons and Quick Info

| Badge | Icon | Quick Info |
| --- | --- | --- |
| Pair Extraordinaire | ![Pair Extraordinaire](https://github.githubassets.com/assets/pair-extraordinaire-default-579438a20e01.png) | Coauthored commits on merged PRs |
| Pull Shark | ![Pull Shark](https://github.githubassets.com/assets/pull-shark-default-498c279a747d.png) | PRs that get merged |
| Galaxy Brain | ![Galaxy Brain](https://github.githubassets.com/assets/galaxy-brain-default-847262c21056.png) | Accepted Discussion answers |
| Quickdraw | ![Quickdraw](https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png) | Close issue within 5 minutes |
| YOLO | ![YOLO](https://github.githubassets.com/assets/yolo-default-be0bbff04951.png) | Merge without code review |
| Starstruck | ![Starstruck](https://github.githubassets.com/assets/starstruck-default--light-a594e2a027e0.png) | Reach star milestone on one repo |
| Public Sponsor | ![Public Sponsor](https://github.githubassets.com/images/modules/profile/achievements/public-sponsor-64.png) | Public sponsorship verification |

Tip: icon variant changes by tier (`default`, `bronze`, `silver`, `gold`) where GitHub provides tiered artwork.

## Requirements

- Node.js `18+`
- npm
- GitHub Personal Access Token (classic) with **`repo`** scope for your **main** account
- A **target repository** where the main account has **write** access (most workflows create branches, PRs, issues, or merges here)
- For **Galaxy Brain** and **YOLO**: a **second GitHub account** plus `HELPER_TOKEN`, and for Galaxy Brain **repository Discussions must be enabled** on `TARGET_REPO`
- For **Public Sponsor**: payment/sponsorship happens outside the app; the tool verifies state via the API (ensure your token can read the relevant data—use the dashboard **Overview** if something is blocked)

## Enable Discussions on your target repository (Galaxy Brain)

Galaxy Brain automation uses **GitHub Discussions**. Enable them on the repo you set as `TARGET_REPO`:

1. Sign in to GitHub as someone who can change repo settings (usually the **owner**, or a user with **Admin** on the repo).
2. Open your repository: `https://github.com/YOUR_USER/YOUR_REPO`.
3. Click **Settings** (repo settings, not your global account settings).
4. In the left sidebar, under **General**, scroll to **Features**.
5. Toggle **Discussions** **On**.
6. Go back to the repo main page and confirm a **Discussions** tab appears next to **Issues** / **Pull requests**.
7. (Recommended) In **Discussions**, open **Categories** and ensure you have an answer-friendly category (for example **Q&A**). The workflow needs a place where answers can be marked accepted.

If Discussions stay off, the dashboard will show Galaxy Brain as blocked until you enable them.

## Beginner Quick Start (Step-by-Step)

### 1) Clone and install

```bash
git clone <your-repo-url>
cd GitHub-Achievement-CLI
npm install
```

What `npm install` does in this repo:

- **`postinstall`**: if `.env` does not exist yet, it is copied from `.env.example` so you only fill in values.
- **`prepare`**: runs **`npm run build`** (TypeScript compile to `dist/`). The first install therefore also produces the CLI build output.

### 2) Fill required `.env` values

Open `.env` and update only these first:

```env
GITHUB_TOKEN=ghp_your_main_account_token
GITHUB_USERNAME=your-main-username
TARGET_REPO=your-main-username/your-target-repo
```

If using helper-required achievements, also set:

```env
HELPER_TOKEN=ghp_your_helper_account_token
```

### 3) Run the CLI (after install)

If you already ran `npm install`, you can usually start immediately:

```bash
npm start
```

If you disabled lifecycle scripts or removed `dist/`, compile again:

```bash
npm run build
npm start
```

### 4) Optional web dashboard

```bash
npm run web:dev
```

Then open:

```text
http://localhost:3000
```

In the dashboard:

- Use **Overview** for preflight (`.env`, tokens, repo access, Discussions, rate limit).
- Use **Achievements** to pick a tier per badge and **Run** / **Resume** (only **one** job runs globally at a time). Use **Stop run** when you need to stop cooperatively.
- Use **History** for local snapshots and stored operations with GitHub links.
- Use **Settings** for env summary (no secrets shown) and optional desktop notifications.

## Complete `.env` Setup Guide (Very Beginner Friendly)

If you can't understand where to find `token`, `username`, and `target repo`, use this section exactly.

### Step A - Find your GitHub username

1. Open `https://github.com` and sign in.
2. Click your profile photo (top-right).
3. Click **Your profile**.
4. Your username is in the URL:
   - Example URL: `https://github.com/your-username`
   - Username: `your-username`
5. Put this in `.env`:

```env
GITHUB_USERNAME=your-username
```

### Step B - Create `GITHUB_TOKEN` (main account token)

This token must belong to the same account that should receive achievements.

1. While signed in to your main GitHub account, open:
   - `https://github.com/settings/tokens`
2. Click **Generate new token (classic)**.
3. Add a note (example: `Achievement Toolkit Main Token`).
4. Select expiry as you prefer.
5. Select scope:
   - `repo` (required)
6. Click **Generate token**.
7. Copy token immediately (GitHub will not show it again).
8. Put this in `.env`:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step C - Find/create your `TARGET_REPO`

`TARGET_REPO` format is always:

```text
owner/repository-name
```

How to find it:
1. Open your repository in browser.
2. Look at URL:
   - Example: `https://github.com/your-username/your-repository-name`
3. Then:

```env
TARGET_REPO=your-username/your-repository-name
```

If you do not have a repo yet:
1. Click `+` on GitHub top-right -> **New repository**
2. Create any test repo under your account
3. Use that repo path as `TARGET_REPO`

### Step D - Helper Token (`HELPER_TOKEN`)

Required only for helper-based badges (Galaxy Brain / YOLO).

1. Login with a **second GitHub account** (not the main one).
2. Open `https://github.com/settings/tokens`
3. Generate classic token with:
   - `repo`
   - `write:discussion` (recommended for **Galaxy Brain** so discussions can be created/participated in as documented in `.env.example`)
4. Put in `.env`:

```env
HELPER_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Important:
- `GITHUB_TOKEN` and `HELPER_TOKEN` must be from different accounts.
- Helper account should have collaborator access to the target repo.

### Step D2 - Invite the helper account to `TARGET_REPO`

1. Repo **Settings → Collaborators and teams → Add people**.
2. Invite the helper’s GitHub username with **Write** access (or sufficient access to collaborate on PRs/discussions).
3. The helper must **accept** the email/notification invite before workflows can run reliably.

### Step E - Final `.env` example

```env
GITHUB_TOKEN=ghp_main_account_token_here
GITHUB_USERNAME=your-main-username
TARGET_REPO=your-main-username/your-target-repo
HELPER_TOKEN=ghp_helper_account_token_here
```

### Quick validation checklist

Before running, confirm:
- `GITHUB_USERNAME` matches the owner of `GITHUB_TOKEN`
- `TARGET_REPO` exists and you can open it in browser
- Main account has write access to `TARGET_REPO`
- For **Galaxy Brain**: Discussions are enabled on `TARGET_REPO` (see section above), helper collaborator invite accepted
- `.env` is in project root (same folder as `package.json`)

Progress files: the app saves local state to **`achievements-data-<username>.json`** in the project folder (already gitignored)—this is separate from GitHub’s own profile badges.

### Common copy mistakes (very common)

- Wrong format:
  - `TARGET_REPO=https://github.com/user/repo` ❌
  - `TARGET_REPO=user/repo` ✅
- Adding quotes around token:
  - `GITHUB_TOKEN="ghp_xxx"` (usually avoid quotes)
- Using same account token for helper and main
- Typo in username or repo name

## Main Account vs Helper Account

Use two different accounts for helper-required badges.

Example:

```env
GITHUB_TOKEN=token_for_account_getting_badges
HELPER_TOKEN=token_for_second_account
```

Do not set both to the same account.

## CLI + Dashboard Overview

- **CLI** (`npm start`): Ink UI for interactive setup, run achievements, view status/history helpers, repo reset tooling as implemented in the CLI
- **Dashboard** (`npm run web:dev`): Overview preflight + **Achievements** runner cards + paginated History + Settings (notifications sync); sticky job panel + **Stop run**

## Rate Limit and Safety

- The tool checks GitHub REST budget before running
- Uses delays/concurrency controls to reduce throttling
- Shows API reset ETA in the dashboard
- Supports cooperative stop for active run

## Public Sponsor and Starstruck Note

- For **Public Sponsor** and **Starstruck**, use only genuine methods.
- This project does not provide tricks, hacks, or abusive shortcuts for those badges.
- Public Sponsor requires a real public sponsorship state on GitHub.
- Starstruck requires real stars from real users on one repository.

## Troubleshooting

### `.env` was not created on install

- Ensure `.env.example` exists in repo root
- Re-run:

```bash
npm install
```

or manually copy:

```bash
cp .env.example .env
```

### I clicked stop but run still active

Stop is cooperative. Current in-flight API call finishes first, then the remaining steps are skipped.

### Helper account badge is blocked

Check:
- helper token belongs to a different account
- helper account accepted collaborator invite
- Discussions are enabled (for Galaxy Brain)

### Bad credentials

Token is invalid/expired/revoked. Generate a new one and update `.env`.

## Development Commands

```bash
npm run build
npm run lint
npm run web:build
```

## SEO Search Phrases (for discoverability)

Useful terms included in this project/readme:
- GitHub achievement unlocker
- GitHub badge automation toolkit
- automate GitHub profile achievements
- Pull Shark automation
- Galaxy Brain automation
- Quickdraw badge tool
- GitHub profile badge manager
- GitHub achievements dashboard

## Security Notes

- Never commit `.env`
- Never expose personal access tokens
- Rotate any token that appears in logs/screenshots/public text

## License

MIT
