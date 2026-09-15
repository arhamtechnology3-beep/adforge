/**
 * Unit checks for Sales-first launch validation (no network).
 * Run: npx tsx scripts/tests/campaign-sales-gate.test.ts
 */
import { validateCampaignLaunch } from '../../src/lib/campaign-validation';
import { DEFAULT_CAMPAIGN_OBJECTIVE } from '../../src/lib/meta-campaign';
import { getDefaultSalesTemplate } from '../../src/lib/campaign-templates';

let failed = 0;
function assert(cond: boolean, name: string, detail = '') {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

assert(DEFAULT_CAMPAIGN_OBJECTIVE === 'OUTCOME_SALES', 'default_objective_sales');

const tpl = getDefaultSalesTemplate();
assert(tpl.objective === 'OUTCOME_SALES', 'default_template_sales', tpl.id);
assert(tpl.id === 'subscriber-sales', 'subscriber_sales_template');

const baseAds = [
  {
    id: 'ad1',
    copy_text: 'Authentic pickles for your festive thali.',
    headline: 'Shop Divyaprabha',
    image_url: 'https://cdn.example.com/product.jpg',
    status: 'approved' as const,
  },
];

const salesNoPixel = validateCampaignLaunch({
  input: {
    name: 'Sales test',
    objective: 'OUTCOME_SALES',
    budget: 500,
    website_url: 'https://divyaprabhafoods.com',
    ad_ids: ['ad1'],
    cta: 'SHOP_NOW',
  },
  ads: baseAds,
  meta_connected: true,
  has_pixel: false,
  page_id: '123',
});
assert(!salesNoPixel.can_launch, 'sales_blocked_without_pixel');
assert(
  salesNoPixel.items.some((i) => i.id === 'pixel' && i.status === 'fail'),
  'pixel_item_fail'
);

const salesWithPixel = validateCampaignLaunch({
  input: {
    name: 'Sales test',
    objective: 'OUTCOME_SALES',
    budget: 500,
    website_url: 'https://divyaprabhafoods.com',
    ad_ids: ['ad1'],
    cta: 'SHOP_NOW',
  },
  ads: baseAds,
  meta_connected: true,
  has_pixel: true,
  page_id: '123',
});
assert(salesWithPixel.can_launch, 'sales_ok_with_pixel');
assert(
  salesWithPixel.items.some((i) => i.id === 'pixel' && i.status === 'pass'),
  'pixel_item_pass'
);

const traffic = validateCampaignLaunch({
  input: {
    name: 'Traffic test',
    objective: 'OUTCOME_TRAFFIC',
    budget: 500,
    website_url: 'https://divyaprabhafoods.com',
    ad_ids: ['ad1'],
    cta: 'SHOP_NOW',
  },
  ads: baseAds,
  meta_connected: true,
  has_pixel: false,
  page_id: '123',
});
assert(
  traffic.warnings.some((w) => /Sales|Purchase|ATC/i.test(w)),
  'traffic_warns_prefer_sales'
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll campaign sales-gate tests passed.');
