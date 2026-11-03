import { defineConfig } from '@neon/config/v1';

// Credentials are loaded only at deployment time from the ignored env file.
// Override both Neon defaults so the function receives no owner connection URL.
const readerUrl = process.env.RKP_READER_DATABASE_URL;
if (!readerUrl) throw new Error('Missing RKP_READER_DATABASE_URL. Run npm run setup:reader first.');

export default defineConfig({
  functions: {
    verify: {
      name: 'Weryfikacja legitymacji RKP',
      source: './backend-neon/index.ts',
      env: {
        DATABASE_URL: readerUrl,
        DATABASE_URL_UNPOOLED: readerUrl,
        ALLOWED_ORIGINS: 'https://rkp.org.pl,https://www.rkp.org.pl',
      },
    },
  },
});
