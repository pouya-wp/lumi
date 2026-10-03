'use client';

import { toJalali } from '@lumi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Avatar, Button, cx, Empty, Icon, IconButton, Input, Panel, Pill } from '@/components/ui';
import { Dialog } from '@/components/ui/dialog';
import { del, post, put } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useGoals, useSearch } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { Goal, GoalStatus, KeyResult } from '@/lib/types';

const STATUS_TONE: Record<GoalStatus, 'success' | 'warn' | 'danger'> = { ON_TRACK: 'success', AT_RISK: 'warn', OFF_TRACK: 'danger' };
const STATUS_COLOR: Record<GoalStatus, string> = { ON_TRACK: 'var(--success)', AT_RISK: 'var(--warn)', OFF_TRACK: 'var(--danger)' };

/** Current quarter, e.g. "1405-Q3" (Jalali) or "2026-Q4". */
function currentPeriod(locale: string) {
  const d = new Date();
  if (locale === 'fa') {
    const j = toJalali(d);
    return `${j.jy}-Q${Math.ceil(j.jm / 3)}`;
  }
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}

export default function GoalsPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const [period, setPeriod] = useState(() => currentPeriod(locale));
  const data = useGoals(workspace?.id, period).data;
  const [creating, setCreating] = useState(false);
  const [checkIn, setCheckIn] = useState<KeyResult | null>(null);
  const [addKrFor, setAddKrFor] = useState<Goal | null>(null);
  const [linkFor, setLinkFor] = useState<KeyResult | null>(null);
  const periods = [...new Set([period, currentPeriod(locale), ...(data?.periods ?? [])])].sort().reverse();
  const goals = data?.goals ?? [];
  const overall = goals.length ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0;

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#16A34A" aurora2="#4F5BFF" className="rise p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 place-items-center rounded-[16px] bg-success-soft text-2xl">🎯</span>
          <div>
            <h1 className="text-xl font-semibold">{t('goals.title')}</h1>
            <p className="text-xs text-muted">
              {t('goals.overall')}: <span className="font-semibold text-success">{num(overall, locale)}%</span>
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-10 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none" dir="ltr">
              {periods.map((p) => (
                <option key={p} value={p}>
                  {num(p, locale)}
                </option>
              ))}
            </select>
            <Button variant="ink" onClick={() => setCreating(true)}>
              <Icon name="plus" size={15} /> {t('goals.new')}
            </Button>
          </div>
        </div>
      </Panel>

      {goals.length === 0 && (
        <Panel className="p-5">
          <Empty emoji="🎯" text={t('goals.empty')} />
        </Panel>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {goals.map((g, i) => (
          <GoalCard key={g.id} goal={g} index={i} onCheckIn={setCheckIn} onAddKr={() => setAddKrFor(g)} onLink={setLinkFor} />
        ))}
      </div>

      {creating && <GoalDialog period={period} onClose={() => setCreating(false)} />}
      {addKrFor && <KrDialog goal={addKrFor} onClose={() => setAddKrFor(null)} />}
      {checkIn && <CheckInDialog kr={checkIn} onClose={() => setCheckIn(null)} />}
      {linkFor && <LinkDialog kr={linkFor} onClose={() => setLinkFor(null)} />}
    </div>
  );
}

function Ring({ value, color, size = 64 }: { value: number; color: string; size?: number }) {
  const { locale } = useT();
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--sunken)" strokeWidth="7" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset 1s var(--ease-lumi)' }}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums">{num(value, locale)}٪</span>
    </span>
  );
}

function GoalCard({ goal, index, onCheckIn, onAddKr, onLink }: { goal: Goal; index: number; onCheckIn: (kr: KeyResult) => void; onAddKr: () => void; onLink: (kr: KeyResult) => void }) {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const remove = useMutation({ mutationFn: () => del(`/goals/${goal.id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }) });
  const removeKr = useMutation({ mutationFn: (id: string) => del(`/key-results/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }) });
  const fmt = (kr: KeyResult, v: number) =>
    kr.type === 'PERCENT' ? `${num(v, locale)}٪` : `${new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(v)}${kr.unit ? ` ${kr.unit}` : ''}`;

  return (
    <Panel aurora={STATUS_COLOR[goal.status]} className="rise p-5" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start gap-4">
        <Ring value={goal.progress} color={STATUS_COLOR[goal.status]} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{goal.emoji ?? '🎯'}</span>
            <h2 className="truncate text-lg font-semibold">{goal.title}</h2>
          </div>
          {goal.description && <p className="mt-1 text-sm text-muted">{goal.description}</p>}
          <div className="mt-2 flex items-center gap-2">
            <Pill tone={STATUS_TONE[goal.status]}>{t(`goals.status.${goal.status}`)}</Pill>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Avatar name={goal.owner.name} size={18} /> {goal.owner.name}
            </span>
          </div>
        </div>
        <IconButton icon="trash" label="delete" className="size-8" onClick={() => confirm('?') && remove.mutate()} />
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {goal.keyResults.map((kr) => (
          <div key={kr.id} className="group rounded-[16px] bg-sunken p-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[kr.status] }} />
              <p className="flex-1 truncate text-sm font-medium">{kr.title}</p>
              <span className="text-xs text-muted tabular-nums">
                {kr.type === 'TASKS' ? `${num(kr.tasks.filter((x) => x.completedAt).length, locale)}/${num(kr.tasks.length, locale)}` : `${fmt(kr, kr.current)} / ${fmt(kr, kr.target)}`}
              </span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${kr.progress}%`, background: STATUS_COLOR[kr.status] }} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
              {kr.checkIns[0] && (
                <span className="truncate">
                  {kr.checkIns[0].user.name} · {timeAgo(kr.checkIns[0].createdAt, locale)} · {t('goals.confidence')} {num(kr.checkIns[0].confidence, locale)}/{num(10, locale)}
                </span>
              )}
              <span className="ms-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                {kr.type === 'TASKS' ? (
                  <Button size="sm" variant="soft" className="!h-7" onClick={() => onLink(kr)}>
                    🔗 {t('goals.linkTasks')}
                  </Button>
                ) : (
                  <Button size="sm" variant="ink" className="!h-7" onClick={() => onCheckIn(kr)}>
                    ✓ {t('goals.checkIn')}
                  </Button>
                )}
                <IconButton icon="close" label="remove" className="size-7" onClick={() => removeKr.mutate(kr.id)} />
              </span>
            </div>
          </div>
        ))}
        <button onClick={onAddKr} className="hatch flex h-11 items-center justify-center gap-2 rounded-[16px] text-sm text-muted transition hover:text-ink">
          <Icon name="plus" size={14} /> {t('goals.addKr')}
        </button>
      </div>
    </Panel>
  );
}

function GoalDialog({ period, onClose }: { period: string; onClose: () => void }) {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🚀');
  const [p, setP] = useState(period);
  const create = useMutation({
    mutationFn: () => post(`/workspaces/${workspace!.id}/goals`, { title, emoji, period: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });
  return (
    <Dialog onClose={onClose} label={t('goals.new')}>
      <form
        className="p-6"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">{t('goals.new')}</h2>
        <div className="mt-4 flex gap-2">
          <Input className="w-16" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
          <Input autoFocus className="flex-1" placeholder={t('goals.objective')} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Input className="mt-2" placeholder={t('goals.period')} value={p} onChange={(e) => setP(e.target.value)} dir="ltr" />
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

function KrDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<KeyResult['type']>('NUMBER');
  const [start, setStart] = useState('0');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const create = useMutation({
    mutationFn: () =>
      post(`/goals/${goal.id}/key-results`, {
        title,
        type,
        start: Number(start) || 0,
        target: type === 'TASKS' ? undefined : type === 'PERCENT' ? Number(target) || 100 : Number(target),
        unit: unit || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });
  return (
    <Dialog onClose={onClose} label={t('goals.addKr')}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && (type === 'TASKS' || target)) create.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">
          {goal.emoji} {t('goals.addKr')}
        </h2>
        <Input autoFocus className="mt-4" placeholder={t('goals.krTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1">
          {(['NUMBER', 'PERCENT', 'CURRENCY', 'TASKS'] as const).map((k) => (
            <button type="button" key={k} onClick={() => setType(k)} className={cx('h-8 rounded-full px-3 text-xs transition', type === k ? 'bg-ink text-on-ink' : 'bg-sunken text-ink-2')}>
              {t(`goals.types.${k}`)}
            </button>
          ))}
        </div>
        {type !== 'TASKS' && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Input type="number" placeholder={t('goals.start')} value={start} onChange={(e) => setStart(e.target.value)} dir="ltr" />
            <Input type="number" placeholder={t('goals.target')} value={target} onChange={(e) => setTarget(e.target.value)} dir="ltr" />
            <Input placeholder={t('goals.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="ink" loading={create.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function CheckInDialog({ kr, onClose }: { kr: KeyResult; onClose: () => void }) {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const [value, setValue] = useState(String(kr.current));
  const [confidence, setConfidence] = useState(7);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => post(`/key-results/${kr.id}/check-ins`, { value: Number(value), confidence, note: note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });
  const tone = confidence >= 7 ? 'var(--success)' : confidence >= 4 ? 'var(--warn)' : 'var(--danger)';
  return (
    <Dialog onClose={onClose} label={t('goals.checkIn')}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="text-lg font-semibold">✓ {t('goals.checkIn')}</h2>
        <p className="mt-1 text-sm text-muted">{kr.title}</p>
        <label className="mt-4 block text-xs text-muted">{t('goals.value')}</label>
        <Input autoFocus type="number" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" className="mt-1" />
        <label className="mt-4 flex items-center justify-between text-xs text-muted">
          {t('goals.confidence')}
          <span className="text-base font-bold" style={{ color: tone }}>
            {num(confidence, locale)}/{num(10, locale)}
          </span>
        </label>
        <input type="range" min={1} max={10} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: tone }} dir="ltr" />
        <Input className="mt-3" placeholder={t('goals.note')} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="ink" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function LinkDialog({ kr, onClose }: { kr: KeyResult; onClose: () => void }) {
  const { t } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [ids, setIds] = useState<Set<string>>(() => new Set(kr.tasks.map((x) => x.id)));
  const [known, setKnown] = useState(() => new Map(kr.tasks.map((x) => [x.id, x.title])));
  const search = useSearch(workspace?.id, q);
  useEffect(() => {
    if (!search.data) return;
    setKnown((m) => new Map([...m, ...search.data!.tasks.map((x) => [x.id, x.title] as const)]));
  }, [search.data]);
  const save = useMutation({
    mutationFn: () => put(`/key-results/${kr.id}/tasks`, { taskIds: [...ids] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      onClose();
    },
  });
  const toggle = (id: string) => setIds((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  return (
    <Dialog onClose={onClose} label={t('goals.linkTasks')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold">🔗 {t('goals.linkTasks')}</h2>
        <p className="mt-1 text-sm text-muted">{kr.title}</p>
        <Input autoFocus icon="search" className="mt-4" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('filters.search')} />
        <div className="mt-3 flex max-h-72 flex-col overflow-y-auto">
          {[...new Set([...ids, ...(search.data?.tasks.map((x) => x.id) ?? [])])].map((id) => (
            <label key={id} className="flex items-center gap-3 rounded-[12px] px-2 py-2 text-sm hover:bg-sunken">
              <input type="checkbox" checked={ids.has(id)} onChange={() => toggle(id)} className="size-4 accent-[var(--lumi)]" />
              {known.get(id)}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="ink" onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
