'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL, tokens } from './api';
import { useT } from './i18n-client';
import { useToast } from './toast';
import type { Notification } from './types';

interface TaskEvent {
  projectId: string;
  taskId: string;
  workspaceId: string;
}

/** Keeps cached queries fresh from server-pushed domain events. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useT();

  useEffect(() => {
    if (!enabled || !tokens.access) return;
    const socket = io(`${API_URL}/realtime`, { auth: (cb) => cb({ token: tokens.access }), transports: ['websocket'] });

    const onTask = (e: TaskEvent) => {
      qc.invalidateQueries({ queryKey: ['tasks', e.projectId] });
      qc.invalidateQueries({ queryKey: ['task', e.taskId] });
      qc.invalidateQueries({ queryKey: ['activity', e.taskId] });
      qc.invalidateQueries({ queryKey: ['myTasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['range'] });
      qc.invalidateQueries({ queryKey: ['taskTime', e.taskId] });
      qc.invalidateQueries({ queryKey: ['timesheet'] });
    };
    const onComment = (e: TaskEvent) => {
      qc.invalidateQueries({ queryKey: ['comments', e.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', e.projectId] });
      qc.invalidateQueries({ queryKey: ['activity', e.taskId] });
    };
    const onProject = (e: { projectId: string }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', e.projectId] });
    };
    const onNotification = (n: Notification) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
      if (n.type === 'workspace.joined') qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast(t(`notif.${n.type}`, { title: n.payload.title ?? '', status: n.payload.status ?? '' }));
    };

    socket.on('task', onTask);
    socket.on('comment', onComment);
    socket.on('project', onProject);
    socket.on('notification', onNotification);
    return () => {
      socket.close();
    };
  }, [enabled, qc, toast, t]);
}
