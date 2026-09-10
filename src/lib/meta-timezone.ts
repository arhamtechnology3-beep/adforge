/** Meta ad-account timezone helpers (India D2C default: Asia/Kolkata). */

export const PREFERRED_META_TIMEZONE = 'Asia/Kolkata';

/** Meta Marketing API timezone_id for Asia/Kolkata (Asia/Calcutta = 476). */
export const META_TZ_ASIA_KOLKATA_ID = 71;
export const META_TZ_ASIA_CALCUTTA_ID = 476;

export type MetaTimezoneInfo = {
  timezone_id?: number | null;
  timezone_name?: string | null;
  timezone_offset_hours_utc?: number | null;
};

export function normalizeTimezoneName(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase();
}

export function isIndiaTimezone(info: MetaTimezoneInfo | null | undefined): boolean {
  if (!info) return false;
  if (
    info.timezone_id === META_TZ_ASIA_KOLKATA_ID ||
    info.timezone_id === META_TZ_ASIA_CALCUTTA_ID
  ) {
    return true;
  }
  const n = normalizeTimezoneName(info.timezone_name);
  return (
    n === 'asia/kolkata' ||
    n === 'asia/calcutta' ||
    n.includes('kolkata') ||
    n.includes('calcutta')
  );
}

export function isLosAngelesTimezone(info: MetaTimezoneInfo | null | undefined): boolean {
  if (!info) return false;
  if (info.timezone_id === 1) return true;
  const n = normalizeTimezoneName(info.timezone_name);
  return n === 'america/los_angeles' || n.includes('los_angeles');
}

/** Calendar date YYYY-MM-DD in Asia/Kolkata (not UTC). */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PREFERRED_META_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function timezoneWarningMessage(info: MetaTimezoneInfo | null | undefined): string | null {
  if (!info?.timezone_name && info?.timezone_id == null) return null;
  if (isIndiaTimezone(info)) return null;
  const label = info.timezone_name || `id ${info.timezone_id}`;
  return (
    `This Meta ad account timezone is ${label} (not Asia/Kolkata). ` +
    `Ads Manager schedules and daily budget resets use that zone — often America/Los_Angeles by default. ` +
    `AdForge cannot change it on an existing account. Create a new ad account in Meta with timezone Asia/Kolkata, then Reconnect Facebook.`
  );
}

/** Prefer an India-timezone account when several are available. */
export function pickPreferredAdAccount<T extends MetaTimezoneInfo & { id?: string }>(
  accounts: T[]
): T | undefined {
  if (!accounts.length) return undefined;
  const india = accounts.find((a) => isIndiaTimezone(a));
  if (india) return india;
  return accounts[0];
}
