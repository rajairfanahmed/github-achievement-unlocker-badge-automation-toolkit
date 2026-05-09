/**
 * General utility functions
 */

import { existsSync, mkdirSync } from 'fs';
import type { TierLevel, TierConfig, AchievementId } from '../types/index.js';

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate a unique branch name
 */
export function generateBranchName(
  prefix: string,
  achievementType: string,
  number: number
): string {
  const timestamp = Date.now().toString(36);
  return `${prefix}-${achievementType}-${number}-${timestamp}`;
}

/**
 * Generate a simple branch name (without timestamp for cleaner names)
 */
export function generateSimpleBranchName(
  prefix: string,
  achievementType: string,
  number: number
): string {
  return `${prefix}-${achievementType}-${number}`;
}

/**
 * Sanitize a string for use in branch names or file names
 */
export function sanitize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert achievement ID to display name
 */
export function achievementIdToDisplayName(id: AchievementId): string {
  const names: Record<AchievementId, string> = {
    'pair-extraordinaire': 'Pair Extraordinaire',
    'pull-shark': 'Pull Shark',
    'quickdraw': 'Quickdraw',
    'galaxy-brain': 'Galaxy Brain',
    'yolo': 'YOLO',
    'starstruck': 'Starstruck',
    'public-sponsor': 'Public Sponsor',
    'heart-on-your-sleeve': 'Heart On Your Sleeve',
    'open-sourcerer': 'Open Sourcerer',
    'arctic-code-vault-contributor': 'Arctic Code Vault Contributor',
    'mars-2020-contributor': 'Mars 2020 Contributor',
  };
  return names[id] || id;
}

/**
 * Get achievement URL slug for GitHub profile link
 */
export function getAchievementSlug(id: AchievementId): string {
  return id; // Achievement IDs match GitHub's URL slugs
}

/**
 * Generate GitHub achievement profile URL
 */
export function getAchievementProfileUrl(username: string, achievementId?: AchievementId): string {
  const baseUrl = `https://github.com/${username}?tab=achievements`;
  if (achievementId) {
    return `${baseUrl}&achievement=${achievementId}`;
  }
  return baseUrl;
}

/**
 * Get tier display name with count
 */
export function getTierDisplayName(tier: TierConfig): string {
  const levelNames: Record<TierLevel, string> = {
    default: 'Default',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
  };
  return `${levelNames[tier.level]} (${tier.targetCount})`;
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Generate a random string
 */
export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current timestamp in ISO format
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function dateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Create a range of numbers
 */
export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => start + i);
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for a number of seconds (convenience wrapper)
 */
export function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural || singular + 's');
  return `${count} ${word}`;
}

/**
 * Create a progress percentage string
 */
export function progressPercent(current: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((current / total) * 100)}%`;
}

/**
 * Mask a token for safe display
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) {
    return '****';
  }
  return token.slice(0, 4) + '...' + token.slice(-4);
}

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com[/:]([^/]+)\/([^/.]+)/,
    /^([^/]+)\/([^/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  return null;
}

/**
 * Get the GitHub achievement badge URL
 */
export function getAchievementBadgeUrl(achievementId: AchievementId, tier: TierLevel): string {
  const tierNum = { default: '', bronze: '-bronze', silver: '-silver', gold: '-gold' }[tier];
  return `https://github.githubassets.com/images/modules/profile/achievements/${achievementId}${tierNum}-64.png`;
}

/**
 * Delay with progress callback
 */
export async function delayWithProgress(
  ms: number,
  onProgress: (remaining: number) => void,
  intervalMs = 1000
): Promise<void> {
  const startTime = Date.now();
  const endTime = startTime + ms;

  while (Date.now() < endTime) {
    const remaining = endTime - Date.now();
    onProgress(remaining);
    await new Promise(resolve =>
      setTimeout(resolve, Math.min(intervalMs, remaining))
    );
  }
  onProgress(0);
}

/**
 * Safe JSON parse with default value
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
