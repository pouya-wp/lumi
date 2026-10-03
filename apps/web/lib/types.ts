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
  dependencies: { type: string; to: { id: string; title: string; number: number } }[];
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
