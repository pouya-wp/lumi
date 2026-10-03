'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, cx, Empty, Icon, IconButton, Input, Panel, Pill } from '@/components/ui';
import { Dialog } from '@/components/ui/dialog';
import { del, post } from '@/lib/api';
import { addDays, dayNumber, startOfDay, weekdayNames, weekStartDay } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useHabits } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { Habit } from '@/lib/types';

const COLORS = ['#16A34A', '#4F5BFF', '#F97316', '#F43F5E', '#8B5CF6', '#0EA5E9', '#EAB308'];
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function HabitsPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const habits = useHabits(workspace?.id).data ?? [];
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, day }: { id: string; day: string }) => post(`/habits/${id}/toggle`, { day }),
    onMutate: async ({ id, day }) => {
      // Optimistic flip so the grid reacts instantly.
      const key = keys.habits(workspace!.id);
      qc.setQueryData<Habit[]>(key, (list) => list?.map((h) => (h.id === id ? { ...h, logs: h.logs.includes(day) ? h.logs.filter((x) => x !== day) : [...h.logs, day] } : h)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.habits(workspace!.id) }),
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/habits/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.habits(workspace!.id) }) });
  const today = startOfDay(new Date());
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, i - 20));
  const doneToday = habits.filter((h) => h.logs.includes(toDay(today))).length;

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#16A34A" className="rise flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-12 place-items-center rounded-[16px] bg-success-soft text-2xl">🌱</span>
        <div>
          <h1 className="text-xl font-semibold">{t('habits.title')}</h1>
          <p className="text-xs text-muted">
            {t('common.today')}: {num(doneToday, locale)}/{num(habits.length, locale)}
          </p>
        </div>
        <Button variant="ink" className="ms-auto" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> {t('habits.new')}
        </Button>
      </Panel>

      {habits.length === 0 ? (
        <Panel className="p-5">
          <Empty emoji="🌱" text={t('habits.empty')} />
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-4">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th />
                {days.map((d) => (
                  <th key={d.toISOString()} className={cx('px-0.5 text-[10px] font-normal', d.getTime() === today.getTime() ? 'text-ink' : 'text-muted')}>
                    <div>{formatDate(d, locale, { weekday: 'narrow' })}</div>
                    <div className="tabular-nums">{num(dayNumber(d, locale), locale)}</div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => {
                const color = h.color ?? '#16A34A';
                return (
                  <tr key={h.id} className="group">
                    <td className="pe-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-[14px] text-xl" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)` }}>
                          {h.emoji ?? '✨'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{h.title}</p>
                          <p className="flex gap-1.5 text-[11px] text-muted">
                            🔥 {t('habits.streak', { n: h.streak })} · {t('habits.best', { n: h.best })}
                          </p>
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const key = toDay(d);
                      const done = h.logs.includes(key);
                      const due = !h.days.length || h.days.includes(d.getDay());
                      return (
                        <td key={key} className="px-0.5">
                          <button
                            onClick={() => toggle.mutate({ id: h.id, day: key })}
                            disabled={d > today}
                            className={cx('mx-auto grid size-8 place-items-center rounded-[10px] transition hover:scale-110 disabled:opacity-30', !due && !done && 'hatch')}
                            style={{ background: done ? color : due ? 'var(--sunken)' : undefined, boxShadow: done ? `0 6px 14px -6px ${color}` : 'inset 0 0 0 1px var(--line)' }}
                          >
                            {done && <Icon name="check" size={14} strokeWidth={3} className="text-white" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="ps-2">
                      <IconButton icon="trash" label="delete" className="size-8 opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(h.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
      {creating && <HabitDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function HabitDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📚');
  const [color, setColor] = useState(COLORS[0]);
  const [days, setDays] = useState<number[]>([]);
  const names = weekdayNames(locale, 'short');
  const order = Array.from({ length: 7 }, (_, i) => (weekStartDay(locale) + i) % 7);
  const create = useMutation({
    mutationFn: () => post('/me/habits', { workspaceId: workspace!.id, title, emoji, color, days }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.habits(workspace!.id) });
      onClose();
    },
  });
  return (
    <Dialog onClose={onClose} label={t('habits.new')}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">{t('habits.new')}</h2>
        <div className="mt-4 flex gap-2">
          <Input className="w-16" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          <Input autoFocus className="flex-1" placeholder={t('habits.name')} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="mt-3 flex gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} className={cx('size-7 rounded-full', c === color && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')} style={{ background: c }} />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">{t('habits.days')}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <button type="button" onClick={() => setDays([])} className={cx('h-8 rounded-full px-3 text-xs', !days.length ? 'bg-ink text-on-ink' : 'bg-sunken')}>
            {t('habits.everyday')}
          </button>
          {order.map((d, i) => (
            <button
              type="button"
              key={d}
              onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
              className={cx('h-8 rounded-full px-3 text-xs', days.includes(d) ? 'bg-ink text-on-ink' : 'bg-sunken')}
            >
              {names[i]}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="ink" loading={create.isPending} disabled={!title.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
