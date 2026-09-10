import assert from 'node:assert/strict';
import {
  isIndiaTimezone,
  isLosAngelesTimezone,
  pickPreferredAdAccount,
  timezoneWarningMessage,
  todayInIndia,
} from '../../src/lib/meta-timezone';

assert.equal(isLosAngelesTimezone({ timezone_id: 1, timezone_name: 'America/Los_Angeles' }), true);
assert.equal(isIndiaTimezone({ timezone_id: 71, timezone_name: 'Asia/Kolkata' }), true);
assert.equal(isIndiaTimezone({ timezone_id: 476, timezone_name: 'Asia/Calcutta' }), true);
assert.equal(isIndiaTimezone({ timezone_name: 'Asia/Calcutta' }), true);
assert.ok(timezoneWarningMessage({ timezone_id: 1, timezone_name: 'America/Los_Angeles' }));
assert.equal(timezoneWarningMessage({ timezone_id: 71, timezone_name: 'Asia/Kolkata' }), null);

const picked = pickPreferredAdAccount([
  { id: 'act_1', timezone_id: 1, timezone_name: 'America/Los_Angeles' },
  { id: 'act_2', timezone_id: 71, timezone_name: 'Asia/Kolkata' },
]);
assert.equal(picked?.id, 'act_2');

const today = todayInIndia();
assert.match(today, /^\d{4}-\d{2}-\d{2}$/);

console.log('meta-timezone contracts passed');
