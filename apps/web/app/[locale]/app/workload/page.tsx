'use client';

import { useMemo, useState } from 'react';
import { Avatar, Button, cx, IconButton, Panel, Pill, PriorityGlyph } from '@/components/ui';
import { addDays, dayNumber, daysBetween, formatMinutes, startOfDay, startOfWeek } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useRangeTasks, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';
import type { Task } from '@/lib/types';

const CAPACITY_MIN = 6 * 60;
const DEFAULT_ESTIMATE = 60;

/** Spreads each task's estimate evenly across its working days (start..due, Fridays excluded). */
function allocate(task: Task): Map<string, number> {
  const due = startOfDay(new Date(task.dueAt ?? task.startAt!));
  const start = startOfDay(new Date(task.startAt ?? task.dueAt!));
  const days: Date[] = [];
  for (let d = start; d <= due; d = addDays(d, 1)) if (d.getDay() !== 5) days.push(d);
  if (!days.length) days.push(due);
  const per = (task.estimateMin ?? DEFAULT_ESTIMATE) / days.length;
  return new Map(days.map((d) => [d.toDateString(), per]));
}

export default function WorkloadPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask } = useUi();
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const [origin, setOrigin] = useState(() => startOfWeek(new Date(), locale));
  const days = Array.from({ length: 14 }, (_, i) => addDays(origin, i));
  const tasks = useRangeTasks(workspace?.id, origin, addDays(origin, 14));
  const [selected, setSelected] = useState<{ userId: string; day: string } | null>(null);
  const today = startOfDay(new Date());

  const load = useMemo(() => {
    const map = new Map<string, { minutes: number; tasks: Task[] }>();
    for (const task of tasks.data ?? []) {
      const alloc = allocate(task);
      for (const a of task.assignees.filter((x) => x.role === 'ASSIGNEE')) {
        for (const [day, min] of alloc) {
          const key = `${a.id}|${day}`;
          const cell = map.get(key) ?? { minutes: 0, tasks: [] };
          cell.minutes += min;
          cell.tasks.push(task);
          map.set(key, cell);
        }
      }
    }
    return map;
  }, [tasks.data]);

  const selectedCell = selected ? load.get(`${selected.userId}|${selected.day}`) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#8B5CF6" className="rise flex flex-wrap items-center gap-3 p-4">
        <span className="grid size-11 place-items-center rounded-[14px] bg-lumi/10 text-xl">⚖️</span>
        <div>
          <h1 className="text-xl font-semibold">{t('planning.workload')}</h1>
          <p className="text-xs text-muted">{t('planning.capacity', { n: CAPACITY_MIN / 60 })}</p>
        </div>
        <div className="ms-auto flex items-center gap-1">
          <IconButton icon="chevronDown" label="prev" className="rotate-90 rtl:-rotate-90" onClick={() => setOrigin((o) => addDays(o, -7))} />
          <Button size="sm" variant="soft" onClick={() => setOrigin(startOfWeek(new Date(), locale))}>
            {t('planning.today')}
          </Button>
          <IconButton icon="chevronDown" label="next" className="-rotate-90 rtl:rotate-90" onClick={() => setOrigin((o) => addDays(o, 7))} />
        </div>
      </Panel>

      <Panel className="overflow-x-auto p-3">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-44" />
              {days.map((d) => (
                <th key={d.toISOString()} className={cx('min-w-14 text-[10px] font-normal', d.getDay() === 5 ? 'text-danger' : 'text-muted')}>
                  <div>{formatDate(d, locale, { weekday: 'short' })}</div>
                  <div className={cx('mx-auto mt-0.5 grid size-6 place-items-center rounded-full text-xs tabular-nums', d.getTime() === today.getTime() && 'bg-ink text-on-ink')}>
                    {num(dayNumber(d, locale), locale)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const week = days.reduce((sum, d) => sum + (load.get(`${m.id}|${d.toDateString()}`)?.minutes ?? 0), 0);
              return (
                <tr key={m.id}>
                  <td className="pe-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="text-[11px] text-muted tabular-nums">{formatMinutes(Math.round(week), locale)}</p>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = load.get(`${m.id}|${d.toDateString()}`);
                    const ratio = (cell?.minutes ?? 0) / CAPACITY_MIN;
                    const off = d.getDay() === 5;
                    const bg = !cell ? 'var(--sunken)' : ratio > 1 ? 'var(--danger)' : ratio > 0.75 ? 'var(--warn)' : 'var(--success)';
                    const isSel = selected?.userId === m.id && selected.day === d.toDateString();
                    return (
                      <td key={d.toISOString()}>
                        <button
                          onClick={() => setSelected(cell ? { userId: m.id, day: d.toDateString() } : null)}
                          className={cx('relative grid h-12 w-full place-items-center overflow-hidden rounded-[10px] text-[11px] font-semibold tabular-nums transition hover:scale-105', off && !cell && 'hatch', isSel && 'ring-2 ring-ink')}
                          style={{ background: cell ? `color-mix(in oklab, ${bg} ${Math.min(90, 25 + ratio * 55)}%, var(--panel))` : undefined, color: cell && ratio > 0.75 ? '#fff' : 'var(--ink-2)' }}
                        >
                          {cell ? formatMinutes(Math.round(cell.minutes), locale) : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      {selectedCell && (
        <Panel className="rise p-4">
          <p className="mb-2 text-sm font-semibold">
            {members.find((m) => m.id === selected!.userId)?.name} · {formatDate(new Date(selected!.day), locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedCell.tasks.map((task) => (
            <button key={task.id} onClick={() => openTask(task.id)} className="flex w-full items-center gap-2 rounded-[12px] px-2 py-2 text-start text-sm hover:bg-sunken">
              <PriorityGlyph priority={task.priority} size={12} />
              <span className="flex-1 truncate">{task.title}</span>
              <Pill>{formatMinutes(task.estimateMin ?? DEFAULT_ESTIMATE, locale)}</Pill>
              <span className="text-[11px] text-muted">{num(daysBetween(today, new Date(task.dueAt ?? task.startAt!)), locale)}d</span>
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}
