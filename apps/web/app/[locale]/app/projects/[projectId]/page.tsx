'use client';

import { use, useState } from 'react';
import { Board } from '@/components/tasks/board';
import { TaskRow } from '@/components/tasks/task-row';
import { Button, Icon, Input, Panel, Segmented, Spinner, StatusDot } from '@/components/ui';
import { num, useT } from '@/lib/i18n-client';
import { useProject, useTasks } from '@/lib/queries';
import { useUi } from '@/lib/ui-state';

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { t, locale } = useT();
  const { openQuickAdd } = useUi();
  const project = useProject(projectId);
  const tasks = useTasks(projectId);
  const [view, setView] = useState<'board' | 'list'>(() => {
    try {
      return (localStorage.getItem(`lumi.view.${projectId}`) as 'board' | 'list') ?? 'board';
    } catch {
      return 'board';
    }
  });
  const [q, setQ] = useState('');

  const changeView = (v: 'board' | 'list') => {
    setView(v);
    try {
      localStorage.setItem(`lumi.view.${projectId}`, v);
    } catch {}
  };

  if (!project.data || !tasks.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }

  const p = project.data;
  const filtered = q ? tasks.data.filter((task) => task.title.toLowerCase().includes(q.toLowerCase()) || task.key.toLowerCase().includes(q.toLowerCase())) : tasks.data;
  const done = tasks.data.filter((task) => task.status.category === 'DONE').length;
  const pct = tasks.data.length ? Math.round((done / tasks.data.length) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel aurora={p.color ?? '#4F5BFF'} className="rise flex flex-wrap items-center gap-4 p-4">
        <span className="grid size-12 place-items-center rounded-[16px] text-2xl" style={{ background: `color-mix(in oklab, ${p.color ?? '#4F5BFF'} 18%, transparent)` }}>
          {p.icon ?? '◆'}
        </span>
        <div>
          <h1 className="text-xl font-semibold">{p.name}</h1>
          <p className="flex items-center gap-2 text-xs text-muted">
            <span dir="ltr">{p.key}</span> · {t('project.tasks', { n: tasks.data.length })} ·{' '}
            <span className="font-medium text-success tabular-nums">{num(pct, locale)}%</span>
          </p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Input icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav2.search')} className="h-10 w-48 !rounded-full" />
          <Segmented
            value={view}
            onChange={changeView}
            options={[
              { value: 'board', label: <><Icon name="board" size={14} /> {t('views.board')}</> },
              { value: 'list', label: <><Icon name="list" size={14} /> {t('views.list')}</> },
            ]}
          />
          <Button variant="ink" onClick={() => openQuickAdd({ projectId })}>
            <Icon name="plus" size={16} /> {t('task.new')}
          </Button>
        </div>
      </Panel>

      {view === 'board' ? (
        <div className="min-h-[60vh] flex-1">
          <Board projectId={projectId} statuses={p.statuses} tasks={filtered} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {p.statuses.map((s) => {
            const items = filtered.filter((task) => task.statusId === s.id);
            return (
              <Panel key={s.id} className="p-3">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <StatusDot color={s.color} category={s.category} />
                  <h3 className="text-sm font-semibold">{s.name}</h3>
                  <span className="text-xs text-muted tabular-nums">{num(items.length, locale)}</span>
                  <button onClick={() => openQuickAdd({ projectId, statusId: s.id })} className="ms-auto grid size-7 place-items-center rounded-full text-muted hover:bg-sunken">
                    <Icon name="plus" size={15} />
                  </button>
                </div>
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} statuses={p.statuses} />
                ))}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
