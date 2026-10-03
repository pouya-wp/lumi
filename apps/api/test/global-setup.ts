import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://lumi:lumi@localhost:5432/lumi_test';

/** Applies migrations to the test database and empties every table. */
export default async function globalSetup() {
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: 'ignore' });
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  }
  await prisma.$disconnect();
}
