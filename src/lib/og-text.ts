/** Keep Unicode product copy while removing pictographs unsupported by the local Satori font. */
export function ogSafeText(text: string, maxLen?: number): string {
  const cleaned = (text || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLen && cleaned.length > maxLen) return cleaned.slice(0, maxLen).trim();
  return cleaned;
}
