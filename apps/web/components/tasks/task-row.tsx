'use client';

import { num, useT } from '@/lib/i18n-client';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { Status, Task } from '@/lib/types';
import { AvatarStack, CheckCircle, cx, Icon, PriorityGlyph, StatusDot } from '../ui';
import { DueChip } from './task-drawer';

export function LabelChip({ label }: { label: { name: string; color: string } }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `color-mix(in oklab, ${label.color} 14%, transparent)`, color: label.color }}>
      #{label.name}
    </span>
  );
}

/** One task in a list: check, priority, key, title, meta. */
export function TaskRow({ task, statuses, showProject }: { task: Task; statuses?: Status[]; showProject?: boolean }) {
  const { locale } = useT();
  const { openTask } = useUi();
  const actions = useTaskActions();
  const done = task.status.category === 'DONE';

  return (
    <div
      onClick={() => openTask(task.id)}
      className="group flex cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2.5 transition hover:bg-sunken"
    >
      <CheckCircle
        checked={done}
        onChange={() => actions.toggleDone(task, statuses ?? [{ id: task.statusId, category: task.status.category }])}
      />
      <PriorityGlyph priority={task.priority} />
      <span className="w-14 shrink-0 text-[11px] text-muted tabular-nums" dir="ltr">
        {task.key}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className={cx(done && 'strike')}>{task.title}</span>
      </span>
      {task.proposalState === 'PROPOSED' && <span className="pulse !bg-warn" title="proposal" />}
      <span className="hidden items-center gap-1 md:flex">
        {task.labels.slice(0, 2).map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
      </span>
      {showProject && (
        <span className="hidden items-center gap-1.5 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2 lg:flex">
          {task.project.icon} {task.project.name}
        </span>
      )}
      {task.counts.comments > 0 && (
        <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex">
          <Icon name="message" size={13} /> {num(task.counts.comments, locale)}
        </span>
      )}
      <span className="hidden sm:block">
        <StatusDot color={task.status.color} category={task.status.category} />
      </span>
      <DueChip value={task.dueAt} compact />
      <AvatarStack users={task.assignees.filter((a) => a.role === 'ASSIGNEE')} size={24} max={2} />
    </div>
  );
}
