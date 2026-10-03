import { addDays, startOfDay } from './calendar';
import type { Task, TaskFilters } from './types';

export function applyFilters(tasks: Task[], f: TaskFilters, meId?: string): Task[] {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const q = f.q?.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q)) return false;
    if (f.assigneeIds?.length) {
      const ids = f.assigneeIds.map((id) => (id === 'me' ? meId : id));
      if (!t.assignees.some((a) => a.role === 'ASSIGNEE' && ids.includes(a.id))) return false;
    }
    if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
    if (f.labelIds?.length && !t.labels.some((l) => f.labelIds!.includes(l.id))) return false;
    if (f.categories?.length && !f.categories.includes(t.status.category)) return false;
    if (f.due) {
      const due = t.dueAt ? new Date(t.dueAt) : null;
      if (f.due === 'none' && due) return false;
      if (f.due === 'overdue' && !(due && due < today && t.status.category !== 'DONE')) return false;
      if (f.due === 'today' && !(due && startOfDay(due).getTime() === today.getTime())) return false;
      if (f.due === 'week' && !(due && due >= today && due < weekEnd)) return false;
    }
    return true;
  });
}

export const activeFilterCount = (f: TaskFilters) =>
  (f.assigneeIds?.length ? 1 : 0) + (f.priorities?.length ? 1 : 0) + (f.labelIds?.length ? 1 : 0) + (f.categories?.length ? 1 : 0) + (f.due ? 1 : 0);
