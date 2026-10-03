'use client';

import { parseQuickAdd } from '@lumi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { post } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import { useT } from '@/lib/i18n-client';
import { useProjects, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { useUi } from '@/lib/ui-state';
import type { Task } from '@/lib/types';
import { Avatar, Button, Icon, Kbd, Pill, PriorityGlyph } from '../ui';
import { Dialog } from '../ui/dialog';

export function QuickAdd() {
  const { quickAdd } = useUi();
  return quickAdd ? <QuickAddDialog quickAdd={quickAdd} /> : null;
}

/** Natural-language task creation: chips preview what the parser understood before saving. */
function QuickAddDialog({ quickAdd }: { quickAdd: NonNullable<ReturnType<typeof useUi>['quickAdd']> }) {
  const { t, locale } = useT();
  const { closeQuickAdd, openTask } = useUi();
  const { workspace, user } = useSession();
  const projects = useProjects(workspace?.id);
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState(quickAdd.projectId);
  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.[0];

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const assignees = parsed.mentions
    .map((m) => members.find((u) => u.name.toLowerCase().startsWith(m.toLowerCase()) || u.email.toLowerCase().startsWith(m.toLowerCase())))
    .filter((u): u is NonNullable<typeof u> => !!u);

  const create = useMutation({
    mutationFn: () =>
      post<Task>(`/projects/${project!.id}/tasks`, {
        title: parsed.title || text.trim(),
        priority: parsed.priority,
        dueAt: parsed.dueAt?.toISOString(),
        labelNames: parsed.labels,
        assigneeIds: assignees.length ? assignees.map((a) => a.id) : user ? [user.id] : [],
        statusId: project!.id === quickAdd.projectId ? quickAdd.statusId : undefined,
        parentId: quickAdd.parentId,
      }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      qc.invalidateQueries({ queryKey: ['task', quickAdd.parentId] });
      qc.invalidateQueries({ queryKey: ['myTasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast(`${task.key} · ${task.title}`, '✨');
      setText('');
      closeQuickAdd();
      if (!quickAdd.parentId) openTask(task.id);
    },
    onError: (e: Error) => toast(e.message, '⚠️'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if ((parsed.title || text.trim()) && project) create.mutate();
  };

  return (
    <Dialog onClose={closeQuickAdd} label={t('task.new')}>
      <form onSubmit={submit}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-lumi/12 text-lumi">
            <Icon name="sparkle" size={18} />
          </span>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('task.quickAddPlaceholder')}
            className="h-10 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex min-h-14 flex-wrap items-center gap-2 px-5 py-3">
          {parsed.dueAt && (
            <Pill tone="info">
              <Icon name="calendar" size={12} /> {formatDate(parsed.dueAt, locale, { weekday: 'short', day: 'numeric', month: 'short' })}
              {parsed.dueAt.getHours() !== 23 && ` · ${formatTime(parsed.dueAt, locale)}`}
            </Pill>
          )}
          {parsed.priority && (
            <Pill tone={parsed.priority === 'URGENT' ? 'danger' : parsed.priority === 'HIGH' ? 'warn' : 'neutral'}>
              <PriorityGlyph priority={parsed.priority} size={11} /> {t(`priority.${parsed.priority}`)}
            </Pill>
          )}
          {assignees.map((a) => (
            <Pill key={a.id} tone="lumi">
              <Avatar name={a.name} size={14} /> {a.name}
            </Pill>
          ))}
          {parsed.labels.map((l) => (
            <Pill key={l}>#{l}</Pill>
          ))}
          {!text && <span className="text-xs text-muted">@ · # · ! · {t('common.tomorrow')} · {locale === 'fa' ? 'ساعت ۱۰' : 'at 10'}</span>}
        </div>
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <select
            value={project?.id}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none"
          >
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
          <span className="ms-auto hidden text-xs text-muted sm:block">
            <Kbd>↵</Kbd>
          </span>
          <Button type="submit" variant="ink" loading={create.isPending} disabled={!text.trim() || !project}>
            {t('task.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
