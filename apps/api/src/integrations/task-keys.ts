import type { PrismaService } from '../prisma/prisma.service';

const KEY_RE = /\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/g;
const CLOSE_RE = /\b(fix(e[sd])?|close[sd]?|resolve[sd]?|done)\b|حل\s*شد|بسته\s*شد/i;

/** Task keys like "APP-12" mentioned in free text, de-duplicated in order. */
export function extractKeys(text: string) {
  return [...new Set([...text.matchAll(KEY_RE)].map((m) => `${m[1]}-${m[2]}`))];
}

/** True when the text says the referenced work is finished ("fixes APP-3", "closes", "حل شد"). */
export const closesWork = (text: string) => CLOSE_RE.test(text);

/** Resolves keys to live task ids inside one workspace. */
export async function findTasksByKeys(prisma: PrismaService, workspaceId: string, keys: string[]) {
  const found: { id: string; key: string; projectId: string }[] = [];
  for (const key of keys) {
    const [projectKey, num] = key.split('-');
    const task = await prisma.task.findFirst({
      where: { number: Number(num), deletedAt: null, project: { workspaceId, key: projectKey } },
      select: { id: true, projectId: true },
    });
    if (task) found.push({ id: task.id, key, projectId: task.projectId });
  }
  return found;
}
