/**
 * Pull Request operations for GitHub API
 */

import type { PRInfo } from '../types/index.js';
import { getGitHubClient } from './client.js';
import { PRAlreadyMergedError, MergeConflictError, GitHubAPIError } from '../utils/errors.js';
import { delay } from '../utils/timing.js';
import logger from '../utils/logger.js';

// Merge methods
export type MergeMethod = 'merge' | 'squash' | 'rebase';

/**
 * Create a pull request
 */
export async function createPR(
  owner: string,
  repo: string,
  options: {
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }
): Promise<PRInfo> {
  const client = getGitHubClient();

  logger.debug(`Creating PR: ${options.title}`);

  const response = await client.api.pulls.create({
    owner,
    repo,
    title: options.title,
    body: options.body || '',
    head: options.head,
    base: options.base,
    draft: options.draft || false,
  });

  logger.verbose(`Created PR #${response.data.number}`);

  return {
    number: response.data.number,
    title: response.data.title,
    url: response.data.html_url,
    state: response.data.state as 'open' | 'closed',
    merged: response.data.merged,
    headBranch: response.data.head.ref,
    baseBranch: response.data.base.ref,
  };
}

/**
 * Get pull request info
 */
export async function getPR(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRInfo> {
  const client = getGitHubClient();

  const response = await client.api.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    number: response.data.number,
    title: response.data.title,
    url: response.data.html_url,
    state: response.data.state as 'open' | 'closed',
    merged: response.data.merged,
    headBranch: response.data.head.ref,
    baseBranch: response.data.base.ref,
  };
}

/**
 * Merge a pull request
 */
export async function mergePR(
  owner: string,
  repo: string,
  pullNumber: number,
  options: {
    method?: MergeMethod;
    commitTitle?: string;
    commitMessage?: string;
  } = {}
): Promise<void> {
  const client = getGitHubClient();

  logger.debug(`Merging PR #${pullNumber}`);

  // Check if already merged
  const pr = await getPR(owner, repo, pullNumber);
  if (pr.merged) {
    throw new PRAlreadyMergedError(pullNumber);
  }

  if (pr.state === 'closed') {
    throw new GitHubAPIError(422, `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, 'PR is closed');
  }

  try {
    await client.api.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: options.method || 'squash',
      commit_title: options.commitTitle,
      commit_message: options.commitMessage,
    });

    logger.verbose(`Merged PR #${pullNumber}`);
  } catch (error) {
    const anyError = error as { status?: number; message?: string };

    // Check for merge conflict
    if (anyError.status === 405 || (anyError.message && anyError.message.includes('conflict'))) {
      throw new MergeConflictError(pullNumber);
    }

    // Check if already merged (race condition)
    if (anyError.status === 422 && anyError.message?.includes('already been merged')) {
      throw new PRAlreadyMergedError(pullNumber);
    }

    throw error;
  }
}

/**
 * Create a PR and immediately merge it
 */
export async function createAndMergePR(
  owner: string,
  repo: string,
  options: {
    title: string;
    body?: string;
    head: string;
    base: string;
    mergeMethod?: MergeMethod;
    delayBeforeMerge?: number;
  }
): Promise<PRInfo> {
  // Create the PR
  const pr = await createPR(owner, repo, {
    title: options.title,
    body: options.body,
    head: options.head,
    base: options.base,
  });

  // Small delay to ensure PR is ready for merge
  if (options.delayBeforeMerge) {
    await delay(options.delayBeforeMerge);
  }

  // Merge the PR. GitHub can briefly report a new PR as not mergeable while
  // it calculates mergeability or after another automated PR updates the base.
  try {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await mergePR(owner, repo, pr.number, {
          method: options.mergeMethod || 'squash',
        });
        break;
      } catch (error) {
        if (error instanceof MergeConflictError && attempt < maxAttempts) {
          await delay(1000 * attempt);
          continue;
        }
        throw error;
      }
    }

    // Update PR info
    return {
      ...pr,
      state: 'closed',
      merged: true,
    };
  } catch (error) {
    if (error instanceof PRAlreadyMergedError) {
      return {
        ...pr,
        state: 'closed',
        merged: true,
      };
    }
    throw error;
  }
}

/**
 * Close a pull request without merging
 */
export async function closePR(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<void> {
  const client = getGitHubClient();

  logger.debug(`Closing PR #${pullNumber}`);

  await client.api.pulls.update({
    owner,
    repo,
    pull_number: pullNumber,
    state: 'closed',
  });

  logger.verbose(`Closed PR #${pullNumber}`);
}

/**
 * List open PRs from a specific branch prefix
 */
export async function listOpenPRsWithPrefix(
  owner: string,
  repo: string,
  branchPrefix: string
): Promise<PRInfo[]> {
  const client = getGitHubClient();

  const prs: PRInfo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await client.api.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: perPage,
      page,
    });

    const matchingPRs = response.data
      .filter(pr => pr.head.ref.startsWith(branchPrefix))
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state as 'open' | 'closed',
        merged: false, // List endpoint doesn't include merged status
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
      }));

    prs.push(...matchingPRs);

    if (response.data.length < perPage) {
      break;
    }

    page++;
  }

  return prs;
}

/**
 * Close all open PRs with a branch prefix
 */
export async function closeAllPRsWithPrefix(
  owner: string,
  repo: string,
  branchPrefix: string
): Promise<number> {
  const prs = await listOpenPRsWithPrefix(owner, repo, branchPrefix);
  let closed = 0;

  for (const pr of prs) {
    try {
      await closePR(owner, repo, pr.number);
      closed++;
    } catch (error) {
      logger.warn(`Failed to close PR #${pr.number}: ${error}`);
    }
  }

  return closed;
}

/**
 * Check if a PR is mergeable
 */
export async function isPRMergeable(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<boolean> {
  const client = getGitHubClient();

  const response = await client.api.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return response.data.mergeable === true;
}

/**
 * Request a review from a user
 */
export async function requestReview(
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[]
): Promise<void> {
  const client = getGitHubClient();

  logger.debug(`Requesting review from ${reviewers.join(', ')} on PR #${pullNumber}`);

  await client.api.pulls.requestReviewers({
    owner,
    repo,
    pull_number: pullNumber,
    reviewers,
  });

  logger.verbose(`Requested review on PR #${pullNumber}`);
}

export default {
  createPR,
  getPR,
  mergePR,
  createAndMergePR,
  closePR,
  listOpenPRsWithPrefix,
  closeAllPRsWithPrefix,
  isPRMergeable,
  requestReview,
};
