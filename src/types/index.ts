/**
 * Type definitions for GitHub Achievements Manager
 */

// Achievement tier levels
export type TierLevel = 'default' | 'bronze' | 'silver' | 'gold';

// Achievement identifiers
export type AchievementId =
  | 'pair-extraordinaire'
  | 'pull-shark'
  | 'quickdraw'
  | 'galaxy-brain'
  | 'yolo'
  | 'starstruck'
  | 'public-sponsor'
  | 'heart-on-your-sleeve'
  | 'open-sourcerer'
  | 'arctic-code-vault-contributor'
  | 'mars-2020-contributor';

// Operation status tracking
export type OperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

// Operation types for different achievements
export type OperationType =
  | 'create_branch'
  | 'create_commit'
  | 'create_pr'
  | 'merge_pr'
  | 'delete_branch'
  | 'create_issue'
  | 'close_issue'
  | 'create_discussion'
  | 'create_answer'
  | 'mark_accepted'
  | 'merge_own_pr'
  | 'poll_stars'
  | 'poll_sponsorship'
  | 'catalog_only';

// Tier configuration with target counts
export interface TierConfig {
  level: TierLevel;
  targetCount: number;
  displayName: string;
}

/**
 * Live counts from GitHub public APIs, mapped to the same tier thresholds as achievement definitions in this app.
 * GitHub does not publish official “achievement tier” API fields; inferredTier is derived from published thresholds.
 */
export interface GitHubLiveInsight {
  qualifyingCount: number | null;
  inferredTier: TierLevel | null;
  summary: string;
  source: 'search' | 'rest' | 'graphql' | 'none';
  detail?: string;
}

// Achievement definition
export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  tiers: TierConfig[];
  estimatedTimePerUnit: number; // milliseconds per operation
  /** Rough GitHub REST calls per workflow unit (operation or poll cycle); used for dashboard feasibility hints */
  estimatedRestCallsPerOperation: number;
  /** If false, workflows are not implemented — UI shows catalog-only / planned */
  automatable: boolean;
  /** Optional docs link for help affordance */
  docsUrl?: string;
  /** If false, main-account push access to TARGET_REPO is not required (e.g. sponsorship verification). Default true. */
  requiresRepoWrite?: boolean;
}

// User-selected achievement with tier
export interface SelectedAchievement {
  id: AchievementId;
  tier: TierLevel;
  targetCount: number;
}

// Application configuration loaded from .env
export interface AppConfig {
  // Required
  githubToken: string;
  githubUsername: string;
  targetRepo: string;

  // Optional with defaults
  coauthorName: string;
  coauthorEmail: string;
  branchPrefix: string;
  delayMs: number;
  batchSize: number;
  verbose: boolean;
  testMode: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Concurrency settings
  concurrency: number;           // Parallel operations per achievement (default: 3)
  maxRequestsPerMinute: number;  // Rate limit (default: 70, under GitHub's 80 limit)

  // Optional: Helper account for Galaxy Brain (creates questions for main account to answer)
  helperToken?: string;
  helperUsername?: string;
}

// GitHub repository info
export interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  hasDiscussions: boolean;
  /** Present when fetched via repos.get — used for Starstruck progress */
  stargazersCount?: number;
  permissions: {
    push: boolean;
    pull: boolean;
    admin: boolean;
  };
}

// GitHub user info
export interface UserInfo {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string;
}

// Pull request info
export interface PRInfo {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  merged: boolean;
  headBranch: string;
  baseBranch: string;
}

// Branch info
export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
}

// Commit info
export interface CommitInfo {
  sha: string;
  message: string;
  url: string;
}

// Issue info
export interface IssueInfo {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
}

// Discussion info
export interface DiscussionInfo {
  id: string;
  number: number;
  title: string;
  url: string;
  category: {
    id: string;
    name: string;
  };
}

// Operation record for database
export interface OperationRecord {
  id?: number;
  achievementId: AchievementId;
  operationType: OperationType;
  operationNumber: number;
  status: OperationStatus;
  prNumber?: number;
  branchName?: string;
  commitSha?: string;
  issueNumber?: number;
  discussionId?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Achievement progress record
export interface AchievementRecord {
  id: AchievementId;
  name: string;
  tier: TierLevel;
  targetCount: number;
  completedCount: number;
  status: OperationStatus;
  createdAt?: string;
  updatedAt?: string;
}

// Progress update for UI
export interface ProgressUpdate {
  achievementId: AchievementId;
  current: number;
  total: number;
  currentOperation: string;
  status: OperationStatus;
  estimatedTimeRemaining?: number;
}

// Execution result for an achievement
export interface ExecutionResult {
  achievementId: AchievementId;
  tier: TierLevel;
  success: boolean;
  /** Web dashboard stopped the job mid-workflow (cooperative exit). */
  cancelled?: boolean;
  completedOperations: number;
  totalOperations: number;
  errors: string[];
  duration: number;
  prNumbers: number[];
}

// Summary of all execution results
export interface ExecutionSummary {
  totalAchievements: number;
  successfulAchievements: number;
  failedAchievements: number;
  totalOperations: number;
  completedOperations: number;
  totalDuration: number;
  results: ExecutionResult[];
}

// CLI options from commander
export interface CLIOptions {
  achievement?: AchievementId;
  tier?: TierLevel;
  dryRun?: boolean;
  verbose?: boolean;
  resume?: boolean;
  setup?: boolean;
  force?: boolean;
}

// Setup wizard answers
export interface SetupAnswers {
  githubToken: string;
  targetRepo: string;
  coauthorName: string;
  coauthorEmail: string;
  branchPrefix: string;
  delayMs: number;
  helperToken?: string;
}

// Rate limit info
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

// Cleanup task for graceful shutdown
export interface CleanupTask {
  type: 'branch' | 'pr';
  identifier: string;
  repoOwner: string;
  repoName: string;
}
