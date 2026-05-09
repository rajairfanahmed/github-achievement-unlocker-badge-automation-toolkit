import { createAchievement } from '../../src/achievements/index.js';
import { initDatabase, closeDatabase, setDatabaseUser } from '../../src/db/database.js';
import { initGitHubClient, initHelperClient } from '../../src/github/client.js';
import { quickValidateToken } from '../../src/github/auth.js';
import { setRunCancellationProbe } from '../../src/utils/runCancellation.js';
import type { TierLevel } from '../../src/types/index.js';
import type { RunSelection, WebJob } from './types';
import { getLocalConfig } from './server';
import { loadJobsFromDisk, normalizeJobsAfterRestart, saveJobsToDisk } from './jobPersistence.js';

interface JobStore {
  activeJobId: string | null;
  jobs: Map<string, WebJob>;
}

const globalForJobs = globalThis as typeof globalThis & {
  __achievementJobStore?: JobStore;
};

function persistStore(store: JobStore): void {
  saveJobsToDisk(store.activeJobId, store.jobs);
}

function getStore(): JobStore {
  if (!globalForJobs.__achievementJobStore) {
    const store: JobStore = {
      activeJobId: null,
      jobs: new Map(),
    };
    const loaded = loadJobsFromDisk();
    if (loaded) {
      for (const [id, job] of Object.entries(loaded.jobs)) {
        store.jobs.set(id, job);
      }
      normalizeJobsAfterRestart(store.jobs);
      store.activeJobId = null;
      persistStore(store);
    }
    globalForJobs.__achievementJobStore = store;
  }
  return globalForJobs.__achievementJobStore;
}

function pushLog(job: WebJob, message: string): void {
  const timestamp = new Date().toLocaleTimeString();
  job.logs = [`[${timestamp}] ${message}`, ...job.logs].slice(0, 200);
}

export function getJob(jobId: string): WebJob | null {
  return getStore().jobs.get(jobId) || null;
}

export function getActiveJob(): WebJob | null {
  const store = getStore();
  return store.activeJobId ? store.jobs.get(store.activeJobId) || null : null;
}

/**
 * Request cooperative cancellation. The current achievement workflow runs to completion;
 * remaining selections are skipped. No-op if the job is not queued or running.
 */
export function requestJobCancellation(jobId: string): { ok: true } | { ok: false; error: string } {
  const store = getStore();
  const job = store.jobs.get(jobId);
  if (!job) {
    return { ok: false, error: 'Job not found' };
  }
  if (job.status !== 'queued' && job.status !== 'running') {
    return { ok: false, error: 'Job is not running' };
  }
  job.cancelRequested = true;
  persistStore(store);
  return { ok: true };
}

function finalizeCancelled(job: WebJob): void {
  job.status = 'cancelled';
  job.cancelRequested = false;
  job.finishedAt = new Date().toISOString();
  pushLog(job, 'Run stopped (remaining steps skipped).');
  for (const selection of job.selections) {
    const p = job.progress[selection.id];
    if (p && (p.status === 'queued' || p.status === 'running')) {
      p.operation = 'Stopped';
      p.status = 'cancelled';
    }
  }
}

export function startJob(selections: RunSelection[]): WebJob {
  const store = getStore();
  const current = getActiveJob();

  if (current && (current.status === 'queued' || current.status === 'running')) {
    throw new Error(`A run is already active: ${current.id}`);
  }

  const job: WebJob = {
    id: `job-${Date.now()}`,
    status: 'queued',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    selections,
    progress: Object.fromEntries(selections.map((selection) => [
      selection.id,
      {
        current: 0,
        total: selection.targetCount,
        operation: 'Queued',
        status: 'queued',
      },
    ])),
    logs: [],
    errors: [],
    results: [],
  };

  store.jobs.set(job.id, job);
  store.activeJobId = job.id;
  persistStore(store);
  void runJob(job).finally(() => {
    if (store.activeJobId === job.id) {
      store.activeJobId = null;
    }
    persistStore(store);
  });

  return job;
}

async function runJob(job: WebJob): Promise<void> {
  try {
    job.status = 'running';
    pushLog(job, 'Run started.');

    const config = getLocalConfig();
    initGitHubClient(config);
    if (config.helperToken) {
      initHelperClient(config.helperToken);
    }

    const user = await quickValidateToken(config.githubToken);
    setDatabaseUser(user.login);
    initDatabase();

    for (const selection of job.selections) {
      if (job.cancelRequested) {
        finalizeCancelled(job);
        return;
      }

      pushLog(job, `Starting ${selection.id} (${selection.tier}).`);
      job.progress[selection.id] = {
        current: 0,
        total: selection.targetCount,
        operation: 'Starting',
        status: 'running',
      };

      const achievement = createAchievement(
        config,
        selection.id,
        selection.tier as TierLevel,
        selection.targetCount
      );

      achievement.setProgressCallback((update) => {
        job.progress[selection.id] = {
          current: Math.min(Math.max(update.current, 0), update.total),
          total: update.total,
          operation: update.currentOperation,
          status: update.status,
        };
      });

      setRunCancellationProbe(() => Boolean(job.cancelRequested));
      let result: Awaited<ReturnType<typeof achievement.execute>>;
      try {
        result = await achievement.execute();
      } finally {
        setRunCancellationProbe(null);
      }

      job.results.push(result);

      if (result.cancelled) {
        job.progress[selection.id] = {
          current: Math.min(Math.max(result.completedOperations, 0), result.totalOperations),
          total: result.totalOperations,
          operation: 'Stopped by user',
          status: 'cancelled',
        };
        pushLog(job, `${selection.id}: stopped by user.`);
        persistStore(getStore());
        finalizeCancelled(job);
        return;
      }

      job.progress[selection.id] = {
        current: Math.min(Math.max(result.completedOperations, 0), result.totalOperations),
        total: result.totalOperations,
        operation: result.success ? 'Completed' : 'Failed',
        status: result.success ? 'completed' : 'failed',
      };

      if (result.success) {
        pushLog(job, `Completed ${selection.id}.`);
      } else {
        const message = result.errors.join('; ') || 'Unknown workflow error.';
        job.errors.push(`${selection.id}: ${message}`);
        pushLog(job, `Failed ${selection.id}: ${message}`);
      }
      persistStore(getStore());

      if (job.cancelRequested) {
        finalizeCancelled(job);
        return;
      }
    }

    job.status = job.errors.length > 0 ? 'failed' : 'completed';
    pushLog(job, job.status === 'completed' ? 'Run completed.' : 'Run finished with errors.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job.errors.push(message);
    job.status = 'failed';
    pushLog(job, `Run failed: ${message}`);
  } finally {
    job.finishedAt = new Date().toISOString();
    closeDatabase();
    persistStore(getStore());
  }
}
