'use client';

import Link from 'next/link';
import { HatchBars, DayArc, SegmentGauge } from '@/components/dashboard/charts';
import { TaskRow } from '@/components/tasks/task-row';
import { DueChip } from '@/components/tasks/task-drawer';
import { Avatar, Button, Delta, Empty, Icon, IconButton, Odometer, Panel, PanelHeader, Pill, Spinner } from '@/components/ui';
import { longToday, timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useDashboard, useProjects } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';

export default function DashboardPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask, openQuickAdd } = useUi();
  const dash = useDashboard(workspace?.id);
  const projects = useProjects(workspace?.id);

  if (!dash.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }
  const { kpis, completedByDay, team, myFocus, upcoming, activity } = dash.data;
  const doneWeek = completedByDay.reduce((a, d) => a + d.count, 0);
  const maxOpen = Math.max(1, ...team.map((m) => m.open));

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1fr_340px]">
      {/* Throughput */}
      <Panel aurora="#16A34A" aurora2="#F97316" className="rise p-5 xl:col-span-2">
        <PanelHeader icon="bolt" title={t('dash.overview')}>
          <Pill>{t('dash.last7')}</Pill>
          <IconButton icon="more" label="more" className="size-8 shadow-[inset_0_0_0_1px_var(--line)]" />
        </PanelHeader>
        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-4xl font-semibold">
              <Odometer value={doneWeek} /> <span className="text-base font-normal text-muted">{t('dash.done')}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted">
              <Delta value={kpis.doneDelta} /> {t('dash.vsLast')}
            </p>
          </div>
          <div className="ms-auto flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" /> {t('dash.done')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warn" /> {t('dash.vsLast')}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <HatchBars data={completedByDay} />
        </div>
      </Panel>

      {/* Progress gauge */}
      <Panel className="rise flex flex-col p-5" style={{ animationDelay: '60ms' }}>
        <PanelHeader icon="checkCircle" title={t('dash.goal')} />
        <div className="mt-4">
          <SegmentGauge value={kpis.completionRate} label={t('dash.done')} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Kpi label={t('dash.open')} value={kpis.open} />
          <Kpi label={t('dash.created')} value={kpis.createdThisWeek} delta={kpis.createdDelta} />
        </div>
        {kpis.overdue > 0 && (
          <Link
            href={`/${locale}/app/my-tasks?scope=overdue`}
            className="mt-3 flex items-center gap-2.5 rounded-full bg-ink py-2 ps-2 pe-4 text-sm text-on-ink transition hover:opacity-90"
          >
            <span className="grid size-7 place-items-center rounded-full bg-warn text-white">
              <Icon name="clock" size={14} />
            </span>
            <span className="flex-1">
              {num(kpis.overdue, locale)} {t('dash.overdue')}
            </span>
            <Icon name="chevronDown" size={14} className="-rotate-90 rtl:rotate-90" />
          </Link>
        )}
      </Panel>

      {/* Focus today */}
      <Panel className="beam rise p-5 xl:col-span-2" style={{ animationDelay: '120ms' }}>
        <span className="beam-ring" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <PanelHeader icon="sparkle" title={t('dash.focus')} />
            <p className="mt-2 text-sm text-muted">{longToday(locale)}</p>
          </div>
          <DayArc />
          <Link href={`/${locale}/app/today`}>
            <Button variant="soft">
              <Icon name="sparkle" size={15} /> {t('ai.planDay')}
            </Button>
          </Link>
          <Button variant="ink" onClick={() => openQuickAdd()}>
            <Icon name="plus" size={16} /> {t('task.new')}
          </Button>
        </div>
        <div className="mt-3 -mx-2">
          {myFocus.length ? myFocus.map((task) => <TaskRow key={task.id} task={task} showProject />) : <Empty emoji="☕" text={t('dash.focusEmpty')} />}
        </div>
      </Panel>

      {/* Team workload */}
      <Panel className="rise p-5" style={{ animationDelay: '180ms' }}>
        <PanelHeader icon="users" title={t('dash.team')}>
          <Link href={`/${locale}/app/team`}>
            <IconButton icon="plus" label={t('nav2.invite')} className="size-8 shadow-[inset_0_0_0_1px_var(--line)]" />
          </Link>
        </PanelHeader>
        <div className="mt-4 flex flex-col gap-2">
          {team.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-[16px] p-2.5 shadow-[inset_0_0_0_1px_var(--line)] ${i === 0 ? 'shadow-[inset_0_0_0_1.5px_var(--ink)]' : ''}`}
            >
              <Avatar name={m.name} src={m.avatarUrl} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${(m.open / maxOpen) * 100}%` }} />
                </div>
              </div>
              <div className="text-end">
                <p className="text-sm font-semibold tabular-nums">{num(m.open, locale)}</p>
                <Pill tone="success" className="!px-1.5 !py-0 text-[10px]">
                  ✓ {num(m.doneThisWeek, locale)}
                </Pill>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Upcoming */}
      <Panel className="rise p-5" style={{ animationDelay: '240ms' }}>
        <PanelHeader icon="calendar" title={t('dash.upcoming')} />
        <div className="mt-3 flex flex-col">
          {upcoming.length === 0 && <Empty emoji="🗓️" text="—" />}
          {upcoming.map((task) => (
            <button key={task.id} onClick={() => openTask(task.id)} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 text-start hover:bg-sunken">
              <span className="w-1 self-stretch rounded-full" style={{ background: task.project.color ?? 'var(--lumi)' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{task.title}</span>
                <span className="text-[11px] text-muted">
                  {task.project.icon} {task.project.name}
                </span>
              </span>
              <DueChip value={task.dueAt} compact />
            </button>
          ))}
        </div>
      </Panel>

      {/* Activity */}
      <Panel className="rise p-5" style={{ animationDelay: '300ms' }}>
        <PanelHeader icon="clock" title={t('dash.activity')} />
        <ol className="mt-4 flex flex-col gap-3.5">
          {activity.slice(0, 7).map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm">
              <Avatar name={a.actor?.name ?? '?'} src={a.actor?.avatarUrl} size={26} />
              <p className="min-w-0 flex-1 leading-relaxed">
                <span className="font-medium">{a.actor?.name}</span> <span className="text-muted">{t(`activity.${a.action}`)}</span>{' '}
                {a.task && (
                  <button onClick={() => openTask(a.task!.id)} className="font-medium hover:text-lumi">
                    {a.task.title}
                  </button>
                )}
                <span className="block text-[11px] text-muted">{timeAgo(a.createdAt, locale)}</span>
              </p>
            </li>
          ))}
        </ol>
      </Panel>

      {/* Projects */}
      <Panel aurora="#16A34A" auroraSide="start" className="rise p-5" style={{ animationDelay: '360ms' }}>
        <PanelHeader icon="folder" title={t('nav2.projects')} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {projects.data?.slice(0, 4).map((p, i) => {
            const total = p.counts?.total ?? 0;
            const done = p.counts?.DONE ?? 0;
            return (
              <Link
                key={p.id}
                href={`/${locale}/app/projects/${p.id}`}
                className={`flex flex-col justify-between gap-6 rounded-[18px] p-3.5 transition hover:-translate-y-0.5 ${i === 0 ? 'hatch-ink text-on-ink' : 'hatch bg-sunken shadow-[inset_0_0_0_1px_var(--line)]'}`}
              >
                <span className="text-2xl">{p.icon ?? '◆'}</span>
                <span>
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-[11px] opacity-70">
                    {t('project.tasks', { n: total })} · <span className="text-success">{num(total ? Math.round((done / total) * 100) : 0, locale)}%</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <div className="rounded-[16px] bg-sunken p-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] text-muted">{label}</p>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <p className="mt-2 text-2xl font-semibold">
        <Odometer value={value} />
      </p>
    </div>
  );
}
