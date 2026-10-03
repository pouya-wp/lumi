'use client';

import type { Priority } from '@lumi/shared';
import { Priority as PRIORITIES } from '@lumi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { del, post } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useFields, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { CustomField, FieldType, Member, Status, Task } from '@/lib/types';
import { Avatar, AvatarStack, Button, cx, Icon, Input, PriorityGlyph, StatusDot } from '../ui';
import { DatePicker } from '../ui/date-picker';
import { Dialog } from '../ui/dialog';
import { DueChip } from './task-drawer';

type SortKey = 'key' | 'title' | 'status' | 'priority' | 'due' | 'estimate' | string;
const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };

/** Spreadsheet view: every cell edits in place; custom fields become columns. */
export function TableView({ projectId, statuses, tasks }: { projectId: string; statuses: Status[]; tasks: Task[] }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask } = useUi();
  const fields = useFields(projectId).data ?? [];
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const actions = useTaskActions();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'key', dir: 1 });
  const [addField, setAddField] = useState(false);

  const rows = useMemo(() => {
    const statusOrder = new Map(statuses.map((s, i) => [s.id, i]));
    const value = (task: Task): string | number => {
      switch (sort.key) {
        case 'key':
          return task.number;
        case 'title':
          return task.title;
        case 'status':
          return statusOrder.get(task.statusId) ?? 0;
        case 'priority':
          return PRIORITY_RANK[task.priority];
        case 'due':
          return task.dueAt ? new Date(task.dueAt).getTime() : Infinity;
        case 'estimate':
          return task.estimateMin ?? Infinity;
        default: {
          const v = task.customFields?.[sort.key];
          return typeof v === 'number' ? v : v == null ? '￿' : String(v);
        }
      }
    };
    return [...tasks].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [tasks, sort, statuses]);

  const update = (task: Task, data: Record<string, unknown>) => actions.update.mutate({ id: task.id, projectId: task.projectId, data });

  const Header = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cx('sticky top-0 z-10 bg-panel px-3 py-2.5 text-start text-[11px] font-medium whitespace-nowrap text-muted', className)}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))} className="flex items-center gap-1 hover:text-ink">
        {children}
        {sort.key === k && <Icon name={sort.dir === 1 ? 'arrowUp' : 'arrowDown'} size={11} />}
      </button>
    </th>
  );

  return (
    <div className="panel overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <Header k="key">#</Header>
              <Header k="title" className="min-w-64">{t('task.title')}</Header>
              <Header k="status">{t('task.status')}</Header>
              <Header k="priority">{t('task.priority')}</Header>
              <th className="sticky top-0 z-10 bg-panel px-3 py-2.5 text-start text-[11px] font-medium text-muted">{t('task.assignees')}</th>
              <Header k="due">{t('task.due')}</Header>
              <Header k="estimate">{t('task.estimate')}</Header>
              {fields.map((f) => (
                <Header key={f.id} k={f.id}>
                  <FieldIcon type={f.type} /> {f.name}
                </Header>
              ))}
              <th className="sticky top-0 z-10 bg-panel px-2">
                <button onClick={() => setAddField(true)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" title={t('fields.add')}>
                  <Icon name="plus" size={15} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => (
              <tr key={task.id} className="group border-b border-line/70 hover:bg-sunken/60">
                <td className="px-3 py-1.5 text-[11px] whitespace-nowrap text-muted tabular-nums" dir="ltr">
                  {task.key}
                </td>
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    <EditableText value={task.title} onSave={(title) => update(task, { title })} />
                    <button onClick={() => openTask(task.id)} className="grid size-7 shrink-0 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 hover:bg-line">
                      <Icon name="arrowUp" size={13} className="rotate-45" />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-1">
                  <label className="flex items-center gap-2">
                    <StatusDot color={task.status.color} category={task.status.category} size={9} />
                    <select value={task.statusId} onChange={(e) => update(task, { statusId: e.target.value })} className="bg-transparent outline-none">
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
                <td className="px-2 py-1">
                  <label className="flex items-center gap-2">
                    <PriorityGlyph priority={task.priority} size={12} />
                    <select value={task.priority} onChange={(e) => update(task, { priority: e.target.value })} className="bg-transparent outline-none">
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {t(`priority.${p}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
                <td className="px-3 py-1">
                  <AvatarStack users={task.assignees.filter((a) => a.role === 'ASSIGNEE')} size={22} max={3} />
                </td>
                <td className="px-2 py-1">
                  <DatePicker value={task.dueAt} onChange={(dueAt) => update(task, { dueAt })} trigger={task.dueAt ? <DueChip value={task.dueAt} compact /> : <span className="text-muted">—</span>} />
                </td>
                <td className="px-2 py-1">
                  <EditableNumber value={task.estimateMin} onSave={(estimateMin) => update(task, { estimateMin })} />
                </td>
                {fields.map((f) => (
                  <td key={f.id} className="px-2 py-1">
                    <FieldCell field={f} value={task.customFields?.[f.id]} members={members} onSave={(v) => update(task, { customFields: { [f.id]: v } })} />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-12 text-center text-sm text-muted">{t('task.empty')}</p>}
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
        {t('project.tasks', { n: rows.length })} · {locale === 'fa' ? 'برای ویرایش روی هر خانه کلیک کنید' : 'Click any cell to edit'}
      </p>
      {addField && <AddFieldDialog projectId={projectId} onClose={() => setAddField(false)} />}
    </div>
  );
}

function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setDraft(value)}
      onBlur={() => draft.trim() && draft !== value && onSave(draft.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-8 w-full min-w-0 rounded-[8px] bg-transparent px-2 outline-none focus:bg-panel focus:shadow-[inset_0_0_0_1.5px_var(--lumi)]"
    />
  );
}

function EditableNumber({ value, onSave, suffix }: { value: number | null | undefined; onSave: (v: number | null) => void; suffix?: string }) {
  const { locale } = useT();
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex h-8 min-w-16 items-center gap-1 rounded-[8px] px-2 text-start tabular-nums hover:bg-panel">
        {value == null ? <span className="text-muted">—</span> : new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(value)}
        {suffix && value != null && <span className="text-[11px] text-muted">{suffix}</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      defaultValue={value ?? ''}
      onBlur={(e) => {
        setEditing(false);
        const v = e.target.value === '' ? null : Number(e.target.value);
        if (v !== (value ?? null)) onSave(v);
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLInputElement).blur()}
      className="h-8 w-28 rounded-[8px] bg-panel px-2 tabular-nums shadow-[inset_0_0_0_1.5px_var(--lumi)] outline-none"
      dir="ltr"
    />
  );
}

/** In-place editor for one custom field value, by type. */
export function FieldCell({ field, value, members, onSave }: { field: CustomField; value: unknown; members: Member[]; onSave: (v: unknown) => void }) {
  const { t, locale } = useT();
  const items = field.options?.items ?? [];
  switch (field.type) {
    case 'TEXT':
    case 'URL':
      return field.type === 'URL' && value ? (
        <a href={String(value)} target="_blank" rel="noreferrer" className="text-lumi underline-offset-2 hover:underline" dir="ltr">
          {String(value).replace(/^https?:\/\//, '').slice(0, 28)}
        </a>
      ) : (
        <EditableText value={(value as string) ?? ''} onSave={(v) => onSave(v || null)} />
      );
    case 'NUMBER':
    case 'MONEY':
      return <EditableNumber value={value as number} onSave={onSave} suffix={field.type === 'MONEY' ? (field.options?.currency === 'IRT' ? (locale === 'fa' ? 'تومان' : 'IRT') : field.options?.currency) : undefined} />;
    case 'CHECKBOX':
      return <input type="checkbox" checked={!!value} onChange={(e) => onSave(e.target.checked)} className="size-4 accent-[var(--lumi)]" />;
    case 'PROGRESS':
      return (
        <label className="flex items-center gap-2">
          <input type="range" min={0} max={100} step={5} defaultValue={(value as number) ?? 0} onMouseUp={(e) => onSave(Number((e.target as HTMLInputElement).value))} className="w-20 accent-[var(--success)]" dir="ltr" />
          <span className="w-8 text-[11px] text-muted tabular-nums">{num((value as number) ?? 0, locale)}٪</span>
        </label>
      );
    case 'RATING':
      return (
        <span className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => onSave(value === n ? 0 : n)} className={cx('text-base leading-none', (value as number) >= n ? 'text-warn' : 'text-line')}>
              ★
            </button>
          ))}
        </span>
      );
    case 'DATE':
      return (
        <DatePicker
          value={(value as string) ?? null}
          onChange={onSave}
          trigger={<span className={value ? '' : 'text-muted'}>{value ? formatDate(value as string, locale) : '—'}</span>}
        />
      );
    case 'SELECT': {
      const current = items.find((o) => o.id === value);
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onSave(e.target.value || null)} className="rounded-full px-2 py-0.5 text-xs outline-none" style={{ background: current ? `color-mix(in oklab, ${current.color} 16%, transparent)` : undefined, color: current?.color }}>
          <option value="">{t('fields.empty')}</option>
          {items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      );
    }
    case 'MULTI_SELECT': {
      const selected = new Set((value as string[]) ?? []);
      return (
        <span className="flex flex-wrap gap-1">
          {items.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                onSave(next.size ? [...next] : null);
              }}
              className="rounded-full px-2 py-0.5 text-[11px] transition"
              style={selected.has(o.id) ? { background: `color-mix(in oklab, ${o.color} 18%, transparent)`, color: o.color } : { color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
            >
              {o.name}
            </button>
          ))}
        </span>
      );
    }
    case 'USER': {
      const m = members.find((u) => u.id === value);
      return (
        <label className="flex items-center gap-1.5">
          {m && <Avatar name={m.name} size={20} />}
          <select value={(value as string) ?? ''} onChange={(e) => onSave(e.target.value || null)} className="bg-transparent outline-none">
            <option value="">{t('fields.empty')}</option>
            {members.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      );
    }
  }
}

const FIELD_ICONS: Record<FieldType, string> = {
  TEXT: 'Aa',
  NUMBER: '#',
  MONEY: '¤',
  DATE: '◷',
  SELECT: '▾',
  MULTI_SELECT: '☰',
  USER: '@',
  CHECKBOX: '☑',
  URL: '↗',
  PROGRESS: '▰',
  RATING: '★',
};

export function FieldIcon({ type }: { type: FieldType }) {
  return <span className="font-mono text-[10px] opacity-70">{FIELD_ICONS[type]}</span>;
}

function AddFieldDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('TEXT');
  const [options, setOptions] = useState('');
  const fields = useFields(projectId).data ?? [];
  const create = useMutation({
    mutationFn: () =>
      post(`/projects/${projectId}/fields`, {
        name,
        type,
        options: type === 'SELECT' || type === 'MULTI_SELECT' ? options.split(/[,،]/).map((o) => o.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.fields(projectId) });
      setName('');
      setOptions('');
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/fields/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.fields(projectId) }) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <Dialog onClose={onClose} label={t('fields.title')}>
      <form onSubmit={submit} className="p-6">
        <h2 className="text-lg font-semibold">{t('fields.title')}</h2>
        {fields.length > 0 && (
          <div className="mt-4 flex flex-col gap-1">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2 hover:bg-sunken">
                <FieldIcon type={f.type} />
                <span className="flex-1 text-sm">{f.name}</span>
                <span className="text-xs text-muted">{t(`fields.types.${f.type}`)}</span>
                <button type="button" onClick={() => remove.mutate(f.id)} className="text-muted hover:text-danger">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Input autoFocus placeholder={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="h-11 rounded-[14px] bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none">
            {(Object.keys(FIELD_ICONS) as FieldType[]).map((ft) => (
              <option key={ft} value={ft}>
                {FIELD_ICONS[ft]} {t(`fields.types.${ft}`)}
              </option>
            ))}
          </select>
          {(type === 'SELECT' || type === 'MULTI_SELECT') && (
            <Input className="col-span-2" placeholder={t('fields.options')} value={options} onChange={(e) => setOptions(e.target.value)} />
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button type="submit" variant="ink" loading={create.isPending} disabled={!name.trim()}>
            <Icon name="plus" size={15} /> {t('fields.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
