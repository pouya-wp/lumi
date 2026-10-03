'use client';

import type { Priority } from '@lumi/shared';
import { Priority as PRIORITIES } from '@lumi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { del, patch, post } from '@/lib/api';
import { dueInfo, formatDate, timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useActivity, useComments, useProject, useTask, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTaskActions } from '@/lib/task-actions';
import { useUi } from '@/lib/ui-state';
import type { Member, Status, TaskDetail } from '@/lib/types';
import { Avatar, AvatarStack, Button, CheckCircle, cx, Icon, IconButton, Pill, PriorityGlyph, Segmented, Spinner, StatusDot, Textarea } from '../ui';
import { DatePicker } from '../ui/date-picker';
import { CustomFieldsSection, DependenciesSection, RecurrencePicker, TimeSection } from './drawer-extras';
import { Dialog } from '../ui/dialog';

export function TaskDrawer() {
  const { taskId, closeTask } = useUi();
  if (!taskId) return null;
  return (
    <Dialog side onClose={closeTask} label="Task">
      <DrawerBody key={taskId} taskId={taskId} />
    </Dialog>
  );
}

function DrawerBody({ taskId }: { taskId: string }) {
  const { t, locale } = useT();
  const { closeTask, openTask } = useUi();
  const task = useTask(taskId);
  const project = useProject(task.data?.projectId);
  const members = useWorkspace(task.data?.project.workspaceId).data?.members ?? [];
  const actions = useTaskActions();

  if (task.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!task.data) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-muted">
        <p>{t('common.error')}</p>
      </div>
    );
  }

  const data = task.data;
  const statuses = project.data?.statuses ?? [];
  const update = (body: Record<string, unknown>) => actions.update.mutate({ id: data.id, projectId: data.projectId, data: body });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <span className="grid size-8 place-items-center rounded-[10px] text-sm" style={{ background: `color-mix(in oklab, ${data.project.color ?? '#4F5BFF'} 18%, transparent)` }}>
          {data.project.icon ?? '◆'}
        </span>
        <span className="text-sm text-muted">{data.project.name}</span>
        <span className="text-muted">/</span>
        <span className="text-sm font-medium tabular-nums" dir="ltr">
          {data.key}
        </span>
        <div className="ms-auto flex items-center gap-1">
          <IconButton
            icon="trash"
            label={t('task.delete')}
            onClick={() => {
              if (confirm(t('task.deleteConfirm'))) {
                actions.remove.mutate({ id: data.id, projectId: data.projectId });
                closeTask();
              }
            }}
          />
          <IconButton icon="close" label={t('common.close')} onClick={closeTask} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
        {data.parent && (
          <button onClick={() => openTask(data.parent!.id)} className="mb-2 flex items-center gap-1.5 text-xs text-muted hover:text-ink">
            <Icon name="subtask" size={13} /> {data.parent.title}
          </button>
        )}
        <TitleEditor
          value={data.title}
          done={data.status.category === 'DONE'}
          onDone={() => actions.toggleDone(data, statuses)}
          onSave={(title) => update({ title })}
        />

        <ProposalBanner task={data} members={members} />

        <div className="mt-6 grid grid-cols-[110px_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <Prop label={t('task.status')}>
            <select
              value={data.statusId}
              onChange={(e) => update({ statusId: e.target.value })}
              className="h-9 rounded-full bg-sunken px-3 outline-none shadow-[inset_0_0_0_1px_var(--line)]"
            >
              {statuses.map((s: Status) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <StatusDot color={data.status.color} category={data.status.category} />
          </Prop>
          <Prop label={t('task.priority')}>
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map((p: Priority) => (
                <button
                  key={p}
                  onClick={() => update({ priority: p })}
                  className={cx('flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs transition', data.priority === p ? 'bg-ink text-on-ink' : 'hover:bg-sunken text-ink-2')}
                >
                  <PriorityGlyph priority={p} size={12} /> {t(`priority.${p}`)}
                </button>
              ))}
            </div>
          </Prop>
          <Prop label={t('task.assignees')}>
            <AssigneePicker task={data} members={members} />
          </Prop>
          <Prop label={t('task.due')}>
            <DatePicker
              value={data.dueAt}
              onChange={(dueAt) => update({ dueAt })}
              trigger={<DueChip value={data.dueAt} />}
            />
          </Prop>
          <Prop label={t('recur.title')}>
            <RecurrencePicker task={data} />
          </Prop>
          <Prop label={t('task.estimate')}>
            <input
              type="number"
              min={0}
              defaultValue={data.estimateMin ?? ''}
              onBlur={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value);
                if (v !== data.estimateMin) update({ estimateMin: v });
              }}
              className="h-9 w-28 rounded-full bg-sunken px-3 outline-none shadow-[inset_0_0_0_1px_var(--line)]"
              dir="ltr"
            />
          </Prop>
          {data.labels.length > 0 && (
            <Prop label={t('task.labels')}>
              <div className="flex flex-wrap gap-1.5">
                {data.labels.map((l) => (
                  <span key={l.id} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: `color-mix(in oklab, ${l.color} 15%, transparent)`, color: l.color }}>
                    #{l.name}
                  </span>
                ))}
              </div>
            </Prop>
          )}
        </div>

        <CustomFieldsSection task={data} />

        <Section title={t('task.description')}>
          <Textarea
            key={data.updatedAt}
            defaultValue={data.description?.text ?? ''}
            placeholder={t('task.descriptionPlaceholder')}
            rows={4}
            onBlur={(e) => {
              if (e.target.value !== (data.description?.text ?? '')) update({ description: { text: e.target.value } });
            }}
          />
        </Section>

        <Checklist task={data} />
        <Subtasks task={data} statuses={statuses} />
        <DependenciesSection task={data} />
        <TimeSection task={data} />
        <Conversation task={data} members={members} />
        <p className="mt-8 text-xs text-muted">
          {t('task.createdBy', { name: data.createdBy.name })} · {formatDate(data.createdAt, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

function TitleEditor({ value, done, onSave, onDone }: { value: string; done: boolean; onSave: (v: string) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex items-start gap-3">
      <div className="mt-2.5">
        <CheckCircle checked={done} onChange={onDone} />
      </div>
      <textarea
        value={draft}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && draft !== value && onSave(draft.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        className={cx('field-sizing-content w-full resize-none bg-transparent text-2xl leading-snug font-semibold outline-none', done && 'text-muted line-through')}
      />
    </div>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="text-muted">{label}</span>
      <div className="flex min-h-10 items-center gap-2">{children}</div>
    </>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="ms-auto">{aside}</div>
      </div>
      {children}
    </section>
  );
}

export function DueChip({ value, compact }: { value: string | null; compact?: boolean }) {
  const { t, locale } = useT();
  if (!value) {
    return compact ? null : (
      <span className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-muted shadow-[inset_0_0_0_1px_var(--line)] hover:bg-sunken">
        <Icon name="calendar" size={15} /> {t('task.noDue')}
      </span>
    );
  }
  const { label, tone } = dueInfo(value, locale, t);
  const toneClass = { late: 'bg-danger-soft text-danger', today: 'bg-warn-soft text-warn', soon: 'bg-info-soft text-info', later: 'bg-sunken text-ink-2' }[tone];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full font-medium', compact ? 'px-2 py-0.5 text-[11px]' : 'h-9 px-3 text-sm', toneClass)}>
      <Icon name="calendar" size={compact ? 11 : 14} /> {label}
    </span>
  );
}

function AssigneePicker({ task, members }: { task: TaskDetail; members: Member[] }) {
  const { t } = useT();
  const actions = useTaskActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const assigned = task.assignees.filter((a) => a.role === 'ASSIGNEE');
  const ids = new Set(assigned.map((a) => a.id));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = (id: string) => {
    const next = ids.has(id) ? [...ids].filter((x) => x !== id) : [...ids, id];
    actions.setAssignees.mutate({ id: task.id, projectId: task.projectId, userIds: next });
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-9 items-center gap-2 rounded-full pe-3 ps-1 hover:bg-sunken">
        {assigned.length ? <AvatarStack users={assigned} size={26} /> : <span className="ps-2 text-muted">{t('task.unassigned')}</span>}
        {assigned.length === 1 && <span>{assigned[0].name}</span>}
        <Icon name="chevronDown" size={14} className="text-muted" />
      </button>
      {open && (
        <div className="panel rise absolute top-full z-40 mt-2 w-60 p-1.5">
          {members.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)} className="flex w-full items-center gap-2.5 rounded-[12px] p-2 text-start text-sm hover:bg-sunken">
              <Avatar name={m.name} src={m.avatarUrl} size={26} />
              <span className="flex-1 truncate">{m.name}</span>
              {ids.has(m.id) && <Icon name="check" size={15} className="text-lumi" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalBanner({ task, members }: { task: TaskDetail; members: Member[] }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const actions = useTaskActions();
  const [mode, setMode] = useState<'idle' | 'decline' | 'counter'>('idle');
  const [note, setNote] = useState('');
  if (task.proposalState === 'NONE' || task.proposalState === 'ACCEPTED' || !user) return null;

  const creator = members.find((m) => m.id === task.createdById);
  const assignees = task.assignees.filter((a) => a.role === 'ASSIGNEE');
  const isAssignee = assignees.some((a) => a.id === user.id);
  const isCreator = task.createdById === user.id;
  const respond = (action: 'accept' | 'decline' | 'counter', extra: { dueAt?: string } = {}) =>
    actions.respond.mutate({ id: task.id, projectId: task.projectId, action, note: note || undefined, ...extra }, { onSuccess: () => setMode('idle') });

  if (task.proposalState === 'DECLINED') {
    return (
      <div className="mt-5 rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
        <p className="font-medium">✕ {t('task.declined')}</p>
        {task.proposalNote && <p className="mt-1 opacity-80">“{task.proposalNote}”</p>}
      </div>
    );
  }

  return (
    <div className="beam relative mt-5 overflow-hidden rounded-[18px] bg-ink p-4 text-on-ink">
      <span className="beam-ring" />
      <div className="flex items-center gap-3">
        <span className="pulse" />
        <p className="flex-1 text-sm">
          {isAssignee
            ? t('task.proposalFor', { name: creator?.name ?? '' })
            : t('task.proposalWaiting', { name: assignees.map((a) => a.name).join('، ') })}
        </p>
      </div>
      {task.proposedDueAt && (
        <p className="mt-2 text-xs opacity-70">
          {t('task.counterFrom', {
            name: assignees[0]?.name ?? '',
            date: formatDate(task.proposedDueAt, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
          })}
          {task.proposalNote && ` — “${task.proposalNote}”`}
        </p>
      )}
      {isAssignee && mode === 'idle' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className="!bg-on-ink !text-ink" onClick={() => respond('accept')} loading={actions.respond.isPending}>
            ✓ {t('task.accept')}
          </Button>
          <Button size="sm" variant="ghost" className="!text-on-ink hover:!bg-on-ink/10" onClick={() => setMode('counter')}>
            <Icon name="calendar" size={14} /> {t('task.counter')}
          </Button>
          <Button size="sm" variant="ghost" className="!text-on-ink/70 hover:!bg-on-ink/10" onClick={() => setMode('decline')}>
            {t('task.decline')}
          </Button>
        </div>
      )}
      {isCreator && !isAssignee && task.proposedDueAt && (
        <Button size="sm" className="mt-4 !bg-on-ink !text-ink" onClick={() => respond('accept')} loading={actions.respond.isPending}>
          ✓ {t('task.acceptCounter')}
        </Button>
      )}
      {mode !== 'idle' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('task.declineReason')}
            className="h-9 min-w-0 flex-1 rounded-full bg-on-ink/10 px-3 text-sm outline-none placeholder:text-on-ink/50"
          />
          {mode === 'decline' ? (
            <Button size="sm" className="!bg-danger !text-white" onClick={() => respond('decline')}>
              {t('task.decline')}
            </Button>
          ) : (
            <div className="text-ink">
              <DatePicker
                value={task.dueAt}
                onChange={(dueAt) => dueAt && respond('counter', { dueAt })}
                trigger={
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-on-ink px-3 text-xs font-medium text-ink">
                    <Icon name="calendar" size={13} /> {t('task.counter')}
                  </span>
                }
              />
            </div>
          )}
          <IconButton icon="close" label={t('common.cancel')} className="!text-on-ink hover:!bg-on-ink/10" onClick={() => setMode('idle')} />
        </div>
      )}
    </div>
  );
}

function Checklist({ task }: { task: TaskDetail }) {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.task(task.id) });
    qc.invalidateQueries({ queryKey: keys.tasks(task.projectId) });
  };
  const add = useMutation({ mutationFn: (v: string) => post(`/tasks/${task.id}/checklist`, { text: v }), onSuccess: refresh });
  const toggle = useMutation({ mutationFn: ({ id, done }: { id: string; done: boolean }) => patch(`/checklist/${id}`, { done }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/checklist/${id}`), onSuccess: refresh });
  const items = task.checklistItems;
  const pct = items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;

  return (
    <Section
      title={t('task.checklist')}
      aside={items.length > 0 && <span className="text-xs text-muted tabular-nums">{num(pct, locale)}٪</span>}
    >
      {items.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="flex flex-col">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-sunken">
            <CheckCircle checked={item.done} onChange={(done) => toggle.mutate({ id: item.id, done })} />
            <span className="flex-1 text-sm">
              <span className={cx(item.done && 'strike')}>{item.text}</span>
            </span>
            <IconButton icon="close" label="remove" className="size-7 opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(item.id)} />
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate(text.trim(), { onSuccess: () => setText('') });
          }}
          className="flex items-center gap-3 px-2 py-1.5"
        >
          <Icon name="plus" size={16} className="text-muted" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('task.addItem')} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        </form>
      </div>
    </Section>
  );
}

function Subtasks({ task, statuses }: { task: TaskDetail; statuses: Status[] }) {
  const { t } = useT();
  const { openTask } = useUi();
  const actions = useTaskActions();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const add = useMutation({
    mutationFn: (title: string) => post(`/projects/${task.projectId}/tasks`, { title, parentId: task.id, assigneeIds: task.assignees.filter((a) => a.role === 'ASSIGNEE').map((a) => a.id) }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: keys.task(task.id) });
    },
  });

  return (
    <Section title={t('task.subtasks')}>
      <div className="flex flex-col">
        {task.subtasks.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-sunken">
            <CheckCircle
              checked={s.status.category === 'DONE'}
              onChange={() => {
                actions.toggleDone(s, statuses);
                setTimeout(() => qc.invalidateQueries({ queryKey: keys.task(task.id) }), 300);
              }}
            />
            <button onClick={() => openTask(s.id)} className="flex-1 text-start text-sm">
              <span className={cx(s.status.category === 'DONE' && 'strike')}>{s.title}</span>
            </button>
            <PriorityGlyph priority={s.priority} size={12} />
            <AvatarStack users={s.assignees} size={20} max={2} />
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate(text.trim());
          }}
          className="flex items-center gap-3 px-2 py-1.5"
        >
          <Icon name="subtask" size={16} className="text-muted" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('task.addSubtask')} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
        </form>
      </div>
    </Section>
  );
}

function Conversation({ task, members }: { task: TaskDetail; members: Member[] }) {
  const { t, locale } = useT();
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const comments = useComments(task.id);
  const activity = useActivity(task.id);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => post(`/tasks/${task.id}/comments`, { text, mentionIds: mentionIds.filter((id) => text.includes(`@${members.find((m) => m.id === id)?.name}`)) }),
    onSuccess: () => {
      setText('');
      setMentionIds([]);
      qc.invalidateQueries({ queryKey: keys.comments(task.id) });
    },
  });

  const onChange = (value: string) => {
    setText(value);
    const match = /@([^\s@]*)$/.exec(value);
    setMentionQuery(match ? match[1] : null);
  };
  const pickMention = (m: Member) => {
    setText(text.replace(/@([^\s@]*)$/, `@${m.name} `));
    setMentionIds((ids) => [...new Set([...ids, m.id])]);
    setMentionQuery(null);
  };
  const suggestions = mentionQuery === null ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  return (
    <section className="mt-10">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'comments', label: <>💬 {t('task.comments')} {comments.data?.length ? <span className="opacity-60">{num(comments.data.length, locale)}</span> : null}</> },
          { value: 'activity', label: <>🕓 {t('task.activity')}</> },
        ]}
      />
      {tab === 'comments' ? (
        <div className="mt-4 flex flex-col gap-4">
          {comments.data?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar name={c.author.name} src={c.author.avatarUrl} size={30} />
              <div className="min-w-0 flex-1">
                <p className="text-xs">
                  <span className="font-semibold">{c.author.name}</span> <span className="text-muted">· {timeAgo(c.createdAt, locale)}</span>
                </p>
                <p className="mt-1 rounded-[14px] rounded-ss-sm bg-sunken px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                  {c.body.text.split(/(@\S+(?:\s\S+)?)/).map((part, i) =>
                    members.some((m) => part === `@${m.name}`) ? (
                      <span key={i} className="rounded bg-lumi/12 px-1 font-medium text-lumi">
                        {part}
                      </span>
                    ) : (
                      part
                    ),
                  )}
                </p>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send.mutate();
            }}
            className="relative"
          >
            {suggestions.length > 0 && (
              <div className="panel absolute bottom-full z-10 mb-2 w-56 p-1">
                {suggestions.map((m) => (
                  <button type="button" key={m.id} onClick={() => pickMention(m)} className="flex w-full items-center gap-2 rounded-[10px] p-2 text-sm hover:bg-sunken">
                    <Avatar name={m.name} size={22} /> {m.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[18px] bg-sunken p-2 shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--lumi)]">
              <textarea
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) send.mutate();
                }}
                rows={2}
                placeholder={`${t('task.commentPlaceholder')} (@)`}
                className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted"
              />
              <Button type="submit" size="sm" variant="ink" loading={send.isPending} disabled={!text.trim()}>
                {t('task.send')}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <ol className="relative mt-5 flex flex-col gap-4 border-s border-line ps-5">
          {activity.data?.map((a) => (
            <li key={a.id} className="relative text-sm">
              <span className="absolute -start-[25px] top-1 size-2.5 rounded-full bg-panel ring-2 ring-line" />
              <span className="font-medium">{a.actor?.name}</span> <span className="text-ink-2">{t(`activity.${a.action}`)}</span>
              <ActivityDetail diff={a.diff} />
              <span className="block text-xs text-muted">{timeAgo(a.createdAt, locale)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityDetail({ diff }: { diff: Record<string, unknown> | null }) {
  const { t } = useT();
  if (!diff) return null;
  const priority = diff.priority as { to?: string } | undefined;
  const text = diff.text as string | undefined;
  return (
    <>
      {priority?.to && (
        <Pill className="ms-1.5">
          {t(`priority.${priority.to}`)}
        </Pill>
      )}
      {text && <span className="ms-1.5 text-muted">“{text}”</span>}
    </>
  );
}
