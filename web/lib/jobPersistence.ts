import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT } from '../../src/utils/config.js';
import type { WebJob } from './types';

const JOBS_FILE = join(PROJECT_ROOT, '.achievement-web-jobs.json');

interface PersistedShape {
  activeJobId: string | null;
  jobs: Record<string, WebJob>;
}

export function loadJobsFromDisk(): PersistedShape | null {
  if (!existsSync(JOBS_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(JOBS_FILE, 'utf-8');
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return null;
  }
}

export function saveJobsToDisk(activeJobId: string | null, jobs: Map<string, WebJob>): void {
  try {
    const data: PersistedShape = {
      activeJobId,
      jobs: Object.fromEntries(jobs),
    };
    writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    /* avoid crashing the job runner if disk is full */
  }
}

/** Normalize jobs after a server restart: nothing is actively executing anymore. */
export function normalizeJobsAfterRestart(jobs: Map<string, WebJob>): void {
  for (const job of jobs.values()) {
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'failed';
      job.finishedAt = job.finishedAt || new Date().toISOString();
      const msg = 'The dashboard restarted while this job was still marked active. GitHub may still be processing actions—check the repository and history, then start a new run if needed.';
      if (!job.errors.includes(msg)) {
        job.errors.push(msg);
      }
    }
  }
}
