'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, cx, Empty, Icon, Input, Panel, Pill } from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog } from '@/components/ui/dialog';
import { patch, post } from '@/lib/api';
import { addDays, daysBetween, monthOf, monthTitle, shiftMonth, firstOfMonth, startOfDay } from '@/lib/calendar';
import { dueInfo, formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useProjects, useRoadmap } from '@/lib/queries';
import { useSession } from '@/lib/session';

/** Milestones across projects on a 6-month horizon, one lane per project. */
export default function RoadmapPage() {
  const { t, locale, dir } = useT();
  const rtl = dir === 'rtl';
  const { workspace } = useSession();
  const roadmap = useRoadmap(workspace?.id).data ?? [];
  const projects = useProjects(workspace?.id).data ?? [];
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => patch(`/milestones/${id}`, { done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roadmap(workspace!.id) }),
  });

  const start = firstOfMonth(shiftMonth(monthOf(new Date(), locale), -1), locale);
  const end = firstOfMonth(shiftMonth(monthOf(new Date(), locale), 5), locale);
  const span = daysBetween(start, end);
  const pos = (d: Date) => (daysBetween(start, d) / span) * 100;
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(monthOf(new Date(), locale), i - 1));
  const lanes = projects.filter((p) => roadmap.some((m) => m.projectId === p.id));
  const todayPos = pos(startOfDay(new Date()));

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#4F5BFF" aurora2="#F43F5E" className="rise flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-12 place-items-center rounded-[16px] bg-lumi/10 text-2xl">🗺️</span>
        <h1 className="text-xl font-semibold">{t('roadmap.title')}</h1>
        <Button variant="ink" className="ms-auto" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> {t('roadmap.new')}
        </Button>
      </Panel>

      <Panel className="overflow-x-auto p-5">
        {lanes.length === 0 ? (
          <Empty emoji="🗺️" text={t('roadmap.empty')} />
        ) : (
          <div className="min-w-[760px]">
            <div className="relative ms-44 flex h-8 border-b border-line">
              {months.map((m) => {
                const s = pos(firstOfMonth(m, locale));
                return (
                  <span key={`${m.year}-${m.month}`} className="absolute top-0 text-xs text-muted" style={{ [rtl ? 'right' : 'left']: `${s}%` }}>
                    {num(monthTitle(m, locale), locale)}
                  </span>
                );
              })}
            </div>
            {lanes.map((p) => (
              <div key={p.id} className="flex items-center border-b border-line/60">
                <div className="flex w-44 shrink-0 items-center gap-2 py-6 text-sm font-medium">
                  <span>{p.icon}</span>
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="relative h-20 flex-1">
                  {months.map((m) => (
                    <span key={`${m.year}-${m.month}`} className="absolute inset-y-0 border-s border-dashed border-line" style={{ [rtl ? 'right' : 'left']: `${pos(firstOfMonth(m, locale))}%` }} />
                  ))}
                  <span className="absolute inset-y-0 z-10 w-0.5 bg-lumi shadow-[0_0_10px_var(--lumi)]" style={{ [rtl ? 'right' : 'left']: `${todayPos}%` }} />
                  {roadmap
                    .filter((m) => m.projectId === p.id)
                    .map((m) => {
                      const x = pos(new Date(m.dueAt));
                      if (x < 0 || x > 100) return null;
                      const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
                      const color = m.color ?? p.color ?? '#4F5BFF';
                      const late = !m.doneAt && new Date(m.dueAt) < new Date();
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggle.mutate({ id: m.id, done: !m.doneAt })}
                          className="group absolute top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rtl:translate-x-1/2 ltr:-translate-x-1/2"
                          style={{ [rtl ? 'right' : 'left']: `${x}%` }}
                          title={m.description ?? m.title}
                        >
                          <span
                            className={cx('grid size-6 rotate-45 place-items-center rounded-[6px] shadow-panel transition group-hover:scale-125', late && 'animate-pulse')}
                            style={{ background: m.doneAt ? 'var(--success)' : late ? 'var(--danger)' : color }}
                          >
                            {m.doneAt && <Icon name="check" size={12} strokeWidth={3} className="-rotate-45 text-white" />}
                          </span>
                          <span className="panel hidden whitespace-nowrap px-3 py-1.5 text-start text-xs group-hover:block sm:block">
                            <span className="block font-medium">{m.title}</span>
                            <span className="text-muted">
                              {formatDate(m.dueAt, locale)} · {num(pct, locale)}%
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {roadmap.map((m) => {
            const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
            const due = dueInfo(m.dueAt, locale, t);
            return (
              <div key={m.id} className="rounded-[18px] bg-sunken p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                <div className="flex items-center gap-2">
                  <span>{m.project?.icon}</span>
                  <p className="flex-1 truncate font-medium">{m.title}</p>
                  {m.doneAt ? <Pill tone="success">✓ {t('roadmap.done')}</Pill> : <Pill tone={due.tone === 'late' ? 'danger' : due.tone === 'today' ? 'warn' : 'neutral'}>{due.label}</Pill>}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel">
                  <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {num(m.done, locale)}/{num(m.total, locale)} · {m.project?.name}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      {creating && <MilestoneDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function MilestoneDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const projects = useProjects(workspace?.id).data ?? [];
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueAt, setDueAt] = useState<string | null>(addDays(new Date(), 30).toISOString());
  const create = useMutation({
    mutationFn: () => post(`/projects/${projectId || projects[0].id}/milestones`, { title, dueAt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roadmap(workspace!.id) });
      onClose();
    },
  });
  return (
    <Dialog onClose={onClose} label={t('roadmap.new')}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && dueAt) create.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">◆ {t('roadmap.new')}</h2>
        <Input autoFocus className="mt-4" placeholder={t('roadmap.name')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-2 h-11 w-full rounded-[14px] bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        <div className="mt-2">
          <DatePicker
            value={dueAt}
            onChange={setDueAt}
            trigger={<span className="flex h-11 items-center rounded-[14px] bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)]">📅 {dueAt ? formatDate(dueAt, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : t('roadmap.due')}</span>}
          />
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
