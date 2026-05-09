/**
 * GitHub API client wrapper with error handling and rate limiting
 */

import { Octokit } from '@octokit/rest';
import type { AppConfig, RateLimitInfo, UserInfo, RepoInfo } from '../types/index.js';
import {
  AuthenticationError,
  RateLimitError,
  RepositoryNotFoundError,
  NoWriteAccessError,
  GitHubAPIError,
  NetworkError,
  wrapError,
} from '../utils/errors.js';
import { retry, delay } from '../utils/timing.js';
import logger from '../utils/logger.js';

// Singleton instances
let clientInstance: GitHubClient | null = null;
let helperClientInstance: GitHubClient | null = null;

export class GitHubClient {
  private octokit: Octokit;
  private config: AppConfig;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken,
      userAgent: 'github-achievements-manager/1.0.0',
      request: {
        timeout: 30000,
      },
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  }

  /**
   * Get the underlying Octokit instance
   */
  get api(): Octokit {
    return this.octokit;
  }

  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimit(headers: Record<string, unknown>): void {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const used = headers['x-ratelimit-used'];

    if (limit !== undefined && remaining !== undefined && reset !== undefined) {
      this.rateLimitInfo = {
        limit: Number(limit),
        remaining: Number(remaining),
        reset: new Date(Number(reset) * 1000),
        used: Number(used) || 0,
      };

      // Log if running low
      if (this.rateLimitInfo.remaining < 50) {
        logger.warn(`Rate limit low: ${this.rateLimitInfo.remaining} remaining`);
      }
    }
  }

  /**
   * Handle API errors and wrap them appropriately
   */
  private handleError(error: unknown, endpoint: string): never {
    if (error instanceof Error) {
      const anyError = error as { status?: number; response?: { headers?: Record<string, unknown> } };

      // Check for rate limiting
      if (anyError.status === 403 && anyError.response?.headers) {
        const remaining = anyError.response.headers['x-ratelimit-remaining'];
        if (remaining === '0' || remaining === 0) {
          const reset = anyError.response.headers['x-ratelimit-reset'];
          const resetTime = new Date(Number(reset) * 1000);
          throw new RateLimitError(resetTime, 0);
        }
      }

      // Authentication error
      if (anyError.status === 401) {
        throw new AuthenticationError();
      }

      // Not found
      if (anyError.status === 404) {
        if (endpoint.includes('/repos/')) {
          const match = endpoint.match(/\/repos\/([^/]+\/[^/]+)/);
          if (match) {
            throw new RepositoryNotFoundError(match[1]);
          }
        }
        throw new GitHubAPIError(404, endpoint, 'Resource not found');
      }

      // Network errors
      if (error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('network')) {
        throw new NetworkError(error.message);
      }

      // Generic API error
      if (anyError.status) {
        throw new GitHubAPIError(anyError.status, endpoint, error.message);
      }
    }

    throw wrapError(error);
  }

  /**
   * Make an API request with retry logic
   */
  async request<T>(
    operation: () => Promise<{ data: T; headers: Record<string, unknown> }>
  ): Promise<T> {
    const result = await retry(
      async () => {
        try {
          const response = await operation();
          this.updateRateLimit(response.headers as Record<string, unknown>);
          return response.data;
        } catch (error) {
          // Check for rate limit and wait if needed
          if (error instanceof RateLimitError) {
            const waitMs = error.resetTime.getTime() - Date.now();
            if (waitMs > 0 && waitMs < 60000) {
              logger.info(`Rate limited, waiting ${Math.ceil(waitMs / 1000)}s...`);
              await delay(waitMs + 1000);
              throw error; // Retry after waiting
            }
          }
          throw error;
        }
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        shouldRetry: (error) => {
          if (error instanceof RateLimitError) return true;
          if (error instanceof NetworkError) return true;
          if (error instanceof GitHubAPIError && error.statusCode >= 500) return true;
          return false;
        },
        onRetry: (attempt, error) => {
          logger.debug(`Retrying request (attempt ${attempt}): ${error}`);
        },
      }
    );

    return result;
  }

  /**
   * Validate the token and get authenticated user
   */
  async validateToken(): Promise<UserInfo> {
    try {
      const response = await this.octokit.users.getAuthenticated();
      this.updateRateLimit(response.headers as Record<string, unknown>);

      return {
        login: response.data.login,
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        avatarUrl: response.data.avatar_url,
      };
    } catch (error) {
      this.handleError(error, '/user');
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<RepoInfo> {
    try {
      const response = await this.octokit.repos.get({ owner, repo });
      this.updateRateLimit(response.headers as Record<string, unknown>);

      return {
        owner: response.data.owner.login,
        repo: response.data.name,
        fullName: response.data.full_name,
        defaultBranch: response.data.default_branch,
        hasDiscussions: response.data.has_discussions || false,
        stargazersCount: response.data.stargazers_count,
        permissions: {
          push: response.data.permissions?.push || false,
          pull: response.data.permissions?.pull || false,
          admin: response.data.permissions?.admin || false,
        },
      };
    } catch (error) {
      this.handleError(error, `/repos/${owner}/${repo}`);
    }
  }

  /**
   * Validate write access to repository
   */
  async validateWriteAccess(owner: string, repo: string): Promise<boolean> {
    const repoInfo = await this.getRepository(owner, repo);

    if (!repoInfo.permissions.push) {
      throw new NoWriteAccessError(`${owner}/${repo}`);
    }

    return true;
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    try {
      const response = await this.octokit.rateLimit.get();
      this.updateRateLimit(response.headers as Record<string, unknown>);

      const core = response.data.resources.core;

      return {
        limit: core.limit,
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        used: core.used,
      };
    } catch (error) {
      this.handleError(error, '/rate_limit');
    }
  }

  /**
   * Wait for rate limit if needed
   */
  async waitForRateLimit(minRemaining = 10): Promise<void> {
    const rateLimit = await this.getRateLimit();

    if (rateLimit.remaining <= minRemaining) {
      const waitMs = rateLimit.reset.getTime() - Date.now() + 1000;
      if (waitMs > 0) {
        logger.warn(`Rate limit low (${rateLimit.remaining}), waiting ${Math.ceil(waitMs / 1000)}s...`);
        await delay(waitMs);
      }
    }
  }

  /**
   * Check if a user is a collaborator on the repo
   */
  async isCollaborator(owner: string, repo: string, username: string): Promise<boolean> {
    try {
      await this.octokit.repos.checkCollaborator({ owner, repo, username });
      return true;
    } catch (error) {
      // 404 means not a collaborator
      return false;
    }
  }

  /**
   * Add a user as a collaborator to the repo
   */
  async addCollaborator(owner: string, repo: string, username: string): Promise<boolean> {
    try {
      await this.octokit.repos.addCollaborator({
        owner,
        repo,
        username,
        permission: 'push', // write access
      });
      return true;
    } catch (error) {
      logger.error(`Failed to add collaborator: ${error}`);
      return false;
    }
  }

  /**
   * Whether the authenticated user has starred the repository
   */
  async isRepoStarredByAuthenticatedUser(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.activity.checkRepoIsStarredByAuthenticatedUser({ owner, repo });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Star a repository
   */
  async starRepo(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.activity.starRepoForAuthenticatedUser({ owner, repo });
      return true;
    } catch (error) {
      logger.debug(`Failed to star repo: ${error}`);
      return false;
    }
  }

  /**
   * GraphQL query (Sponsors, etc.). Returns null if the request fails (e.g. missing scope).
   */
  async graphqlQuery<T>(query: string): Promise<T | null> {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.githubToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'github-achievements-manager/1.0.0',
        },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
      if (!response.ok || body.errors?.length) {
        logger.debug(`GraphQL error: ${response.status} ${JSON.stringify(body.errors)}`);
        return null;
      }
      return body.data ?? null;
    } catch (error) {
      logger.debug(`GraphQL request failed: ${error}`);
      return null;
    }
  }

  /**
   * Count of sponsorships created by the viewer (Public Sponsor achievement).
   */
  async getSponsorshipsAsSponsorCount(): Promise<number | null> {
    const query = `query { viewer { sponsorshipsAsSponsor(first: 1) { totalCount } } }`;
    type Q = { viewer: { sponsorshipsAsSponsor: { totalCount: number } | null } };
    const data = await this.graphqlQuery<Q>(query);
    if (!data?.viewer?.sponsorshipsAsSponsor) {
      return null;
    }
    return data.viewer.sponsorshipsAsSponsor.totalCount;
  }

  /**
   * Get owner and repo from config
   */
  getTargetRepo(): { owner: string; repo: string } {
    const parts = this.config.targetRepo.split('/');
    return {
      owner: parts[0],
      repo: parts[1],
    };
  }
}

/**
 * Initialize the GitHub client singleton
 */
export function initGitHubClient(config: AppConfig): GitHubClient {
  clientInstance = new GitHubClient(config);
  return clientInstance;
}

/**
 * Get the GitHub client singleton
 */
export function getGitHubClient(): GitHubClient {
  if (!clientInstance) {
    throw new Error('GitHub client not initialized. Call initGitHubClient first.');
  }
  return clientInstance;
}

/**
 * Check if client is initialized
 */
export function isClientInitialized(): boolean {
  return clientInstance !== null;
}

/**
 * Initialize the helper GitHub client for Galaxy Brain (secondary account)
 */
export function initHelperClient(token: string): GitHubClient {
  // Create a minimal config for the helper client
  const helperConfig: AppConfig = {
    githubToken: token,
    githubUsername: '',
    targetRepo: clientInstance?.getTargetRepo() ? `${clientInstance.getTargetRepo().owner}/${clientInstance.getTargetRepo().repo}` : '',
    coauthorName: 'n0',
    coauthorEmail: 'luke@u.software',
    branchPrefix: '',
    delayMs: 200,
    batchSize: 5,
    verbose: false,
    testMode: false,
    logLevel: 'info',
    concurrency: 3,
    maxRequestsPerMinute: 70,
  };
  helperClientInstance = new GitHubClient(helperConfig);
  return helperClientInstance;
}

/**
 * Get the helper GitHub client singleton (for Galaxy Brain)
 */
export function getHelperClient(): GitHubClient | null {
  return helperClientInstance;
}

/**
 * Check if helper client is initialized
 */
export function isHelperClientInitialized(): boolean {
  return helperClientInstance !== null;
}

export default GitHubClient;
