'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { cx } from '../ui';

/** Hatched column chart; the selected column turns ink with a floating tooltip (Teknova-style). */
export function HatchBars({ data }: { data: { date: string; count: number; delta: number }[] }) {
  const { t, locale } = useT();
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(3, Math.ceil(Math.max(...data.map((d) => d.count)) / 3) * 3);
  const ticks = [max, (max * 2) / 3, max / 3, 0];

  return (
    <div className="flex h-56 gap-3">
      <div className="flex flex-col justify-between pb-7 text-[11px] text-muted tabular-nums">
        {ticks.map((tick, i) => (
          <span key={i}>{num(tick, locale)}</span>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const h = Math.max(14, (d.count / max) * 100);
          const active = i === selected;
          return (
            <button key={d.date} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} className="group flex h-full flex-1 flex-col items-center gap-2">
              <div className="relative flex w-full flex-1 items-end justify-center">
                {active && (
                  <div className="rise absolute bottom-[calc(var(--h)+12px)] z-10 min-w-28 rounded-[14px] bg-ink p-2.5 text-start text-on-ink shadow-panel" style={{ '--h': `${h}%` } as React.CSSProperties}>
                    <p className="text-[11px] opacity-60">{formatDate(d.date, locale, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <span className="size-2 rounded-full bg-success" /> {num(d.count, locale)} {t('dash.done')}
                    </p>
                    <span className="absolute -bottom-1.5 start-1/2 size-3 -translate-x-1/2 rotate-45 bg-ink rtl:translate-x-1/2" />
                  </div>
                )}
                <div
                  className={cx(
                    'relative w-full max-w-14 rounded-[16px] transition-all duration-500 ease-[var(--ease-lumi)]',
                    active ? 'hatch-ink' : 'hatch bg-sunken shadow-[inset_0_0_0_1px_var(--line)] group-hover:bg-line/60',
                  )}
                  style={{ height: `${h}%` }}
                >
                  {(d.count > 0 || d.delta !== 0) && <span
                    className={cx(
                      'absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm rtl:translate-x-1/2',
                      d.delta >= 0 ? 'bg-success' : 'bg-warn',
                    )}
                    dir="ltr"
                  >
                    {d.delta >= 0 ? '+' : ''}
                    {num(d.delta, locale)}%
                  </span>}
                </div>
              </div>
              <span className={cx('text-[11px]', active ? 'font-semibold text-ink' : 'text-muted')}>{formatDate(d.date, locale, { weekday: 'short' })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Semicircle of rounded segments filled up to `value` percent. */
export function SegmentGauge({ value, label }: { value: number; label: string }) {
  const { locale } = useT();
  const segments = 14;
  const filled = Math.round((value / 100) * segments);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((s) => (s >= filled ? (clearInterval(id), s) : s + 1)), 55);
    return () => clearInterval(id);
  }, [filled]);

  const cx0 = 110;
  const cy0 = 110;
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 220 125" className="w-full">
        {Array.from({ length: segments }, (_, i) => {
          // Fill from the left end of the arc (start side in LTR).
          const a0 = Math.PI - (i / segments) * Math.PI - 0.025;
          const a1 = Math.PI - ((i + 1) / segments) * Math.PI + 0.025;
          const r1 = 100;
          const r0 = 66;
          const p = (a: number, r: number) => `${cx0 + r * Math.cos(a)} ${cy0 - r * Math.sin(a)}`;
          const d = `M ${p(a0, r0)} L ${p(a0, r1)} A ${r1} ${r1} 0 0 1 ${p(a1, r1)} L ${p(a1, r0)} A ${r0} ${r0} 0 0 0 ${p(a0, r0)} Z`;
          const on = i < shown;
          return (
            <path
              key={i}
              d={d}
              fill={on ? `color-mix(in oklab, var(--success) ${70 + (i / segments) * 30}%, #052e16)` : 'var(--sunken)'}
              stroke={on ? 'none' : 'var(--line)'}
              strokeWidth={1}
              strokeLinejoin="round"
              style={{ transition: 'fill .3s' }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-4xl font-bold tabular-nums" dir="ltr">
          {num(value, locale)}%
        </p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Thin arc from 09:00 to 18:00 with a glowing dot at the current time. */
export function DayArc() {
  const { t, locale } = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const progress = Math.min(1, Math.max(0, (minutes - 9 * 60) / (9 * 60)));
  const angle = Math.PI - progress * Math.PI;
  const x = 100 + 86 * Math.cos(angle);
  const y = 96 - 86 * Math.sin(angle);
  const hue = now.getHours() < 12 ? '#F97316' : now.getHours() < 17 ? '#4F5BFF' : '#8B5CF6';

  return (
    <div className="relative w-40" title={t('dash.daily')}>
      <svg viewBox="0 0 200 104" className="w-full overflow-visible">
        <path d="M14 96 A 86 86 0 0 1 186 96" fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
        <path
          d="M14 96 A 86 86 0 0 1 186 96"
          fill="none"
          stroke={hue}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${progress} 1`}
        />
        <circle cx={x} cy={y} r="14" fill={hue} opacity="0.18">
          <animate attributeName="r" values="10;16;10" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={x} cy={y} r="6" fill={hue} />
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center text-xl font-bold tabular-nums" dir="ltr">
        {num(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, locale)}
      </p>
    </div>
  );
}
