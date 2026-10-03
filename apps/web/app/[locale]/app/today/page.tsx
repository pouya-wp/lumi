'use client';

import { copyText } from '@/lib/clipboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DayArc } from '@/components/dashboard/charts';
import { Button, CheckCircle, cx, Empty, Icon, Panel, PanelHeader, PriorityGlyph } from '@/components/ui';
import { ApiError, get, patch, post } from '@/lib/api';
import { formatTime, longToday } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { MarkdownLite } from '@/lib/markdown-lite';
import { keys, usePlan } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';
import type { PlanBlock } from '@/lib/types';

const START_H = 8;
const END_H = 19;
const HOUR_PX = 72;
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TodayPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask } = useUi();
  const qc = useQueryClient();
  const toast = useToast();
  const date = todayKey();
  const plan = usePlan(date);
  const [standup, setStandup] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const make = useMutation({
    mutationFn: () => post<PlanBlock[]>('/me/plan', { workspaceId: workspace!.id, date }),
    onSuccess: (blocks) => qc.setQueryData(keys.plan(date), blocks),
  });
  const writeStandup = useMutation({
    mutationFn: () => post<{ text: string }>(`/workspaces/${workspace!.id}/ai/standup`),
    onSuccess: (r) => setStandup(r.text),
    onError: (e: Error) => toast(e instanceof ApiError && e.status === 503 ? t('ai.disabled') : e.message, '⚠️'),
  });
  const complete = useMutation({
    mutationFn: async (b: PlanBlock) => {
      const project = await get<{ statuses: { id: string; category: string }[] }>(`/projects/${b.task!.projectId}`);
      const done = project.statuses.find((s) => s.category === 'DONE');
      if (done) await patch(`/tasks/${b.task!.id}`, { statusId: done.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.plan(date) });
      qc.invalidateQueries({ queryKey: ['myTasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const blocks = plan.data ?? [];
  const y = (iso: string | Date) => {
    const d = new Date(iso);
    return (d.getHours() + d.getMinutes() / 60 - START_H) * HOUR_PX;
  };
  const nowY = y(now);

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
      <Panel aurora="#4F5BFF" aurora2="#F97316" className="rise p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{t('ai.today')} ☀️</h1>
            <p className="text-sm text-muted">{longToday(locale)}</p>
          </div>
          <DayArc />
          <Button variant="ink" onClick={() => make.mutate()} loading={make.isPending}>
            <Icon name="sparkle" size={15} /> {blocks.length ? t('ai.replan') : t('ai.planDay')}
          </Button>
        </div>

        {blocks.length === 0 ? (
          <div className="mt-6">
            <Empty emoji="🗓️" text={t('ai.planHint')} />
          </div>
        ) : (
          <div className="relative mt-6 flex" style={{ height: (END_H - START_H) * HOUR_PX }}>
            <div className="w-14 shrink-0">
              {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
                <div key={i} className="absolute text-[11px] text-muted tabular-nums" style={{ top: i * HOUR_PX - 7 }}>
                  {num(`${String(START_H + i).padStart(2, '0')}:00`, locale)}
                </div>
              ))}
            </div>
            <div className="relative flex-1">
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: i * HOUR_PX }} />
              ))}
              {nowY > 0 && nowY < (END_H - START_H) * HOUR_PX && (
                <div className="absolute inset-x-0 z-20 flex items-center" style={{ top: nowY }}>
                  <span className="size-2.5 rounded-full bg-danger shadow-[0_0_10px_var(--danger)]" />
                  <span className="h-0.5 flex-1 bg-danger" />
                </div>
              )}
              {blocks.map((b, i) => {
                const top = y(b.startAt);
                const height = Math.max(28, y(b.endAt) - top - 4);
                if (b.kind === 'break') {
                  return (
                    <div key={b.id} className="hatch absolute inset-x-0 grid place-items-center rounded-[14px] text-xs text-muted" style={{ top, height }}>
                      {t('ai.lunch')}
                    </div>
                  );
                }
                const color = b.task?.project.color ?? '#4F5BFF';
                const done = !!b.task?.completedAt;
                const live = new Date(b.startAt) <= now && now < new Date(b.endAt);
                return (
                  <div
                    key={b.id}
                    className={cx('rise absolute inset-x-0 flex gap-3 overflow-hidden rounded-[14px] p-3 text-sm transition hover:z-10 hover:-translate-y-px', live && 'beam', done && 'opacity-50')}
                    style={{ top, height, background: `color-mix(in oklab, ${color} 12%, var(--panel))`, boxShadow: `inset 3px 0 0 ${color}`, animationDelay: `${i * 40}ms` }}
                  >
                    {live && <span className="beam-ring" />}
                    {b.task && <CheckCircle checked={done} onChange={() => !done && complete.mutate(b)} />}
                    <button onClick={() => b.task && openTask(b.task.id)} className="min-w-0 flex-1 text-start">
                      <p className={cx('truncate font-medium', done && 'line-through')}>
                        {b.task?.project.icon} {b.title}
                      </p>
                      <p className="text-[11px] text-muted tabular-nums">
                        {formatTime(b.startAt, locale)} – {formatTime(b.endAt, locale)}
                      </p>
                    </button>
                    {b.task && <PriorityGlyph priority={b.task.priority as never} size={12} />}
                    {live && b.task && (
                      <Link href={`/${locale}/app/focus`} className="self-start rounded-full bg-ink px-3 py-1 text-[11px] text-on-ink">
                        🍅
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        <Panel className="p-5">
          <PanelHeader icon="message" title={t('ai.standup')}>
            {standup && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  copyText(standup);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t('ai.copied') : t('ai.copy')}
              </Button>
            )}
          </PanelHeader>
          {standup ? (
            <div className="rise mt-4 rounded-[16px] bg-sunken p-4 text-sm">
              <MarkdownLite text={standup} />
            </div>
          ) : (
            <Button variant="soft" className="mt-4 w-full" onClick={() => writeStandup.mutate()} loading={writeStandup.isPending}>
              ✍️ {t('ai.standup')}
            </Button>
          )}
        </Panel>
        <Panel className="night p-5 text-white">
          <p className="text-sm text-white/60">{t('focus.subtitle')}</p>
          <Link href={`/${locale}/app/focus`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
            🍅 {t('focus.title')}
          </Link>
        </Panel>
      </div>
    </div>
  );
}
