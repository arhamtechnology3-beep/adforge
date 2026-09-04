/**
 * Platform owner / perpetual accounts — never blocked by 7-day trial.
 * Comma-separated ADMIN_EMAILS env can extend the list.
 */
const BUILTIN_ADMIN_EMAILS = ['jesalp85@gmail.com'];

export function getAdminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...BUILTIN_ADMIN_EMAILS, ...fromEnv])];
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
