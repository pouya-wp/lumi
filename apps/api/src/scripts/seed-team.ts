/**
 * Creates the Beyondex workspace and its members on a fresh deployment.
 *
 *   node dist/scripts/seed-team.js
 *
 * Emails come from TEAM_EMAILS (comma separated, in the order below) and default to @beyondex.io
 * addresses. Each new account gets a random password, printed once; members change it from
 * Settings → My account. Safe to run again: existing users and memberships are left as they are.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const TEAM = [
  { name: 'پویا صادق‌پور', en: 'Pouya Sadeghpour', email: 'pouya@beyondex.io', role: 'OWNER' as const },
  { name: 'امیرحسین قطبی', en: 'Amirhossein Ghotbi', email: 'amirhossein@beyondex.io', role: 'ADMIN' as const },
  { name: 'متین ایزدی', en: 'Matin Izadi', email: 'matin@beyondex.io', role: 'ADMIN' as const },
];

const WORKSPACE = process.env.TEAM_WORKSPACE ?? 'بیاندکس';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const workspaces = app.get(WorkspacesService);
  const emails = (process.env.TEAM_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
  const created: { name: string; email: string; password: string }[] = [];

  const users = [];
  for (const [i, m] of TEAM.entries()) {
    const email = emails[i] || m.email;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const password = randomBytes(9).toString('base64url');
      user = await prisma.user.create({ data: { email, name: m.name, locale: 'fa', calendar: 'jalali', timezone: 'Asia/Tehran', passwordHash: await bcrypt.hash(password, 10) } });
      created.push({ name: `${m.name} (${m.en})`, email, password });
    }
    users.push({ ...m, user });
  }

  const owner = users.find((u) => u.role === 'OWNER')!.user;
  let workspace = await prisma.workspace.findFirst({ where: { name: WORKSPACE, memberships: { some: { userId: owner.id, role: 'OWNER' } } } });
  if (!workspace) workspace = await workspaces.create(owner.id, { name: WORKSPACE }, { withStarterProject: true, locale: 'fa' });

  for (const u of users) {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: u.user.id, workspaceId: workspace.id } },
      create: { userId: u.user.id, workspaceId: workspace.id, role: u.role },
      update: {},
    });
  }

  console.log(`\n✅ Workspace «${workspace.name}» (${workspace.id}) with ${users.length} members.`);
  if (created.length) {
    console.log('\nNew accounts — share each password privately, then change it in Settings → My account:\n');
    for (const c of created) console.log(`  ${c.name.padEnd(42)} ${c.email.padEnd(28)} ${c.password}`);
  } else {
    console.log('All accounts already existed; passwords were not changed.');
  }
  console.log('');
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
