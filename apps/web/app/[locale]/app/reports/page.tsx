'use client';

import { useMemo, useState } from 'react';
import { CycleScatter, DualBars, fmtHours, Spark, StackedArea } from '@/components/reports/charts';
import { Avatar, Button, cx, Empty, Icon, Odometer, Panel, PanelHeader, Pill, PriorityGlyph, Segmented, Spinner } from '@/components/ui';
import { API_URL, tokens } from '@/lib/api';
import { formatMinutes } from '@/lib/calendar';
import { num, useT } from '@/lib/i18n-client';
import { useProjects, useReport, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';

const CATS = [
  { key: 'BACKLOG', color: '#A1A1AA' },
  { key: 'TODO', color: '#0EA5E9' },
  { key: 'IN_PROGRESS', color: '#F97316' },
  { key: 'REVIEW', color: '#8B5CF6' },
  { key: 'DONE', color: '#16A34A' },
];
const PRIORITY_COLORS: Record<string, string> = { URGENT: '#F43F5E', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#0EA5E9', NONE: '#A1A1AA' };

export default function ReportsPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask } = useUi();
  const toast = useToast();
  const projects = useProjects(workspace?.id).data ?? [];
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [projectId, setProjectId] = useState('');
  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - Number(range) + 1);
    return d;
  }, [range]);
  const report = useReport(workspace?.id, from, projectId);
  const r = report.data;

  const exportCsv = async () => {
    const res = await fetch(`${API_URL}/api/workspaces/${workspace!.id}/export/tasks.csv${projectId ? `?projectId=${projectId}` : ''}`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: `lumi-tasks-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    toast(t('reports.exported'));
  };

  const pct = (v: number | null) => (v === null ? '—' : `${num(Math.round(v * 100), locale)}%`);

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#16A34A" aurora2="#4F5BFF" className="rise flex flex-wrap items-center gap-3 p-5">
        <span className="grid size-12 place-items-center rounded-[16px] bg-ink text-xl text-on-ink">📈</span>
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="text-2xl font-semibold">{t('reports.title')}</h1>
          <p className="text-sm text-muted">{t('reports.subtitle')}</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 rounded-full bg-sunken px-4 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
          <option value="">{t('reports.allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        <Segmented value={range} onChange={setRange} options={(['7', '30', '90'] as const).map((v) => ({ value: v, label: t(`reports.range.${v}`) }))} />
        <Button variant="ink" onClick={exportCsv}>
          <Icon name="arrowDown" size={15} /> {t('reports.export')}
        </Button>
      </Panel>

      {!r ? (
        <div className="grid h-96 place-items-center">
          <Spinner />
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className={cx('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 transition-opacity', report.isFetching && 'opacity-60')}>
            <Kpi label={t('reports.completed')} value={num(r.totals.completed, locale)} accent="var(--success)" spark={r.throughput.map((d) => d.completed)} />
            <Kpi label={t('reports.created')} value={num(r.totals.created, locale)} accent="var(--info)" spark={r.throughput.map((d) => d.created)} />
            <Kpi label={t('reports.cycleMedian')} value={r.cycle.points.length ? fmtHours(r.cycle.medianHours, locale, t) : '—'} accent="var(--lumi)" />
            <Kpi label={t('reports.onTime')} value={pct(r.totals.onTimeRate)} accent="var(--success)" ring={r.totals.onTimeRate ?? 0} />
            <Kpi label={t('reports.logged')} value={formatMinutes(r.totals.minutes, locale)} accent="var(--warn)" />
            <Kpi label={t('reports.overdue')} value={num(r.totals.overdue, locale)} accent="var(--danger)" dark />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel className="rise p-5">
              <PanelHeader icon="bolt" title={t('reports.throughput')}>
                <span className="flex items-center gap-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-ink" /> {t('reports.completed')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="hatch size-2.5 rounded-sm bg-sunken shadow-[inset_0_0_0_1px_var(--line)]" /> {t('reports.created')}
                  </span>
                </span>
              </PanelHeader>
              <p className="mt-1 mb-4 text-xs text-muted">{t('reports.throughputHint')}</p>
              <DualBars data={r.throughput} labels={{ created: t('reports.created'), completed: t('reports.completed') }} />
            </Panel>

            <Panel className="rise p-5" style={{ animationDelay: '60ms' }}>
              <PanelHeader icon="board" title={t('reports.cfd')}>
                <span className="flex flex-wrap gap-2 text-[11px] text-muted">
                  {CATS.map((c) => (
                    <span key={c.key} className="flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ background: c.color }} /> {t(`reports.cats.${c.key}`)}
                    </span>
                  ))}
                </span>
              </PanelHeader>
              <p className="mt-1 mb-4 text-xs text-muted">{t('reports.cfdHint')}</p>
              <StackedArea rows={r.cfd} series={[...CATS].reverse().map((c) => ({ key: c.key, label: t(`reports.cats.${c.key}`), color: c.color }))} />
            </Panel>
          </div>

          <Panel className="rise p-5" style={{ animationDelay: '120ms' }}>
            <PanelHeader icon="clock" title={t('reports.cycle')}>
              <Pill tone="success">
                {t('reports.p50')} {fmtHours(r.cycle.medianHours, locale, t)}
              </Pill>
              <Pill tone="warn">
                {t('reports.p85')} {fmtHours(r.cycle.p85Hours, locale, t)}
              </Pill>
            </PanelHeader>
            <p className="mt-1 mb-4 text-xs text-muted">{t('reports.cycleHint')}</p>
            {r.cycle.points.length === 0 ? (
              <Empty emoji="⏱️" text={t('reports.noData')} />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <CycleScatter points={r.cycle.points} p50={r.cycle.medianHours} p85={r.cycle.p85Hours} from={r.range.from} to={r.range.to} onPick={openTask} />
                <div className="flex flex-col gap-2">
                  {r.cycle.histogram.map((b) => {
                    const max = Math.max(1, ...r.cycle.histogram.map((x) => x.count));
                    return (
                      <div key={b.key} className="flex items-center gap-3 text-xs">
                        <span className="w-16 shrink-0 text-muted">{t(`reports.buckets.${b.key}`)}</span>
                        <span className="h-6 flex-1 overflow-hidden rounded-full bg-sunken">
                          <span className="hatch-ink block h-full rounded-full transition-[width] duration-700" style={{ width: `${(b.count / max) * 100}%` }} />
                        </span>
                        <span className="w-6 text-end font-semibold tabular-nums">{num(b.count, locale)}</span>
                      </div>
                    );
                  })}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <MiniStat label={t('reports.avg')} value={fmtHours(r.cycle.avgHours, locale, t)} />
                    <MiniStat label={t('reports.lead')} value={fmtHours(r.cycle.avgLeadHours, locale, t)} />
                  </div>
                </div>
              </div>
            )}
          </Panel>

          {/* People */}
          <Panel className="rise overflow-hidden p-0" style={{ animationDelay: '180ms' }}>
            <div className="p-5 pb-3">
              <PanelHeader icon="users" title={t('reports.people')} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] text-muted">
                    {['person', 'done', 'inProgress', 'open', 'overdue', 'avgCycle', 'onTime', 'logged', 'trend'].map((k) => (
                      <th key={k} className="px-4 py-2.5 text-start font-medium">
                        {t(`reports.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...r.people]
                    .sort((a, b) => b.done - a.done)
                    .map((p, i) => (
                      <tr key={p.user.id} className="border-b border-line/70 last:border-0 hover:bg-sunken/60">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            <span className="relative">
                              <Avatar name={p.user.name} src={p.user.avatarUrl} size={32} />
                              {i === 0 && p.done > 0 && <span className="absolute -top-2 -end-1 text-sm">👑</span>}
                            </span>
                            <span className="font-medium">{p.user.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-base font-semibold tabular-nums">{num(p.done, locale)}</td>
                        <td className="px-4 py-3 tabular-nums">{num(p.inProgress, locale)}</td>
                        <td className="px-4 py-3 tabular-nums">{num(p.open, locale)}</td>
                        <td className="px-4 py-3">{p.overdue ? <Pill tone="danger">{num(p.overdue, locale)}</Pill> : <span className="text-muted">—</span>}</td>
                        <td className="px-4 py-3 text-muted">{p.done ? fmtHours(p.avgCycleHours, locale, t) : '—'}</td>
                        <td className="px-4 py-3">{pct(p.onTimeRate)}</td>
                        <td className="px-4 py-3 text-muted">{formatMinutes(p.minutes, locale)}</td>
                        <td className="w-40 px-4 py-3">
                          <Spark values={p.daily.slice(-30)} color="var(--success)" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel className="rise p-5">
              <PanelHeader icon="folder" title={t('reports.projects')} />
              <div className="mt-4 flex flex-col gap-3">
                {r.projects.map((p) => {
                  const max = Math.max(1, ...r.projects.map((x) => x.done + x.open));
                  return (
                    <div key={p.project.id}>
                      <div className="mb-1.5 flex items-center gap-2 text-sm">
                        <span>{p.project.icon ?? '◆'}</span>
                        <span className="flex-1 truncate">{p.project.name}</span>
                        <span className="text-[11px] text-muted">{formatMinutes(p.minutes, locale)}</span>
                      </div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken">
                        <span className="h-full bg-success" style={{ width: `${(p.done / max) * 100}%` }} />
                        <span className="hatch h-full" style={{ width: `${(p.open / max) * 100}%`, background: `color-mix(in oklab, ${p.project.color ?? '#4F5BFF'} 35%, transparent)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="rise p-5">
              <PanelHeader icon="flag" title={t('reports.priorities')} />
              {(() => {
                const total = Math.max(1, r.priorities.reduce((a, p) => a + p.count, 0));
                return (
                  <>
                    <div className="mt-5 flex h-10 overflow-hidden rounded-[14px]">
                      {r.priorities
                        .filter((p) => p.count)
                        .map((p) => (
                          <span key={p.priority} className="h-full transition-all" style={{ width: `${(p.count / total) * 100}%`, background: PRIORITY_COLORS[p.priority] }} title={t(`priority.${p.priority}`)} />
                        ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {r.priorities.map((p) => (
                        <span key={p.priority} className="flex items-center gap-2 rounded-[12px] bg-sunken px-3 py-2 text-xs">
                          <PriorityGlyph priority={p.priority} size={12} />
                          <span className="flex-1">{t(`priority.${p.priority}`)}</span>
                          <b className="tabular-nums">{num(p.count, locale)}</b>
                        </span>
                      ))}
                    </div>
                  </>
                );
              })()}
              {r.labels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.labels.map((l) => (
                    <span key={l.label.id} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: `color-mix(in oklab, ${l.label.color} 16%, transparent)`, color: l.label.color }}>
                      {l.label.name} · {num(l.count, locale)}
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="rise p-5">
              <PanelHeader icon="clock" title={t('reports.aging')} />
              <p className="mt-1 text-xs text-muted">{t('reports.agingHint')}</p>
              <div className="mt-3 flex flex-col">
                {r.aging.length === 0 && <Empty emoji="🌊" text={t('reports.noData')} />}
                {r.aging.map((a) => {
                  const days = a.ageHours / 24;
                  const tone = days > 7 ? 'bg-danger' : days > 3 ? 'bg-warn' : 'bg-success';
                  const who = members.find((m) => a.assigneeIds.includes(m.id));
                  return (
                    <button key={a.id} onClick={() => openTask(a.id)} className="flex items-center gap-3 rounded-[12px] px-2 py-2 text-start hover:bg-sunken">
                      <span className={cx('size-2 shrink-0 rounded-full', tone)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{a.title}</span>
                        <span className="text-[10px] text-muted" dir="ltr">
                          {a.key}
                        </span>
                      </span>
                      {who && <Avatar name={who.name} src={who.avatarUrl} size={22} />}
                      <span className="w-14 text-end text-xs font-medium tabular-nums">{fmtHours(a.ageHours, locale, t)}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, spark, ring, dark }: { label: string; value: string; accent: string; spark?: number[]; ring?: number; dark?: boolean }) {
  return (
    <Panel className={cx('rise flex min-h-32 flex-col justify-between p-4', dark && '!bg-ink text-on-ink')}>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
        <p className="truncate text-xs opacity-70">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold whitespace-nowrap">{/^[\d۰-۹٪%]+$/.test(value) ? <Odometer value={value} /> : value}</p>
        {spark && (
          <span className="w-20">
            <Spark values={spark.slice(-14)} color={accent} />
          </span>
        )}
        {ring !== undefined && (
          <svg width={36} height={36} viewBox="0 0 36 36" className="-rotate-90">
            <circle cx={18} cy={18} r={14} fill="none" stroke="var(--line)" strokeWidth={5} />
            <circle cx={18} cy={18} r={14} fill="none" stroke={accent} strokeWidth={5} strokeLinecap="round" strokeDasharray={88} strokeDashoffset={88 * (1 - ring)} />
          </svg>
        )}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-sunken p-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
