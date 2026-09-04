type UsageRecord = {
  userId?: string;
  workspaceId?: string;
  provider: string;
  model?: string;
  assetType: 'image' | 'video' | 'pack';
  requests?: number;
  imagesGenerated?: number;
  videoSeconds?: number;
  estimatedCost?: number;
  actualCost?: number;
  freeQuotaConsumed?: number;
};

const memoryLedger: Array<UsageRecord & { createdAt: string }> = [];

export async function recordCreativeUsage(record: UsageRecord): Promise<void> {
  memoryLedger.push({ ...record, createdAt: new Date().toISOString() });
  if (memoryLedger.length > 5000) memoryLedger.splice(0, memoryLedger.length - 5000);

  if (!record.userId || process.env.SUPABASE_SERVICE_ROLE_KEY === undefined) return;
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const admin = await createServiceClient();
    await admin.from('creative_usage').insert({
      user_id: record.userId,
      workspace_id: record.workspaceId || record.userId,
      provider: record.provider,
      model: record.model || null,
      asset_type: record.assetType,
      requests: record.requests || 1,
      images_generated: record.imagesGenerated || 0,
      video_seconds: record.videoSeconds || 0,
      estimated_cost: record.estimatedCost || 0,
      actual_cost: record.actualCost || 0,
      free_quota_consumed: record.freeQuotaConsumed || 0,
    });
  } catch {
    // Table may not exist yet during local dev.
  }
}

export function readUsageLedger(userId?: string): Array<UsageRecord & { createdAt: string }> {
  return memoryLedger.filter((entry) => !userId || entry.userId === userId);
}
