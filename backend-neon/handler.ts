export type VerifyLicence = (licenceNumber: string) => Promise<boolean>;

export function createHandler(verify: VerifyLicence, allowedOrigins: string[]) {
  return async function fetch(request: Request): Promise<Response> {
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
    });
    const json = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    const origin = request.headers.get('Origin');
    // Local development is allowed on loopback only, with any explicit port.
    const localOrigin = origin !== null && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin) {
      if (!allowedOrigins.includes(origin) && !localOrigin) return json(403, { error: 'Origin not allowed' });
      headers.set('Access-Control-Allow-Origin', origin);
    }
    const path = new URL(request.url).pathname;
    if (path !== '/api/licences/verify') return json(404, { error: 'Not found' });
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'POST') {
      headers.set('Allow', 'POST, OPTIONS');
      return json(405, { error: 'Method not allowed' });
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json(415, { error: 'Expected application/json' });
    }
    let body: unknown;
    try {
      // Bound the body even when Content-Length is missing or incorrect.
      const reader = request.body?.getReader();
      if (!reader) return json(400, { error: 'Missing JSON body' });
      const decoder = new TextDecoder();
      let length = 0;
      let text = '';
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 1024) {
            await reader.cancel();
            return json(413, { error: 'Request too large' });
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      body = JSON.parse(text);
    } catch { return json(400, { error: 'Invalid JSON' }); }

    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Invalid request' });
    const licenceNumber = (body as Record<string, unknown>).licenceNumber;
    if (typeof licenceNumber !== 'string' || !/^RKP\/[0-9]{1,32}\/[0-9]{4}$/.test(licenceNumber)) {
      return json(400, { error: 'Invalid licenceNumber' });
    }
    try {
      return json(200, { licenceNumber, valid: await verify(licenceNumber) });
    } catch {
      // A database failure must never be presented as an invalid document.
      console.error('Licence verification database request failed');
      return json(503, { error: 'Verification temporarily unavailable' });
    }
  };
}
