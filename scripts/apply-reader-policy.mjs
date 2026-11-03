import { loadEnvFile } from 'node:process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
loadEnvFile('.env.local');
const url = new URL(process.env.DATABASE_URL_UNPOOLED);
url.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query(readFileSync('database/001-api-reader-policy.sql', 'utf8'));
  console.log('Applied SELECT policy for the dedicated API role. RLS remains enabled.');
} catch (error) {
  console.error('Policy migration failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await client.end(); }
