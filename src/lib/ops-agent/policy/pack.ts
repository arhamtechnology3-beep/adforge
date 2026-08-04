import type { MetaPolicyRule } from '@/types/database';
import { META_POLICY_PACK_VERSION, type CreativeRow, type RecommendationDraft } from '../types';

/** In-code fallback pack (mirrors migration seed) */
export const POLICY_PACK_V1: Omit<MetaPolicyRule, 'id' | 'effective_at'>[] = [
  {
    version: META_POLICY_PACK_VERSION,
    category: 'personal_attributes',
    severity: 'high',
    pattern: "(you are|you're|are you)\\s+(fat|ugly|poor|broke|overweight|depressed)",
    pattern_text: 'Personal attributes targeting claims',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'auto_pause',
    remediation_copy: 'Paused: Meta disallows personal attribute claims in ads.',
    enabled: true,
  },
  {
    version: META_POLICY_PACK_VERSION,
    category: 'health_before_after',
    severity: 'high',
    pattern: '(before\\s*(and|&|/)\\s*after|lose\\s+\\d+\\s*(kg|kilo|lbs)|miracle\\s+cure|guaranteed\\s+weight)',
    pattern_text: 'Health/weight before-after or miracle claims',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'auto_pause',
    remediation_copy: 'Paused: health transformation claims risk account restriction.',
    enabled: true,
  },
  {
    version: META_POLICY_PACK_VERSION,
    category: 'income_guarantees',
    severity: 'critical',
    pattern: '(guaranteed\\s+(income|profit|returns)|earn\\s+₹?\\s*\\d+\\s*(lakh|crore|/day)|get\\s+rich\\s+quick)',
    pattern_text: 'Unrealistic income / guaranteed returns',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'auto_pause',
    remediation_copy: 'Paused: income guarantees violate Meta advertising standards.',
    enabled: true,
  },
  {
    version: META_POLICY_PACK_VERSION,
    category: 'misleading_urgency',
    severity: 'medium',
    pattern: '(last\\s+chance\\s+ever|only\\s+1\\s+left\\s+worldwide|act\\s+now\\s+or\\s+lose\\s+forever)',
    pattern_text: 'Misleading urgency / scarcity spam',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'recommend',
    remediation_copy: 'Soften urgency language to avoid policy flags.',
    enabled: true,
  },
  {
    version: META_POLICY_PACK_VERSION,
    category: 'caps_spam',
    severity: 'medium',
    pattern: '([A-Z]{12,}|!!!{2,}|₹₹₹+)',
    pattern_text: 'Excessive caps / punctuation spam',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'recommend',
    remediation_copy: 'Reduce caps and repeated punctuation for Meta best practices.',
    enabled: true,
  },
  {
    version: META_POLICY_PACK_VERSION,
    category: 'restricted_crypto',
    severity: 'high',
    pattern: '(crypto\\s+guaranteed|bitcoin\\s+double|nft\\s+guaranteed\\s+profit)',
    pattern_text: 'Restricted financial / crypto claims',
    match_fields: ['copy_text', 'headline'],
    match_statuses: [],
    remediation: 'auto_pause',
    remediation_copy: 'Paused: restricted financial claims.',
    enabled: true,
  },
];

export type PolicyScanHit = {
  rule: Omit<MetaPolicyRule, 'id' | 'effective_at'> | MetaPolicyRule;
  creative: CreativeRow;
  recommendation: RecommendationDraft;
};

export function scanCreativesForPolicy(
  creatives: CreativeRow[],
  rules: Array<Omit<MetaPolicyRule, 'id' | 'effective_at'> | MetaPolicyRule> = POLICY_PACK_V1,
  metaStatuses?: Array<{ adId: string; effective_status?: string }>
): PolicyScanHit[] {
  const hits: PolicyScanHit[] = [];
  const enabled = rules.filter((r) => r.enabled !== false);

  for (const creative of creatives) {
    const hay = `${creative.copy_text || ''} ${creative.headline || ''}`;

    for (const rule of enabled) {
      if (!rule.pattern) continue;
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (!re.test(hay)) continue;
      } catch {
        continue;
      }

      const auto = rule.remediation === 'auto_pause';
      hits.push({
        rule,
        creative,
        recommendation: {
          source: 'policy',
          type: auto ? 'policy_violation' : 'policy_soft',
          severity: rule.severity,
          title: `${rule.pattern_text || rule.category}: ${creative.name}`,
          body:
            rule.remediation_copy ||
            `Matched Meta norm (${rule.category}). Pack ${rule.version}.`,
          proposed_action: {
            action: auto ? 'pause_ad' : 'rewrite_creative',
            adId: creative.id,
            category: rule.category,
            pack_version: rule.version,
          },
          auto_apply: auto,
        },
      });
    }
  }

  // Status-based disapproval
  if (metaStatuses?.length) {
    for (const st of metaStatuses) {
      const bad =
        st.effective_status === 'DISAPPROVED' ||
        st.effective_status === 'WITH_ISSUES' ||
        st.effective_status === 'PENDING_REVIEW';
      if (!bad || st.effective_status === 'PENDING_REVIEW') {
        if (st.effective_status !== 'DISAPPROVED' && st.effective_status !== 'WITH_ISSUES') {
          continue;
        }
      }
      const creative = creatives.find((c) => c.id === st.adId) || {
        id: st.adId,
        name: st.adId,
        format: 'unknown',
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpa: null,
        frequency: 0,
      };
      hits.push({
        rule: {
          version: META_POLICY_PACK_VERSION,
          category: 'disapproval_status',
          severity: 'critical',
          pattern: null,
          pattern_text: 'Ad disapproval / delivery issues',
          match_fields: [],
          match_statuses: ['DISAPPROVED', 'WITH_ISSUES'],
          remediation: 'auto_pause',
          remediation_copy: 'Paused: Meta disapproval detected.',
          enabled: true,
        },
        creative,
        recommendation: {
          source: 'policy',
          type: 'disapproval',
          severity: 'critical',
          title: `Disapproved: ${creative.name}`,
          body: `effective_status=${st.effective_status}. Immediate pause to protect Page / ad account.`,
          proposed_action: {
            action: 'pause_ad',
            adId: st.adId,
            status: st.effective_status,
          },
          auto_apply: true,
        },
      });
    }
  }

  return hits;
}
