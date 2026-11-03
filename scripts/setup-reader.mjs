import { loadEnvFile } from 'node:process';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

loadEnvFile('.env.local');
const target = '.env.neon-api.local';
if (existsSync(target)) throw new Error(`${target} already exists. Reuse it; credentials were not rotated.`);
const adminUrl = new URL(process.env.DATABASE_URL_UNPOOLED);
adminUrl.searchParams.set('sslmode', 'verify-full');
const client = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN');
  const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname='rkp_licence_reader'");
  if (existing.rowCount) throw new Error('Reader role already exists. No existing credentials were changed.');
  const password = randomBytes(32).toString('hex');
  // Random hex is generated locally; no user input is interpolated into SQL.
  await client.query(`CREATE ROLE rkp_licence_reader WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  const dbName = decodeURIComponent(adminUrl.pathname.slice(1));
  await client.query(`GRANT CONNECT ON DATABASE "${dbName.replaceAll('"', '""')}" TO rkp_licence_reader`);
  await client.query('GRANT USAGE ON SCHEMA public TO rkp_licence_reader');
  await client.query('GRANT SELECT (licence_number, valid_form, valid_to) ON public.clergy_id_cards TO rkp_licence_reader');
  await client.query('ALTER ROLE rkp_licence_reader SET default_transaction_read_only = on');
  await client.query("ALTER ROLE rkp_licence_reader SET statement_timeout = '5s'");
  const privileges = await client.query(`SELECT
    has_table_privilege('rkp_licence_reader', 'public.clergy_id_cards', 'INSERT') OR
    has_table_privilege('rkp_licence_reader', 'public.clergy_id_cards', 'UPDATE') OR
    has_table_privilege('rkp_licence_reader', 'public.clergy_id_cards', 'DELETE') OR
    has_table_privilege('rkp_licence_reader', 'public.clergy_id_cards', 'TRUNCATE') AS can_write`);
  if (privileges.rows[0].can_write) throw new Error('Unexpected inherited write privileges; setup rolled back.');
  const readerUrl = new URL(process.env.DATABASE_URL);
  readerUrl.username = 'rkp_licence_reader'; readerUrl.password = password;
  readerUrl.searchParams.set('sslmode', 'verify-full');
  writeFileSync(target, `RKP_READER_DATABASE_URL=${readerUrl.toString()}\n`, { mode: 0o600, flag: 'wx' });
  await client.query('COMMIT');
  console.log(`Created a read-only role. Deployment credentials saved privately in ${target}. No licence records changed.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Reader setup failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally { await client.end(); }
