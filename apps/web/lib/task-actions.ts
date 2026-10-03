'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { del, patch, post, put } from './api';
import { useToast } from './toast';
import { useT } from './i18n-client';
import type { Task } from './types';

/** Task mutations that refresh every view showing the task. */
export function useTaskActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useT();

  const refresh = (task: { id: string; projectId: string }) => {
    qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    qc.invalidateQueries({ queryKey: ['task', task.id] });
    qc.invalidateQueries({ queryKey: ['myTasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['activity', task.id] });
    qc.invalidateQueries({ queryKey: ['range'] });
  };
  const onError = (e: Error) => toast(e.message || t('common.error'), '⚠️');

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; projectId: string; data: Record<string, unknown> }) => patch<Task>(`/tasks/${id}`, data),
    onSuccess: (task) => refresh(task),
    onError,
  });
  const move = useMutation({
    mutationFn: ({ id, ...body }: { id: string; projectId: string; statusId: string; beforeId?: string; afterId?: string }) =>
      post<Task>(`/tasks/${id}/move`, { statusId: body.statusId, beforeId: body.beforeId, afterId: body.afterId }),
    onSettled: (_d, _e, v) => refresh(v),
    onError,
  });
  const remove = useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => del(`/tasks/${id}`),
    onSuccess: (_d, v) => refresh(v),
    onError,
  });
  const setAssignees = useMutation({
    mutationFn: ({ id, userIds }: { id: string; projectId: string; userIds: string[] }) => put<Task>(`/tasks/${id}/assignees`, { userIds }),
    onSuccess: (task) => refresh(task),
    onError,
  });
  const respond = useMutation({
    mutationFn: ({ id, ...body }: { id: string; projectId: string; action: 'accept' | 'decline' | 'counter'; note?: string; dueAt?: string }) =>
      post<Task>(`/tasks/${id}/proposal`, { action: body.action, note: body.note, dueAt: body.dueAt }),
    onSuccess: (task) => refresh(task),
    onError,
  });

  /** Toggles done by moving to the project's first DONE or TODO status. */
  const toggleDone = (task: Task, statuses: { id: string; category: string }[]) => {
    const done = task.status.category === 'DONE';
    const target = statuses.find((s) => s.category === (done ? 'TODO' : 'DONE'));
    if (target) update.mutate({ id: task.id, projectId: task.projectId, data: { statusId: target.id } });
  };

  return { update, move, remove, setAssignees, respond, toggleDone, refresh };
}
