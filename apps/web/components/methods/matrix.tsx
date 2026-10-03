'use client';

import type { Priority } from '@lumi/shared';
import { useState, type DragEvent } from 'react';
import { addDays, startOfDay } from '@/lib/calendar';
import { num, useT } from '@/lib/i18n-client';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { Task } from '@/lib/types';
import { AvatarStack, cx, Panel, PriorityGlyph } from '../ui';
import { DueChip } from '../tasks/task-drawer';

type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';

const important = (t: Task) => t.priority === 'URGENT' || t.priority === 'HIGH';
/** Urgent = urgent priority, or due within 48 hours (including overdue). */
const urgent = (t: Task) => t.priority === 'URGENT' || (!!t.dueAt && new Date(t.dueAt).getTime() - Date.now() < 48 * 3600 * 1000);

export function quadrantOf(t: Task): Quadrant {
  if (important(t)) return urgent(t) ? 'q1' : 'q2';
  return urgent(t) ? 'q3' : 'q4';
}

const QUADRANTS: { id: Quadrant; color: string; emoji: string }[] = [
  { id: 'q1', color: '#EF4444', emoji: '🔥' },
  { id: 'q2', color: '#4F5BFF', emoji: '📅' },
  { id: 'q3', color: '#F97316', emoji: '🤝' },
  { id: 'q4', color: '#8A8F99', emoji: '🗑️' },
];

/** Eisenhower matrix; dropping a task into a quadrant adjusts its priority and, if needed, its due date. */
export function EisenhowerMatrix({ tasks }: { tasks: Task[] }) {
  const { t } = useT();
  const actions = useTaskActions();
  const [over, setOver] = useState<Quadrant | null>(null);

  const drop = (e: DragEvent, q: Quadrant) => {
    e.preventDefault();
    setOver(null);
    const task = tasks.find((x) => x.id === e.dataTransfer.getData('text/task'));
    if (!task || quadrantOf(task) === q) return;
    const wantImportant = q === 'q1' || q === 'q2';
    const wantUrgent = q === 'q1' || q === 'q3';
    const data: Record<string, unknown> = {};
    let priority: Priority = task.priority;
    if (wantImportant && !important(task)) priority = 'HIGH';
    if (!wantImportant && important(task)) priority = 'MEDIUM';
    if (!wantUrgent && priority === 'URGENT') priority = 'HIGH';
    if (priority !== task.priority) data.priority = priority;
    const isUrgent = urgent({ ...task, priority });
    if (wantUrgent && !isUrgent) {
      const d = startOfDay(new Date());
      d.setHours(18);
      data.dueAt = d.toISOString();
    }
    if (!wantUrgent && isUrgent) {
      const d = addDays(startOfDay(new Date()), 7);
      d.setHours(18);
      data.dueAt = d.toISOString();
    }
    actions.update.mutate({ id: task.id, projectId: task.projectId, data });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {QUADRANTS.map((q) => {
        const items = tasks.filter((x) => quadrantOf(x) === q.id);
        return (
          <Panel
            key={q.id}
            aurora={q.color}
            className={cx('min-h-64 p-4 transition', over === q.id && 'hatch')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(q.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => drop(e, q.id)}
          >
            <QuadrantHeader q={q} count={items.length} title={t(`matrix.${q.id}`)} sub={t(`matrix.${q.id}d`)} />
            <TaskChips tasks={items} />
          </Panel>
        );
      })}
    </div>
  );
}

function QuadrantHeader({ q, count, title, sub }: { q: { color: string; emoji: string }; count: number; title: string; sub: string }) {
  const { locale } = useT();
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-[14px] text-xl" style={{ background: `color-mix(in oklab, ${q.color} 14%, transparent)` }}>
        {q.emoji}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-[11px] text-muted">{sub}</p>
      </div>
      <span className="ms-auto text-2xl font-bold tabular-nums" style={{ color: q.color }}>
        {num(count, locale)}
      </span>
    </div>
  );
}

function TaskChips({ tasks }: { tasks: Task[] }) {
  const { openTask } = useUi();
  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
          onClick={() => openTask(task.id)}
          className="flex cursor-grab items-center gap-2 rounded-[12px] bg-panel px-3 py-2 text-sm shadow-[inset_0_0_0_1px_var(--line)] transition hover:-translate-y-px active:cursor-grabbing"
        >
          <PriorityGlyph priority={task.priority} size={12} />
          <span className="flex-1 truncate">{task.title}</span>
          <DueChip value={task.dueAt} compact />
          <AvatarStack users={task.assignees.filter((a) => a.role === 'ASSIGNEE')} size={18} max={1} />
        </div>
      ))}
    </div>
  );
}

type GtdList = 'inbox' | 'next' | 'waiting' | 'someday';

/** GTD lists derived from task state: waiting = proposed to someone/blocked, someday = backlog, next = scheduled or in progress. */
export function gtdOf(t: Task, meId?: string): GtdList {
  if (t.proposalState === 'PROPOSED' && t.createdById === meId) return 'waiting';
  if (t.status.category === 'REVIEW') return 'waiting';
  if (t.status.category === 'BACKLOG') return 'someday';
  if (t.status.category === 'IN_PROGRESS' || t.dueAt || t.priority !== 'NONE') return 'next';
  return 'inbox';
}

export function GtdBoard({ tasks, meId }: { tasks: Task[]; meId?: string }) {
  const { t } = useT();
  const lists: { id: GtdList; color: string; emoji: string }[] = [
    { id: 'inbox', color: '#8B5CF6', emoji: '📥' },
    { id: 'next', color: '#4F5BFF', emoji: '⚡' },
    { id: 'waiting', color: '#F97316', emoji: '⏳' },
    { id: 'someday', color: '#8A8F99', emoji: '☁️' },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {lists.map((l) => {
        const items = tasks.filter((x) => gtdOf(x, meId) === l.id);
        return (
          <Panel key={l.id} aurora={l.color} className="min-h-64 p-4">
            <QuadrantHeader q={l} count={items.length} title={t(`gtd.${l.id}`)} sub="" />
            <TaskChips tasks={items} />
          </Panel>
        );
      })}
    </div>
  );
}
