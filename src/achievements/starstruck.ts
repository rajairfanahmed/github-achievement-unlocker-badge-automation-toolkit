/**
 * Starstruck — progress tracks repository stargazers_count on TARGET_REPO.
 * This workflow polls GitHub and stars with the main + helper tokens when not already starred.
 * Many tiers require stars from additional accounts; raise TARGET_REPO visibility or poll longer as needed.
 */

import { BaseAchievement } from './base.js';
import type {
  AppConfig,
  ExecutionResult,
  OperationType,
  TierLevel,
} from '../types/index.js';
import { getGitHubClient, getHelperClient } from '../github/client.js';
import {
  upsertAchievement,
  updateAchievementStatus,
  updateAchievementProgress,
} from '../db/database.js';
import { delayUnlessCancelled, isRunCancelled } from '../utils/runCancellation.js';
import logger from '../utils/logger.js';

const MAX_POLL_ITERATIONS = 360;

export class StarstruckAchievement extends BaseAchievement {
  constructor(config: AppConfig, tier: TierLevel, targetCount: number) {
    super(config, 'starstruck', 'Starstruck', tier, targetCount);
  }

  protected getOperationType(): OperationType {
    return 'poll_stars';
  }

  protected async executeOperation(): Promise<{
    prNumber?: number;
    branchName?: string;
    commitSha?: string;
    issueNumber?: number;
    discussionId?: string;
  }> {
    return {};
  }

  override async execute(): Promise<ExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    upsertAchievement(this.achievementId, this.achievementName, this.tier, this.targetCount);
    updateAchievementStatus(this.achievementId, 'in_progress');

    const client = getGitHubClient();
    const helper = getHelperClient();
    const pollMs = Math.max(this.config.delayMs * 15, 15_000);
    let lastCompleted = 0;

    try {
      for (let iter = 0; iter < MAX_POLL_ITERATIONS; iter++) {
        if (isRunCancelled()) {
          return {
            achievementId: this.achievementId,
            tier: this.tier,
            success: false,
            cancelled: true,
            completedOperations: lastCompleted,
            totalOperations: this.targetCount,
            errors: [],
            duration: Date.now() - startTime,
            prNumbers: [],
          };
        }

        const repoInfo = await client.getRepository(this.owner, this.repo);
        const count = repoInfo.stargazersCount ?? 0;
        const completed = Math.min(count, this.targetCount);
        lastCompleted = completed;
        updateAchievementProgress(this.achievementId, completed);
        this.reportProgress(
          completed,
          `${count.toLocaleString()} stars · target ${this.targetCount.toLocaleString()}`
        );

        if (isRunCancelled()) {
          return {
            achievementId: this.achievementId,
            tier: this.tier,
            success: false,
            cancelled: true,
            completedOperations: completed,
            totalOperations: this.targetCount,
            errors: [],
            duration: Date.now() - startTime,
            prNumbers: [],
          };
        }

        if (count >= this.targetCount) {
          updateAchievementStatus(this.achievementId, 'completed');
          this.reportProgress(this.targetCount, 'Tier target reached', 'completed');
          return {
            achievementId: this.achievementId,
            tier: this.tier,
            success: true,
            completedOperations: this.targetCount,
            totalOperations: this.targetCount,
            errors: [],
            duration: Date.now() - startTime,
            prNumbers: [],
          };
        }

        if (!(await client.isRepoStarredByAuthenticatedUser(this.owner, this.repo))) {
          await client.starRepo(this.owner, this.repo);
        }
        if (helper && !(await helper.isRepoStarredByAuthenticatedUser(this.owner, this.repo))) {
          await helper.starRepo(this.owner, this.repo);
        }

        logger.info(`Starstruck poll ${iter + 1}/${MAX_POLL_ITERATIONS}; waiting ${pollMs}ms`);
        const stopWaiting = await delayUnlessCancelled(pollMs);
        if (stopWaiting) {
          return {
            achievementId: this.achievementId,
            tier: this.tier,
            success: false,
            cancelled: true,
            completedOperations: completed,
            totalOperations: this.targetCount,
            errors: [],
            duration: Date.now() - startTime,
            prNumbers: [],
          };
        }
      }

      const final = await client.getRepository(this.owner, this.repo);
      const finalCount = final.stargazersCount ?? 0;
      errors.push(
        `Stopped after ${MAX_POLL_ITERATIONS} polls (${finalCount} stars). Add more stargazers or run again later.`
      );
      updateAchievementProgress(this.achievementId, Math.min(finalCount, this.targetCount));
      updateAchievementStatus(this.achievementId, 'failed');

      return {
        achievementId: this.achievementId,
        tier: this.tier,
        success: false,
        completedOperations: Math.min(finalCount, this.targetCount),
        totalOperations: this.targetCount,
        errors,
        duration: Date.now() - startTime,
        prNumbers: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      updateAchievementStatus(this.achievementId, 'failed');
      return {
        achievementId: this.achievementId,
        tier: this.tier,
        success: false,
        completedOperations: 0,
        totalOperations: this.targetCount,
        errors,
        duration: Date.now() - startTime,
        prNumbers: [],
      };
    }
  }
}
