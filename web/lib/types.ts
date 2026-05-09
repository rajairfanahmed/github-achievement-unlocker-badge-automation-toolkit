import type { AchievementId, TierLevel } from '../../src/types/index.js';

export type HealthState = 'ok' | 'warning' | 'error' | 'unknown';

export interface WebIssue {
  code: string;
  title: string;
  message: string;
  action: string;
  severity: 'info' | 'warning' | 'error';
}

export interface WebStatus {
  ok: boolean;
  envExists: boolean;
  configValid: boolean;
  targetRepo: string | null;
  username: string | null;
  helperConfigured: boolean;
  helperUsername: string | null;
  helperSameAsMain: boolean;
  helperCollaborator: boolean | null;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    hasWriteAccess: boolean;
    hasDiscussions: boolean;
  } | null;
  tokens: {
    githubToken: 'missing' | 'present';
    helperToken: 'missing' | 'present';
  };
  issues: WebIssue[];
}

export interface WebRateLimit {
  ok: boolean;
  state: HealthState;
  limit: number | null;
  remaining: number | null;
  used: number | null;
  resetAt: string | null;
  resetInSeconds: number | null;
  message: string;
}

export interface TierFeasibility {
  level: TierLevel;
  targetCount: number;
  remainingOperations: number;
  estimatedCallsForRemaining: number;
  canLikelyCompleteRun: boolean;
}

export interface WebAchievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  tiers: Array<{
    level: TierLevel;
    displayName: string;
    targetCount: number;
  }>;
  estimatedTimePerUnit: number;
  estimatedRestCallsPerOperation: number;
  automatable: boolean;
  docsUrl?: string;
  requiresHelper: boolean;
  requiresDiscussions: boolean;
  available: boolean;
  unavailableReasons: string[];
  progress: {
    completedCount: number;
    targetCount: number;
    status: string;
    tier?: TierLevel;
  } | null;
  /** Per-tier feasibility vs current GitHub REST core remaining (conservative estimate). */
  tierFeasibility: TierFeasibility[];
}

export interface WebHistory {
  ok: boolean;
  username: string | null;
  databasePath: string;
  achievements: Array<{
    id: string;
    name: string;
    tier: string;
    targetCount: number;
    completedCount: number;
    status: string;
    updatedAt?: string;
  }>;
  operations: Array<{
    achievementId: string;
    operationNumber: number;
    status: string;
    prNumber?: number;
    branchName?: string;
    issueNumber?: number;
    discussionId?: string;
    errorMessage?: string;
    updatedAt?: string;
  }>;
  error: string | null;
}

export interface RunSelection {
  id: AchievementId;
  tier: TierLevel;
  targetCount: number;
}

export interface WebJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** User asked to stop; runner checks between achievement workflows. */
  cancelRequested?: boolean;
  startedAt: string;
  finishedAt: string | null;
  selections: RunSelection[];
  progress: Record<string, {
    current: number;
    total: number;
    operation: string;
    status: string;
  }>;
  logs: string[];
  errors: string[];
  results: unknown[];
}
