const DAILY_PROVIDER_LIMITS: Record<string, number> = {
  arham: Number.MAX_SAFE_INTEGER,
  freellm: 500,
  'freellm-video': 50,
  cloudflare: 10_000,
  pollinations: 500,
  openrouter: 2_000,
  local: Number.MAX_SAFE_INTEGER,
};

const usage = new Map<string, number>();

function dayKey(provider: string, userId?: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${provider}:${userId || 'global'}:${day}`;
}

export async function reserveProviderQuota(
  provider: string,
  amount: number,
  userId?: string
): Promise<boolean> {
  const limit = DAILY_PROVIDER_LIMITS[provider] ?? 100;
  const key = dayKey(provider, userId);
  const current = usage.get(key) || 0;
  if (current + amount > limit) return false;
  usage.set(key, current + amount);
  return true;
}

export function providerQuotaRemaining(provider: string, userId?: string): number {
  const limit = DAILY_PROVIDER_LIMITS[provider] ?? 100;
  const key = dayKey(provider, userId);
  return Math.max(0, limit - (usage.get(key) || 0));
}
