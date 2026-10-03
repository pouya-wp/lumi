'use client';

import { fromJalali, JALALI_MONTHS, JALALI_WEEKDAYS, jalaliMonthLength, toJalali } from '@lumi/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { num, useT } from '@/lib/i18n-client';
import { cx, Icon } from '.';

const EN_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Month {
  year: number;
  month: number; // 1-based
}

/** Popover month grid: Jalali (Saturday-first) for fa, Gregorian for en. Value is an ISO string at 18:00 local. */
export function DatePicker({ value, onChange, trigger }: { value: string | null; onChange: (iso: string | null) => void; trigger: ReactNode }) {
  const { t, locale } = useT();
  const jalali = locale === 'fa';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value) : null;

  const initial = (): Month => {
    const d = selected ?? new Date();
    if (jalali) {
      const j = toJalali(d);
      return { year: j.jy, month: j.jm };
    }
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  };
  const [view, setView] = useState<Month>(initial);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const daysInMonth = jalali ? jalaliMonthLength(view.year, view.month) : new Date(view.year, view.month, 0).getDate();
  const dateOf = (day: number) => (jalali ? fromJalali(view.year, view.month, day) : new Date(view.year, view.month - 1, day));
  // Leading blanks: Saturday-first for Jalali, Sunday-first for Gregorian.
  const firstWeekday = dateOf(1).getDay();
  const lead = jalali ? (firstWeekday + 1) % 7 : firstWeekday;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pick = (d: Date | null) => {
    if (d) d.setHours(18, 0, 0, 0);
    onChange(d ? d.toISOString() : null);
    setOpen(false);
  };
  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const m = month + delta;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });
  const plusDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };

  const monthName = jalali
    ? JALALI_MONTHS[view.month - 1]
    : new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(view.year, view.month - 1, 1));

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setView(initial()); setOpen(!open); }} className="w-full text-start">
        {trigger}
      </button>
      {open && (
        <div className="panel rise absolute top-full z-40 mt-2 w-72 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-full hover:bg-sunken" aria-label="prev">
              <Icon name="chevronDown" size={15} className="rotate-90 rtl:-rotate-90" />
            </button>
            <span className="text-sm font-semibold">
              {monthName} {num(view.year, locale)}
            </span>
            <button type="button" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-full hover:bg-sunken" aria-label="next">
              <Icon name="chevronDown" size={15} className="-rotate-90 rtl:rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted">
            {(jalali ? JALALI_WEEKDAYS : EN_WEEKDAYS).map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = dateOf(i + 1);
              const isSel = selected && d.toDateString() === selected.toDateString();
              const isToday = d.getTime() === today.getTime();
              const isFriday = d.getDay() === 5 && jalali;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(d)}
                  className={cx(
                    'grid aspect-square place-items-center rounded-full text-[13px] transition',
                    isSel ? 'bg-ink text-on-ink' : isToday ? 'text-lumi font-semibold shadow-[inset_0_0_0_1.5px_var(--lumi)]' : 'text-ink hover:bg-sunken',
                    !isSel && isFriday && 'text-danger',
                  )}
                >
                  {num(i + 1, locale)}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {[
              [t('common.today'), 0],
              [t('common.tomorrow'), 1],
              [`+${num(7, locale)}`, 7],
            ].map(([label, n]) => (
              <button type="button" key={label} onClick={() => pick(plusDays(n as number))} className="rounded-full bg-sunken px-3 py-1 text-xs hover:bg-line">
                {label}
              </button>
            ))}
            {value && (
              <button type="button" onClick={() => pick(null)} className="ms-auto rounded-full px-3 py-1 text-xs text-danger hover:bg-danger-soft">
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
