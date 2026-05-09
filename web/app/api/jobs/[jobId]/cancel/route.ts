import { getJob, requestJobCancellation } from '../../../../../lib/jobStore';
import { noStoreJson } from '../../../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const result = requestJobCancellation(jobId);
  if (!result.ok) {
    return noStoreJson({ error: result.error }, { status: 400 });
  }
  const job = getJob(jobId);
  return noStoreJson({ ok: true, job });
}
