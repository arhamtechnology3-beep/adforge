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

const countryOnly = buildTargetingSpec({
  countries: ['IN'],
  cities: [],
});
assert.deepEqual(countryOnly.geo_locations, { countries: ['IN'] });

console.log('meta-targeting geo conflict tests passed');
