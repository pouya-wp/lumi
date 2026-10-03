'use client';

import { num, useT } from '@/lib/i18n-client';
import type { Task } from '@/lib/types';
import { AvatarStack, cx, Icon, PriorityGlyph } from '../ui';
import { DueChip } from './task-drawer';
import { LabelChip } from './task-row';

export function TaskCard({ task, dragging, overlay }: { task: Task; dragging?: boolean; overlay?: boolean }) {
  const { locale } = useT();
  const done = task.status.category === 'DONE';
  const proposed = task.proposalState === 'PROPOSED';
  return (
    <div
      className={cx(
        'panel cursor-grab p-3.5 transition duration-200 active:cursor-grabbing',
        dragging && 'opacity-40',
        overlay && 'rotate-2 scale-[1.03] shadow-[0_24px_48px_-16px_rgb(0_0_0/.35)]',
        proposed && 'outline-dashed outline-[1.5px] outline-warn/60',
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <PriorityGlyph priority={task.priority} size={12} />
        <span dir="ltr" className="tabular-nums">
          {task.key}
        </span>
        {task.status.category === 'IN_PROGRESS' && <span className="pulse ms-auto" />}
        {proposed && <span className="sticker ms-auto !px-2 !py-0.5 !text-[10px] bg-warn-soft text-warn">✦</span>}
      </div>
      <p className={cx('mt-2 text-sm leading-relaxed font-medium', done && 'text-muted line-through')}>{task.title}</p>
      {task.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <LabelChip key={l.id} label={l} />
          ))}
        </div>
      )}
      {task.checklist.total > 0 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-success" style={{ width: `${(task.checklist.done / task.checklist.total) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <DueChip value={task.dueAt} compact />
        {task.checklist.total > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted tabular-nums">
            <Icon name="checkCircle" size={12} /> {num(task.checklist.done, locale)}/{num(task.checklist.total, locale)}
          </span>
        )}
        {task.counts.subtasks > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Icon name="subtask" size={12} /> {num(task.counts.subtasks, locale)}
          </span>
        )}
        {task.counts.comments > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Icon name="message" size={12} /> {num(task.counts.comments, locale)}
          </span>
        )}
        <span className="ms-auto">
          <AvatarStack users={task.assignees.filter((a) => a.role === 'ASSIGNEE')} size={22} max={2} />
        </span>
      </div>
    </div>
  );
}
