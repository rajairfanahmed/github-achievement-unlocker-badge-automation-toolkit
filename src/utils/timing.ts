/**
 * Timing and delay utilities for rate limiting and pacing
 */

import type { RateLimitInfo } from '../types/index.js';

// Default delays in milliseconds
const DEFAULT_DELAY = 1000;
const MIN_DELAY = 100;
const MAX_DELAY = 60000;
const RATE_LIMIT_BUFFER = 5000; // Extra buffer when rate limited

// Exponential backoff settings
const BACKOFF_BASE = 2;
const MAX_RETRIES = 5;

/**
 * Simple delay function
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delay with configurable minimum/maximum
 */
export function safeDelay(ms: number): Promise<void> {
  const safeMs = Math.min(Math.max(ms, MIN_DELAY), MAX_DELAY);
  return delay(safeMs);
}

/**
 * Calculate exponential backoff delay
 */
export function getBackoffDelay(attempt: number, baseDelay = DEFAULT_DELAY): number {
  const exponentialDelay = baseDelay * Math.pow(BACKOFF_BASE, attempt);
  // Add some jitter to prevent thundering herd
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_DELAY);
}

/**
 * Wait with exponential backoff
 */
export async function backoff(attempt: number, baseDelay = DEFAULT_DELAY): Promise<void> {
  const delayMs = getBackoffDelay(attempt, baseDelay);
  await delay(delayMs);
}

/**
 * Calculate delay until rate limit reset
 */
export function getDelayUntilReset(resetTime: Date): number {
  const now = Date.now();
  const resetMs = resetTime.getTime();
  return Math.max(0, resetMs - now + RATE_LIMIT_BUFFER);
}

/**
 * Wait until rate limit resets
 */
export async function waitForRateLimitReset(resetTime: Date): Promise<void> {
  const delayMs = getDelayUntilReset(resetTime);
  if (delayMs > 0) {
    await delay(delayMs);
  }
}

/**
 * Check if we should pause based on rate limit info
 */
export function shouldPauseForRateLimit(info: RateLimitInfo, threshold = 10): boolean {
  return info.remaining <= threshold;
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    baseDelay = DEFAULT_DELAY,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      await backoff(attempt, baseDelay);
    }
  }

  throw lastError;
}

/**
 * Execute operations with rate limiting
 */
export async function rateLimitedExecution<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  options: {
    delayBetween?: number;
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { delayBetween = DEFAULT_DELAY, batchSize = 1, onProgress } = options;

  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Execute batch in parallel if batchSize > 1
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => operation(item, i + batchIndex))
    );

    results.push(...batchResults);
    completed += batch.length;

    if (onProgress) {
      onProgress(completed, items.length);
    }

    // Delay between batches (not after the last one)
    if (i + batchSize < items.length) {
      await safeDelay(delayBetween);
    }
  }

  return results;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Estimate time remaining based on progress
 */
export function estimateTimeRemaining(
  completed: number,
  total: number,
  elapsedMs: number
): number {
  if (completed === 0) {
    return 0;
  }

  const averageTimePerItem = elapsedMs / completed;
  const remaining = total - completed;
  return Math.round(averageTimePerItem * remaining);
}

/**
 * Create a stopwatch for timing operations
 */
export function createStopwatch(): {
  start: () => void;
  stop: () => number;
  elapsed: () => number;
  reset: () => void;
} {
  let startTime: number | null = null;
  let stoppedTime: number | null = null;

  return {
    start() {
      startTime = Date.now();
      stoppedTime = null;
    },
    stop() {
      if (startTime === null) {
        return 0;
      }
      stoppedTime = Date.now();
      return stoppedTime - startTime;
    },
    elapsed() {
      if (startTime === null) {
        return 0;
      }
      return (stoppedTime || Date.now()) - startTime;
    },
    reset() {
      startTime = null;
      stoppedTime = null;
    },
  };
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;

  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      return fn.apply(this, args) as ReturnType<T>;
    }
    return undefined;
  };
}

/**
 * Run tasks with limited concurrency
 * @param tasks Array of async functions to execute
 * @param concurrency Maximum number of concurrent executions
 * @param onProgress Optional callback for progress updates
 * @returns Array of results in order
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number = 3,
  onProgress?: (completed: number, total: number) => void,
  shouldContinue?: () => boolean
): Promise<Array<{ success: boolean; result?: T; error?: unknown; index: number }>> {
  const results: Array<{ success: boolean; result?: T; error?: unknown; index: number }> = [];
  let completedCount = 0;
  let currentIndex = 0;

  const executeNext = async (): Promise<void> => {
    while (currentIndex < tasks.length) {
      if (shouldContinue && !shouldContinue()) {
        break;
      }
      const index = currentIndex++;
      const task = tasks[index];

      try {
        const result = await task();
        results.push({ success: true, result, index });
      } catch (error) {
        results.push({ success: false, error, index });
      }

      completedCount++;
      if (onProgress) {
        onProgress(completedCount, tasks.length);
      }
    }
  };

  // Start concurrent workers
  const workers = Array(Math.min(concurrency, tasks.length))
    .fill(null)
    .map(() => executeNext());

  await Promise.all(workers);

  // Sort results by original index
  return results.sort((a, b) => a.index - b.index);
}
