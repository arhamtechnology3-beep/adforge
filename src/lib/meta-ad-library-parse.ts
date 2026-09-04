import type { MetaAdLibraryAd } from '@/lib/ai';

export function extractAdsFromGraphqlPayload(json: unknown): MetaAdLibraryAd[] {
  const ads: MetaAdLibraryAd[] = [];
  const seen = new Set<string>();

  const textFromBody = (body: unknown): string => {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (typeof body === 'object' && body !== null && 'text' in body) {
      return String((body as { text?: string }).text || '');
    }
    return '';
  };

  const mediaFromSnapshot = (snap: Record<string, unknown>): {
    media: string | null;
    isVideo: boolean;
    isCarousel: boolean;
    body: string;
    headline: string;
    cta: string;
  } => {
    const cards = (snap.cards as Array<Record<string, unknown>>) || [];
    const images = (snap.images as Array<Record<string, unknown>>) || [];
    const videos = (snap.videos as Array<Record<string, unknown>>) || [];

    const card0 = cards[0] || {};
    const body =
      textFromBody(card0.body) ||
      textFromBody(snap.body) ||
      String(card0.link_description || snap.link_description || '');
    const headline = String(card0.title || snap.title || snap.link_title || '')
      .replace(/\{\{[^}]+\}\}/g, '')
      .trim();
    const cta = String(
      card0.cta_text || snap.cta_text || card0.cta_type || snap.cta_type || 'Shop Now'
    ).replace(/_/g, ' ');

    const media =
      (card0.original_image_url as string) ||
      (card0.resized_image_url as string) ||
      (card0.video_preview_image_url as string) ||
      (images[0]?.original_image_url as string) ||
      (images[0]?.resized_image_url as string) ||
      (videos[0]?.video_preview_image_url as string) ||
      null;

    const isVideo = Boolean(
      card0.video_hd_url ||
        card0.video_sd_url ||
        (Array.isArray(videos) && videos.length > 0)
    );
    const isCarousel = cards.length > 1;

    return { media, isVideo, isCarousel, body, headline, cta };
  };

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const n = node as Record<string, unknown>;

    const archiveId = n.ad_archive_id || n.adArchiveId;
    if (archiveId && n.snapshot) {
      const id = String(archiveId);
      if (!seen.has(id)) {
        seen.add(id);
        const snap = (n.snapshot || {}) as Record<string, unknown>;
        const extracted = mediaFromSnapshot(snap);
        const platforms = (n.publisher_platform || n.publisher_platforms || []) as string[];
        const startTs = n.start_date || n.ad_delivery_start_time;
        let started: string | null = null;
        if (typeof startTs === 'number') {
          started = new Date(startTs * 1000).toISOString().slice(0, 10);
        } else if (typeof startTs === 'string') {
          started = startTs.slice(0, 10);
        }
        const activeTime =
          typeof n.total_active_time === 'number' ? n.total_active_time : null;
        const collationCount =
          typeof n.collation_count === 'number' ? n.collation_count : null;
        ads.push({
          id: `lib_${id}`,
          library_id: id,
          ad_format: extracted.isVideo
            ? 'video'
            : extracted.isCarousel
              ? 'carousel'
              : 'single_image',
          primary_text: extracted.body || '',
          headline: extracted.headline,
          cta: extracted.cta,
          active_status: n.is_active === false ? 'UNKNOWN' : 'ACTIVE',
          started_date: started,
          publisher_platforms: platforms.map((p) =>
            String(p)
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase())
          ),
          media_url: extracted.media,
          snapshot_url: `https://www.facebook.com/ads/library/?id=${id}`,
          source: 'web_library',
          total_active_time: activeTime,
          has_multiple_versions: collationCount != null ? collationCount > 1 : undefined,
        });
      }
    }

    if (n.collated_results) visit(n.collated_results);
    for (const v of Object.values(n)) {
      if (v && typeof v === 'object') visit(v);
    }
  };

  visit(json);
  return ads;
}
