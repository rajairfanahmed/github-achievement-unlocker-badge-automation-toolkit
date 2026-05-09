/**
 * Lets the web job runner signal in-flight achievement code to stop cooperatively.
 * CLI runs leave the probe unset so isRunCancelled() is always false.
 */

import { delay } from './timing.js';

let probe: (() => boolean) | null = null;
const RUN_CANCELLED_CODE = 'RUN_CANCELLED';

export class RunCancelledError extends Error {
  constructor(message = 'Run cancelled by user') {
    super(message);
    this.name = RUN_CANCELLED_CODE;
  }
}

export function setRunCancellationProbe(fn: (() => boolean) | null): void {
  probe = fn;
}

export function isRunCancelled(): boolean {
  return Boolean(probe?.());
}

export function createRunCancelledError(): RunCancelledError {
  return new RunCancelledError();
}

export function isRunCancelledError(error: unknown): boolean {
  return error instanceof RunCancelledError || (error instanceof Error && error.name === RUN_CANCELLED_CODE);
}

/**
 * Waits up to totalMs in small chunks, returning early with true if cancelled.
 */
export async function delayUnlessCancelled(totalMs: number, chunkMs = 1000): Promise<boolean> {
  let elapsed = 0;
  while (elapsed < totalMs) {
    if (isRunCancelled()) return true;
    const step = Math.min(chunkMs, totalMs - elapsed);
    await delay(step);
    elapsed += step;
  }
  return isRunCancelled();
}
