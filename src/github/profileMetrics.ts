/**
 * Live counts from GitHub’s public APIs mapped to the same tier thresholds this app uses.
 * GitHub does not expose official “profile achievement tier” fields on REST/GraphQL — only
 * underlying activity can be queried; tier graphics on your profile remain authoritative.
 */

import type { Octokit } from '@octokit/rest';
import type {
  AchievementId,
  AchievementDefinition,
  GitHubLiveInsight,
  TierLevel,
} from '../types/index.js';
import { ACHIEVEMENT_DEFINITIONS } from '../achievements/index.js';

/** Community docs / discussions about profile achievements (rules source of truth is GitHub). */
export const GITHUB_ACHIEVEMENTS_COMMUNITY =
  'https://github.com/orgs/community/discussions/categories/profile';

function definitionFor(id: AchievementId): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
}

/**
 * Highest tier whose targetCount the count meets or exceeds (matches GitHub tier ladder in app).
 */
export function inferTierFromCount(count: number, definition: AchievementDefinition): TierLevel | null {
  const sorted = [...definition.tiers].sort((a, b) => a.targetCount - b.targetCount);
  let achieved: TierLevel | null = null;
  for (const t of sorted) {
    if (count >= t.targetCount) {
      achieved = t.level;
    }
  }
  return achieved;
}

async function mergedPullRequestsAuthoredCount(octokit: Octokit, login: string): Promise<number> {
  const q = `is:pr is:merged author:${login}`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    per_page: 1,
  });
  return data.total_count;
}

export async function fetchGitHubLiveInsights(
  octokit: Octokit,
  username: string,
  repoOwner: string,
  repoName: string,
  sponsorshipCount: number | null
): Promise<Partial<Record<AchievementId, GitHubLiveInsight>>> {
  const out: Partial<Record<AchievementId, GitHubLiveInsight>> = {};

  const pullDef = definitionFor('pull-shark');
  const starDef = definitionFor('starstruck');
  const sponsorDef = definitionFor('public-sponsor');

  try {
    const count = await mergedPullRequestsAuthoredCount(octokit, username);
    if (pullDef) {
      out['pull-shark'] = {
        qualifyingCount: count,
        inferredTier: inferTierFromCount(count, pullDef),
        summary: `${count.toLocaleString()} merged PRs opened by you (GitHub Search: merged PRs you authored).`,
        source: 'search',
        detail:
          'Aligned with GitHub’s Pull Shark description: merged pull requests you opened. Search uses your token’s visibility (private repos only if the token can see them).',
      };
    }
  } catch (e) {
    out['pull-shark'] = {
      qualifyingCount: null,
      inferredTier: null,
      summary: 'Could not load merged PR count from GitHub Search.',
      source: 'none',
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const { data } = await octokit.rest.repos.get({ owner: repoOwner, repo: repoName });
    const count = data.stargazers_count;
    if (starDef) {
      out['starstruck'] = {
        qualifyingCount: count,
        inferredTier: inferTierFromCount(count, starDef),
        summary: `${count.toLocaleString()} stars on ${repoOwner}/${repoName} (your TARGET_REPO).`,
        source: 'rest',
        detail:
          'Starstruck is based on stars on a single repository; this uses TARGET_REPO from your .env.',
      };
    }
  } catch (e) {
    out['starstruck'] = {
      qualifyingCount: null,
      inferredTier: null,
      summary: 'Could not load repository star count.',
      source: 'none',
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (sponsorDef && sponsorshipCount !== null) {
    out['public-sponsor'] = {
      qualifyingCount: sponsorshipCount,
      inferredTier: inferTierFromCount(sponsorshipCount, sponsorDef),
      summary:
        sponsorshipCount >= 1
          ? `${sponsorshipCount} sponsorship(s) as sponsor (GraphQL viewer).`
          : 'No sponsorships as sponsor detected yet for this token.',
      source: 'graphql',
      detail: 'Public Sponsor reflects GitHub Sponsors activity; sponsor someone publicly first, then verify here.',
    };
  } else if (sponsorDef) {
    out['public-sponsor'] = {
      qualifyingCount: null,
      inferredTier: null,
      summary: 'Could not read sponsorship count (GraphQL).',
      source: 'none',
      detail: 'Ensure your token can access Sponsors data when verifying Public Sponsor.',
    };
  }

  out['pair-extraordinaire'] = {
    qualifyingCount: null,
    inferredTier: null,
    summary:
      'GitHub does not publish one API field for “co-authored commits on merged pull requests”.',
    source: 'none',
    detail: `Compare your profile badge to local progress. Rules: ${GITHUB_ACHIEVEMENTS_COMMUNITY}`,
  };

  out['galaxy-brain'] = {
    qualifyingCount: null,
    inferredTier: null,
    summary: 'No public API exposes your Discussion “accepted answers” total for achievements.',
    source: 'none',
    detail: `Use your profile or History from this app. Community: ${GITHUB_ACHIEVEMENTS_COMMUNITY}`,
  };

  out['quickdraw'] = {
    qualifyingCount: null,
    inferredTier: null,
    summary: 'No bulk API for “issues closed within 5 minutes of opening”.',
    source: 'none',
    detail: 'Confirm Quickdraw on your GitHub profile.',
  };

  out['yolo'] = {
    qualifyingCount: null,
    inferredTier: null,
    summary: 'No API lists PRs merged without review for achievement scoring.',
    source: 'none',
    detail: 'Confirm YOLO on your GitHub profile.',
  };

  return out;
}
