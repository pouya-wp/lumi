'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { num, useT } from '@/lib/i18n-client';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { Status, Task } from '@/lib/types';
import { Icon, IconButton, StatusDot } from '../ui';
import { TaskCard } from './task-card';

type Columns = Record<string, string[]>;

function toColumns(statuses: Status[], tasks: Task[]): Columns {
  const cols: Columns = Object.fromEntries(statuses.map((s) => [s.id, []]));
  for (const task of [...tasks].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))) cols[task.statusId]?.push(task.id);
  return cols;
}

/** Kanban board with cross-column drag & drop; moves are applied optimistically. */
export function Board({ projectId, statuses, tasks }: { projectId: string; statuses: Status[]; tasks: Task[] }) {
  const actions = useTaskActions();
  const [columns, setColumns] = useState<Columns>(() => toColumns(statuses, tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Re-sync from the server unless a drag is in progress.
  useEffect(() => {
    if (!activeId) setColumns(toColumns(statuses, tasks));
  }, [statuses, tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string) => (id in columns ? id : Object.keys(columns).find((c) => columns[c].includes(id)));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const fromItems = cols[from].filter((id) => id !== active.id);
      const overIndex = cols[to].indexOf(String(over.id));
      const toItems = [...cols[to]];
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, String(active.id));
      return { ...cols, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActiveId(null);
    if (!over) return;
    const column = findColumn(id);
    const overColumn = findColumn(String(over.id));
    if (!column || !overColumn) return;

    let items = columns[column];
    if (column === overColumn && over.id !== active.id && !(String(over.id) in columns)) {
      const oldIndex = items.indexOf(id);
      const newIndex = items.indexOf(String(over.id));
      items = [...items];
      items.splice(oldIndex, 1);
      items.splice(newIndex, 0, id);
      setColumns((cols) => ({ ...cols, [column]: items }));
    }

    const index = items.indexOf(id);
    const task = byId.get(id);
    if (!task) return;
    const beforeId = items[index - 1];
    const afterId = items[index + 1];
    const original = toColumns(statuses, tasks);
    const unchanged = task.statusId === column && original[column].indexOf(id) === index;
    if (!unchanged) actions.move.mutate({ id, projectId, statusId: column, beforeId, afterId });
  };

  const activeTask = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto pb-4 scrollbar-none">
        {statuses.map((status) => (
          <Column key={status.id} projectId={projectId} status={status} ids={columns[status.id] ?? []} byId={byId} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ projectId, status, ids, byId }: { projectId: string; status: Status; ids: string[]; byId: Map<string, Task> }) {
  const { t, locale } = useT();
  const { openQuickAdd } = useUi();
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <section className="flex w-[290px] shrink-0 flex-col rounded-[22px] bg-sunken/70 p-2 shadow-[inset_0_0_0_1px_var(--line)]">
      <header className="flex items-center gap-2 px-2 py-2">
        <StatusDot color={status.color} category={status.category} />
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span className="rounded-full bg-panel px-2 text-[11px] text-muted tabular-nums shadow-[inset_0_0_0_1px_var(--line)]">{num(ids.length, locale)}</span>
        <IconButton icon="plus" label={t('task.new')} className="ms-auto size-7" onClick={() => openQuickAdd({ projectId, statusId: status.id })} />
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`flex min-h-24 flex-1 flex-col gap-2 rounded-[16px] p-0.5 transition ${isOver && ids.length === 0 ? 'hatch' : ''}`}>
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableCard key={id} task={task} /> : null;
          })}
          {ids.length === 0 && (
            <button
              onClick={() => openQuickAdd({ projectId, statusId: status.id })}
              className="hatch grid h-24 place-items-center rounded-[16px] text-xs text-muted transition hover:text-ink"
            >
              <span className="flex items-center gap-1.5">
                <Icon name="plus" size={14} /> {t('task.new')}
              </span>
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task }: { task: Task }) {
  const { openTask } = useUi();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.id)}
    >
      <TaskCard task={task} dragging={isDragging} />
    </div>
  );
}
