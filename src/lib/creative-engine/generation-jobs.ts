import { randomUUID } from 'crypto';
import type { GenerationJob, GenerationJobStatus } from './types';

const memoryJobs = new Map<string, GenerationJob>();

export async function createGenerationJob(input: {
  userId: string;
  campaignInputId: string;
  productId: string;
  assetType: GenerationJob['asset_type'];
  creativeConceptId?: string;
  prompt?: string;
  negativePrompt?: string;
  sourceAssets?: Record<string, unknown>;
}): Promise<GenerationJob> {
  const job: GenerationJob = {
    id: randomUUID(),
    user_id: input.userId,
    campaign_input_id: input.campaignInputId,
    product_id: input.productId,
    creative_concept_id: input.creativeConceptId || null,
    asset_type: input.assetType,
    status: 'queued',
    prompt: input.prompt || null,
    negative_prompt: input.negativePrompt || null,
    source_assets: input.sourceAssets || {},
    result_assets: {},
    retry_count: 0,
    created_at: new Date().toISOString(),
  };
  memoryJobs.set(job.id, job);

  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const { data } = await admin.from('generation_jobs').insert(job).select('*').single();
    if (data) return data as GenerationJob;
  } catch {
    // Fall back to in-memory jobs in local dev.
  }
  return job;
}

export async function updateGenerationJob(
  id: string,
  patch: Partial<GenerationJob>
): Promise<GenerationJob | null> {
  const current = memoryJobs.get(id);
  const next = { ...(current || ({} as GenerationJob)), ...patch, id } as GenerationJob;
  memoryJobs.set(id, next);
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const { data } = await admin
      .from('generation_jobs')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (data) return data as GenerationJob;
  } catch {
    // ignore
  }
  return next;
}

export async function getGenerationJob(id: string): Promise<GenerationJob | null> {
  if (memoryJobs.has(id)) return memoryJobs.get(id) || null;
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    const { data } = await admin.from('generation_jobs').select('*').eq('id', id).maybeSingle();
    return (data as GenerationJob | null) || null;
  } catch {
    return null;
  }
}

export function setJobStatus(id: string, status: GenerationJobStatus): void {
  const job = memoryJobs.get(id);
  if (!job) return;
  job.status = status;
  if (status === 'processing') job.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed' || status === 'rejected') {
    job.completed_at = new Date().toISOString();
  }
  memoryJobs.set(id, job);
}
