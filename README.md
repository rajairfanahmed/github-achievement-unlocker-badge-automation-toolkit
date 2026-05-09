# GitHub Achievement Unlocker - Badge Automation Toolkit

Automate and manage GitHub profile achievement workflows with a CLI + local web dashboard.

If you searched for phrases like:
- GitHub achievement unlocker
- GitHub badge automation tool
- earn pull shark quickdraw galaxy brain
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
- local web dashboard flow and status visibility
- clearer tier/progress messaging
- stop active run control
- light-only web theme
- better history readability with pagination
- environment/bootstrap quality-of-life updates

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
- GitHub Personal Access Token (classic) with `repo` scope
- Target repository where your main account has write access
- Helper account token for workflows that require a second account (Galaxy Brain / YOLO)

## Beginner Quick Start (Step-by-Step)

### 1) Clone and install

```bash
git clone <your-repo-url>
cd GitHub-Achievement-CLI
npm install
```

On `npm install`, this project now auto-creates `.env` from `.env.example` **if `.env` does not already exist**.

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

### 3) Build and run

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

## Easy `.env` Guide for Beginners

### Required keys

- `GITHUB_TOKEN`: token of the account that should receive achievements
- `GITHUB_USERNAME`: same account username
- `TARGET_REPO`: repo where automation will create branches/issues/PRs

### Optional but useful keys

- `HELPER_TOKEN`: second account token (required for some achievements)
- `DELAY_MS`: increase if you want slower, safer API pacing
- `LOG_LEVEL`: `info` / `debug` / `warn` / `error`

### Token creation tips

1. Go to `https://github.com/settings/tokens`
2. Create a classic token with `repo` scope
3. Never share a token in screenshots/chat/commits
4. If leaked, revoke immediately and create a new one

## Main Account vs Helper Account

Use two different accounts for helper-required badges.

Example:

```env
GITHUB_TOKEN=token_for_account_getting_badges
HELPER_TOKEN=token_for_second_account
```

Do not set both to the same account.

## CLI + Dashboard Overview

- **CLI** (`npm start`): setup, execute, status, reset options
- **Dashboard** (`npm run web:dev`): preflight checks, achievements, history, settings, active job panel

## Rate Limit and Safety

- The tool checks GitHub REST budget before running
- Uses delays/concurrency controls to reduce throttling
- Shows API reset ETA in the dashboard
- Supports cooperative stop for active run

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
