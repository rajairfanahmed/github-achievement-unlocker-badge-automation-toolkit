import { getActiveJob } from '../../../../lib/jobStore';
import { noStoreJson } from '../../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const job = getActiveJob();
  return noStoreJson({ active: job });
}
