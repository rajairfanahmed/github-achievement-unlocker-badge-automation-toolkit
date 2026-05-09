import { AchievementError } from '../../src/utils/errors.js';
import type { WebIssue } from './types';

export function toIssue(error: unknown, fallbackTitle = 'Unexpected error'): WebIssue {
  if (error instanceof AchievementError) {
    return {
      code: error.code,
      title: error.name,
      message: error.message,
      action: error.suggestion,
      severity: error.recoverable ? 'warning' : 'error',
    };
  }

  if (error instanceof Error) {
    const message = error.message;
    const lower = message.toLowerCase();

    if (lower.includes('bad credentials') || lower.includes('unauthorized')) {
      return {
        code: 'AUTH_FAILED',
        title: 'GitHub authentication failed',
        message,
        action: 'Generate a new token for the main account and update GITHUB_TOKEN in .env.',
        severity: 'error',
      };
    }

    if (lower.includes('rate limit')) {
      return {
        code: 'RATE_LIMIT',
        title: 'GitHub rate limit reached',
        message,
        action: 'Wait until the reset time or lower concurrency before running more workflows.',
        severity: 'warning',
      };
    }

    return {
      code: 'UNKNOWN',
      title: fallbackTitle,
      message,
      action: 'Check the terminal logs and README troubleshooting section.',
      severity: 'error',
    };
  }

  return {
    code: 'UNKNOWN',
    title: fallbackTitle,
    message: String(error),
    action: 'Check the terminal logs and README troubleshooting section.',
    severity: 'error',
  };
}
