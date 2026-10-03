'use client';

import { holidayOn } from '@lumi/shared';
import { useState, type DragEvent } from 'react';
import { dayNumber, monthGrid, monthOf, monthTitle, sameDay, shiftMonth, startOfDay, weekdayNames, firstOfMonth, type MonthRef } from '@/lib/calendar';
import { num, useT } from '@/lib/i18n-client';
import { useUi } from '@/lib/ui-state';
import type { Task } from '@/lib/types';
import { Avatar, Button, cx, Icon, IconButton, PriorityGlyph } from '../ui';

/** Month grid in the locale's calendar; drag a task chip onto a day to reschedule it. */
export function CalendarView({
  tasks,
  month,
  onMonthChange,
  onReschedule,
  onCreate,
  showProject,
}: {
  tasks: Task[];
  month: MonthRef;
  onMonthChange: (m: MonthRef) => void;
  onReschedule: (task: Task, day: Date) => void;
  onCreate?: (day: Date) => void;
  showProject?: boolean;
}) {
  const { t, locale } = useT();
  const { openTask } = useUi();
  const [over, setOver] = useState<string | null>(null);
  const days = monthGrid(month, locale);
  const first = firstOfMonth(month, locale);
  const nextFirst = firstOfMonth(shiftMonth(month, 1), locale);
  const today = startOfDay(new Date());

  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueAt) continue;
    const key = startOfDay(new Date(task.dueAt)).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }

  const drop = (e: DragEvent, day: Date) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/task');
    const task = tasks.find((x) => x.id === id);
    if (task && !(task.dueAt && sameDay(new Date(task.dueAt), day))) onReschedule(task, day);
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold">{monthTitle(month, locale).replace(/\d+/g, (d) => num(d, locale))}</h2>
        <div className="ms-auto flex items-center gap-1">
          <IconButton icon="chevronDown" label="prev" className="rotate-90 rtl:-rotate-90" onClick={() => onMonthChange(shiftMonth(month, -1))} />
          <Button size="sm" variant="soft" onClick={() => onMonthChange(monthOf(new Date(), locale))}>
            {t('planning.today')}
          </Button>
          <IconButton icon="chevronDown" label="next" className="-rotate-90 rtl:rotate-90" onClick={() => onMonthChange(shiftMonth(month, 1))} />
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-line text-center text-[11px] text-muted">
        {weekdayNames(locale).map((w) => (
          <span key={w} className="py-2">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day >= first && day < nextFirst;
          const key = day.toDateString();
          const items = byDay.get(key) ?? [];
          const holiday = holidayOn(day, locale === 'fa' ? 'fa' : 'en');
          const isToday = day.getTime() === today.getTime();
          const off = day.getDay() === 5 || !!holiday;
          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => drop(e, day)}
              onDoubleClick={() => onCreate?.(day)}
              className={cx(
                'group relative min-h-28 border-e border-b border-line/70 p-1.5 transition [&:nth-child(7n)]:border-e-0',
                !inMonth && 'bg-sunken/50',
                off && inMonth && 'bg-danger-soft/30',
                over === key && 'hatch bg-lumi/5',
              )}
              title={holiday ?? undefined}
            >
              <div className="mb-1 flex items-center gap-1">
                <span
                  className={cx(
                    'grid size-6 place-items-center rounded-full text-xs tabular-nums',
                    isToday ? 'bg-ink font-semibold text-on-ink' : off ? 'text-danger' : inMonth ? 'text-ink-2' : 'text-muted/60',
                  )}
                >
                  {num(dayNumber(day, locale), locale)}
                </span>
                {holiday && inMonth && <span className="truncate text-[9px] text-danger">{holiday}</span>}
                {onCreate && (
                  <button onClick={() => onCreate(day)} className="ms-auto hidden size-5 place-items-center rounded-full text-muted group-hover:grid hover:bg-line">
                    <Icon name="plus" size={12} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
                    onClick={() => openTask(task.id)}
                    className={cx(
                      'flex cursor-grab items-center gap-1.5 truncate rounded-[8px] px-1.5 py-1 text-start text-[11px] transition hover:-translate-y-px active:cursor-grabbing',
                      task.status.category === 'DONE' ? 'text-muted line-through' : '',
                    )}
                    style={{ background: `color-mix(in oklab, ${task.project.color ?? '#4F5BFF'} 13%, var(--panel))` }}
                  >
                    <PriorityGlyph priority={task.priority} size={10} />
                    <span className="truncate">{showProject && task.project.icon ? `${task.project.icon} ` : ''}{task.title}</span>
                    {task.assignees[0] && (
                      <span className="ms-auto">
                        <Avatar name={task.assignees[0].name} size={14} />
                      </span>
                    )}
                  </button>
                ))}
                {items.length > 4 && <span className="px-1.5 text-[10px] text-muted">+{num(items.length - 4, locale)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">{t('planning.dragHint')}</p>
    </div>
  );
}
