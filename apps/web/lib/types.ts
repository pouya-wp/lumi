import type { Priority, ProposalState, Role, StatusCategory } from '@lumi/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  locale: string;
  calendar: 'jalali' | 'gregorian';
  timezone: string;
}

export type UserBrief = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
  _count?: { memberships: number; projects: number };
}

export interface Member extends UserBrief {
  role: Role;
  joinedAt: string;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface WorkspaceDetail extends Workspace {
  members: Member[];
  invites: Invite[];
}

export interface Status {
  id: string;
  name: string;
  category: StatusCategory;
  color: string;
  order: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  methodology: string[];
  settings: { proposals?: boolean } | null;
  statuses: Status[];
  counts?: Partial<Record<StatusCategory | 'total', number>>;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  key: string;
  number: number;
  projectId: string;
  parentId: string | null;
  title: string;
  description: { text?: string } | null;
  statusId: string;
  status: Pick<Status, 'id' | 'name' | 'category' | 'color'>;
  project: { id: string; key: string; name: string; color: string | null; icon: string | null; workspaceId: string };
  priority: Priority;
  storyPoints: number | null;
  estimateMin: number | null;
  startAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdById: string;
  proposalState: ProposalState;
  proposedDueAt: string | null;
  proposalNote: string | null;
  orderKey: string;
  assignees: (UserBrief & { role: 'ASSIGNEE' | 'REVIEWER' | 'WATCHER' })[];
  labels: Label[];
  checklist: { done: number; total: number };
  counts: { subtasks: number; comments: number; attachments: number };
  createdAt: string;
  updatedAt: string;
  recurrence: string | null;
  customFields: Record<string, unknown> | null;
  dependencies: { toTaskId: string; type: string }[];
  sprintId: string | null;
  milestoneId: string | null;
}

export type FieldType = 'TEXT' | 'NUMBER' | 'MONEY' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'USER' | 'CHECKBOX' | 'URL' | 'PROGRESS' | 'RATING';

export interface CustomField {
  id: string;
  projectId: string;
  name: string;
  type: FieldType;
  options: { items?: { id: string; name: string; color: string }[]; currency?: string } | null;
  order: number;
}

export interface TaskFilters {
  assigneeIds?: string[];
  priorities?: string[];
  labelIds?: string[];
  categories?: string[];
  due?: 'overdue' | 'today' | 'week' | 'none';
  q?: string;
}

export type ViewKind = 'BOARD' | 'LIST' | 'TABLE' | 'CALENDAR' | 'TIMELINE' | 'SPRINTS' | 'AUTOMATIONS';

export interface SavedView {
  id: string;
  name: string;
  type: ViewKind;
  config: { filters?: TaskFilters };
  shared: boolean;
  ownerId: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
  note: string | null;
  billable: boolean;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  task?: { id: string; title: string; number: number; projectId: string; project: { key: string; name: string; color: string | null; icon: string | null } };
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface TaskDetail extends Task {
  createdBy: UserBrief;
  parent: { id: string; title: string; number: number } | null;
  checklistItems: ChecklistItem[];
  subtasks: Task[];
  dependencies: { toTaskId: string; type: string; to: { id: string; title: string; number: number; statusId: string } }[];
  dependents: { type: string; from: { id: string; title: string; number: number } }[];
}

export interface Comment {
  id: string;
  taskId: string;
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  body: { text: string; mentionIds?: string[]; edited?: boolean };
  parentId: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  action: string;
  entityId: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
  task?: { id: string; title: string; key: string } | null;
}

export interface Notification {
  id: string;
  type: string;
  payload: { taskId?: string; title?: string; key?: string; workspaceId?: string; note?: string; excerpt?: string; status?: string; proposedDueAt?: string };
  readAt: string | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}

export interface Dashboard {
  kpis: {
    open: number;
    overdue: number;
    inProgress: number;
    doneThisWeek: number;
    doneDelta: number;
    createdThisWeek: number;
    createdDelta: number;
    completionRate: number;
  };
  completedByDay: { date: string; count: number; delta: number }[];
  byCategory: Partial<Record<StatusCategory, number>>;
  team: (UserBrief & { role: Role; open: number; doneThisWeek: number })[];
  myFocus: Task[];
  upcoming: Task[];
  activity: Activity[];
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startAt: string;
  endAt: string;
  state: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  retro: { wentWell?: string[]; improve?: string[]; actions?: string[] } | null;
  summary: { committedPoints: number; completedPoints: number; committedTasks: number; completedTasks: number; carriedOver: number } | null;
  stats: { tasks: number; done: number; points: number; donePoints: number };
}

export interface SprintReport {
  total: number;
  series: { date: string; ideal: number; actual: number | null }[];
  velocity: { id: string; name: string; committedPoints: number; completedPoints: number }[];
  averageVelocity: number | null;
}

export type GoalStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

export interface KeyResult {
  id: string;
  title: string;
  type: 'NUMBER' | 'PERCENT' | 'CURRENCY' | 'TASKS';
  start: number;
  target: number;
  current: number;
  unit: string | null;
  progress: number;
  status: GoalStatus;
  tasks: { id: string; title: string; key: string; completedAt: string | null }[];
  checkIns: { id: string; value: number; confidence: number; note: string | null; createdAt: string; user: { id: string; name: string } }[];
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  period: string;
  emoji: string | null;
  owner: { id: string; name: string; avatarUrl: string | null };
  progress: number;
  status: GoalStatus;
  keyResults: KeyResult[];
}

export interface Habit {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  days: number[];
  logs: string[];
  streak: number;
  best: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueAt: string;
  color: string | null;
  doneAt: string | null;
  total: number;
  done: number;
  project?: { id: string; name: string; icon: string | null; color: string | null; key: string };
}

export interface FocusStats {
  current: { id: string; startedAt: string; plannedMin: number; kind: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK'; task: { id: string; title: string } | null } | null;
  today: { count: number; minutes: number };
  streak: number;
  days: { date: string; count: number; minutes: number }[];
}

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  trigger: { type: string; params?: Record<string, unknown> };
  conditions: { field: string; op: string; value?: unknown }[];
  actions: { type: string; params?: Record<string, unknown> }[];
  runCount: number;
  lastRunAt: string | null;
}

export interface AutomationRun {
  id: string;
  taskId: string | null;
  status: 'SUCCESS' | 'FAILED';
  log: { type: string; ok: boolean; error?: string }[];
  createdAt: string;
}

export interface PlanBlock {
  id: string;
  taskId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  kind: 'task' | 'break';
  task: { id: string; title: string; priority: string; projectId: string; number: number; completedAt: string | null; project: { key: string; color: string | null; icon: string | null } } | null;
}
