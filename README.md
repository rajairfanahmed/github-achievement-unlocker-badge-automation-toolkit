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

You use **two GitHub accounts**: a **main account** (badges go on this profile) and a **helper account** (second login). All automation happens in **one test repository** owned by the main account (`TARGET_REPO`). Fill **every** item below before you rely on Galaxy Brain, YOLO, or other flows that need the helper.

Follow **Part A → Part B → Part C → Part D** in order.

### What you must have

| # | Piece | What it is |
| --- | --- | --- |
| 1 | **Main account** | The GitHub user that should earn achievements on their profile. |
| 2 | **Test repo** | A repository under the main account (for example `your-main-username/achievement-test`). All branches, PRs, issues, and pushes go **here**. |
| 3 | **`GITHUB_TOKEN`** | Personal access token (**classic**) created while logged in as the **main** account. Scope: **`repo`**. |
| 4 | **`TARGET_REPO`** | Same test repo as `owner/repo` — from the URL `https://github.com/your-main-username/repo-name` → `your-main-username/repo-name`. |
| 5 | **`GITHUB_USERNAME`** | The main account’s username (same as in `TARGET_REPO` when the repo is yours). |
| 6 | **Discussions ON** | On **that same test repo**: repo **Settings** → **General** → **Features** → enable **Discussions**. Confirm the **Discussions** tab appears on the repo. Use a **Q&A** category if GitHub asks — needed for accepted answers in Discussions. |
| 7 | **Helper account** | A **second** GitHub user — different login than main. |
| 8 | **Collaborator invite** | On the test repo: **Settings** → **Collaborators** → add the helper’s **username** → **Write** access. The helper must **accept** the invitation. |
| 9 | **`HELPER_TOKEN`** | Personal access token (**classic**) created while logged in as the **helper** account. Scopes: **`repo`** and **`write:discussion`** (needed for Discussions workflows). |

Also: **Node.js 18+** and **npm** on your computer.

**Public Sponsor** is verified separately (you sponsor on GitHub first); this tool only checks your account afterward.

---

### Part A — Main account, test repo, Discussions

| Step | Action |
| --- | --- |
| A1 | Sign in to GitHub as your **main** account (the one that should get the badges). |
| A2 | Create a **new repository** under this account if you do not have one: **+** → **New repository** → name it (for example `achievement-test`) → **Create repository**. This is your **test repo**. |
| A3 | Note **`TARGET_REPO`**: `your-main-username` / `repo-you-just-created` → in `.env` write `your-main-username/repo-you-just-created` (no `https://`). |
| A4 | Note **`GITHUB_USERNAME`**: it is your main account name (same as in the repo URL). |
| A5 | Open that repo → **Settings** (repo settings, not your profile settings) → **General** → **Features** → turn **Discussions** **On**. Return to the repo home and confirm the **Discussions** tab is visible. |

---

### Part B — Helper account and collaborator access

| Step | Action |
| --- | --- |
| B1 | Sign in with your **second** account (**helper**) in another browser or after signing out — it must **not** be the main account. |
| B2 | On the **test repo** (while logged in as **main**): **Settings** → **Collaborators** → **Add people** → enter the helper’s **GitHub username** → choose **Write** → send invite. |
| B3 | Sign in as the **helper** and **accept** the collaboration invite (email or GitHub notifications). Until this is accepted, PR/discussion flows that need the helper will fail. |

---

### Part C — Tokens (main and helper)

Create tokens at [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**. Copy each token once.

| Token | Logged in as | Scopes |
| --- | --- | --- |
| `GITHUB_TOKEN` | **Main** account | **`repo`** |
| `HELPER_TOKEN` | **Helper** account | **`repo`** + **`write:discussion`** |

Never reuse one token for both accounts.

---

### Part D — Install this project, `.env`, run

| Step | Action |
| --- | --- |
| D1 | Clone and enter the folder: `git clone <your-repo-url>` → `cd GitHub-Achievement-CLI`. |
| D2 | Run `npm install` (creates `.env` from `.env.example` if missing and builds via `prepare`). |
| D3 | Edit **`.env`** next to `package.json` with **all** of these lines filled in: |

```env
GITHUB_TOKEN=ghp_your_main_account_token
GITHUB_USERNAME=your-main-username
TARGET_REPO=your-main-username/your-test-repo-name
HELPER_TOKEN=ghp_your_helper_account_token
```

| Step | Action |
| --- | --- |
| D4 | Start the CLI: `npm start` — if `dist/` is missing, run `npm run build` then `npm start`. |
| D5 | Start the dashboard: `npm run web:dev` → open [http://localhost:3000](http://localhost:3000). |

---

### Using the dashboard

| Tab | Purpose |
| --- | --- |
| **Overview** | Checks `.env`, tokens, repo access, Discussions, rate limit |
| **Achievements** | Pick tier → **Run** / **Resume** — **one job at a time** for the whole app |
| **History** | Local log with GitHub links |
| **Settings** | Env summary (no secrets), notifications |

**Stop run** waits for the current GitHub request to finish, then stops.

---

### Final checklist

- [ ] Main account owns or controls the **test repo** used as `TARGET_REPO`
- [ ] `GITHUB_USERNAME` matches the **main** account that owns `GITHUB_TOKEN`
- [ ] `TARGET_REPO` is exactly `owner/repo` (not a full URL)
- [ ] **Discussions** are enabled on that repo and the tab shows on GitHub
- [ ] **Helper** username is added as **collaborator** on the test repo and the invite is **accepted**
- [ ] `HELPER_TOKEN` belongs to the **helper** account (different from `GITHUB_TOKEN`)
- [ ] `.env` sits in the project root next to `package.json`

Local state file: **`achievements-data-<username>.json`** (gitignored). That is not the same as GitHub’s badge state.

### Common mistakes

| Wrong | Right |
| --- | --- |
| `TARGET_REPO=https://github.com/user/repo` | `TARGET_REPO=user/repo` |
| Same account for both tokens | Main token + helper token from **two** users |
| Helper not invited or invite not accepted | Invite helper on **test repo** → helper accepts |
| `GITHUB_TOKEN="ghp_..."` with quotes | Usually omit quotes: `GITHUB_TOKEN=ghp_...` |

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
