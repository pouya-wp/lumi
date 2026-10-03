'use client';

import { num, useT } from '@/lib/i18n-client';
import { useTimer } from '@/lib/queries';
import { useUi } from '@/lib/ui-state';
import { useElapsed, useTimerActions } from '../tasks/drawer-extras';

/** Floating ink pill while a timer runs: task name, live clock and stop. */
export function TimerPill() {
  const { t, locale } = useT();
  const timer = useTimer();
  const { openTask } = useUi();
  const { stop } = useTimerActions();
  const elapsed = useElapsed(timer.data?.startedAt);
  if (!timer.data?.task) return null;
  return (
    <div className="rise flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink ps-2.5 pe-1 text-on-ink shadow-panel sm:gap-2">
      <span className="pulse !bg-danger" />
      <button onClick={() => openTask(timer.data!.taskId)} className="hidden max-w-36 truncate text-xs opacity-80 sm:block" title={t('time.running')}>
        {timer.data.task.title}
      </button>
      <span className="text-xs font-semibold tabular-nums sm:text-sm" dir="ltr">
        {num(elapsed, locale)}
      </span>
      <button onClick={() => stop.mutate()} className="grid size-8 place-items-center rounded-full bg-on-ink/15 hover:bg-on-ink/25" aria-label={t('time.stop')}>
        <span className="size-2.5 rounded-[2px] bg-on-ink" />
      </button>
    </div>
  );
}
