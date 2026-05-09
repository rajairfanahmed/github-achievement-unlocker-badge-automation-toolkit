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

## Complete beginner path (step by step, one flow)

Read from top to bottom like a recipe. **Do the steps in order.** If a step says “only for Galaxy Brain,” you can skip it when you do not want that badge—but it is safe to turn Discussions on anyway.

**1.** Open [https://github.com](https://github.com) and sign in with the account that should **earn the badges** on the profile. This is your **main account**.

**2.** Decide which repository the tool will use. It can be an old repo or a brand new empty one. Everywhere below we call this your **target repo**. In your mind, remember: “all the automatic issues, PRs, and so on happen **inside this one repo**.”

**3.** If you do not have a target repo yet, create it now:
   - Click the **+** button at the top right of GitHub.
   - Click **New repository**.
   - Choose any name you like (for example `my-achievements-playground`).
   - You can leave it **public** or **private**; your main account must be able to **write** to it (owner is fine).
   - Click **Create repository**.

**4.** Copy the repo name in the `owner/repo` form. Open the repo in the browser. Look at the address bar.
   - Example address: `https://github.com/alice/hello-world`
   - The value you need is: `alice/hello-world`
   - You will put that in `.env` as `TARGET_REPO` later.

**5.** *(Only if you plan to earn **Galaxy Brain**.)* Galaxy Brain needs a **Discussions** area on that **same** target repo. Think of Discussions like a forum tab on the repo. Turn it on **before** you run the tool:
   - **5a.** Make sure you are still logged in as someone who **owns** the repo or has **admin** rights (usually the repo owner).
   - **5b.** Open your target repo’s home page (the page with **Code**, **Issues**, **Pull requests**).
   - **5c.** Click **Settings** near the top of the repo page. (This is **repository** Settings, not your profile picture Settings for the whole GitHub account.)
   - **5d.** In the **left** menu, click **General** if it is not already selected.
   - **5e.** Scroll down the main page until you see a block named **Features**.
   - **5f.** Find the line that says **Discussions**.
   - **5g.** Click the switch so Discussions is **On** (enabled).
   - **5h.** Click your repository name at the top (or use the browser Back button) to return to the **normal repo home page** (not Settings).
   - **5i.** Look at the tabs: you should now see **Discussions** next to **Issues** and **Pull requests**. If you do **not** see it, go back to **Settings → General → Features** and make sure the switch is really on.
   - **5j.** *(Nice to have.)* Click the **Discussions** tab. If GitHub asks you to set up categories, pick or keep a **Q&A** style category so questions and “accepted answers” work the way GitHub expects. You do not need to be perfect here; you mainly need Discussions **on** and a normal place to post.

If you skip step 5 and later run Galaxy Brain, the dashboard will say Discussions are missing until you complete 5a–5i.

**6.** *(Only if you plan **Galaxy Brain** or **YOLO**.)* You need a **second** GitHub account (the **helper**). It must **not** be the same login as the main account.

**7.** *(Only with a helper.)* Invite the helper to the **target repo**:
   - Open the target repo → **Settings** → **Collaborators** (sometimes labeled **Collaborators and teams**).
   - **Add people** with the helper’s GitHub username and give at least **Write** access so they can work with PRs and discussions.
   - The helper must **accept** the invitation (email or GitHub notification). Wait until that is done.

**8.** Create a **classic** token for the **main** account: [https://github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)** → enable scope **`repo`** → generate → copy the token once (GitHub will not show it again). That string is your `GITHUB_TOKEN`.

**9.** *(Only with a helper.)* While logged into the **helper** account, create another classic token with scopes **`repo`** and **`write:discussion`** (needed for Galaxy Brain–style discussion work). That string is your `HELPER_TOKEN`.

**10.** On your **computer**, clone this project and enter the folder:

```bash
git clone <your-repo-url>
cd GitHub-Achievement-CLI
```

**11.** Install dependencies. The first install also creates `.env` from `.env.example` if needed, and runs a build:

```bash
npm install
```

**12.** Open the file **`.env`** in the project folder (same level as `package.json`). Fill at least:

```env
GITHUB_TOKEN=paste_main_token_here
GITHUB_USERNAME=your-main-username
TARGET_REPO=owner/repo-from-step-4
```

If you use a helper, add one more line:

```env
HELPER_TOKEN=paste_helper_token_here
```

**13.** Start the CLI:

```bash
npm start
```

If `dist/` is missing because you skipped install scripts, run `npm run build` then `npm start` again.

**14.** *(Optional but recommended.)* Start the local dashboard:

```bash
npm run web:dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Overview** first (checks env, repo, Discussions if needed, rate limit). Use **Achievements** to run one badge at a time (**only one job** runs at once). **Stop run** stops politely after the current API call. **History** shows what happened; **Settings** shows env summary without secrets.

---

**Tiny cheat sheet**

| You want | Do not skip |
| --- | --- |
| Most badges | Steps 1–4, 8, 10–13 |
| Galaxy Brain | Step 5 (Discussions), steps 6–7, helper token in step 9 |
| YOLO | Steps 6–7, helper token (scope `repo` at minimum) |

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
- For **Galaxy Brain**: Discussions are enabled on `TARGET_REPO` (see **Complete beginner path**, steps 5a–5i), helper collaborator invite accepted
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
