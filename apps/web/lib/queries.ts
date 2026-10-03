'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import type {
  Activity,
  Comment,
  Dashboard,
  Label,
  Notification,
  Project,
  Task,
  TaskDetail,
  User,
  Workspace,
  WorkspaceDetail,
} from './types';

export const keys = {
  me: ['me'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  projects: (wid: string) => ['projects', wid] as const,
  project: (id: string) => ['project', id] as const,
  tasks: (projectId: string) => ['tasks', projectId] as const,
  task: (id: string) => ['task', id] as const,
  myTasks: (wid: string, scope: string) => ['myTasks', wid, scope] as const,
  notifications: (unread: boolean) => ['notifications', unread] as const,
  unread: ['unread'] as const,
  dashboard: (wid: string) => ['dashboard', wid] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  activity: (taskId: string) => ['activity', taskId] as const,
  labels: (wid: string) => ['labels', wid] as const,
  search: (wid: string, q: string) => ['search', wid, q] as const,
};

const enabled = (...ids: (string | null | undefined)[]) => ids.every(Boolean);

export const useMe = (on = true) => useQuery({ queryKey: keys.me, queryFn: () => get<User>('/auth/me'), enabled: on, retry: false });
export const useWorkspaces = (on = true) => useQuery({ queryKey: keys.workspaces, queryFn: () => get<Workspace[]>('/workspaces'), enabled: on });
export const useWorkspace = (id?: string | null) =>
  useQuery({ queryKey: keys.workspace(id!), queryFn: () => get<WorkspaceDetail>(`/workspaces/${id}`), enabled: enabled(id) });
export const useProjects = (wid?: string | null) =>
  useQuery({ queryKey: keys.projects(wid!), queryFn: () => get<Project[]>(`/workspaces/${wid}/projects`), enabled: enabled(wid) });
export const useProject = (id?: string | null) =>
  useQuery({ queryKey: keys.project(id!), queryFn: () => get<Project>(`/projects/${id}`), enabled: enabled(id) });
export const useTasks = (projectId?: string | null) =>
  useQuery({ queryKey: keys.tasks(projectId!), queryFn: () => get<Task[]>(`/projects/${projectId}/tasks`), enabled: enabled(projectId) });
export const useTask = (id?: string | null) =>
  useQuery({ queryKey: keys.task(id!), queryFn: () => get<TaskDetail>(`/tasks/${id}`), enabled: enabled(id) });
export const useMyTasks = (wid: string | null | undefined, scope: string) =>
  useQuery({
    queryKey: keys.myTasks(wid!, scope),
    queryFn: () => get<Task[]>(`/me/tasks?workspaceId=${wid}&scope=${scope}`),
    enabled: enabled(wid),
  });
export const useNotifications = (unread: boolean) =>
  useQuery({ queryKey: keys.notifications(unread), queryFn: () => get<Notification[]>(`/notifications${unread ? '?unread=true' : ''}`) });
export const useUnreadCount = () =>
  useQuery({ queryKey: keys.unread, queryFn: () => get<{ count: number }>('/notifications/unread-count'), refetchInterval: 60_000 });
export const useDashboard = (wid?: string | null) =>
  useQuery({ queryKey: keys.dashboard(wid!), queryFn: () => get<Dashboard>(`/workspaces/${wid}/dashboard`), enabled: enabled(wid) });
export const useComments = (taskId?: string | null) =>
  useQuery({ queryKey: keys.comments(taskId!), queryFn: () => get<Comment[]>(`/tasks/${taskId}/comments`), enabled: enabled(taskId) });
export const useActivity = (taskId?: string | null) =>
  useQuery({ queryKey: keys.activity(taskId!), queryFn: () => get<Activity[]>(`/tasks/${taskId}/activity`), enabled: enabled(taskId) });
export const useLabels = (wid?: string | null) =>
  useQuery({ queryKey: keys.labels(wid!), queryFn: () => get<Label[]>(`/workspaces/${wid}/labels`), enabled: enabled(wid) });
export const useSearch = (wid: string | null | undefined, q: string) =>
  useQuery({
    queryKey: keys.search(wid!, q),
    queryFn: () => get<{ tasks: Task[]; projects: Project[] }>(`/workspaces/${wid}/search?q=${encodeURIComponent(q)}`),
    enabled: enabled(wid) && q.trim().length > 0,
    placeholderData: (prev) => prev,
  });
