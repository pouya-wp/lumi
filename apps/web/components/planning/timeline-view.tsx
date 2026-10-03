'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { addDays, daysBetween, dayNumber, startOfDay, startOfWeek } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { Task } from '@/lib/types';
import { Avatar, Button, cx, IconButton, PriorityGlyph, Segmented, StatusDot } from '../ui';

const ROW = 44;
const LABEL_W = 240;

interface Drag {
  id: string;
  mode: 'move' | 'end' | 'start';
  x0: number;
  delta: number;
}

/** Gantt timeline: drag a bar to move it, drag its edges to change start/due; BLOCKS dependencies draw arrows. */
export function TimelineView({ tasks }: { tasks: Task[] }) {
  const { t, locale, dir } = useT();
  const rtl = dir === 'rtl';
  const { openTask } = useUi();
  const actions = useTaskActions();
  const [zoom, setZoom] = useState<'day' | 'week'>('day');
  const dayW = zoom === 'day' ? 40 : 18;
  const [origin, setOrigin] = useState(() => addDays(startOfWeek(new Date(), locale), -7));
  const span = zoom === 'day' ? 42 : 98;
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(origin, i)), [origin, span]);
  const width = span * dayW;
  const [drag, setDrag] = useState<Drag | null>(null);
  const today = startOfDay(new Date());
  const scroller = useRef<HTMLDivElement>(null);

  const scheduled = tasks
    .filter((task) => task.startAt || task.dueAt)
    .sort((a, b) => new Date(a.startAt ?? a.dueAt!).getTime() - new Date(b.startAt ?? b.dueAt!).getTime());
  const unscheduled = tasks.filter((task) => !task.startAt && !task.dueAt);

  /** Logical [startIndex, length] in days, including the live drag delta. */
  const spanOf = (task: Task) => {
    const start = startOfDay(new Date(task.startAt ?? task.dueAt!));
    const end = startOfDay(new Date(task.dueAt ?? task.startAt!));
    let s = daysBetween(origin, start);
    let e = daysBetween(origin, end < start ? start : end);
    if (drag?.id === task.id) {
      if (drag.mode === 'move') {
        s += drag.delta;
        e += drag.delta;
      } else if (drag.mode === 'end') e = Math.max(s, e + drag.delta);
      else s = Math.min(e, s + drag.delta);
    }
    return { s, len: e - s + 1 };
  };
  // Physical x of a logical day index (mirrored in RTL).
  const xOf = (index: number, len = 0) => (rtl ? width - (index + len) * dayW : index * dayW);

  const onDown = (e: PointerEvent, task: Task, mode: Drag['mode']) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: task.id, mode, x0: e.clientX, delta: 0 });
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const delta = Math.round(((e.clientX - drag.x0) / dayW) * (rtl ? -1 : 1));
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  };
  const onUp = () => {
    if (!drag) return;
    const task = tasks.find((x) => x.id === drag.id);
    const d = drag;
    setDrag(null);
    if (!task || d.delta === 0) {
      if (task && d.delta === 0 && d.mode === 'move') openTask(task.id);
      return;
    }
    const shift = (iso: string | null) => (iso ? addDays(new Date(iso), d.delta).toISOString() : null);
    const data: Record<string, unknown> = {};
    if (d.mode === 'move') {
      if (task.startAt) data.startAt = shift(task.startAt);
      if (task.dueAt) data.dueAt = shift(task.dueAt);
    } else if (d.mode === 'end') data.dueAt = shift(task.dueAt ?? task.startAt);
    else data.startAt = shift(task.startAt ?? task.dueAt);
    actions.update.mutate({ id: task.id, projectId: task.projectId, data });
  };

  const rowOf = new Map(scheduled.map((task, i) => [task.id, i]));
  const arrows = scheduled.flatMap((task) =>
    task.dependencies
      .filter((dep) => dep.type === 'BLOCKS' && rowOf.has(dep.toTaskId))
      .map((dep) => {
        const from = spanOf(task);
        const target = scheduled[rowOf.get(dep.toTaskId)!];
        const to = spanOf(target);
        const x1 = rtl ? xOf(from.s, from.len) : xOf(from.s + from.len);
        const x2 = rtl ? xOf(to.s + to.len) : xOf(to.s);
        const y1 = rowOf.get(task.id)! * ROW + ROW / 2;
        const y2 = rowOf.get(dep.toTaskId)! * ROW + ROW / 2;
        const late = to.s <= from.s + from.len - 1;
        const bend = rtl ? -12 : 12;
        return { key: `${task.id}-${dep.toTaskId}`, d: `M${x1} ${y1} h${bend} V${y2} H${x2}`, late };
      }),
  );

  const todayX = xOf(daysBetween(origin, today));

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{t('views.timeline')}</h2>
        <span className="text-xs text-muted">
          {formatDate(origin, locale, { day: 'numeric', month: 'long' })} — {formatDate(addDays(origin, span - 1), locale, { day: 'numeric', month: 'long' })}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <Segmented value={zoom} onChange={setZoom} options={[{ value: 'day', label: locale === 'fa' ? 'روز' : 'Days' }, { value: 'week', label: locale === 'fa' ? 'هفته' : 'Weeks' }]} />
          <IconButton icon="chevronDown" label="prev" className="rotate-90 rtl:-rotate-90" onClick={() => setOrigin((o) => addDays(o, -14))} />
          <Button size="sm" variant="soft" onClick={() => setOrigin(addDays(startOfWeek(new Date(), locale), -7))}>
            {t('planning.today')}
          </Button>
          <IconButton icon="chevronDown" label="next" className="-rotate-90 rtl:rotate-90" onClick={() => setOrigin((o) => addDays(o, 14))} />
        </div>
      </div>

      <div className="flex max-h-[68vh] overflow-auto" ref={scroller}>
        {/* Task labels */}
        <div className="sticky start-0 z-20 shrink-0 border-e border-line bg-panel" style={{ width: LABEL_W }}>
          <div className="h-12 border-b border-line" />
          {scheduled.map((task) => (
            <button key={task.id} onClick={() => openTask(task.id)} className="flex w-full items-center gap-2 border-b border-line/50 px-3 text-start text-sm hover:bg-sunken" style={{ height: ROW }}>
              <StatusDot color={task.status.color} category={task.status.category} size={9} />
              <span className="truncate">{task.title}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="relative shrink-0" dir="ltr" style={{ width }} onPointerMove={onMove} onPointerUp={onUp}>
          <div className="sticky top-0 z-10 flex h-12 border-b border-line bg-panel" style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}>
            {days.map((day) => {
              const first = dayNumber(day, locale) === 1;
              return (
                <div
                  key={day.toISOString()}
                  className={cx('flex shrink-0 flex-col items-center justify-center border-e border-line/40 text-[10px]', day.getDay() === 5 && 'text-danger', day.getTime() === today.getTime() && 'bg-ink text-on-ink')}
                  style={{ width: dayW }}
                >
                  {(zoom === 'day' || first || day.getDay() === (locale === 'fa' ? 6 : 0)) && (
                    <>
                      <span className="opacity-60">{formatDate(day, locale, { weekday: 'narrow' })}</span>
                      <span className="font-medium tabular-nums">{num(dayNumber(day, locale), locale)}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ height: scheduled.length * ROW }}>
            {/* Weekend columns */}
            {days.map((day, i) =>
              day.getDay() === 5 ? <div key={i} className="hatch absolute inset-y-0" style={{ left: xOf(i, 1), width: dayW }} /> : null,
            )}
            {/* Today line */}
            {todayX >= 0 && todayX <= width && (
              <div className="absolute inset-y-0 z-10 w-0.5 bg-lumi shadow-[0_0_12px_var(--lumi)]" style={{ left: rtl ? todayX - dayW / 2 : todayX + dayW / 2 }} />
            )}
            {scheduled.map((_, i) => (
              <div key={i} className="absolute inset-x-0 border-b border-line/50" style={{ top: (i + 1) * ROW - 1 }} />
            ))}

            <svg className="pointer-events-none absolute inset-0 z-10" width={width} height={scheduled.length * ROW}>
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="var(--muted)" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <path key={a.key} d={a.d} fill="none" stroke={a.late ? 'var(--danger)' : 'var(--muted)'} strokeWidth="1.5" strokeDasharray={a.late ? '4 3' : undefined} markerEnd="url(#arrow)" />
              ))}
            </svg>

            {scheduled.map((task, i) => {
              const { s, len } = spanOf(task);
              const color = task.project.color ?? '#4F5BFF';
              const done = task.status.category === 'DONE';
              const active = drag?.id === task.id;
              return (
                <div
                  key={task.id}
                  onPointerDown={(e) => onDown(e, task, 'move')}
                  className={cx(
                    'group absolute z-20 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-[10px] px-2 text-[11px] font-medium text-white select-none active:cursor-grabbing',
                    active ? 'shadow-[0_10px_24px_-8px_rgb(0_0_0/.4)]' : 'shadow-sm',
                    done && 'opacity-55',
                  )}
                  style={{
                    left: xOf(s, len) + 2,
                    width: Math.max(dayW - 4, len * dayW - 4),
                    top: i * ROW + 8,
                    height: ROW - 16,
                    background: done ? 'var(--muted)' : `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 75%, #000))`,
                    flexDirection: rtl ? 'row-reverse' : 'row',
                  }}
                >
                  <span onPointerDown={(e) => onDown(e, task, rtl ? 'end' : 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-white/30" />
                  <PriorityGlyph priority={task.priority} size={10} />
                  {len * dayW > 70 && <span className="truncate" dir={rtl ? 'rtl' : 'ltr'}>{task.title}</span>}
                  {task.assignees[0] && len * dayW > 120 && (
                    <span className={rtl ? 'me-auto' : 'ms-auto'}>
                      <Avatar name={task.assignees[0].name} size={16} />
                    </span>
                  )}
                  <span onPointerDown={(e) => onDown(e, task, rtl ? 'start' : 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 group-hover:bg-white/30" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-xs font-medium text-muted">
            {t('planning.unscheduled')} · {num(unscheduled.length, locale)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.slice(0, 20).map((task) => (
              <button key={task.id} onClick={() => openTask(task.id)} className="rounded-full bg-sunken px-3 py-1 text-xs shadow-[inset_0_0_0_1px_var(--line)] hover:bg-line">
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
