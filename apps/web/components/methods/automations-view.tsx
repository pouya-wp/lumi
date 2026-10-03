'use client';

import { Priority as PRIORITIES, StatusCategory } from '@lumi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { del, patch, post } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n-client';
import { keys, useAutomationRuns, useAutomations, useLabels, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import type { AutomationRule, Status, Task } from '@/lib/types';
import { Button, cx, Empty, Icon, IconButton, Input, Panel, PanelHeader, Pill } from '../ui';
import { Dialog } from '../ui/dialog';

type Rule = Pick<AutomationRule, 'name' | 'trigger' | 'conditions' | 'actions'>;

const TRIGGERS = ['task.created', 'status.changed', 'priority.changed', 'assignee.added', 'comment.created', 'due.approaching'];
const FIELDS = ['priority', 'statusCategory', 'assigneeId', 'labelId', 'title', 'hasDue', 'unassigned'];
const ACTIONS = ['set_status', 'set_priority', 'assign', 'add_label', 'set_due', 'create_subtask', 'add_checklist', 'comment', 'notify', 'move_to_sprint', 'webhook'];

function templates(t: (k: string) => string, meId: string, statuses: Status[]): Rule[] {
  const review = statuses.find((s) => s.category === 'REVIEW');
  return [
    {
      name: t('auto.tpl.urgent'),
      trigger: { type: 'task.created' },
      conditions: [{ field: 'priority', op: 'eq', value: 'URGENT' }],
      actions: [{ type: 'assign', params: { userIds: [meId] } }, { type: 'notify', params: { to: 'assignees', message: '🚨' } }],
    },
    { name: t('auto.tpl.done'), trigger: { type: 'status.changed', params: { toCategory: 'DONE' } }, conditions: [], actions: [{ type: 'create_subtask', params: { title: 'QA / بررسی نهایی' } }] },
    ...(review
      ? [{ name: t('auto.tpl.review'), trigger: { type: 'status.changed', params: { toCategory: 'REVIEW' } }, conditions: [], actions: [{ type: 'comment', params: { text: '👀 آماده بازبینی' } }] }]
      : []),
    { name: t('auto.tpl.due'), trigger: { type: 'due.approaching', params: { hours: 24 } }, conditions: [], actions: [{ type: 'set_priority', params: { priority: 'HIGH' } }] },
    {
      name: t('auto.tpl.bug'),
      trigger: { type: 'task.created' },
      conditions: [{ field: 'title', op: 'contains', value: 'باگ' }],
      actions: [{ type: 'add_checklist', params: { items: ['بازتولید', 'رفع', 'تست'] } }, { type: 'set_priority', params: { priority: 'HIGH' } }],
    },
  ];
}

export function AutomationsView({ projectId, statuses, tasks }: { projectId: string; statuses: Status[]; tasks: Task[] }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const rules = useAutomations(projectId).data ?? [];
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<(Rule & { id?: string }) | null>(null);
  const [runsFor, setRunsFor] = useState<AutomationRule | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: keys.automations(projectId) });
  const toggle = useMutation({ mutationFn: (r: AutomationRule) => patch(`/automations/${r.id}`, { enabled: !r.enabled }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/automations/${id}`), onSuccess: refresh });
  const createTpl = useMutation({
    mutationFn: (r: Rule) => post(`/projects/${projectId}/automations`, r),
    onSuccess: () => {
      refresh();
      toast(t('auto.new'), '⚡');
    },
    onError: (e: Error) => toast(e.message, '⚠️'),
  });

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-3">
        <Panel aurora="#8B5CF6" className="flex items-center gap-3 p-5">
          <span className="grid size-11 place-items-center rounded-[14px] bg-lumi/10 text-xl">⚡</span>
          <h2 className="text-lg font-semibold">{t('auto.title')}</h2>
          <Button variant="ink" className="ms-auto" onClick={() => setEditing({ name: '', trigger: { type: 'task.created' }, conditions: [], actions: [{ type: 'comment', params: { text: '' } }] })}>
            <Icon name="plus" size={15} /> {t('auto.new')}
          </Button>
        </Panel>
        {rules.length === 0 && (
          <Panel className="p-5">
            <Empty emoji="⚡" text={t('auto.empty')} />
          </Panel>
        )}
        {rules.map((r) => (
          <Panel key={r.id} className={cx('p-5 transition', !r.enabled && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <button
                role="switch"
                aria-checked={r.enabled}
                onClick={() => toggle.mutate(r)}
                className={cx('relative h-6 w-11 shrink-0 rounded-full transition', r.enabled ? 'bg-success' : 'bg-line')}
              >
                <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', r.enabled ? 'start-[22px]' : 'start-0.5')} />
              </button>
              <h3 className="flex-1 font-semibold">{r.name}</h3>
              <Pill>{t('auto.timesRun', { n: r.runCount })}</Pill>
              {r.lastRunAt && <span className="hidden text-[11px] text-muted sm:inline">{timeAgo(r.lastRunAt, locale)}</span>}
              <IconButton icon="clock" label={t('auto.runs')} className="size-8" onClick={() => setRunsFor(r)} />
              <IconButton icon="settings" label="edit" className="size-8" onClick={() => setEditing({ ...r })} />
              <IconButton icon="trash" label="delete" className="size-8" onClick={() => remove.mutate(r.id)} />
            </div>
            <RuleSentence rule={r} statuses={statuses} />
          </Panel>
        ))}
      </div>

      <Panel className="h-fit p-5">
        <PanelHeader icon="sparkle" title={t('auto.templates')} />
        <div className="mt-3 flex flex-col gap-2">
          {templates(t, user?.id ?? '', statuses).map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => createTpl.mutate(tpl)}
              className="group flex items-center gap-2 rounded-[14px] bg-sunken p-3 text-start text-sm shadow-[inset_0_0_0_1px_var(--line)] transition hover:-translate-y-px hover:shadow-panel"
            >
              <span className="flex-1">{tpl.name}</span>
              <Icon name="plus" size={14} className="text-muted group-hover:text-lumi" />
            </button>
          ))}
        </div>
      </Panel>

      {editing && <RuleDialog projectId={projectId} statuses={statuses} tasks={tasks} initial={editing} onClose={() => setEditing(null)} />}
      {runsFor && <RunsDialog rule={runsFor} tasks={tasks} onClose={() => setRunsFor(null)} />}
    </div>
  );
}

function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `color-mix(in oklab, ${tone} 13%, transparent)`, color: tone }}>
      {children}
    </span>
  );
}

function RuleSentence({ rule, statuses }: { rule: Rule; statuses: Status[] }) {
  const { t } = useT();
  const statusName = (id: unknown) => statuses.find((s) => s.id === id)?.name ?? String(id ?? '');
  const triggerExtra = rule.trigger.params?.toCategory ? ` → ${t(`categories.${rule.trigger.params.toCategory}`)}` : rule.trigger.params?.hours ? ` (${rule.trigger.params.hours}h)` : '';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">{t('auto.when')}</span>
      <Chip tone="var(--lumi)">
        {t(`auto.triggers.${rule.trigger.type}`)}
        {triggerExtra}
      </Chip>
      {rule.conditions.map((c, i) => (
        <span key={i} className="contents">
          <span className="text-muted">{i === 0 ? t('auto.if') : '+'}</span>
          <Chip tone="var(--warn)">
            {t(`auto.fields.${c.field}`)} {c.field !== 'hasDue' && c.field !== 'unassigned' && `${t(`auto.ops.${c.op}`)} ${c.field === 'priority' ? t(`priority.${c.value}`) : c.field === 'statusCategory' ? t(`categories.${c.value}`) : String(c.value ?? '')}`}
          </Chip>
        </span>
      ))}
      <span className="text-muted">{t('auto.then')}</span>
      {rule.actions.map((a, i) => (
        <Chip key={i} tone="var(--success)">
          {t(`auto.actions.${a.type}`)}
          {a.type === 'set_status' && `: ${statusName(a.params?.statusId)}`}
          {a.type === 'set_priority' && `: ${t(`priority.${a.params?.priority}`)}`}
          {a.type === 'create_subtask' && `: ${a.params?.title}`}
        </Chip>
      ))}
    </div>
  );
}

const selectCls = 'h-9 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] outline-none';

function RuleDialog({ projectId, statuses, tasks, initial, onClose }: { projectId: string; statuses: Status[]; tasks: Task[]; initial: Rule & { id?: string }; onClose: () => void }) {
  const { t } = useT();
  const { workspace } = useSession();
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const labels = useLabels(workspace?.id).data ?? [];
  const qc = useQueryClient();
  const toast = useToast();
  const [rule, setRule] = useState<Rule>({ name: initial.name, trigger: initial.trigger, conditions: initial.conditions, actions: initial.actions });
  const [testTask, setTestTask] = useState('');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const save = useMutation({
    mutationFn: () => (initial.id ? patch(`/automations/${initial.id}`, rule) : post(`/projects/${projectId}/automations`, rule)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.automations(projectId) });
      onClose();
    },
    onError: (e: Error) => toast(e.message, '⚠️'),
  });
  const test = useMutation({
    mutationFn: () => post<{ matches: boolean }>(`/automations/${initial.id}/test`, { taskId: testTask }),
    onSuccess: (r) => setTestResult(r.matches),
  });

  const setCond = (i: number, c: Rule['conditions'][number]) => setRule({ ...rule, conditions: rule.conditions.map((x, j) => (j === i ? c : x)) });
  const setAction = (i: number, a: Rule['actions'][number]) => setRule({ ...rule, actions: rule.actions.map((x, j) => (j === i ? a : x)) });

  const valueInput = (c: Rule['conditions'][number], i: number) => {
    const set = (value: unknown) => setCond(i, { ...c, value });
    switch (c.field) {
      case 'priority':
        return (
          <select className={selectCls} value={String(c.value ?? 'URGENT')} onChange={(e) => set(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`priority.${p}`)}
              </option>
            ))}
          </select>
        );
      case 'statusCategory':
        return (
          <select className={selectCls} value={String(c.value ?? 'TODO')} onChange={(e) => set(e.target.value)}>
            {StatusCategory.map((s) => (
              <option key={s} value={s}>
                {t(`categories.${s}`)}
              </option>
            ))}
          </select>
        );
      case 'assigneeId':
        return (
          <select className={selectCls} value={String(c.value ?? '')} onChange={(e) => set(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        );
      case 'labelId':
        return (
          <select className={selectCls} value={String(c.value ?? '')} onChange={(e) => set(e.target.value)}>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        );
      case 'title':
        return <input className={selectCls} value={String(c.value ?? '')} onChange={(e) => set(e.target.value)} />;
      default:
        return null;
    }
  };

  const actionParams = (a: Rule['actions'][number], i: number) => {
    const p = a.params ?? {};
    const set = (patchP: Record<string, unknown>) => setAction(i, { ...a, params: { ...p, ...patchP } });
    switch (a.type) {
      case 'set_status':
        return (
          <select className={selectCls} value={String(p.statusId ?? '')} onChange={(e) => set({ statusId: e.target.value })}>
            <option value="" />
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        );
      case 'set_priority':
        return (
          <select className={selectCls} value={String(p.priority ?? 'HIGH')} onChange={(e) => set({ priority: e.target.value })}>
            {PRIORITIES.map((x) => (
              <option key={x} value={x}>
                {t(`priority.${x}`)}
              </option>
            ))}
          </select>
        );
      case 'assign':
        return (
          <select className={selectCls} value={String((p.userIds as string[] | undefined)?.[0] ?? '')} onChange={(e) => set({ userIds: [e.target.value] })}>
            <option value="" />
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        );
      case 'add_label':
        return (
          <select className={selectCls} value={String(p.labelId ?? '')} onChange={(e) => set({ labelId: e.target.value })}>
            <option value="" />
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        );
      case 'set_due':
        return (
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="number" className={`${selectCls} w-16`} value={Number(p.inDays ?? 1)} onChange={(e) => set({ inDays: Number(e.target.value) })} /> {t('auto.inDays')}
          </label>
        );
      case 'create_subtask':
        return <input className={`${selectCls} flex-1`} placeholder={t('task.title')} value={String(p.title ?? '')} onChange={(e) => set({ title: e.target.value })} />;
      case 'comment':
        return <input className={`${selectCls} flex-1`} placeholder={t('auto.text')} value={String(p.text ?? '')} onChange={(e) => set({ text: e.target.value })} />;
      case 'add_checklist':
        return (
          <input
            className={`${selectCls} flex-1`}
            placeholder={t('auto.items')}
            value={((p.items as string[]) ?? []).join('، ')}
            onChange={(e) => set({ items: e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean) })}
          />
        );
      case 'notify':
        return (
          <>
            <select className={selectCls} value={String(p.to ?? 'assignees')} onChange={(e) => set({ to: e.target.value })}>
              <option value="assignees">{t('auto.assignees')}</option>
              <option value="creator">{t('auto.creator')}</option>
            </select>
            <input className={`${selectCls} flex-1`} placeholder={t('auto.text')} value={String(p.message ?? '')} onChange={(e) => set({ message: e.target.value })} />
          </>
        );
      case 'webhook':
        return <input className={`${selectCls} flex-1`} dir="ltr" placeholder="https://…" value={String(p.url ?? '')} onChange={(e) => set({ url: e.target.value })} />;
      default:
        return null;
    }
  };

  const Row = ({ label, tone, children, onRemove }: { label: string; tone: string; children: ReactNode; onRemove?: () => void }) => (
    <div className="flex flex-wrap items-center gap-2 rounded-[16px] p-2.5" style={{ background: `color-mix(in oklab, ${tone} 7%, var(--panel))` }}>
      <span className="w-14 text-xs font-semibold" style={{ color: tone }}>
        {label}
      </span>
      {children}
      {onRemove && <IconButton icon="close" label="remove" className="ms-auto size-7" onClick={onRemove} />}
    </div>
  );

  return (
    <Dialog onClose={onClose} label={t('auto.new')} className="!max-w-2xl">
      <div className="max-h-[78vh] overflow-y-auto p-6">
        <Input autoFocus placeholder={t('auto.name')} value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
        <div className="mt-4 flex flex-col gap-2">
          <Row label={t('auto.when')} tone="var(--lumi)">
            <select className={selectCls} value={rule.trigger.type} onChange={(e) => setRule({ ...rule, trigger: { type: e.target.value } })}>
              {TRIGGERS.map((x) => (
                <option key={x} value={x}>
                  {t(`auto.triggers.${x}`)}
                </option>
              ))}
            </select>
            {rule.trigger.type === 'status.changed' && (
              <select
                className={selectCls}
                value={String(rule.trigger.params?.toCategory ?? '')}
                onChange={(e) => setRule({ ...rule, trigger: { ...rule.trigger, params: e.target.value ? { toCategory: e.target.value } : {} } })}
              >
                <option value="">*</option>
                {StatusCategory.map((s) => (
                  <option key={s} value={s}>
                    {t('auto.toCategory')} {t(`categories.${s}`)}
                  </option>
                ))}
              </select>
            )}
            {rule.trigger.type === 'due.approaching' && (
              <label className="flex items-center gap-1 text-xs text-muted">
                <input
                  type="number"
                  className={`${selectCls} w-16`}
                  value={Number(rule.trigger.params?.hours ?? 24)}
                  onChange={(e) => setRule({ ...rule, trigger: { ...rule.trigger, params: { hours: Number(e.target.value) } } })}
                />
                {t('auto.hours')}
              </label>
            )}
          </Row>
          {rule.conditions.map((c, i) => (
            <Row key={i} label={t('auto.if')} tone="var(--warn)" onRemove={() => setRule({ ...rule, conditions: rule.conditions.filter((_, j) => j !== i) })}>
              <select className={selectCls} value={c.field} onChange={(e) => setCond(i, { field: e.target.value, op: e.target.value === 'title' ? 'contains' : 'eq', value: undefined })}>
                {FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {t(`auto.fields.${f}`)}
                  </option>
                ))}
              </select>
              {c.field !== 'hasDue' && c.field !== 'unassigned' && (
                <select className={selectCls} value={c.op} onChange={(e) => setCond(i, { ...c, op: e.target.value })}>
                  {(c.field === 'title' ? ['contains'] : ['eq', 'neq']).map((o) => (
                    <option key={o} value={o}>
                      {t(`auto.ops.${o}`)}
                    </option>
                  ))}
                </select>
              )}
              {valueInput(c, i)}
            </Row>
          ))}
          {rule.actions.map((a, i) => (
            <Row key={i} label={t('auto.then')} tone="var(--success)" onRemove={rule.actions.length > 1 ? () => setRule({ ...rule, actions: rule.actions.filter((_, j) => j !== i) }) : undefined}>
              <select className={selectCls} value={a.type} onChange={(e) => setAction(i, { type: e.target.value, params: {} })}>
                {ACTIONS.map((x) => (
                  <option key={x} value={x}>
                    {t(`auto.actions.${x}`)}
                  </option>
                ))}
              </select>
              {actionParams(a, i)}
            </Row>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="soft" onClick={() => setRule({ ...rule, conditions: [...rule.conditions, { field: 'priority', op: 'eq', value: 'URGENT' }] })}>
              <Icon name="plus" size={13} /> {t('auto.addCondition')}
            </Button>
            <Button size="sm" variant="soft" onClick={() => setRule({ ...rule, actions: [...rule.actions, { type: 'set_priority', params: { priority: 'HIGH' } }] })}>
              <Icon name="plus" size={13} /> {t('auto.addAction')}
            </Button>
          </div>
        </div>
        <div className="mt-5 rounded-[16px] bg-sunken p-3">
          <RuleSentence rule={rule} statuses={statuses} />
        </div>
        {initial.id && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select className={selectCls} value={testTask} onChange={(e) => setTestTask(e.target.value)}>
              <option value="">{t('auto.test')}</option>
              {tasks.slice(0, 50).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.key} · {x.title}
                </option>
              ))}
            </select>
            <Button size="sm" variant="soft" disabled={!testTask} onClick={() => test.mutate()} loading={test.isPending}>
              ▶
            </Button>
            {testResult !== null && <span className={cx('text-sm', testResult ? 'text-success' : 'text-warn')}>{testResult ? t('auto.matches') : t('auto.noMatch')}</span>}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="ink" onClick={() => save.mutate()} loading={save.isPending} disabled={!rule.name.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RunsDialog({ rule, tasks, onClose }: { rule: AutomationRule; tasks: Task[]; onClose: () => void }) {
  const { t, locale } = useT();
  const runs = useAutomationRuns(rule.id).data ?? [];
  return (
    <Dialog onClose={onClose} label={t('auto.runs')}>
      <div className="max-h-[70vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold">
          {t('auto.runs')} · {rule.name}
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {runs.length === 0 && <p className="text-sm text-muted">—</p>}
          {runs.map((r) => (
            <div key={r.id} className="rounded-[14px] bg-sunken p-3 text-sm">
              <div className="flex items-center gap-2">
                <span>{r.status === 'SUCCESS' ? '✅' : '❌'}</span>
                <span className="flex-1 truncate">{tasks.find((x) => x.id === r.taskId)?.title ?? r.taskId}</span>
                <span className="text-[11px] text-muted">{timeAgo(r.createdAt, locale)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.log.map((l, i) => (
                  <Pill key={i} tone={l.ok ? 'success' : 'danger'}>
                    {t(`auto.actions.${l.type}`)}
                    {l.error ? `: ${l.error}` : ''}
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
