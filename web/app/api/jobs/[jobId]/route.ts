import { getJob } from '../../../../lib/jobStore';
import { noStoreJson } from '../../../../lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return noStoreJson({ error: 'Job not found' }, { status: 404 });
  }

  return noStoreJson(job);
}
