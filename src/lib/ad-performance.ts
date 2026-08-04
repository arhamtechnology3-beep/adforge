import type { MetaAdLibraryAd } from '@/lib/ai';

/**
 * Rank Meta Ad Library ads for client selection.
 * Meta does NOT publish commercial spend/impressions for most IN ads.
 * We use Library sort order (total_impressions when available) + runtime signals.
 */
export function rankLibraryAds(ads: MetaAdLibraryAd[]): MetaAdLibraryAd[] {
  const now = Date.now();

  const withSignals = ads.map((ad, index) => {
    const runtimeDays =
      ad.runtime_days ??
      (ad.started_date
        ? Math.max(0, Math.floor((now - Date.parse(ad.started_date)) / 86400000))
        : null);

    const activeSeconds = ad.total_active_time ?? null;
    const activeDays =
      activeSeconds && activeSeconds > 0
        ? Math.max(1, Math.round(activeSeconds / 86400))
        : null;

    // Library collection order already follows impressions sort when URL requests it
    const libraryRank = index + 1;

    let score = 100 - Math.min(60, libraryRank * 4);
    if (runtimeDays != null) {
      if (runtimeDays >= 45) score += 25;
      else if (runtimeDays >= 21) score += 18;
      else if (runtimeDays >= 7) score += 10;
      else score += 2;
    }
    if (activeDays != null) {
      if (activeDays >= 30) score += 15;
      else if (activeDays >= 14) score += 10;
      else if (activeDays >= 7) score += 5;
    }
    if (ad.has_multiple_versions) score += 5;
    if ((ad.publisher_platforms || []).length >= 2) score += 3;

    return {
      ...ad,
      library_rank: libraryRank,
      runtime_days: runtimeDays,
      total_active_time: activeSeconds,
      performance_score: Math.min(99, Math.max(10, Math.round(score))),
    };
  });

  // Keep Library order (impressions), but attach badges from score bands within list
  const sortedByScore = [...withSignals].sort(
    (a, b) => (b.performance_score || 0) - (a.performance_score || 0)
  );
  const winnerCutoff = Math.max(1, Math.ceil(sortedByScore.length * 0.25));
  const winnerIds = new Set(
    sortedByScore.slice(0, winnerCutoff).map((a) => a.library_id)
  );
  const scalingIds = new Set(
    sortedByScore.slice(winnerCutoff, winnerCutoff + Math.max(1, Math.ceil(sortedByScore.length * 0.35))).map(
      (a) => a.library_id
    )
  );

  return withSignals.map((ad) => {
    const rating: MetaAdLibraryAd['performance_rating'] = winnerIds.has(ad.library_id)
      ? 'WINNER'
      : scalingIds.has(ad.library_id)
        ? 'SCALING'
        : 'TESTING';

    const reasons: string[] = [];
    if (ad.library_rank && ad.library_rank <= 3) {
      reasons.push(`#${ad.library_rank} in Library (sorted by total impressions)`);
    } else if (ad.library_rank) {
      reasons.push(`Library rank #${ad.library_rank} by impressions`);
    }
    if (ad.runtime_days != null && ad.runtime_days >= 14) {
      reasons.push(`Running ${ad.runtime_days}d — sustained delivery`);
    } else if (ad.runtime_days != null && ad.runtime_days < 7) {
      reasons.push(`Newer creative (${ad.runtime_days}d) — still testing`);
    }
    if ((ad.publisher_platforms || []).includes('Instagram')) {
      reasons.push('Active on Instagram');
    }

    const label =
      rating === 'WINNER'
        ? 'Best performer signal'
        : rating === 'SCALING'
          ? 'Strong runner'
          : 'Newer / testing';

    return {
      ...ad,
      performance_rating: rating,
      performance_label: label,
      performance_reason:
        reasons.join(' · ') ||
        'Active in Meta Ad Library — compare creatives and pick what fits your store',
      winning_strategy_hook:
        ad.headline ||
        ad.primary_text?.slice(0, 80) ||
        'Replicate hook + format with your product',
    };
  });
}

export function performanceBadgeClass(rating?: MetaAdLibraryAd['performance_rating']) {
  if (rating === 'WINNER') return 'bg-amber-500 text-white';
  if (rating === 'SCALING') return 'bg-emerald-600 text-white';
  return 'bg-slate-600 text-white';
}
