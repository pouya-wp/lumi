'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useT } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import type { DocBrief } from '@/lib/types';

export function useCreateDoc() {
  const { workspace } = useSession();
  const { locale } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const create = async (template: string, parentId?: string) => {
    if (!workspace) return;
    setBusy(template);
    try {
      const doc = await post<DocBrief>(`/workspaces/${workspace.id}/docs`, { template, parentId });
      qc.invalidateQueries({ queryKey: ['docs'] });
      router.push(`/${locale}/app/docs/${doc.id}`);
    } finally {
      setBusy(null);
    }
  };
  return { create, busy };
}
