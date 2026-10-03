'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Button, cx, Empty, Panel, Segmented, Spinner } from '@/components/ui';
import { post } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n-client';
import { useNotifications } from '@/lib/queries';
import { useUi } from '@/lib/ui-state';
import type { Notification } from '@/lib/types';

const ICONS: Record<string, string> = {
  'task.assigned': '📌',
  'task.proposed': '🤝',
  'task.proposal.accepted': '✅',
  'task.proposal.declined': '🙅',
  'task.proposal.countered': '📅',
  'task.status': '🔄',
  'comment.mention': '💬',
  'comment.reply': '↩️',
  'workspace.joined': '👋',
};

export default function InboxPage() {
  const { t, locale } = useT();
  const { openTask } = useUi();
  const [filter, setFilter] = useState<'unread' | 'all'>('all');
  const list = useNotifications(filter === 'unread');
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['unread'] });
  };
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: refresh });
  const read = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: refresh });

  const open = (n: Notification) => {
    if (!n.readAt) read.mutate(n.id);
    if (n.payload.taskId) openTask(n.payload.taskId);
  };

  return (
    <Panel aurora="#F97316" className="rise mx-auto min-h-[70vh] max-w-3xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('inbox.title')}</h1>
        <div className="ms-auto flex items-center gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('inbox.all') },
              { value: 'unread', label: t('inbox.unread') },
            ]}
          />
          <Button size="sm" variant="ghost" onClick={() => readAll.mutate()}>
            {t('inbox.markAll')}
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-1">
        {list.isLoading && <Spinner />}
        {list.data?.length === 0 && <Empty emoji="🌿" text={t('inbox.empty')} />}
        {list.data?.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={cx('group flex items-start gap-3 rounded-[18px] p-3 text-start transition hover:bg-sunken', !n.readAt && 'bg-lumi/[.04]')}
          >
            <span className="relative">
              <Avatar name={n.actor?.name ?? 'Lumi'} src={n.actor?.avatarUrl} size={38} />
              <span className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full bg-panel text-[11px] shadow-panel">{ICONS[n.type] ?? '🔔'}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-relaxed">
                <span className="font-semibold">{n.actor?.name}</span>{' '}
                {t(`notif.${n.type}`, { title: n.payload.title ?? '', status: n.payload.status ?? '' })}
              </span>
              {(n.payload.note || n.payload.excerpt) && (
                <span className="mt-1 block truncate rounded-[10px] bg-sunken px-2.5 py-1.5 text-xs text-ink-2">“{n.payload.note ?? n.payload.excerpt}”</span>
              )}
              <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                {n.payload.key && <span dir="ltr">{n.payload.key}</span>}
                {timeAgo(n.createdAt, locale)}
              </span>
            </span>
            {!n.readAt && <span className="mt-2 size-2 rounded-full bg-lumi shadow-[0_0_10px_var(--lumi)]" />}
          </button>
        ))}
      </div>
    </Panel>
  );
}
