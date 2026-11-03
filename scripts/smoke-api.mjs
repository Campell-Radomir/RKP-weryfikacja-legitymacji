import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync('frontend/index.html', 'utf8');
const endpoint = html.match(/data-api-url="([^"]+)"/)[1];
const send = (number, origin = 'https://rkp.org.pl') => fetch(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ licenceNumber: number }), signal: AbortSignal.timeout(20000),
});
const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin:'https://rkp.org.pl', 'Access-Control-Request-Method':'POST', 'Access-Control-Request-Headers':'content-type' }, signal: AbortSignal.timeout(20000) });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://rkp.org.pl');
console.log('PASS browser CORS preflight');
for (const [number, expected] of [['RKP/000001/2026',true], ['RKP/0000001/2026',false], ['RKP/999999999999/2026',false]]) {
  const response = await send(number);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.deepEqual(body, { licenceNumber: number, valid: expected });
  console.log('PASS',JSON.stringify(body));
}
assert.equal((await send('malformed')).status,400);
assert.equal((await send('RKP/000001/2026','https://untrusted.example')).status,403);
console.log('PASS malformed input and disallowed browser origin');
