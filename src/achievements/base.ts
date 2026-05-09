/**
 * Base class for achievement implementations
 */

import type {
  AchievementId,
  TierLevel,
  AppConfig,
  ExecutionResult,
  ProgressUpdate,
  OperationStatus,
  OperationType,
} from '../types/index.js';
import { getGitHubClient } from '../github/client.js';
import { parseRepo } from '../utils/config.js';
import {
  upsertAchievement,
  getAchievement,
  updateAchievementStatus,
  updateAchievementProgress,
  incrementAchievementProgress,
  createOperation,
  updateOperation,
  getOperationsForAchievement,
  countCompletedOperations,
  resetStuckOperations,
  getCompletedOperationNumbers,
} from '../db/database.js';
import { runWithConcurrency } from '../utils/timing.js';
import { getRateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';
import { wrapError } from '../utils/errors.js';
import {
  createRunCancelledError,
  delayUnlessCancelled,
  isRunCancelled,
  isRunCancelledError,
} from '../utils/runCancellation.js';

export type ProgressCallback = (update: ProgressUpdate) => void;

export abstract class BaseAchievement {
  protected config: AppConfig;
  protected achievementId: AchievementId;
  protected achievementName: string;
  protected tier: TierLevel;
  protected targetCount: number;
  protected owner: string;
  protected repo: string;
  protected onProgress?: ProgressCallback;

  constructor(
    config: AppConfig,
    achievementId: AchievementId,
    achievementName: string,
    tier: TierLevel,
    targetCount: number
  ) {
    this.config = config;
    this.achievementId = achievementId;
    this.achievementName = achievementName;
    this.tier = tier;
    this.targetCount = targetCount;

    const parsed = parseRepo(config.targetRepo);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  /**
   * Report progress
   */
  protected reportProgress(current: number, operation: string, status: OperationStatus = 'in_progress'): void {
    if (this.onProgress) {
      this.onProgress({
        achievementId: this.achievementId,
        current,
        total: this.targetCount,
        currentOperation: operation,
        status,
      });
    }
  }

  /**
   * Execute the achievement workflow with concurrency support
   */
  async execute(): Promise<ExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const prNumbers: number[] = [];

    // Initialize rate limiter with config
    const rateLimiter = getRateLimiter({
      maxPerMinute: this.config.maxRequestsPerMinute,
      maxConcurrent: this.config.concurrency,
    });

    // Initialize achievement in database
    upsertAchievement(
      this.achievementId,
      this.achievementName,
      this.tier,
      this.targetCount
    );
    updateAchievementStatus(this.achievementId, 'in_progress');

    // Reset any stuck 'in_progress' operations from previous interrupted runs
    const resetCount = resetStuckOperations(this.achievementId);
    if (resetCount > 0) {
      logger.info(`Reset ${resetCount} stuck operations from previous run`);
    }

    // Get set of already completed operation numbers. Operation numbers are only
    // local bookkeeping, so resume by completed count and create fresh operation
    // numbers for the remaining work instead of retrying old failed branches.
    const completedOperations = getCompletedOperationNumbers(this.achievementId);
    let completed = Math.min(completedOperations.size, this.targetCount);

    const concurrency = this.config.concurrency || 3;
    logger.info(`Starting ${this.achievementName} (${this.tier}) - ${this.targetCount} operations (concurrency: ${concurrency})`);

    if (completed > 0) {
      logger.info(`Resuming: ${completed}/${this.targetCount} already completed`);
    }

    try {
      if (completed >= this.targetCount) {
        updateAchievementProgress(this.achievementId, this.targetCount);
        updateAchievementStatus(this.achievementId, 'completed');
        this.reportProgress(this.targetCount, `${this.targetCount}/${this.targetCount} operations...`, 'completed');

        return {
          achievementId: this.achievementId,
          tier: this.tier,
          success: true,
          completedOperations: this.targetCount,
          totalOperations: this.targetCount,
          errors,
          duration: Date.now() - startTime,
          prNumbers,
        };
      }

      // Build list of pending operations
      const pendingOps: number[] = [];
      const maxCompletedOperation = completedOperations.size > 0
        ? Math.max(...completedOperations)
        : 0;
      const remainingCount = this.targetCount - completed;

      for (let i = 1; i <= remainingCount; i++) {
        pendingOps.push(maxCompletedOperation + i);
      }

      // Create tasks for concurrent execution
      const tasks = pendingOps.map((opNum) => async () => {
        if (isRunCancelled()) {
          throw createRunCancelledError();
        }

        // Wait for rate limiter before proceeding
        await rateLimiter.acquire();

        try {
          if (isRunCancelled()) {
            throw createRunCancelledError();
          }

          // Create operation record
          const operationId = createOperation({
            achievementId: this.achievementId,
            operationType: this.getOperationType(),
            operationNumber: opNum,
            status: 'in_progress',
          });

          // Execute the single operation
          const result = await this.executeOperation(opNum);

          // Update operation record
          updateOperation(operationId, {
            status: 'completed',
            prNumber: result.prNumber,
            branchName: result.branchName,
            commitSha: result.commitSha,
            issueNumber: result.issueNumber,
            discussionId: result.discussionId,
          });

          // Small delay between operations for stability
          if (this.config.delayMs > 0) {
            const cancelledWhileWaiting = await delayUnlessCancelled(this.config.delayMs, 250);
            if (cancelledWhileWaiting) {
              throw createRunCancelledError();
            }
          }

          return { success: true, opNum, result };
        } finally {
          rateLimiter.release();
        }
      });

      // Execute with concurrency
      const results = await runWithConcurrency(
        tasks,
        concurrency,
        (done, total) => {
          completed = Math.min(completedOperations.size + done, this.targetCount);
          updateAchievementProgress(this.achievementId, completed);
          this.reportProgress(completed, `${completed}/${this.targetCount} operations...`);
        },
        () => !isRunCancelled()
      );

      // Process results
      let cancelled = false;
      for (const res of results) {
        if (res.success && res.result) {
          const opResult = res.result as { success: boolean; opNum: number; result: { prNumber?: number } };
          if (opResult.result?.prNumber) {
            prNumbers.push(opResult.result.prNumber);
          }
        } else if (res.error) {
          if (isRunCancelledError(res.error)) {
            cancelled = true;
            continue;
          }
          const wrappedError = wrapError(res.error);
          errors.push(`Operation ${res.index + 1}: ${wrappedError.message}`);
          logger.error(`Operation ${res.index + 1} failed: ${wrappedError.message}`);
        }
      }

      // Count successful operations
      const successCount = results.filter(r => r.success).length;
      completed = Math.min(completedOperations.size + successCount, this.targetCount);

      if (cancelled || isRunCancelled()) {
        updateAchievementProgress(this.achievementId, completed);
        this.reportProgress(completed, `${completed}/${this.targetCount} operations...`, 'in_progress');
        return {
          achievementId: this.achievementId,
          tier: this.tier,
          success: false,
          cancelled: true,
          completedOperations: completed,
          totalOperations: this.targetCount,
          errors,
          duration: Date.now() - startTime,
          prNumbers,
        };
      }

      // Update final status
      const finalStatus: OperationStatus = completed >= this.targetCount ? 'completed' : 'failed';
      updateAchievementStatus(this.achievementId, finalStatus);

      const duration = Date.now() - startTime;

      return {
        achievementId: this.achievementId,
        tier: this.tier,
        success: completed >= this.targetCount,
        completedOperations: completed,
        totalOperations: this.targetCount,
        errors,
        duration,
        prNumbers,
      };
    } catch (error) {
      if (isRunCancelledError(error) || isRunCancelled()) {
        updateAchievementProgress(this.achievementId, completed);
        this.reportProgress(completed, `${completed}/${this.targetCount} operations...`, 'in_progress');
        return {
          achievementId: this.achievementId,
          tier: this.tier,
          success: false,
          cancelled: true,
          completedOperations: completed,
          totalOperations: this.targetCount,
          errors,
          duration: Date.now() - startTime,
          prNumbers,
        };
      }

      const wrappedError = wrapError(error);
      updateAchievementStatus(this.achievementId, 'failed');

      return {
        achievementId: this.achievementId,
        tier: this.tier,
        success: false,
        completedOperations: completed,
        totalOperations: this.targetCount,
        errors: [...errors, wrappedError.message],
        duration: Date.now() - startTime,
        prNumbers,
      };
    }
  }

  /**
   * Get the operation type for this achievement
   */
  protected abstract getOperationType(): OperationType;

  /**
   * Execute a single operation
   */
  protected abstract executeOperation(number: number): Promise<{
    prNumber?: number;
    branchName?: string;
    commitSha?: string;
    issueNumber?: number;
    discussionId?: string;
  }>;

  /**
   * Clean up any resources (e.g., orphaned branches)
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }
}

export default BaseAchievement;
