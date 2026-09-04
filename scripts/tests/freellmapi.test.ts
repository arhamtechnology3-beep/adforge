import assert from 'node:assert/strict';
import { freeLlmBaseUrl, freeLlmConfigured } from '../../src/lib/freellmapi';

assert.equal(typeof freeLlmConfigured(), 'boolean');
assert.ok(freeLlmBaseUrl().endsWith('/v1'));

console.log('freellmapi contracts passed');
