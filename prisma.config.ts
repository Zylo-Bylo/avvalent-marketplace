import dotenv from 'dotenv';
import { defineConfig } from '@prisma/config';

dotenv.config({ path: '.env.local' });

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'file:./dev.db';
const isVercelBuild = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

if (
  isVercelBuild &&
  !databaseUrl.startsWith('postgresql://') &&
  !databaseUrl.startsWith('postgres://')
) {
  throw new Error(
    'Refusing to use a SQLite Prisma datasource during a Vercel build. ' +
      'Set DATABASE_URL or DIRECT_DATABASE_URL to the production PostgreSQL URL.',
  );
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: './prisma/migrations',
  },
});
