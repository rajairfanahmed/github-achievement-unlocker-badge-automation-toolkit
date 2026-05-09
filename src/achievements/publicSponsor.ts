/**
 * Public Sponsor — polls until the viewer has at least one sponsorship as sponsor (GraphQL).
 * Creating a sponsorship requires GitHub Sponsors checkout outside this tool; run verification after sponsoring.
 */

import { BaseAchievement } from './base.js';
import type {
  AppConfig,
  ExecutionResult,
  OperationType,
  TierLevel,
} from '../types/index.js';
import { getGitHubClient } from '../github/client.js';
import {
  upsertAchievement,
  updateAchievementStatus,
  updateAchievementProgress,
} from '../db/database.js';
import { delayUnlessCancelled, isRunCancelled } from '../utils/runCancellation.js';
import logger from '../utils/logger.js';

const MAX_POLL_ITERATIONS = 480;
const SPONSOR_POLL_MS = 30_000;

export class PublicSponsorAchievement extends BaseAchievement {
  constructor(config: AppConfig, tier: TierLevel, targetCount: number) {
    super(config, 'public-sponsor', 'Public Sponsor', tier, targetCount);
  }

  protected getOperationType(): OperationType {
    return 'poll_sponsorship';
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
    let lastReportedCompleted = 0;

    try {
      for (let iter = 0; iter < MAX_POLL_ITERATIONS; iter++) {
        if (isRunCancelled()) {
          return {
            achievementId: this.achievementId,
            tier: this.tier,
            success: false,
            cancelled: true,
            completedOperations: lastReportedCompleted,
            totalOperations: this.targetCount,
            errors: [],
            duration: Date.now() - startTime,
            prNumbers: [],
          };
        }

        const count = await client.getSponsorshipsAsSponsorCount();

        if (count === null) {
          errors.push(
            'Could not read sponsorships (GraphQL failed or token lacks access). Complete sponsorship at https://github.com/sponsors then retry.'
          );
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

        const completed = Math.min(count, this.targetCount);
        lastReportedCompleted = completed;
        updateAchievementProgress(this.achievementId, completed);
        this.reportProgress(
          completed,
          `Sponsorships as sponsor: ${count} (need ${this.targetCount})`
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
          this.reportProgress(this.targetCount, 'Public sponsor verified', 'completed');
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

        logger.info(`Public Sponsor poll ${iter + 1}/${MAX_POLL_ITERATIONS}`);
        const stopWaiting = await delayUnlessCancelled(SPONSOR_POLL_MS, 500);
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

      errors.push(
        `No qualifying sponsorship detected after ${MAX_POLL_ITERATIONS} polls. Sponsor someone publicly on GitHub Sponsors, then run again.`
      );
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
