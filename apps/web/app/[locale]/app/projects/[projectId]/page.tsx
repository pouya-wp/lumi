'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { use, useEffect, useMemo, useState } from 'react';
import { CalendarView } from '@/components/planning/calendar-view';
import { TimelineView } from '@/components/planning/timeline-view';
import { Board } from '@/components/tasks/board';
import { FilterBar } from '@/components/tasks/filter-bar';
import { TableView } from '@/components/tasks/table-view';
import { TaskRow } from '@/components/tasks/task-row';
import { Button, cx, Icon, Input, Panel, Segmented, Spinner, StatusDot, type IconName } from '@/components/ui';
import { Dialog } from '@/components/ui/dialog';
import { del, post } from '@/lib/api';
import { monthOf } from '@/lib/calendar';
import { applyFilters } from '@/lib/filters';
import { num, useT } from '@/lib/i18n-client';
import { keys, useProject, useTasks, useViews } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { TaskFilters, ViewKind } from '@/lib/types';

const VIEWS: { kind: ViewKind; icon: IconName; label: string }[] = [
  { kind: 'BOARD', icon: 'board', label: 'views.board' },
  { kind: 'LIST', icon: 'list', label: 'views.list' },
  { kind: 'TABLE', icon: 'filter', label: 'views.table' },
  { kind: 'CALENDAR', icon: 'calendar', label: 'views.calendar' },
  { kind: 'TIMELINE', icon: 'clock', label: 'views.timeline' },
];

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { t, locale } = useT();
  const { user } = useSession();
  const { openQuickAdd } = useUi();
  const project = useProject(projectId);
  const tasks = useTasks(projectId);
  const views = useViews(projectId);
  const actions = useTaskActions();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewKind>('BOARD');
  const [filters, setFilters] = useState<TaskFilters>({});
  const [activeView, setActiveView] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(new Date(), locale));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lumi.view.${projectId}`) as ViewKind | null;
      if (saved && VIEWS.some((v) => v.kind === saved)) setView(saved);
    } catch {}
  }, [projectId]);

  const changeView = (v: ViewKind) => {
    setView(v);
    setActiveView(null);
    try {
      localStorage.setItem(`lumi.view.${projectId}`, v);
    } catch {}
  };

  const saveView = useMutation({
    mutationFn: (body: { name: string; shared: boolean }) => post(`/projects/${projectId}/views`, { ...body, type: view, config: { filters } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.views(projectId) }),
  });
  const removeView = useMutation({
    mutationFn: (id: string) => del(`/views/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.views(projectId) }),
  });

  const filtered = useMemo(() => applyFilters(tasks.data ?? [], filters, user?.id), [tasks.data, filters, user?.id]);

  if (!project.data || !tasks.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }

  const p = project.data;
  const done = tasks.data.filter((task) => task.status.category === 'DONE').length;
  const pct = tasks.data.length ? Math.round((done / tasks.data.length) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel aurora={p.color ?? '#4F5BFF'} className="rise p-4">
        <div className="flex flex-wrap items-center gap-4">
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
            <div className="max-w-full overflow-x-auto scrollbar-none">
              <Segmented
                value={view}
                onChange={changeView}
                options={VIEWS.map((v) => ({ value: v.kind, label: <><Icon name={v.icon} size={14} /> <span className="hidden sm:inline">{t(v.label)}</span></> }))}
              />
            </div>
            <Button variant="ink" onClick={() => openQuickAdd({ projectId })}>
              <Icon name="plus" size={16} /> {t('task.new')}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <FilterBar value={filters} onChange={(f) => { setFilters(f); setActiveView(null); }} />
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            {views.data?.map((v) => (
              <span key={v.id} className={cx('group flex h-8 items-center gap-1 rounded-full ps-3 pe-1 text-xs transition', activeView === v.id ? 'bg-lumi text-white' : 'bg-sunken text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]')}>
                <button
                  onClick={() => {
                    setView(v.type);
                    setFilters(v.config.filters ?? {});
                    setActiveView(v.id);
                  }}
                >
                  {v.shared ? '👥 ' : ''}
                  {v.name}
                </button>
                {v.ownerId === user?.id && (
                  <button onClick={() => removeView.mutate(v.id)} className="grid size-6 place-items-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/10">
                    <Icon name="close" size={11} />
                  </button>
                )}
              </span>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSaving(true)}>
              <Icon name="plus" size={13} /> {t('views.saveView')}
            </Button>
          </div>
        </div>
      </Panel>

      {saving && (
        <SaveViewDialog
          onClose={() => setSaving(false)}
          onSave={(name, shared) => saveView.mutate({ name, shared }, { onSuccess: () => setSaving(false) })}
          loading={saveView.isPending}
        />
      )}

      <div className="min-h-[60vh] flex-1">
        {view === 'BOARD' && <Board projectId={projectId} statuses={p.statuses} tasks={filtered} />}
        {view === 'TABLE' && <TableView projectId={projectId} statuses={p.statuses} tasks={filtered} />}
        {view === 'CALENDAR' && (
          <CalendarView
            tasks={filtered}
            month={month}
            onMonthChange={setMonth}
            onReschedule={(task, day) => {
              const due = task.dueAt ? new Date(task.dueAt) : new Date(day);
              const next = new Date(day);
              next.setHours(task.dueAt ? due.getHours() : 18, task.dueAt ? due.getMinutes() : 0, 0, 0);
              actions.update.mutate({ id: task.id, projectId, data: { dueAt: next.toISOString() } });
            }}
            onCreate={() => openQuickAdd({ projectId })}
          />
        )}
        {view === 'TIMELINE' && <TimelineView tasks={filtered} />}
        {view === 'LIST' && (
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
    </div>
  );
}

function SaveViewDialog({ onClose, onSave, loading }: { onClose: () => void; onSave: (name: string, shared: boolean) => void; loading: boolean }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  return (
    <Dialog onClose={onClose} label={t('views.saveView')}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), shared);
        }}
      >
        <h2 className="text-lg font-semibold">{t('views.saveView')}</h2>
        <Input autoFocus className="mt-4" placeholder={t('views.viewName')} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-4 accent-[var(--lumi)]" /> 👥 {t('views.shared')}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="ink" loading={loading} disabled={!name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
