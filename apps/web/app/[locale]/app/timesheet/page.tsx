'use client';

import { useMemo, useState } from 'react';
import { Avatar, Button, cx, Empty, IconButton, Panel, Pill } from '@/components/ui';
import { addDays, dayNumber, formatMinutes, startOfDay, startOfWeek } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useTimesheet, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';

export default function TimesheetPage() {
  const { t, locale } = useT();
  const { workspace, user } = useSession();
  const { openTask } = useUi();
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const [origin, setOrigin] = useState(() => startOfWeek(new Date(), locale));
  const [userId, setUserId] = useState(user?.id ?? '');
  const days = Array.from({ length: 7 }, (_, i) => addDays(origin, i));
  const sheet = useTimesheet(workspace?.id, origin, addDays(origin, 7), userId);
  const today = startOfDay(new Date());

  const rows = useMemo(() => {
    const map = new Map<string, { task: NonNullable<(typeof sheet.data)>['entries'][number]['task']; byDay: Map<string, number>; total: number }>();
    for (const e of sheet.data?.entries ?? []) {
      if (!e.task) continue;
      const row = map.get(e.taskId) ?? { task: e.task, byDay: new Map(), total: 0 };
      const minutes = e.minutes ?? Math.round((Date.now() - new Date(e.startedAt).getTime()) / 60000);
      const day = startOfDay(new Date(e.startedAt)).toDateString();
      row.byDay.set(day, (row.byDay.get(day) ?? 0) + minutes);
      row.total += minutes;
      map.set(e.taskId, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [sheet.data]);

  const dayTotal = (d: Date) => rows.reduce((s, r) => s + (r.byDay.get(d.toDateString()) ?? 0), 0);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const maxDay = Math.max(60, ...days.map(dayTotal));

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#F97316" className="rise flex flex-wrap items-center gap-3 p-4">
        <span className="grid size-11 place-items-center rounded-[14px] bg-warn-soft text-xl">⏱️</span>
        <div>
          <h1 className="text-xl font-semibold">{t('time.timesheet')}</h1>
          <p className="text-xs text-muted">
            {formatDate(origin, locale, { day: 'numeric', month: 'long' })} — {formatDate(addDays(origin, 6), locale, { day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-9 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
            <option value="">{t('time.everyone')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <IconButton icon="chevronDown" label="prev" className="rotate-90 rtl:-rotate-90" onClick={() => setOrigin((o) => addDays(o, -7))} />
          <Button size="sm" variant="soft" onClick={() => setOrigin(startOfWeek(new Date(), locale))}>
            {t('planning.today')}
          </Button>
          <IconButton icon="chevronDown" label="next" className="-rotate-90 rtl:rotate-90" onClick={() => setOrigin((o) => addDays(o, 7))} />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <Panel className="overflow-x-auto p-3">
          {rows.length === 0 ? (
            <Empty emoji="⏳" text={t('time.empty')} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted">
                  <th className="px-2 py-2 text-start font-normal">{t('time.task')}</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={cx('px-1 py-2 font-normal', d.getTime() === today.getTime() && 'text-ink')}>
                      {formatDate(d, locale, { weekday: 'short' })} {num(dayNumber(d, locale), locale)}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-normal">{t('time.sum')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.task!.id} className="border-t border-line/70 hover:bg-sunken/60">
                    <td className="px-2 py-2">
                      <button onClick={() => openTask(r.task!.id)} className="flex items-center gap-2 text-start">
                        <span className="w-1 self-stretch rounded-full" style={{ background: r.task!.project.color ?? 'var(--lumi)' }} />
                        <span className="truncate">{r.task!.title}</span>
                      </button>
                    </td>
                    {days.map((d) => {
                      const m = r.byDay.get(d.toDateString());
                      return (
                        <td key={d.toISOString()} className="px-1 py-2 text-center text-xs tabular-nums">
                          {m ? <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">{formatMinutes(m, locale)}</span> : <span className="text-line">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-xs font-semibold tabular-nums">{formatMinutes(r.total, locale)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-semibold">
                  <td className="px-2 py-2 text-xs">{t('time.sum')}</td>
                  {days.map((d) => (
                    <td key={d.toISOString()} className="px-1 py-2 text-center text-xs tabular-nums">
                      {dayTotal(d) ? formatMinutes(dayTotal(d), locale) : ''}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{formatMinutes(total, locale)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Panel>

        <Panel className="p-5">
          <p className="text-sm text-muted">{t('time.total')}</p>
          <p className="mt-1 text-4xl font-bold">{formatMinutes(total, locale)}</p>
          <div className="mt-6 flex h-36 items-end gap-2">
            {days.map((d) => (
              <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={cx('w-full rounded-[10px]', d.getTime() === today.getTime() ? 'hatch-ink' : 'hatch bg-sunken')} style={{ height: `${Math.max(6, (dayTotal(d) / maxDay) * 100)}%` }} />
                <span className="text-[10px] text-muted">{formatDate(d, locale, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          {!userId && sheet.data && (
            <div className="mt-6 flex flex-col gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={m.name} size={24} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <Pill>{formatMinutes(sheet.data!.totals.byUser[m.id] ?? 0, locale)}</Pill>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
