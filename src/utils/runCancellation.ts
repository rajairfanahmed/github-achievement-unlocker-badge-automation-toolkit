/**
 * Lets the web job runner signal in-flight achievement code to stop cooperatively.
 * CLI runs leave the probe unset so isRunCancelled() is always false.
 */

import { delay } from './timing.js';

let probe: (() => boolean) | null = null;

export function setRunCancellationProbe(fn: (() => boolean) | null): void {
  probe = fn;
}

export function isRunCancelled(): boolean {
  return Boolean(probe?.());
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
