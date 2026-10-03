'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { cx } from '../ui';

const W = 640;

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(points: [number, number][]) {
  if (points.length < 2) return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function Tooltip({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-[14px] bg-ink p-2.5 text-[11px] text-on-ink shadow-panel"
      style={{ left: `${Math.min(88, Math.max(12, x))}%` }}
    >
      {children}
    </div>
  );
}

/** Stacked smooth areas, one band per series, drawn from the bottom up. */
export function StackedArea({ rows, series, height = 220 }: { rows: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; height?: number }) {
  const { locale } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const n = rows.length;
  const totals = rows.map((r) => series.reduce((a, s) => a + Number(r[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * (H - 12);
  const bands = series.map((s, si) => {
    const lower = rows.map((r) => series.slice(0, si).reduce((a, p) => a + Number(r[p.key] ?? 0), 0));
    const upper = rows.map((r, i) => lower[i] + Number(r[s.key] ?? 0));
    const top = smooth(upper.map((v, i) => [x(i), y(v)]));
    const bottom = smooth(lower.map((v, i) => [x(i), y(v)]).reverse() as [number, number][]);
    return { ...s, d: `${top} L${x(n - 1)},${y(lower[n - 1])} ${bottom.replace(/^M/, 'L')} Z`, line: top };
  });

  return (
    <div className="relative" dir="ltr" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[220px] w-full overflow-visible"
        style={{ height: H }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
        }}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        {bands.map((b) => (
          <g key={b.key}>
            <path d={b.d} fill={b.color} fillOpacity={0.22} />
            <path d={b.line} fill="none" stroke={b.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--ink)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && rows[hover] && (
        <Tooltip x={(hover / Math.max(1, n - 1)) * 100}>
          <p className="mb-1 opacity-60">{formatDate(String(rows[hover].day), locale, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          {[...series].reverse().map((s) => (
            <p key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <span className="flex-1">{s.label}</span>
              <b className="tabular-nums">{num(Number(rows[hover][s.key] ?? 0), locale)}</b>
            </p>
          ))}
        </Tooltip>
      )}
      <AxisDays days={rows.map((r) => String(r.day))} />
    </div>
  );
}

function AxisDays({ days }: { days: string[] }) {
  const { locale } = useT();
  const step = Math.max(1, Math.ceil(days.length / 6));
  return (
    <div className="mt-2 flex justify-between text-[10px] text-muted">
      {days
        .filter((_, i) => i % step === 0 || i === days.length - 1)
        .map((d) => (
          <span key={d}>{formatDate(d, locale, { day: 'numeric', month: 'short' })}</span>
        ))}
    </div>
  );
}

/** Paired columns per day: hatched "created" behind a solid "completed". */
export function DualBars({ data, labels }: { data: { day: string; created: number; completed: number }[]; labels: { created: string; completed: string } }) {
  const { locale } = useT();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.completed)));
  return (
    <div className="relative" dir="ltr" onMouseLeave={() => setHover(null)}>
      <div className="flex h-48 items-end gap-[3px]">
        {data.map((d, i) => (
          <div key={d.day} onMouseEnter={() => setHover(i)} className="relative flex h-full flex-1 items-end justify-center">
            <div className="hatch absolute bottom-0 w-full rounded-t-[6px] bg-sunken shadow-[inset_0_0_0_1px_var(--line)]" style={{ height: `${(d.created / max) * 100}%` }} />
            <div
              className={cx('relative w-[55%] rounded-t-[6px] transition-all duration-500', hover === i ? 'bg-lumi' : 'bg-ink')}
              style={{ height: `${Math.max(d.completed ? 4 : 0, (d.completed / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      {hover !== null && data[hover] && (
        <Tooltip x={((hover + 0.5) / data.length) * 100}>
          <p className="mb-1 opacity-60">{formatDate(data[hover].day, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="flex justify-between gap-3">
            {labels.completed} <b>{num(data[hover].completed, locale)}</b>
          </p>
          <p className="flex justify-between gap-3 opacity-70">
            {labels.created} <b>{num(data[hover].created, locale)}</b>
          </p>
        </Tooltip>
      )}
      <AxisDays days={data.map((d) => d.day)} />
    </div>
  );
}

/** Dot plot of cycle time per finished task with median and 85th-percentile guides. */
export function CycleScatter({ points, p50, p85, from, to, onPick }: { points: { id: string; key: string; title: string; completedAt: string; cycleHours: number }[]; p50: number; p85: number; from: string; to: string; onPick: (id: string) => void }) {
  const { t, locale } = useT();
  const H = 200;
  const t0 = new Date(from).getTime();
  const t1 = Math.max(t0 + 1, new Date(to).getTime());
  const max = Math.max(24, p85 * 1.25, ...points.map((p) => p.cycleHours));
  const y = (h: number) => H - (Math.sqrt(h) / Math.sqrt(max)) * (H - 10);
  const [hover, setHover] = useState<string | null>(null);
  const hp = points.find((p) => p.id === hover);
  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: H }}>
        {[
          { v: p50, c: 'var(--success)', l: t('reports.p50') },
          { v: p85, c: 'var(--warn)', l: '85%' },
        ].map((g) => (
          <g key={g.l}>
            <line x1={0} x2={W} y1={y(g.v)} y2={y(g.v)} stroke={g.c} strokeDasharray="6 6" strokeWidth={1.5} />
            <text x={W} y={y(g.v) - 5} textAnchor="end" fontSize={11} fill={g.c}>
              {g.l} · {fmtHours(g.v, locale, t)}
            </text>
          </g>
        ))}
        {points.map((p) => {
          const cx0 = ((new Date(p.completedAt).getTime() - t0) / (t1 - t0)) * W;
          return (
            <circle
              key={p.id}
              cx={cx0}
              cy={y(p.cycleHours)}
              r={hover === p.id ? 8 : 5.5}
              fill={p.cycleHours > p85 ? 'var(--warn)' : 'var(--ink)'}
              fillOpacity={0.85}
              stroke="var(--panel)"
              strokeWidth={2}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(p.id)}
            />
          );
        })}
      </svg>
      {hp && (
        <Tooltip x={((new Date(hp.completedAt).getTime() - t0) / (t1 - t0)) * 100}>
          <p className="opacity-60">{hp.key}</p>
          <p className="max-w-52 truncate font-medium">{hp.title}</p>
          <p className="mt-1">{fmtHours(hp.cycleHours, locale, t)}</p>
        </Tooltip>
      )}
    </div>
  );
}

export function fmtHours(h: number, locale: 'fa' | 'en', t: (k: string, p?: Record<string, string | number>) => string) {
  if (h < 24) return t('reports.hours', { n: Math.round(h * 10) / 10 });
  return t('reports.days', { n: Math.round((h / 24) * 10) / 10 });
}

/** Tiny bar sparkline. */
export function Spark({ values, color = 'var(--ink)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-7 items-end gap-px" dir="ltr">
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(v ? 18 : 6, (v / max) * 100)}%`, background: v ? color : 'var(--line)' }} />
      ))}
    </div>
  );
}

/** GitHub-style contribution grid: columns are weeks, rows are weekdays. */
export function Heatmap({ heat, weeks = 12 }: { heat: Record<string, number>; weeks?: number }) {
  const { locale } = useT();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  const max = Math.max(1, ...Object.values(heat));
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cols: Date[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: Date[] = [];
    for (let d = 0; d < 7; d++) col.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    cols.push(col);
  }
  return (
    <div className="flex gap-[3px]">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-1 flex-col gap-[3px]">
          {col.map((d) => {
            const v = heat[key(d)] ?? 0;
            return (
              <span
                key={d.toISOString()}
                title={`${formatDate(d, locale, { day: 'numeric', month: 'short' })} · ${num(v, locale)}`}
                className={cx('aspect-square rounded-[4px]', d > today && 'opacity-0')}
                style={{ background: v ? `color-mix(in oklab, var(--success) ${25 + (v / max) * 75}%, var(--sunken))` : 'var(--sunken)', boxShadow: v ? undefined : 'inset 0 0 0 1px var(--line)' }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Ring progress used for levels. */
export function Ring({ value, size = 120, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-[stroke-dashoffset] duration-1000 ease-[var(--ease-lumi)]"
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4F5BFF" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
