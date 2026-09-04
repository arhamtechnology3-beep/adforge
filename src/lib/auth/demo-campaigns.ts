import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { MetaCampaign } from '@/types/database';
import { DEMO_USER } from '@/lib/auth/session';

function demoCampaignsPath(userId: string = DEMO_USER.id): string {
  return path.join(process.cwd(), '.data', `demo-campaigns-${userId}.json`);
}

export async function readDemoCampaigns(userId: string = DEMO_USER.id): Promise<MetaCampaign[]> {
  try {
    const raw = await readFile(demoCampaignsPath(userId), 'utf8');
    const parsed = JSON.parse(raw) as MetaCampaign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveDemoCampaigns(
  campaigns: MetaCampaign[],
  userId: string = DEMO_USER.id
): Promise<void> {
  const dir = path.dirname(demoCampaignsPath(userId));
  await mkdir(dir, { recursive: true });
  await writeFile(demoCampaignsPath(userId), JSON.stringify(campaigns, null, 2), 'utf8');
}

export async function getDemoCampaign(
  id: string,
  userId: string = DEMO_USER.id
): Promise<MetaCampaign | null> {
  const campaigns = await readDemoCampaigns(userId);
  return campaigns.find((c) => c.id === id) || null;
}

export async function upsertDemoCampaign(
  campaign: MetaCampaign,
  userId: string = DEMO_USER.id
): Promise<MetaCampaign> {
  const campaigns = await readDemoCampaigns(userId);
  const index = campaigns.findIndex((c) => c.id === campaign.id);
  if (index >= 0) campaigns[index] = campaign;
  else campaigns.unshift(campaign);
  await saveDemoCampaigns(campaigns, userId);
  return campaign;
}

export function buildDemoCampaign(input: {
  userId: string;
  name: string;
  website_url: string | null;
  budget: number;
  objective: string;
  status: MetaCampaign['status'];
  ad_ids: string[];
  meta_campaign_id?: string | null;
  ad_set_id?: string | null;
  launch_config?: Record<string, unknown>;
}): MetaCampaign {
  return {
    id: randomUUID(),
    user_id: input.userId,
    meta_campaign_id: input.meta_campaign_id ?? null,
    ad_set_id: input.ad_set_id ?? null,
    budget: input.budget,
    objective: input.objective,
    status: input.status,
    name: input.name,
    website_url: input.website_url,
    ad_ids: input.ad_ids,
    launch_config: input.launch_config || {},
    created_at: new Date().toISOString(),
  };
}
