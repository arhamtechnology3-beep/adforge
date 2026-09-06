import type { MetaAdLibraryAd } from '@/lib/ai';
import { rankLibraryAds } from '@/lib/ad-performance';

type SeedProduct = {
  brand_name: string;
  product_name: string;
  category?: string | null;
  price?: string | null;
  offer?: string | null;
  benefits?: string[] | null;
  product_url?: string | null;
  primary_packshot?: string | null;
};

/**
 * Meta-style starter creatives when competitor Library ads are empty.
 * Used so Generate still works from product truth (offer / social proof / benefit / urgency).
 */
export function buildAlgorithmSeedAds(product: SeedProduct): MetaAdLibraryAd[] {
  const brand = product.brand_name || 'Our brand';
  const name = product.product_name || 'our product';
  const benefit = (product.benefits || []).find(Boolean)?.slice(0, 120);
  const priceLine = [product.price, product.offer].filter(Boolean).join(' · ');
  const media = product.primary_packshot || null;

  const raw: MetaAdLibraryAd[] = [
    {
      id: 'algo_offer',
      library_id: 'algo_offer',
      ad_format: 'single_image',
      primary_text: priceLine
        ? `${name} from ${brand}. ${priceLine}. Order today — limited stock.`
        : `Shop ${name} from ${brand}. Fresh batch, ready to ship.`,
      headline: product.offer || 'Shop the offer',
      cta: 'Shop Now',
      active_status: 'ACTIVE',
      started_date: new Date().toISOString().slice(0, 10),
      publisher_platforms: ['Facebook', 'Instagram'],
      media_url: media,
      snapshot_url: product.product_url || '',
      source: 'manual',
      performance_rating: 'SCALING',
      performance_label: 'Offer-led Meta pattern',
    },
    {
      id: 'algo_benefit',
      library_id: 'algo_benefit',
      ad_format: 'single_image',
      primary_text: benefit
        ? `${benefit} — that's why customers choose ${name} by ${brand}.`
        : `Real ingredients. Honest taste. ${name} by ${brand}.`,
      headline: name.slice(0, 40),
      cta: 'Learn More',
      active_status: 'ACTIVE',
      started_date: new Date().toISOString().slice(0, 10),
      publisher_platforms: ['Instagram', 'Facebook'],
      media_url: media,
      snapshot_url: product.product_url || '',
      source: 'manual',
      performance_rating: 'SCALING',
      performance_label: 'Benefit-led Meta pattern',
    },
    {
      id: 'algo_social',
      library_id: 'algo_social',
      ad_format: 'single_image',
      primary_text: `Thousands trust homemade-style ${product.category || 'food'} from ${brand}. See why ${name} keeps getting reordered.`,
      headline: 'Loved by repeat buyers',
      cta: 'Order Now',
      active_status: 'ACTIVE',
      started_date: new Date().toISOString().slice(0, 10),
      publisher_platforms: ['Facebook', 'Instagram'],
      media_url: media,
      snapshot_url: product.product_url || '',
      source: 'manual',
      performance_rating: 'WINNER',
      performance_label: 'Social-proof Meta pattern',
    },
    {
      id: 'algo_urgency',
      library_id: 'algo_urgency',
      ad_format: 'single_image',
      primary_text: `Batch drops fast. Grab ${name} before this lot sells out.`,
      headline: 'Limited batch',
      cta: 'Shop Now',
      active_status: 'ACTIVE',
      started_date: new Date().toISOString().slice(0, 10),
      publisher_platforms: ['Instagram'],
      media_url: media,
      snapshot_url: product.product_url || '',
      source: 'manual',
      performance_rating: 'TESTING',
      performance_label: 'Urgency Meta pattern',
    },
  ];

  return rankLibraryAds(raw).slice(0, 10);
}
