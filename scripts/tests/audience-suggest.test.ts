/**
 * Unit checks for audience auto-suggest (cities + interests).
 * Run: npx tsx scripts/tests/audience-suggest.test.ts
 */
import {
  suggestAudience,
  audienceSuggestionFromCompetitorIntel,
} from '../../src/lib/audience-suggest';

let failed = 0;
function assert(cond: boolean, name: string, detail = '') {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const food = suggestAudience({
  category: 'pickles',
  brandName: 'Divyaprabha Foods',
  libraryAdTexts: [
    'Homemade mango pickle — chemical free, gift ready for Ganpati',
  ],
  competitorHooks: ['Authentic homemade achar'],
});

assert(food.cities.includes('Mumbai'), 'metros_included');
assert(food.cities.includes('Chennai') && food.cities.includes('Kolkata'), 'tier1_has_8_metros');
assert(food.cities.some((c) => /Jaipur|Surat|Indore/.test(c)), 'tier2_for_food');
assert(food.cities.length >= 50, 'broad_tier_city_count', String(food.cities.length));
assert(food.cityTiers.includes('tier1') && food.cityTiers.includes('tier2'), 'default_tiers');
assert(
  food.interests.some((i) => /cuisine|Cooking|Gifting|Organic|shopping/i.test(i)),
  'food_interests',
  food.interestsCsv
);
assert(/festiv|gift|diwali|ganpati/i.test(food.interestsCsv + food.rationale.join(' ')), 'festive_signal');

const fromIntel = audienceSuggestionFromCompetitorIntel({
  websiteUrl: 'https://divyaprabhafoods.com',
  competitors: [
    {
      brand: 'FarmDidi',
      hook: 'Homemade pickles from farm kitchens',
      counterAngle: 'Beat with authentic batch proof',
      positioning: 'Traditional Indian food',
      live_meta_ads: [
        {
          headline: 'Buy organic achar online',
          primary_text: 'Gift hamper for Diwali — preservative free pickle',
        },
      ],
    },
  ],
  selectedAds: [
    {
      headline: 'Special Mango Pickle',
      primary_text: 'Order homemade mango pickle today',
    },
  ],
});

assert(fromIntel.citiesCsv.includes('Mumbai'), 'intel_cities_csv');
assert(fromIntel.interestsCsv.length > 10, 'intel_interests_csv', fromIntel.interestsCsv);
assert(fromIntel.source === 'competitor_library' || fromIntel.source === 'subscriber_website', 'source_library', fromIntel.source);
assert(Array.isArray(fromIntel.suggestedInterests), 'has_suggestion_chips');

const fromSite = suggestAudience({
  websiteUrl: 'https://divyaprabhafoods.com',
  brandName: 'Divyaprabha Foods',
  websiteTexts: [
    'Homemade mango pickle and achar — traditional Gujarati recipes',
    'Special Mango Saurashtra Pickle | Aam ka Achar',
  ],
  productNames: ['Mango Pickle', 'Meethi Keri', 'Garlic Pickle'],
});
assert(fromSite.category === 'pickles', 'site_category_pickles', String(fromSite.category));
assert(!fromSite.interests.includes('Organic food'), 'no_organic_without_signal', fromSite.interestsCsv);
assert(fromSite.interests.some((i) => /cuisine|Homemade|Cooking/i.test(i)), 'pickle_core_interests', fromSite.interestsCsv);
assert(fromSite.suggestedInterests.some((i) => /Organic|Spices|Gifting/i.test(i)), 'suggestions_available');
assert(fromSite.suggestedInterests.length >= 50, 'suggestions_50_plus', String(fromSite.suggestedInterests.length));
assert(fromSite.source === 'subscriber_website', 'source_website', fromSite.source);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll audience-suggest tests passed.');
