/** Client-safe Meta helpers (no Node fs / server secrets). */

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}
