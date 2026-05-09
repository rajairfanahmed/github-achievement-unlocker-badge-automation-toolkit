import { startJob } from '../../../lib/jobStore';
import { assertSelectionInput, getRateLimit, getStatus, noStoreJson } from '../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const status = await getStatus();
    if (!status.ok) {
      return noStoreJson({
        code: 'PREFLIGHT_FAILED',
        error: 'Preflight checks failed. Fix the issues below before running.',
        action: 'Review each issue and update .env or repository settings.',
        issues: status.issues,
      }, { status: 400 });
    }

    const rate = await getRateLimit();
    if (rate.remaining !== null && rate.remaining <= 10) {
      return noStoreJson({
        code: 'RATE_LIMIT_LOW',
        error: 'GitHub API rate limit is too low for a safe run.',
        action: 'Wait for the core API limit to reset, then try again.',
        rateLimit: rate,
      }, { status: 429 });
    }

    const body = await request.json();
    const selections = assertSelectionInput(body).map((selection) => ({
      id: selection.id,
      tier: selection.tier,
      targetCount: selection.targetCount,
    }));

    const job = startJob(selections);
    return noStoreJson(job, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return noStoreJson({
      code: 'BAD_REQUEST',
      error: message,
      action: 'Check your selection payload and achievement availability.',
    }, { status: 400 });
  }
}
