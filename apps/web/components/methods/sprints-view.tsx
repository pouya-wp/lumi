'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type DragEvent } from 'react';
import { patch, post } from '@/lib/api';
import { addDays, daysBetween } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useSprintReport, useSprints } from '@/lib/queries';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';
import type { Sprint, SprintReport, Task } from '@/lib/types';
import { AvatarStack, Button, cx, Icon, Panel, PanelHeader, Pill, PriorityGlyph, StatusDot } from '../ui';
import { Dialog } from '../ui/dialog';

/** Scrum: active sprint burndown, retro, and drag-and-drop planning between backlog and sprints. */
export function SprintsView({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const sprints = useSprints(projectId).data ?? [];
  const active = sprints.find((s) => s.state === 'ACTIVE');
  const upcoming = sprints.filter((s) => s.state === 'PLANNED');
  const lastDone = [...sprints].reverse().find((s) => s.state === 'COMPLETED');
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.sprints(projectId) });
    qc.invalidateQueries({ queryKey: keys.tasks(projectId) });
    qc.invalidateQueries({ queryKey: ['sprintReport'] });
  };
  const onError = (e: Error) => toast(e.message, '⚠️');
  const assign = useMutation({ mutationFn: (body: { taskIds: string[]; sprintId: string | null }) => post(`/projects/${projectId}/sprints/assign`, body), onSuccess: refresh, onError });
  const create = useMutation({
    mutationFn: () => {
      const last = sprints[sprints.length - 1];
      const start = last ? new Date(Math.max(Date.now(), new Date(last.endAt).getTime())) : new Date();
      start.setHours(9, 0, 0, 0);
      return post(`/projects/${projectId}/sprints`, {
        name: `${locale === 'fa' ? 'اسپرینت' : 'Sprint'} ${num(sprints.length + 1, locale)}`,
        startAt: start.toISOString(),
        endAt: addDays(start, 14).toISOString(),
      });
    },
    onSuccess: refresh,
    onError,
  });
  const start = useMutation({ mutationFn: (id: string) => post(`/sprints/${id}/start`), onSuccess: refresh, onError });

  const backlog = tasks.filter((x) => !x.sprintId && x.status.category !== 'DONE' && x.status.category !== 'CANCELED');
  const drop = (e: DragEvent, sprintId: string | null) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/task');
    const task = tasks.find((x) => x.id === id);
    if (task && task.sprintId !== sprintId) assign.mutate({ taskIds: [id], sprintId });
  };
  const dropZone = (id: string | null) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(id ?? 'backlog');
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => drop(e, id),
  });

  return (
    <div className="flex flex-col gap-3">
      {active ? (
        <ActiveSprint sprint={active} tasks={tasks.filter((x) => x.sprintId === active.id)} onComplete={() => setCompleting(active)} />
      ) : (
        <Panel aurora="#16A34A" className="flex flex-wrap items-center gap-3 p-5">
          <span className="text-3xl">🏃</span>
          <p className="flex-1 text-sm text-muted">{t('sprint.dragToPlan')}</p>
          <Button variant="ink" onClick={() => create.mutate()} loading={create.isPending}>
            <Icon name="plus" size={15} /> {t('sprint.new')}
          </Button>
        </Panel>
      )}

      {lastDone && <Retro sprint={lastDone} projectId={projectId} />}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Panel className={cx('p-4 transition', over === 'backlog' && 'hatch')} {...dropZone(null)}>
          <PanelHeader icon="inbox" title={t('sprint.backlog')}>
            <Pill>{num(backlog.length, locale)}</Pill>
          </PanelHeader>
          <TaskList tasks={backlog} empty={t('sprint.emptyBacklog')} />
        </Panel>
        {[...(active ? [active] : []), ...upcoming].map((s) => {
          const items = tasks.filter((x) => x.sprintId === s.id);
          const pts = items.reduce((a, x) => a + (x.storyPoints ?? 1), 0);
          return (
            <Panel key={s.id} className={cx('p-4 transition', over === s.id && 'hatch', s.state === 'ACTIVE' && 'shadow-[inset_0_0_0_1.5px_var(--lumi)]')} {...dropZone(s.id)}>
              <PanelHeader icon={s.state === 'ACTIVE' ? 'bolt' : 'calendar'} title={s.name}>
                <Pill tone={s.state === 'ACTIVE' ? 'lumi' : 'neutral'}>{t(`sprint.${s.state.toLowerCase()}`)}</Pill>
                <Pill>{t('sprint.points', { n: pts })}</Pill>
              </PanelHeader>
              <p className="mt-1 ps-11 text-[11px] text-muted">
                {formatDate(s.startAt, locale)} — {formatDate(s.endAt, locale)}
              </p>
              <TaskList tasks={items} empty={t('task.dropHere')} />
              {s.state === 'PLANNED' && !active && (
                <Button size="sm" variant="ink" className="mt-3 w-full" onClick={() => start.mutate(s.id)} loading={start.isPending}>
                  ▶ {t('sprint.start')}
                </Button>
              )}
            </Panel>
          );
        })}
        <button onClick={() => create.mutate()} className="hatch grid min-h-40 place-items-center rounded-[var(--radius-panel)] text-sm text-muted shadow-[inset_0_0_0_1px_var(--line)] transition hover:text-ink">
          <span className="flex items-center gap-2">
            <Icon name="plus" size={16} /> {t('sprint.new')}
          </span>
        </button>
      </div>

      {completing && <CompleteDialog sprint={completing} onClose={() => setCompleting(null)} onDone={refresh} />}
    </div>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  const { locale } = useT();
  const { openTask } = useUi();
  if (!tasks.length) return <p className="py-8 text-center text-xs text-muted">{empty}</p>;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
          onClick={() => openTask(task.id)}
          className="flex cursor-grab items-center gap-2 rounded-[12px] bg-sunken px-3 py-2 text-sm shadow-[inset_0_0_0_1px_var(--line)] transition hover:-translate-y-px active:cursor-grabbing"
        >
          <StatusDot color={task.status.color} category={task.status.category} size={8} />
          <PriorityGlyph priority={task.priority} size={11} />
          <span className={cx('flex-1 truncate', task.status.category === 'DONE' && 'text-muted line-through')}>{task.title}</span>
          <span className="rounded-full bg-panel px-1.5 text-[10px] text-muted tabular-nums">{num(task.storyPoints ?? 1, locale)}</span>
          <AvatarStack users={task.assignees.filter((a) => a.role === 'ASSIGNEE')} size={18} max={1} />
        </div>
      ))}
    </div>
  );
}

function ActiveSprint({ sprint, tasks, onComplete }: { sprint: Sprint; tasks: Task[]; onComplete: () => void }) {
  const { t, locale } = useT();
  const report = useSprintReport(sprint.id).data;
  const left = Math.max(0, daysBetween(new Date(), new Date(sprint.endAt)));
  const total = tasks.reduce((a, x) => a + (x.storyPoints ?? 1), 0);
  const done = tasks.filter((x) => x.status.category === 'DONE').reduce((a, x) => a + (x.storyPoints ?? 1), 0);
  return (
    <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
      <Panel aurora="#4F5BFF" className="beam p-5">
        <span className="beam-ring" />
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span className="pulse" /> {t('sprint.active')} · {t('sprint.daysLeft', { n: left })}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{sprint.name}</h2>
            {sprint.goal && <p className="mt-1 text-sm text-ink-2">🎯 {sprint.goal}</p>}
          </div>
          <Button variant="ink" onClick={onComplete}>
            ✓ {t('sprint.complete')}
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted">{t('sprint.summary', { done, total })}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-gradient-to-l from-lumi to-[#a5b4fc] transition-[width] duration-700" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        {report && <Burndown report={report} />}
      </Panel>
      <Panel className="p-5">
        <PanelHeader icon="bolt" title={t('sprint.velocity')} />
        {report?.averageVelocity != null && <p className="mt-2 text-xs text-muted">{t('sprint.avgVelocity', { n: Math.round(report.averageVelocity) })}</p>}
        <div className="mt-6 flex h-44 items-end gap-3">
          {(report?.velocity ?? []).map((v) => {
            const max = Math.max(1, ...report!.velocity.map((x) => x.committedPoints));
            return (
              <div key={v.id} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex w-full flex-1 items-end justify-center gap-1">
                  <div className="hatch w-1/2 rounded-[8px] bg-sunken shadow-[inset_0_0_0_1px_var(--line)]" style={{ height: `${(v.committedPoints / max) * 100}%` }} />
                  <div className="hatch-ink w-1/2 rounded-[8px]" style={{ height: `${(v.completedPoints / max) * 100}%` }} />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted">{v.name}</span>
              </div>
            );
          })}
          {!report?.velocity.length && <p className="w-full self-center text-center text-xs text-muted">—</p>}
        </div>
      </Panel>
    </div>
  );
}

/** Ideal (dashed) vs actual (filled) remaining points. */
function Burndown({ report }: { report: SprintReport }) {
  const { t, locale } = useT();
  const W = 600;
  const H = 180;
  const n = report.series.length - 1 || 1;
  const max = Math.max(1, report.total);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / max) * H;
  const actual = report.series.map((p, i) => (p.actual === null ? null : [x(i), y(p.actual)] as const)).filter(Boolean) as [number, number][];
  const line = actual.map(([a, b], i) => `${i ? 'L' : 'M'}${a} ${b}`).join(' ');
  const area = actual.length ? `${line} L${actual[actual.length - 1][0]} ${H} L0 ${H} Z` : '';
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="font-medium text-ink">{t('sprint.burndown')}</span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-muted" /> {t('sprint.ideal')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full bg-lumi" /> {t('sprint.actual')}
        </span>
      </div>
      <svg viewBox={`0 -8 ${W} ${H + 24}`} className="w-full overflow-visible" style={{ transform: locale === 'fa' ? 'scaleX(-1)' : undefined }}>
        <defs>
          <linearGradient id="bd" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--lumi)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--lumi)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--line)" strokeDasharray="2 6" />
        ))}
        <path d={`M0 ${y(report.total)} L${W} ${H}`} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="6 6" fill="none" />
        {area && <path d={area} fill="url(#bd)" />}
        {line && <path d={line} stroke="var(--lumi)" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {actual.length > 0 && (
          <circle cx={actual[actual.length - 1][0]} cy={actual[actual.length - 1][1]} r="6" fill="var(--panel)" stroke="var(--lumi)" strokeWidth="3" />
        )}
      </svg>
    </div>
  );
}

function CompleteDialog({ sprint, onClose, onDone }: { sprint: Sprint; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const complete = useMutation({
    mutationFn: (carryOver: 'next' | 'backlog') => post<{ completedPoints: number; committedPoints: number }>(`/sprints/${sprint.id}/complete`, { carryOver }),
    onSuccess: (r) => {
      toast(t('sprint.summary', { done: r.completedPoints, total: r.committedPoints }), '🎉');
      onDone();
      onClose();
    },
  });
  return (
    <Dialog onClose={onClose} label={t('sprint.complete')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold">
          {t('sprint.complete')} · {sprint.name}
        </h2>
        <p className="mt-2 text-sm text-muted">{t('sprint.summary', { done: sprint.stats.donePoints, total: sprint.stats.points })}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="ink" onClick={() => complete.mutate('next')} loading={complete.isPending}>
            ➡️ {t('sprint.carryNext')}
          </Button>
          <Button variant="soft" onClick={() => complete.mutate('backlog')} loading={complete.isPending}>
            ↩️ {t('sprint.carryBacklog')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Retro({ sprint, projectId }: { sprint: Sprint; projectId: string }) {
  const { t } = useT();
  const qc = useQueryClient();
  const retro = sprint.retro ?? {};
  const save = useMutation({
    mutationFn: (next: Sprint['retro']) => patch(`/sprints/${sprint.id}`, { retro: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sprints(projectId) }),
  });
  const columns: { key: 'wentWell' | 'improve' | 'actions'; tone: string }[] = [
    { key: 'wentWell', tone: 'var(--success)' },
    { key: 'improve', tone: 'var(--warn)' },
    { key: 'actions', tone: 'var(--lumi)' },
  ];
  return (
    <Panel className="p-5">
      <PanelHeader icon="message" title={`${t('sprint.retro')} · ${sprint.name}`}>
        {sprint.summary && <Pill tone="success">{t('sprint.summary', { done: sprint.summary.completedPoints, total: sprint.summary.committedPoints })}</Pill>}
      </PanelHeader>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {columns.map(({ key, tone }) => (
          <div key={key} className="rounded-[18px] p-3" style={{ background: `color-mix(in oklab, ${tone} 8%, var(--panel))` }}>
            <p className="mb-2 text-sm font-semibold">{t(`sprint.${key}`)}</p>
            <div className="flex flex-col gap-1.5">
              {(retro[key] ?? []).map((note, i) => (
                <div key={i} className="group flex items-start gap-2 rounded-[12px] bg-panel p-2.5 text-sm shadow-panel" style={{ transform: `rotate(${(i % 3) - 1}deg)` }}>
                  <span className="flex-1">{note}</span>
                  <button
                    onClick={() => save.mutate({ ...retro, [key]: (retro[key] ?? []).filter((_, j) => j !== i) })}
                    className="text-muted opacity-0 group-hover:opacity-100 hover:text-danger"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              <input
                placeholder={t('sprint.addNote')}
                onKeyDown={(e) => {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (e.key === 'Enter' && v) {
                    save.mutate({ ...retro, [key]: [...(retro[key] ?? []), v] });
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                className="rounded-[12px] bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted focus:bg-panel"
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
