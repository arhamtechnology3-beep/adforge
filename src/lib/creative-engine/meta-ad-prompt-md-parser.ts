import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { MetaAdPromptPreset, MetaAdPromptPresetId } from './meta-ad-prompt-library.types';

export type ParsedMetaAdPromptLibrary = {
  masterProductProtectionNegative: string;
  presets: MetaAdPromptPreset[];
  source: 'markdown' | 'fallback';
  sourcePath?: string;
};

/** Map MD heading / matrix names → stable preset IDs */
const PRESET_ID_ALIASES: Record<string, MetaAdPromptPresetId> = {
  'premium-luxury-studio': 'premium-luxury-studio',
  'natural-lifestyle-environment': 'natural-lifestyle',
  'natural-lifestyle': 'natural-lifestyle',
  'bold-scroll-stopping-facebook-ad': 'bold-scroll-stopper',
  'bold-scroll-stopper': 'bold-scroll-stopper',
  'sunlight-premium-home': 'sunlight-premium-home',
  'minimal-clean-product-ad': 'minimal-clean',
  'minimal-clean': 'minimal-clean',
  'dark-cinematic-premium': 'dark-cinematic',
  'dark-cinematic': 'dark-cinematic',
  'soft-beauty-instagram-aesthetic': 'soft-beauty',
  'soft-beauty': 'soft-beauty',
  'fresh-clean-refreshing': 'fresh-clean',
  'fresh-clean': 'fresh-clean',
  'modern-urban-premium-brand': 'modern-urban',
  'modern-urban': 'modern-urban',
  'problem-solution-visual': 'problem-solution',
  'problem-solution': 'problem-solution',
  'premium-ugc-style': 'premium-ugc',
  'premium-ugc': 'premium-ugc',
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/→/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function presetIdFromName(name: string): MetaAdPromptPresetId {
  const slug = slugifyName(name);
  return PRESET_ID_ALIASES[slug] || (slug as MetaAdPromptPresetId);
}

function normalizeMatrixKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/→/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePurposeMatrix(content: string): Map<string, string> {
  const purposes = new Map<string, string>();
  const matrixStart = content.indexOf('# Creative Testing Matrix');
  if (matrixStart < 0) return purposes;

  const tableSection = content.slice(matrixStart);
  for (const line of tableSection.split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || line.includes('Creative |')) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length >= 3) {
      purposes.set(normalizeMatrixKey(cells[0]), cells[2]);
    }
  }
  return purposes;
}

function purposeForName(name: string, matrix: Map<string, string>): string {
  const key = normalizeMatrixKey(name);
  for (const [matrixName, purpose] of matrix.entries()) {
    if (key.includes(matrixName) || matrixName.includes(key.split(' ')[0])) {
      return purpose;
    }
  }
  const short = name.split('/')[0]?.trim() || name;
  for (const [matrixName, purpose] of matrix.entries()) {
    if (normalizeMatrixKey(short).includes(matrixName) || matrixName.includes(normalizeMatrixKey(short))) {
      return purpose;
    }
  }
  return 'Premium advertising';
}

function extractTextBlock(section: string): string {
  const match = section.match(/```text\n([\s\S]*?)```/);
  if (!match) return '';
  return match[1]
    .replace(/\n\[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT\]\n?/g, '\n')
    .replace(/\[ADD MASTER PRODUCT-PROTECTION NEGATIVE PROMPT\]/g, '')
    .trim();
}

function extractBestFor(section: string): string {
  const match = section.match(/\*\*Best for:\*\*\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

/** Parse docs/facebook_meta_product_ad_prompts.md into structured presets */
export function parseMetaAdPromptMarkdown(content: string): ParsedMetaAdPromptLibrary {
  const masterHeading = '# Master Product-Protection Negative Prompt';
  const masterStart = content.indexOf(masterHeading);
  const firstPresetStart = content.search(/^# \d+\.\s/m);
  const masterSection =
    masterStart >= 0 && firstPresetStart > masterStart
      ? content.slice(masterStart, firstPresetStart)
      : '';
  const masterProductProtectionNegative = extractTextBlock(masterSection)
    .replace(/\n+/g, ' ')
    .trim();

  const purposeMatrix = parsePurposeMatrix(content);
  const presetSections = content.split(/^# (\d+\.\s.+)$/m).slice(1);
  const presets: MetaAdPromptPreset[] = [];

  for (let i = 0; i < presetSections.length; i += 2) {
    const rawName = presetSections[i]?.trim();
    const body = presetSections[i + 1] || '';
    if (!rawName || !/^\d+\./.test(rawName)) continue;
    if (rawName.includes('Creative Testing Matrix') || rawName.includes('Important Product Rule')) {
      continue;
    }

    const name = rawName.replace(/^\d+\.\s*/, '').trim();
    const prompt = extractTextBlock(body);
    if (!prompt) continue;

    const bestFor = extractBestFor(body);
    const id = presetIdFromName(name);
    presets.push({
      id,
      name,
      bestFor,
      purpose: purposeForName(name, purposeMatrix),
      prompt,
    });
  }

  return {
    masterProductProtectionNegative,
    presets,
    source: 'markdown',
  };
}

export function defaultMarkdownPath(): string {
  return path.join(process.cwd(), 'docs/facebook_meta_product_ad_prompts.md');
}

let cache: { mtimeMs: number; library: ParsedMetaAdPromptLibrary } | null = null;

export function loadMetaAdPromptLibraryFromMarkdown(
  mdPath = defaultMarkdownPath()
): ParsedMetaAdPromptLibrary | null {
  if (!existsSync(mdPath)) return null;
  try {
    const stat = statSync(mdPath);
    if (cache && cache.library.sourcePath === mdPath && cache.mtimeMs === stat.mtimeMs) {
      return cache.library;
    }
    const content = readFileSync(mdPath, 'utf8');
    const parsed = parseMetaAdPromptMarkdown(content);
    if (parsed.presets.length === 0) return null;
    const library: ParsedMetaAdPromptLibrary = {
      ...parsed,
      source: 'markdown',
      sourcePath: mdPath,
    };
    cache = { mtimeMs: stat.mtimeMs, library };
    return library;
  } catch {
    return null;
  }
}

/** Clear loader cache (tests / hot reload) */
export function clearMetaAdPromptLibraryCache(): void {
  cache = null;
}
