'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, del, post } from '@/lib/api';
import { formatMinutes } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useFields, useSearch, useTaskTime, useTimer, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTaskActions } from '@/lib/task-actions';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';
import type { TaskDetail } from '@/lib/types';
import { MarkdownLite } from '@/lib/markdown-lite';
import { Avatar, Button, cx, Icon, IconButton } from '../ui';
import { FieldCell, FieldIcon } from './table-view';

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="ms-auto">{aside}</div>
      </div>
      {children}
    </section>
  );
}

export function CustomFieldsSection({ task }: { task: TaskDetail }) {
  const { t } = useT();
  const fields = useFields(task.projectId).data ?? [];
  const members = useWorkspace(task.project.workspaceId).data?.members ?? [];
  const actions = useTaskActions();
  if (!fields.length) return null;
  return (
    <Section title={t('fields.title')}>
      <div className="grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        {fields.map((f) => (
          <div key={f.id} className="contents">
            <span className="flex items-center gap-1.5 truncate text-muted">
              <FieldIcon type={f.type} /> {f.name}
            </span>
            <div className="flex min-h-9 items-center">
              <FieldCell
                field={f}
                value={task.customFields?.[f.id]}
                members={members}
                onSave={(v) => actions.update.mutate({ id: task.id, projectId: task.projectId, data: { customFields: { [f.id]: v } } })}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Preset recurrence rules; Iranian work week is Saturday–Wednesday. */
export function RecurrencePicker({ task }: { task: TaskDetail }) {
  const { t, locale } = useT();
  const actions = useTaskActions();
  const presets: [string, string][] = [
    ['', t('recur.none')],
    ['FREQ=DAILY', t('recur.daily')],
    [locale === 'fa' ? 'FREQ=WEEKLY;BYDAY=SA,SU,MO,TU,WE' : 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', t('recur.weekdays')],
    ['FREQ=WEEKLY', t('recur.weekly')],
    ['FREQ=WEEKLY;INTERVAL=2', t('recur.biweekly')],
    [locale === 'fa' ? 'FREQ=JMONTHLY' : 'FREQ=MONTHLY', t('recur.monthly')],
    [locale === 'fa' ? 'FREQ=JMONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY;BYMONTHDAY=-1', t('recur.monthEnd')],
    ['FREQ=YEARLY', t('recur.yearly')],
  ];
  const current = task.recurrence ?? '';
  const known = presets.some(([v]) => v === current);
  return (
    <label className={cx('flex h-9 items-center gap-2 rounded-full px-3 shadow-[inset_0_0_0_1px_var(--line)]', current && 'bg-lumi/10 text-lumi')}>
      <span>🔁</span>
      <select
        value={current}
        onChange={(e) => actions.update.mutate({ id: task.id, projectId: task.projectId, data: { recurrence: e.target.value || null } })}
        className="bg-transparent text-sm outline-none"
      >
        {!known && <option value={current}>{current}</option>}
        {presets.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DependenciesSection({ task }: { task: TaskDetail }) {
  const { t } = useT();
  const { openTask } = useUi();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const search = useSearch(task.project.workspaceId, q);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.task(task.id) });
    qc.invalidateQueries({ queryKey: keys.tasks(task.projectId) });
  };
  const add = useMutation({
    mutationFn: (body: { toTaskId: string; type: string }) => post(`/tasks/${task.id}/dependencies`, body),
    onSuccess: () => {
      setQ('');
      refresh();
    },
    onError: (e: Error) => toast(e instanceof ApiError && e.status === 400 ? t('deps.cycle') : e.message, '⚠️'),
  });
  const remove = useMutation({
    mutationFn: ({ toTaskId, type, from }: { toTaskId: string; type: string; from: string }) => del(`/tasks/${from}/dependencies?toTaskId=${toTaskId}&type=${type}`),
    onSuccess: refresh,
  });

  const blocks = task.dependencies.filter((d) => d.type === 'BLOCKS');
  const blockedBy = task.dependents.filter((d) => d.type === 'BLOCKS');
  const related = task.dependencies.filter((d) => d.type !== 'BLOCKS');
  const row = (id: string, title: string, number: number, icon: string, onRemove: () => void) => (
    <div key={`${icon}-${id}`} className="group flex items-center gap-2 rounded-[12px] px-2 py-1.5 hover:bg-sunken">
      <span className="text-xs">{icon}</span>
      <button onClick={() => openTask(id)} className="flex-1 truncate text-start text-sm">
        <span className="me-2 text-[11px] text-muted" dir="ltr">
          #{number}
        </span>
        {title}
      </button>
      <IconButton icon="close" label="remove" className="size-7 opacity-0 group-hover:opacity-100" onClick={onRemove} />
    </div>
  );

  return (
    <Section title={t('deps.title')}>
      {blockedBy.length > 0 && <p className="mb-1 text-[11px] text-danger">⛔ {t('deps.blockedBy')}</p>}
      {blockedBy.map((d) => row(d.from.id, d.from.title, d.from.number, '⛔', () => remove.mutate({ toTaskId: task.id, type: d.type, from: d.from.id })))}
      {blocks.length > 0 && <p className="mt-2 mb-1 text-[11px] text-warn">🚧 {t('deps.blocks')}</p>}
      {blocks.map((d) => row(d.to.id, d.to.title, d.to.number, '🚧', () => remove.mutate({ toTaskId: d.to.id, type: d.type, from: task.id })))}
      {related.map((d) => row(d.to.id, d.to.title, d.to.number, '🔗', () => remove.mutate({ toTaskId: d.to.id, type: d.type, from: task.id })))}
      <div className="relative mt-1">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Icon name="plus" size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('deps.add')} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        </div>
        {q && !!search.data?.tasks.length && (
          <div className="panel absolute z-20 mt-1 w-full p-1">
            {search.data.tasks
              .filter((x) => x.id !== task.id)
              .slice(0, 6)
              .map((x) => (
                <div key={x.id} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm hover:bg-sunken">
                  <span className="text-[11px] text-muted" dir="ltr">
                    {x.key}
                  </span>
                  <span className="flex-1 truncate">{x.title}</span>
                  <button onClick={() => add.mutate({ toTaskId: x.id, type: 'BLOCKS' })} className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">
                    🚧 {t('deps.blocks')}
                  </button>
                  <button onClick={() => add.mutate({ toTaskId: x.id, type: 'RELATES' })} className="rounded-full bg-sunken px-2 py-0.5 text-[11px]">
                    🔗 {t('deps.relates')}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Live mm:ss since `since`. */
export function useElapsed(since?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return '';
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function useTimerActions() {
  const qc = useQueryClient();
  const refresh = (taskId?: string) => {
    qc.invalidateQueries({ queryKey: keys.timer });
    qc.invalidateQueries({ queryKey: ['taskTime'] });
    qc.invalidateQueries({ queryKey: ['timesheet'] });
    if (taskId) qc.invalidateQueries({ queryKey: keys.activity(taskId) });
  };
  const start = useMutation({ mutationFn: (taskId: string) => post(`/tasks/${taskId}/timer/start`), onSuccess: (_d, id) => refresh(id) });
  const stop = useMutation({ mutationFn: () => post('/me/timer/stop'), onSuccess: () => refresh() });
  return { start, stop };
}

export function TimeSection({ task }: { task: TaskDetail }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const time = useTaskTime(task.id);
  const timer = useTimer();
  const { start, stop } = useTimerActions();
  const qc = useQueryClient();
  const [minutes, setMinutes] = useState('');
  const running = timer.data?.taskId === task.id ? timer.data : null;
  const elapsed = useElapsed(running?.startedAt);
  const log = useMutation({
    mutationFn: () => post(`/tasks/${task.id}/time`, { minutes: Number(minutes) }),
    onSuccess: () => {
      setMinutes('');
      qc.invalidateQueries({ queryKey: keys.taskTime(task.id) });
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/time/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.taskTime(task.id) }) });
  const total = time.data?.total ?? 0;
  const estimate = task.estimateMin ?? 0;

  return (
    <Section
      title={`⏱️ ${t('time.title')}`}
      aside={
        <span className="text-xs text-muted tabular-nums">
          {formatMinutes(total, locale)}
          {estimate > 0 && ` / ${formatMinutes(estimate, locale)}`}
        </span>
      }
    >
      {estimate > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className={cx('h-full rounded-full transition-[width]', total > estimate ? 'bg-danger' : 'bg-lumi')} style={{ width: `${Math.min(100, (total / estimate) * 100)}%` }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="ink" onClick={() => stop.mutate()} loading={stop.isPending}>
            <span className="pulse !bg-danger" /> <span className="tabular-nums" dir="ltr">{num(elapsed, locale)}</span> · {t('time.stop')}
          </Button>
        ) : (
          <Button variant="soft" onClick={() => start.mutate(task.id)} loading={start.isPending}>
            ▶ {t('time.start')}
          </Button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(minutes) > 0) log.mutate();
          }}
          className="flex items-center gap-1 rounded-full bg-sunken ps-3 shadow-[inset_0_0_0_1px_var(--line)]"
        >
          <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder={t('time.minutes')} className="w-20 bg-transparent text-sm outline-none" dir="ltr" />
          <Button type="submit" size="sm" variant="ghost" disabled={!minutes}>
            {t('time.log')}
          </Button>
        </form>
      </div>
      {!!time.data?.entries.length && (
        <div className="mt-3 flex flex-col">
          {time.data.entries.slice(0, 6).map((e) => (
            <div key={e.id} className="group flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-xs hover:bg-sunken">
              <Avatar name={e.user?.name ?? '?'} size={20} />
              <span className="text-ink-2">{formatDate(e.startedAt, locale, { day: 'numeric', month: 'short' })}</span>
              {e.note && <span className="truncate text-muted">“{e.note}”</span>}
              <span className="ms-auto font-medium tabular-nums">{e.minutes ? formatMinutes(e.minutes, locale) : '…'}</span>
              {e.userId === user?.id && e.endedAt && (
                <button onClick={() => remove.mutate(e.id)} className="text-muted opacity-0 group-hover:opacity-100 hover:text-danger">
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/** AI helpers in the task drawer: subtask breakdown (preview → create) and a discussion summary. */
export function AiSection({ task }: { task: TaskDetail }) {
  const { t } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState<{ title: string; estimateMin: number }[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const onError = (e: Error) => toast(e instanceof ApiError && e.status === 503 ? t('ai.disabled') : e.message, '⚠️');
  const breakdown = useMutation({
    mutationFn: (apply: boolean) => post<{ subtasks: { title: string; estimateMin: number }[] }>(`/tasks/${task.id}/ai/breakdown`, { apply }),
    onSuccess: (r, apply) => {
      if (apply) {
        setPreview(null);
        qc.invalidateQueries({ queryKey: keys.task(task.id) });
        qc.invalidateQueries({ queryKey: keys.tasks(task.projectId) });
      } else setPreview(r.subtasks);
    },
    onError,
  });
  const summarize = useMutation({ mutationFn: () => post<{ summary: string }>(`/tasks/${task.id}/ai/summary`), onSuccess: (r) => setSummary(r.summary), onError });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="soft" onClick={() => breakdown.mutate(false)} loading={breakdown.isPending && !preview}>
          {t('ai.breakdown')}
        </Button>
        <Button size="sm" variant="soft" onClick={() => summarize.mutate()} loading={summarize.isPending}>
          {t('ai.summary')}
        </Button>
      </div>
      {preview && (
        <div className="rise mt-3 rounded-[18px] bg-lumi/[.06] p-3 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--lumi)_25%,transparent)]">
          {preview.map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-1 py-1.5 text-sm">
              <span className="text-lumi">✦</span>
              <span className="flex-1">{s.title}</span>
              <span className="text-[11px] text-muted">{s.estimateMin}′</span>
            </div>
          ))}
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="ink" onClick={() => breakdown.mutate(true)} loading={breakdown.isPending}>
              {t('ai.apply')}
            </Button>
          </div>
        </div>
      )}
      {summary && (
        <div className="rise mt-3 rounded-[18px] bg-sunken p-4 text-sm shadow-[inset_0_0_0_1px_var(--line)]">
          <MarkdownLite text={summary} />
        </div>
      )}
    </div>
  );
}
