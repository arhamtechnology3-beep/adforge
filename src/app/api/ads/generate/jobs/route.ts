import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { creativeGenerationQueue } from '@/workers/queues';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.campaign_input_id || !body.product_id) {
    return NextResponse.json(
      { error: 'campaign_input_id and product_id are required' },
      { status: 400 }
    );
  }

  const job = await creativeGenerationQueue.add('generate-pack', {
    userId: sessionUser.id,
    isDemo: sessionUser.isDemo,
    payload: body,
  });

  return NextResponse.json({
    job_id: job.id,
    status: 'queued',
    poll_url: `/api/ads/generate/jobs/${job.id}`,
  });
}
