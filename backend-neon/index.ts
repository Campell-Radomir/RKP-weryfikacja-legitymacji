import pg from 'pg';
import { createHandler } from './handler.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Missing DATABASE_URL');
const url = new URL(connectionString);
if (decodeURIComponent(url.username) !== 'rkp_licence_reader') {
  throw new Error('The API requires the rkp_licence_reader database role');
}
url.searchParams.set('sslmode', 'verify-full');
const pool = new pg.Pool({
  connectionString: url.toString(),
  max: 3,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  statement_timeout: 5000,
  query_timeout: 6000,
});
pool.on('error', () => console.error('Licence verification database pool error'));

const fetch = createHandler(async (licenceNumber) => {
  const result = await pool.query<{ valid: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM public.clergy_id_cards
      WHERE licence_number = $1
        AND valid_form <= CURRENT_TIMESTAMP
        AND valid_to >= CURRENT_TIMESTAMP
    ) AS valid
  `, [licenceNumber]);
  return result.rows[0].valid;
}, (process.env.ALLOWED_ORIGINS ?? 'https://rkp.org.pl,https://www.rkp.org.pl').split(',').map(s => s.trim()));

export default { fetch };
