import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './handler.js';

const origin = 'https://rkp.org.pl';
const endpoint = 'https://example.test/api/licences/verify';
function request(body: unknown, extra: Record<string, string> = {}) {
  return new Request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify(body) });
}

test('valid/invalid result preserves leading zeros and returns no database fields', async () => {
  for (const valid of [true, false]) {
    const handler = createHandler(async number => { assert.equal(number, 'RKP/000001/2026'); return valid; }, [origin]);
    const response = await handler(request({ licenceNumber: 'RKP/000001/2026' }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { licenceNumber: 'RKP/000001/2026', valid });
  }
});

test('malformed numbers and JSON never reach the database', async () => {
  const handler = createHandler(async () => { throw new Error('Must not query'); }, [origin]);
  for (const body of [null, [], {}, { licenceNumber: 1 }, { licenceNumber: "RKP/1' OR 1=1/2026" }, { licenceNumber: 'RKP/1/26' }]) {
    assert.equal((await handler(request(body))).status, 400);
  }
  assert.equal((await handler(new Request(endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{' }))).status, 400);
});

test('connection errors return 503, never valid:false', async () => {
  const response = await createHandler(async () => { throw new Error('Private database details'); }, [origin])(request({ licenceNumber: 'RKP/1/2026' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Verification temporarily unavailable' });
});

test('CORS preflight, origin rejection, route, method, content type and payload limit', async () => {
  const handler = createHandler(async () => true, [origin]);
  const options = await handler(new Request(endpoint, { method: 'OPTIONS', headers: { Origin: origin } }));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal((await handler(request({ licenceNumber: 'RKP/1/2026' }, { Origin: 'https://untrusted.example' }))).status, 403);
  assert.equal((await handler(request({ licenceNumber: 'RKP/1/2026' }, { Origin: 'http://localhost:8080' }))).status, 200);
  assert.equal((await handler(new Request(endpoint))).status, 405);
  assert.equal((await handler(new Request('https://example.test/'))).status, 404);
  assert.equal((await handler(request({}, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await handler(request({ licenceNumber: 'x'.repeat(2000) }))).status, 413);
});
