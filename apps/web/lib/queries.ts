'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import type {
  Activity,
  Comment,
  CustomField,
  FocusStats,
  Goal,
  Habit,
  Milestone,
  SavedView,
  Sprint,
  SprintReport,
  TimeEntry,
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
  fields: (projectId: string) => ['fields', projectId] as const,
  views: (projectId: string) => ['views', projectId] as const,
  range: (wid: string, from: string, to: string, extra: string) => ['range', wid, from, to, extra] as const,
  timer: ['timer'] as const,
  taskTime: (taskId: string) => ['taskTime', taskId] as const,
  timesheet: (wid: string, from: string, to: string, userId: string) => ['timesheet', wid, from, to, userId] as const,
  sprints: (projectId: string) => ['sprints', projectId] as const,
  sprintReport: (id: string) => ['sprintReport', id] as const,
  goals: (wid: string, period: string) => ['goals', wid, period] as const,
  habits: (wid: string) => ['habits', wid] as const,
  milestones: (projectId: string) => ['milestones', projectId] as const,
  roadmap: (wid: string) => ['roadmap', wid] as const,
  focus: ['focus'] as const,
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

export const useFields = (projectId?: string | null) =>
  useQuery({ queryKey: keys.fields(projectId!), queryFn: () => get<CustomField[]>(`/projects/${projectId}/fields`), enabled: enabled(projectId) });
export const useViews = (projectId?: string | null) =>
  useQuery({ queryKey: keys.views(projectId!), queryFn: () => get<SavedView[]>(`/projects/${projectId}/views`), enabled: enabled(projectId) });

/** Workspace tasks scheduled in [from, to); `extra` is a query string such as "&assigneeId=me". */
export const useRangeTasks = (wid: string | null | undefined, from: Date, to: Date, extra = '') =>
  useQuery({
    queryKey: keys.range(wid!, from.toISOString(), to.toISOString(), extra),
    queryFn: () => get<Task[]>(`/workspaces/${wid}/tasks?from=${from.toISOString()}&to=${to.toISOString()}${extra}`),
    enabled: enabled(wid),
    placeholderData: (prev) => prev,
  });

export const useTimer = () =>
  useQuery({
    queryKey: keys.timer,
    queryFn: async () => {
      const t = await get<TimeEntry | Record<string, never> | null>('/me/timer');
      return t && 'id' in t ? (t as TimeEntry) : null;
    },
  });
export const useTaskTime = (taskId?: string | null) =>
  useQuery({ queryKey: keys.taskTime(taskId!), queryFn: () => get<{ total: number; entries: TimeEntry[] }>(`/tasks/${taskId}/time`), enabled: enabled(taskId) });
export const useTimesheet = (wid: string | null | undefined, from: Date, to: Date, userId = '') =>
  useQuery({
    queryKey: keys.timesheet(wid!, from.toISOString(), to.toISOString(), userId),
    queryFn: () =>
      get<{ entries: TimeEntry[]; totals: { byDay: Record<string, number>; byUser: Record<string, number>; byProject: Record<string, number>; total: number } }>(
        `/workspaces/${wid}/timesheet?from=${from.toISOString()}&to=${to.toISOString()}${userId ? `&userId=${userId}` : ''}`,
      ),
    enabled: enabled(wid),
    placeholderData: (prev) => prev,
  });

export const useSprints = (projectId?: string | null) =>
  useQuery({ queryKey: keys.sprints(projectId!), queryFn: () => get<Sprint[]>(`/projects/${projectId}/sprints`), enabled: enabled(projectId) });
export const useSprintReport = (id?: string | null) =>
  useQuery({ queryKey: keys.sprintReport(id!), queryFn: () => get<SprintReport>(`/sprints/${id}/report`), enabled: enabled(id) });
export const useGoals = (wid: string | null | undefined, period: string) =>
  useQuery({
    queryKey: keys.goals(wid!, period),
    queryFn: () => get<{ periods: string[]; goals: Goal[] }>(`/workspaces/${wid}/goals${period ? `?period=${encodeURIComponent(period)}` : ''}`),
    enabled: enabled(wid),
    placeholderData: (prev) => prev,
  });
export const useHabits = (wid?: string | null) =>
  useQuery({
    queryKey: keys.habits(wid!),
    queryFn: () => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return get<Habit[]>(`/me/habits?workspaceId=${wid}&today=${today}`);
    },
    enabled: enabled(wid),
  });
export const useMilestones = (projectId?: string | null) =>
  useQuery({ queryKey: keys.milestones(projectId!), queryFn: () => get<Milestone[]>(`/projects/${projectId}/milestones`), enabled: enabled(projectId) });
export const useRoadmap = (wid?: string | null) =>
  useQuery({ queryKey: keys.roadmap(wid!), queryFn: () => get<Milestone[]>(`/workspaces/${wid}/roadmap`), enabled: enabled(wid) });
export const useFocus = () => useQuery({ queryKey: keys.focus, queryFn: () => get<FocusStats>('/me/focus') });
