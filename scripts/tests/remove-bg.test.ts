import assert from 'node:assert/strict';
import { removeBgConfigured } from '../../src/lib/remove-bg';

assert.equal(typeof removeBgConfigured(), 'boolean');

console.log('remove.bg contracts passed');
