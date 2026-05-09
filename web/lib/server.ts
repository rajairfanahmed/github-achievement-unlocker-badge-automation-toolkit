import { existsSync, readFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import {
  ENV_PATH,
  PROJECT_ROOT,
  envFileExists,
  loadConfig,
  parseRepo,
  clearConfigCache,
} from '../../src/utils/config.js';
import { quickValidateToken } from '../../src/github/auth.js';
import { initGitHubClient, initHelperClient, getGitHubClient } from '../../src/github/client.js';
import { areDiscussionsEnabled } from '../../src/github/discussion.js';
import { ACHIEVEMENT_DEFINITIONS } from '../../src/achievements/index.js';
import { getAchievement, initDatabase, setDatabaseUser } from '../../src/db/database.js';
import type { AchievementId, TierLevel } from '../../src/types/index.js';
import { toIssue } from './errors';
import type { WebAchievement, WebHistory, WebIssue, WebRateLimit, WebStatus, TierFeasibility } from './types';

const FEASIBILITY_MARGIN = 1.15;
const FEASIBILITY_BUFFER = 15;

interface DatabaseShape {
  achievements?: Record<string, {
    id: string;
    name: string;
    tier: string;
    targetCount: number;
    completedCount: number;
    status: string;
    updatedAt?: string;
  }>;
  operations?: Array<{
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
}

export function noStoreJson<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

export function getLocalConfig() {
  clearConfigCache();
  return loadConfig(true);
}

export async function getStatus(): Promise<WebStatus> {
  const issues: WebIssue[] = [];
  const envExists = envFileExists();

  const base: WebStatus = {
    ok: false,
    envExists,
    configValid: false,
    targetRepo: null,
    username: null,
    helperConfigured: false,
    helperUsername: null,
    helperSameAsMain: false,
    helperCollaborator: null,
    repo: null,
    tokens: {
      githubToken: 'missing',
      helperToken: 'missing',
    },
    issues,
  };

  if (!envExists) {
    issues.push({
      code: 'MISSING_ENV',
      title: '.env file missing',
      message: `Expected configuration at ${ENV_PATH}.`,
      action: 'Copy .env.example to .env and add your GitHub tokens.',
      severity: 'error',
    });
    return base;
  }

  let config;
  try {
    config = getLocalConfig();
    base.configValid = true;
    base.targetRepo = config.targetRepo;
    base.helperConfigured = Boolean(config.helperToken);
    base.tokens.githubToken = config.githubToken ? 'present' : 'missing';
    base.tokens.helperToken = config.helperToken ? 'present' : 'missing';
  } catch (error) {
    issues.push(toIssue(error, 'Configuration is invalid'));
    return base;
  }

  try {
    initGitHubClient(config);
    const mainUser = await quickValidateToken(config.githubToken);
    base.username = mainUser.login;

    initGitHubClient(config);
    const { owner, repo } = parseRepo(config.targetRepo);
    const repoInfo = await getGitHubClient().getRepository(owner, repo);
    const hasDiscussions = await areDiscussionsEnabled(owner, repo);
    base.repo = {
      owner: repoInfo.owner,
      name: repoInfo.repo,
      fullName: repoInfo.fullName,
      defaultBranch: repoInfo.defaultBranch,
      hasWriteAccess: repoInfo.permissions.push,
      hasDiscussions,
    };

    if (!repoInfo.permissions.push) {
      issues.push({
        code: 'NO_WRITE_ACCESS',
        title: 'Main account cannot write to target repository',
        message: `${mainUser.login} does not have push access to ${config.targetRepo}.`,
        action: 'Use a repository owned by the main account or grant write access.',
        severity: 'error',
      });
    }

    if (config.helperToken) {
      try {
        const helperUser = await quickValidateToken(config.helperToken);
        base.helperUsername = helperUser.login;
        base.helperSameAsMain = helperUser.login === mainUser.login;
        initGitHubClient(config);
        initHelperClient(config.helperToken);

        if (base.helperSameAsMain) {
          issues.push({
            code: 'HELPER_SAME_AS_MAIN',
            title: 'Helper token belongs to the main account',
            message: 'Galaxy Brain and YOLO need a second GitHub account.',
            action: 'Generate HELPER_TOKEN while logged in as the helper account.',
            severity: 'error',
          });
        }

        base.helperCollaborator = await getGitHubClient().isCollaborator(owner, repo, helperUser.login);
        if (!base.helperCollaborator) {
          issues.push({
            code: 'HELPER_NOT_COLLABORATOR',
            title: 'Helper account lacks repository access',
            message: `${helperUser.login} is not a collaborator on ${config.targetRepo}.`,
            action: 'Invite the helper account to the target repository with write access.',
            severity: 'warning',
          });
        }
      } catch (error) {
        issues.push(toIssue(error, 'Helper token validation failed'));
      }
    } else {
      issues.push({
        code: 'HELPER_MISSING',
        title: 'Helper account not configured',
        message: 'Galaxy Brain and YOLO require a second GitHub account token.',
        action: 'Add HELPER_TOKEN from the helper account to .env.',
        severity: 'warning',
      });
    }

    if (!hasDiscussions) {
      issues.push({
        code: 'DISCUSSIONS_DISABLED',
        title: 'Discussions are disabled',
        message: `${config.targetRepo} does not report Discussions as enabled.`,
        action: 'Enable Discussions in repository Settings > Features.',
        severity: 'warning',
      });
    }

    base.ok = base.configValid && Boolean(base.username) && Boolean(base.repo?.hasWriteAccess) && !base.helperSameAsMain;
    return base;
  } catch (error) {
    issues.push(toIssue(error, 'GitHub status check failed'));
    return base;
  }
}

export async function getRateLimit(): Promise<WebRateLimit> {
  try {
    const config = getLocalConfig();
    initGitHubClient(config);
    const rate = await getGitHubClient().getRateLimit();
    const resetInSeconds = Math.max(0, Math.ceil((rate.reset.getTime() - Date.now()) / 1000));
    const state = rate.remaining <= 10 ? 'error' : rate.remaining <= 50 ? 'warning' : 'ok';

    return {
      ok: true,
      state,
      limit: rate.limit,
      remaining: rate.remaining,
      used: rate.used,
      resetAt: rate.reset.toISOString(),
      resetInSeconds,
      message: state === 'ok'
        ? 'GitHub API limit is healthy.'
        : state === 'warning'
          ? 'GitHub API limit is getting low.'
          : 'GitHub API limit is too low for a safe run.',
    };
  } catch (error) {
    const issue = toIssue(error, 'Rate limit check failed');
    return {
      ok: false,
      state: 'unknown',
      limit: null,
      remaining: null,
      used: null,
      resetAt: null,
      resetInSeconds: null,
      message: `${issue.title}: ${issue.message}`,
    };
  }
}

export async function getAchievementsForWeb(): Promise<{ achievements: WebAchievement[]; status: WebStatus }> {
  const status = await getStatus();
  let rate: WebRateLimit | null = null;
  try {
    rate = await getRateLimit();
  } catch {
    rate = null;
  }

  if (status.username) {
    setDatabaseUser(status.username);
    initDatabase();
  }

  const achievements = ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const requiresHelper = definition.id === 'galaxy-brain' || definition.id === 'yolo';
    const requiresDiscussions = definition.id === 'galaxy-brain';
    const requiresRepoWrite = definition.requiresRepoWrite !== false;
    const unavailableReasons: string[] = [];

    if (!definition.automatable) {
      if (definition.id === 'arctic-code-vault-contributor' || definition.id === 'mars-2020-contributor') {
        unavailableReasons.push('Historical achievement — GitHub no longer awards this badge.');
      } else {
        unavailableReasons.push('Automation is not implemented yet for this achievement.');
      }
    }

    if (requiresHelper && !status.helperConfigured) {
      unavailableReasons.push('Requires HELPER_TOKEN from a second GitHub account.');
    }
    if (requiresHelper && status.helperSameAsMain) {
      unavailableReasons.push('Helper account must be different from the main account.');
    }
    if (requiresHelper && status.helperCollaborator === false) {
      unavailableReasons.push('Helper account needs collaborator access.');
    }
    if (requiresDiscussions && !status.repo?.hasDiscussions) {
      unavailableReasons.push('Requires repository Discussions to be enabled.');
    }
    if (requiresRepoWrite && !status.repo?.hasWriteAccess) {
      unavailableReasons.push('Main account needs write access to the target repository.');
    }

    let progress: WebAchievement['progress'] = null;
    let record: ReturnType<typeof getAchievement> = null;
    try {
      record = getAchievement(definition.id);
      if (record) {
        progress = {
          completedCount: Math.min(Math.max(record.completedCount, 0), record.targetCount),
          targetCount: record.targetCount,
          status: record.status,
          tier: record.tier,
        };
      }
    } catch {
      progress = null;
    }

    const remainingCore = rate?.remaining;
    const tierFeasibility: TierFeasibility[] = definition.tiers.map((tier) => {
      const completedRaw = record ? Math.min(Math.max(record.completedCount, 0), tier.targetCount) : 0;
      const remainingOps = Math.max(0, tier.targetCount - completedRaw);
      const estimatedCallsForRemaining = Math.ceil(
        remainingOps * definition.estimatedRestCallsPerOperation * FEASIBILITY_MARGIN
      ) + FEASIBILITY_BUFFER;
      const canLikelyCompleteRun =
        remainingCore == null || estimatedCallsForRemaining <= remainingCore;

      return {
        level: tier.level,
        targetCount: tier.targetCount,
        remainingOperations: remainingOps,
        estimatedCallsForRemaining,
        canLikelyCompleteRun,
      };
    });

    const available =
      definition.automatable && unavailableReasons.length === 0;

    return {
      ...definition,
      requiresHelper,
      requiresDiscussions,
      available,
      unavailableReasons,
      progress,
      tierFeasibility,
    };
  });

  return { achievements, status };
}

function getDatabasePath(username: string | null): string {
  return join(PROJECT_ROOT, username ? `achievements-data-${username}.json` : 'achievements-data.json');
}

function isDatabaseShape(value: unknown): value is DatabaseShape {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'achievements' in value &&
    'operations' in value
  );
}

export async function getHistory(): Promise<WebHistory> {
  const status = await getStatus();
  const databasePath = getDatabasePath(status.username);

  if (!existsSync(databasePath)) {
    return {
      ok: true,
      username: status.username,
      databasePath,
      achievements: [],
      operations: [],
      error: null,
    };
  }

  try {
    const raw = readFileSync(databasePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (!isDatabaseShape(parsed)) {
      const backupPath = `${databasePath}.invalid-${Date.now()}.bak`;
      copyFileSync(databasePath, backupPath);
      return {
        ok: false,
        username: status.username,
        databasePath,
        achievements: [],
        operations: [],
        error: `History file has an unexpected shape. A backup was created at ${backupPath}.`,
      };
    }

    return {
      ok: true,
      username: status.username,
      databasePath,
      achievements: Object.values(parsed.achievements || {}),
      operations: (parsed.operations || []).slice(-100).reverse(),
      error: null,
    };
  } catch (error) {
    const backupPath = `${databasePath}.invalid-${Date.now()}.bak`;
    try {
      copyFileSync(databasePath, backupPath);
    } catch {
      // Ignore backup failure; report original read/parse problem below.
    }

    return {
      ok: false,
      username: status.username,
      databasePath,
      achievements: [],
      operations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function assertSelectionInput(value: unknown): Array<{ id: AchievementId; tier: TierLevel; targetCount: number }> {
  if (!value || typeof value !== 'object' || !('selections' in value)) {
    throw new Error('Expected request body with selections array.');
  }

  const selections = (value as { selections?: unknown }).selections;
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('Select at least one achievement to run.');
  }

  return selections.map((selection) => {
    if (!selection || typeof selection !== 'object') {
      throw new Error('Invalid selection payload.');
    }

    const candidate = selection as { id?: unknown; tier?: unknown; targetCount?: unknown };
    if (typeof candidate.id !== 'string' || typeof candidate.tier !== 'string' || typeof candidate.targetCount !== 'number') {
      throw new Error('Each selection must include id, tier, and targetCount.');
    }

    const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === candidate.id);
    const tier = definition?.tiers.find((item) => item.level === candidate.tier);
    if (!definition || !tier) {
      throw new Error(`Unsupported achievement selection: ${candidate.id}/${candidate.tier}`);
    }
    if (!definition.automatable) {
      throw new Error(`Achievement "${candidate.id}" cannot be run automatically.`);
    }

    return {
      id: candidate.id as AchievementId,
      tier: candidate.tier as TierLevel,
      targetCount: tier.targetCount,
    };
  });
}
