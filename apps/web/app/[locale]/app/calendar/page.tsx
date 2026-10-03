'use client';

import { useMemo, useState } from 'react';
import { CalendarView } from '@/components/planning/calendar-view';
import { Panel, Segmented } from '@/components/ui';
import { addDays, monthGrid, monthOf } from '@/lib/calendar';
import { useT } from '@/lib/i18n-client';
import { useMeetings, useProjects, useRangeTasks } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';

export default function WorkspaceCalendarPage() {
  const { t, locale } = useT();
  const { workspace, user } = useSession();
  const { openQuickAdd } = useUi();
  const actions = useTaskActions();
  const projects = useProjects(workspace?.id).data ?? [];
  const [month, setMonth] = useState(() => monthOf(new Date(), locale));
  const [scope, setScope] = useState<'me' | 'all'>('all');
  const [projectId, setProjectId] = useState('');
  const grid = monthGrid(month, locale);
  const extra = `${scope === 'me' ? '&assigneeId=me' : ''}${projectId ? `&projectId=${projectId}` : ''}&includeDone=true`;
  const tasks = useRangeTasks(workspace?.id, grid[0], addDays(grid[41], 1), extra);
  const meetings = useMeetings(workspace?.id, grid[0], addDays(grid[41], 1)).data ?? [];
  const list = useMemo(() => tasks.data ?? [], [tasks.data]);

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#F43F5E" className="rise flex flex-wrap items-center gap-3 p-4">
        <span className="grid size-11 place-items-center rounded-[14px] bg-danger-soft text-xl">📅</span>
        <h1 className="text-xl font-semibold">{t('planning.calendar')}</h1>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
            <option value="">{t('nav2.projects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: t('time.everyone') }, { value: 'me', label: t('filters.me') }]} />
        </div>
      </Panel>
      <CalendarView
        tasks={list}
        month={month}
        onMonthChange={setMonth}
        showProject
        meetings={scope === 'all' || !workspace ? meetings : meetings.filter((m) => m.attendeeIds?.includes(user?.id ?? ''))}
        onReschedule={(task, day) => {
          const prev = task.dueAt ? new Date(task.dueAt) : null;
          const next = new Date(day);
          next.setHours(prev ? prev.getHours() : 18, prev ? prev.getMinutes() : 0, 0, 0);
          actions.update.mutate({ id: task.id, projectId: task.projectId, data: { dueAt: next.toISOString() } });
        }}
        onCreate={() => openQuickAdd({ projectId: projectId || undefined })}
      />
    </div>
  );
}
