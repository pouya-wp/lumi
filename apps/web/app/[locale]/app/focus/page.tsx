'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, cx } from '@/components/ui';
import { post } from '@/lib/api';
import { addDays, startOfDay } from '@/lib/calendar';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useFocus, useMyTasks } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';

type Kind = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
const LENGTH: Record<Kind, number> = { FOCUS: 25, SHORT_BREAK: 5, LONG_BREAK: 15 };

/** Soft two-note chime via WebAudio (no asset needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 1);
    });
  } catch {}
}

export default function FocusPage() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const stats = useFocus().data;
  const tasks = useMyTasks(workspace?.id, 'open').data ?? [];
  const [kind, setKind] = useState<Kind>('FOCUS');
  const [taskId, setTaskId] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);
  const current = stats?.current ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.focus });
    qc.invalidateQueries({ queryKey: ['taskTime'] });
  };
  const start = useMutation({
    mutationFn: () => post('/me/focus', { kind, minutes: LENGTH[kind], taskId: kind === 'FOCUS' && taskId ? taskId : undefined }),
    onSuccess: () => {
      refresh();
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    },
  });
  const finish = useMutation({
    mutationFn: (completed: boolean) => post(`/focus/${current!.id}/finish`, { completed }),
    onSuccess: (_d, completed) => {
      finishing.current = false;
      refresh();
      if (completed) {
        const msg = current?.kind === 'FOCUS' ? t('focus.done') : t('focus.breakDone');
        toast(msg, '🍅');
        chime();
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Lumi', { body: msg });
        setKind(current?.kind === 'FOCUS' ? ((stats?.today.count ?? 0) % 4 === 3 ? 'LONG_BREAK' : 'SHORT_BREAK') : 'FOCUS');
      }
    },
  });

  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [current]);

  const total = (current?.plannedMin ?? LENGTH[kind]) * 60;
  const elapsed = current ? Math.min(total, (now - new Date(current.startedAt).getTime()) / 1000) : 0;
  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const progress = current ? elapsed / total : 0;
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (current && remaining === 0 && !finishing.current) {
      finishing.current = true;
      finish.mutate(true);
    }
  }, [current, remaining, finish]);

  useEffect(() => {
    const prev = document.title;
    if (current) document.title = `${clock} · Lumi`;
    return () => {
      document.title = prev;
    };
  }, [current, clock]);

  const R = 140;
  const C = 2 * Math.PI * R;
  const accent = (current?.kind ?? kind) === 'FOCUS' ? '#7680ff' : '#34d399';
  const today = startOfDay(new Date());
  const history = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    return { d, count: stats?.days.find((x) => new Date(x.date).getTime() === d.getTime())?.count ?? 0 };
  });

  return (
    <div className="night relative min-h-[calc(100dvh-140px)] overflow-hidden rounded-[var(--radius-panel)] p-6 text-white">
      {/* Breathing aurora */}
      <div
        className="pointer-events-none absolute -top-1/3 left-1/2 size-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: `radial-gradient(circle, ${accent}55, transparent 60%)`, animation: current ? 'breathe 8s ease-in-out infinite' : undefined }}
      />
      <style>{`@keyframes breathe{0%,100%{transform:translateX(-50%) scale(.85);opacity:.45}50%{transform:translateX(-50%) scale(1.1);opacity:.75}}`}</style>

      <div className="relative z-10 flex flex-col items-center">
        <p className="text-sm text-white/60">{t('focus.subtitle')}</p>
        <h1 className="mt-1 text-2xl font-semibold">{t('focus.title')}</h1>

        <div className="mt-6 flex rounded-full border border-white/15 bg-white/[.06] p-1 backdrop-blur">
          {(
            [
              ['FOCUS', `🍅 ${t('focus.focus')}`],
              ['SHORT_BREAK', `☕ ${t('focus.short')}`],
              ['LONG_BREAK', `🌙 ${t('focus.long')}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              disabled={!!current}
              onClick={() => setKind(k)}
              className={cx('h-9 rounded-full px-4 text-xs font-medium transition', (current?.kind ?? kind) === k ? 'bg-white text-black' : 'text-white/70 hover:text-white')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative mt-10 grid place-items-center">
          <svg width={R * 2 + 40} height={R * 2 + 40} className="-rotate-90">
            <circle cx={R + 20} cy={R + 20} r={R} stroke="rgb(255 255 255 / .08)" strokeWidth="10" fill="none" />
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * 2 * Math.PI;
              const r1 = R + 16;
              const r2 = R + (i % 5 === 0 ? 10 : 13);
              return <line key={i} x1={R + 20 + r1 * Math.cos(a)} y1={R + 20 + r1 * Math.sin(a)} x2={R + 20 + r2 * Math.cos(a)} y2={R + 20 + r2 * Math.sin(a)} stroke="rgb(255 255 255 / .18)" strokeWidth="1.5" />;
            })}
            <circle
              cx={R + 20}
              cy={R + 20}
              r={R}
              stroke={accent}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ filter: `drop-shadow(0 0 12px ${accent})`, transition: 'stroke-dashoffset .3s linear' }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-7xl font-bold tracking-tight tabular-nums" dir="ltr">
              {num(current ? clock : `${String(LENGTH[kind]).padStart(2, '0')}:00`, locale)}
            </p>
            <p className="mt-2 max-w-56 truncate text-sm text-white/60">{current?.task?.title ?? (current ? '' : t('focus.pickTask'))}</p>
          </div>
        </div>

        {!current && kind === 'FOCUS' && (
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="mt-8 h-11 w-80 max-w-full rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none backdrop-blur [&>option]:text-black"
          >
            <option value="">{t('focus.noTask')}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.project.icon} {task.title}
              </option>
            ))}
          </select>
        )}

        <div className="mt-6 flex gap-2">
          {current ? (
            <>
              <Button size="lg" className="!bg-white !text-black" onClick={() => finish.mutate(true)} loading={finish.isPending}>
                ✓ {t('focus.finish')}
              </Button>
              <Button size="lg" variant="ghost" className="!text-white/70 hover:!bg-white/10" onClick={() => finish.mutate(false)}>
                {t('focus.skip')}
              </Button>
            </>
          ) : (
            <Button size="lg" className="!bg-white px-10 !text-black" onClick={() => start.mutate()} loading={start.isPending}>
              ▶ {t('focus.start')}
            </Button>
          )}
        </div>

        <div className="mt-12 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/[.06] p-4 backdrop-blur">
            <p className="text-xs text-white/50">{t('focus.today')}</p>
            <p className="mt-2 text-2xl">{'🍅'.repeat(Math.min(8, stats?.today.count ?? 0)) || '—'}</p>
            <p className="mt-1 text-xs text-white/60">
              {t('focus.sessions', { n: stats?.today.count ?? 0 })} · {t('focus.minutes', { n: stats?.today.minutes ?? 0 })}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[.06] p-4 backdrop-blur">
            <p className="text-xs text-white/50">🔥</p>
            <p className="mt-2 text-3xl font-bold">{num(stats?.streak ?? 0, locale)}</p>
            <p className="mt-1 text-xs text-white/60">{t('focus.streak', { n: stats?.streak ?? 0 })}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[.06] p-4 backdrop-blur">
            <div className="flex h-16 items-end gap-1">
              {history.map(({ d, count }) => (
                <div
                  key={d.toISOString()}
                  title={formatDate(d, locale)}
                  className={cx('flex-1 rounded-[4px]', count ? '' : 'bg-white/10')}
                  style={{ height: `${Math.max(8, Math.min(100, count * 20))}%`, background: count ? accent : undefined }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-white/50">{num(14, locale)} {locale === 'fa' ? 'روز اخیر' : 'days'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
