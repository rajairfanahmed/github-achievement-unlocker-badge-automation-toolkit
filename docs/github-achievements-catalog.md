# GitHub profile achievements catalog

Single source of truth for scope: what this tool can automate vs catalog-only entries.

| Achievement | Slug | Earnable | Tiers (typical) | Automation in this repo |
|-------------|------|----------|-------------------|---------------------------|
| Pair Extraordinaire | `pair-extraordinaire` | Yes | 1 / 10 / 24 / 48 | Full — coauthored merge workflow |
| Pull Shark | `pull-shark` | Yes | 2 / 16 / 128 / 1024 | Full — merge PR workflow |
| Galaxy Brain | `galaxy-brain` | Yes | 2 / 8 / 16 / 32 | Full — discussions + helper |
| Quickdraw | `quickdraw` | Yes | 1 | Full — timed issue close |
| YOLO | `yolo` | Yes | 1 | Full — merge without review + helper |
| Starstruck | `starstruck` | Yes | 16 / 128 / 512 / 4096 | Partial — polls `stargazers_count`, stars with main + helper tokens; remaining stars need other accounts or time |
| Public Sponsor | `public-sponsor` | Yes | 1 | Verify-only — polls Sponsors GraphQL until viewer has a public sponsorship (payment outside the tool) |
| Heart On Your Sleeve | `heart-on-your-sleeve` | Beta / fluctuating | varies | Planned — reaction rules unstable |
| Open Sourcerer | `open-sourcerer` | Beta / fluctuating | varies | Planned — multi-repo merge criteria |
| Arctic Code Vault Contributor | `arctic-code-vault-contributor` | No (historical) | — | Catalog only |
| Mars 2020 Contributor | `mars-2020-contributor` | No (historical) | — | Catalog only |

## Profile badges (not profile “achievements”)

Campus Expert, Security Bug Bounty, GitHub Pro, etc. are outside this CLI — show as informational only if listed in UI later.

## API notes

- **REST core rate limit** drives feasibility hints (`estimatedRestCallsPerOperation` per achievement).
- **Starstruck**: `GET /repos/{owner}/{repo}` → `stargazers_count`; `PUT /user/starred/{owner}/{repo}` per authenticated account.
- **Public Sponsor**: GraphQL `viewer { sponsorshipsAsSponsor { totalCount } }` (requires token scopes that can read sponsorships).
