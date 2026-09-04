import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getGenerationJob } from '@/lib/creative-engine/generation-jobs';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const job = await getGenerationJob(params.jobId);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.user_id !== sessionUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ job });
}
