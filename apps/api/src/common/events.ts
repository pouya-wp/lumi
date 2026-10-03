/** Domain events published via EventEmitter2 and consumed by activity, realtime and notifications. */
export const Events = {
  TaskCreated: 'task.created',
  TaskUpdated: 'task.updated',
  TaskDeleted: 'task.deleted',
  CommentCreated: 'comment.created',
  NotificationCreated: 'notification.created',
  ProjectChanged: 'project.changed',
} as const;

export interface TaskEvent {
  workspaceId: string;
  projectId: string;
  taskId: string;
  actorId: string;
  action: string;
  diff?: Record<string, unknown>;
  /** >0 when the change was made by an automation rule. */
  depth?: number;
}

export interface CommentEvent {
  workspaceId: string;
  projectId: string;
  taskId: string;
  commentId: string;
  actorId: string;
  depth?: number;
}

export interface NotificationEvent {
  userId: string;
  notification: { id: string; type: string; payload: unknown; createdAt: Date };
}

export interface ProjectEvent {
  workspaceId: string;
  projectId: string;
  actorId: string;
}
