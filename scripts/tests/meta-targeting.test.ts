import assert from 'node:assert/strict';
import { buildTargetingSpec } from '../../src/lib/meta-targeting';

const withCities = buildTargetingSpec({
  countries: ['IN'],
  cities: [{ key: '2490299' }, { key: '2490299' }, { key: '2673300' }],
  age_min: 18,
  age_max: 65,
});

assert.deepEqual(withCities.geo_locations, {
  cities: [{ key: '2490299' }, { key: '2673300' }],
});
assert.ok(!('countries' in (withCities.geo_locations as object)));
assert.deepEqual(withCities.targeting_automation, { advantage_audience: 0 });

const countryOnly = buildTargetingSpec({
  countries: ['IN'],
  cities: [],
});
assert.deepEqual(countryOnly.geo_locations, { countries: ['IN'] });
assert.deepEqual(countryOnly.targeting_automation, { advantage_audience: 0 });

const advantageOn = buildTargetingSpec({
  countries: ['IN'],
  cities: [],
  advantage_audience: 1,
});
assert.deepEqual(advantageOn.targeting_automation, { advantage_audience: 1 });

console.log('meta-targeting geo conflict + advantage_audience tests passed');
