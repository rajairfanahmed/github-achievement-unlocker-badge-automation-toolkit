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

**New here?** Go straight to **[Setup guide](#setup-guide)** below.

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

## Setup guide

All setup steps live here. Follow **Part 1 → Part 2 → Part 3 → Part 4**. Skip optional rows if you do not need that badge.

### At a glance

| Need | Details |
| --- | --- |
| Node.js **18+**, **npm** | |
| **Main** GitHub account | Profile that should earn badges |
| Classic PAT, scope **`repo`** | [github.com/settings/tokens](https://github.com/settings/tokens) |
| **`TARGET_REPO`** | Format `owner/repo` — one repo where your main account can **write** |
| **Helper** + **`HELPER_TOKEN`** | Only for **Galaxy Brain** & **YOLO** (must be a **different** login than main) |
| **Discussions ON** | Only for **Galaxy Brain** — [see below](#optional-enable-discussions-galaxy-brain) |

**Public Sponsor:** subscribe on GitHub Sponsors yourself; this app only verifies afterward.

---

### Part 1 — GitHub (account, repo, helper)

| # | Do this |
| --- | --- |
| 1 | Sign in at [github.com](https://github.com) as the account that should **get the badges** (**main**). |
| 2 | Pick **one** repo for all automation, or create it: **+** → **New repository** → **Create** (any name; you need **write** access). |
| 3 | Set **`TARGET_REPO`** from the URL: `https://github.com/alice/my-repo` → `alice/my-repo` (never paste the full `https://` link). |
| 4 | **`GITHUB_USERNAME`**: open avatar → **Your profile** → copy the name from the URL `github.com/your-username`. |

**Optional — helper (Galaxy Brain / YOLO only)**

| # | Do this |
| --- | --- |
| 5 | Create or use a **second** GitHub user (**helper**). Not the same person as main. |
| 6 | Target repo → **Settings** → **Collaborators** → add helper → **Write**. Helper must **accept** the invite. |

#### Optional: enable Discussions (Galaxy Brain)

| # | Do this |
| --- | --- |
| A | Open the **repository** as owner or admin (repo **Settings**, not account Settings). |
| B | **General** → **Features** → turn **Discussions** **On**. |
| C | Back on the repo home, confirm a **Discussions** tab appears. |
| D | Open **Discussions**; pick a **Q&A** category if GitHub asks — helps “accepted answer” work. |

Without B–C, Galaxy Brain stays blocked in the dashboard.

---

### Part 2 — Tokens

Create at [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**. Copy once; GitHub will not show it again.

| Variable | Who | Scopes |
| --- | --- | --- |
| `GITHUB_TOKEN` | Main | `repo` |
| `HELPER_TOKEN` | Helper (if used) | `repo` + `write:discussion` for Galaxy Brain; YOLO needs at least `repo` on helper |

Never use one token for both accounts.

---

### Part 3 — Install, `.env`, run

| # | Step |
| --- | --- |
| 1 | `git clone <your-repo-url>` and `cd GitHub-Achievement-CLI` |
| 2 | `npm install` — copies `.env` from `.env.example` if missing; runs build via `prepare` |

Edit **`.env`** (next to `package.json`):

```env
GITHUB_TOKEN=ghp_your_main_token
GITHUB_USERNAME=your-main-username
TARGET_REPO=owner/repo
```

If you use a helper:

```env
HELPER_TOKEN=ghp_your_helper_token
```

| # | Step |
| --- | --- |
| 3 | CLI: `npm start` — if `dist/` is missing, run `npm run build` then `npm start` |
| 4 | Dashboard (optional): `npm run web:dev` → [http://localhost:3000](http://localhost:3000) |

---

### Part 4 — Using the dashboard

| Tab | Purpose |
| --- | --- |
| **Overview** | Checks env, repo, Discussions if needed, rate limit |
| **Achievements** | Choose tier → **Run** / **Resume** — **one global job at a time** |
| **History** | What ran locally + GitHub links |
| **Settings** | Env summary (no secrets), notifications |

**Stop run** finishes the current API call, then stops.

---

### Before you run (checklist)

- [ ] `GITHUB_USERNAME` matches the user that owns `GITHUB_TOKEN`
- [ ] `TARGET_REPO` is only `owner/repo`
- [ ] You can open that repo in the browser and your main user can write to it
- [ ] Galaxy Brain: Discussions on + helper invited and accepted + `HELPER_TOKEN`
- [ ] `.env` is in the project root with `package.json`

Progress file: **`achievements-data-<username>.json`** (gitignored), separate from GitHub’s badges.

### Common mistakes

| Wrong | Right |
| --- | --- |
| `TARGET_REPO=https://github.com/u/r` | `TARGET_REPO=u/r` |
| Same token for main and helper | Two accounts, two tokens |
| `GITHUB_TOKEN="ghp_..."` with quotes | Usually no quotes |

## CLI + Dashboard Overview

| Mode | Command | What you get |
| --- | --- | --- |
| CLI | `npm start` | Ink menus: setup, run achievements, status/history, repo helpers |
| Dashboard | `npm run web:dev` | Overview, Achievements, History, Settings; job bar + **Stop run** |

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
