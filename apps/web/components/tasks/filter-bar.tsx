'use client';

import { Priority, StatusCategory } from '@lumi/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { activeFilterCount } from '@/lib/filters';
import { num, useT } from '@/lib/i18n-client';
import { useLabels, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { TaskFilters } from '@/lib/types';
import { Avatar, cx, Icon, PriorityGlyph } from '../ui';

function toggle<T>(list: T[] | undefined, v: T) {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
}

/** Chip-style filter bar; each chip opens a small popover. */
export function FilterBar({ value, onChange }: { value: TaskFilters; onChange: (f: TaskFilters) => void }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const members = useWorkspace(workspace?.id).data?.members ?? [];
  const labels = useLabels(workspace?.id).data ?? [];
  const count = activeFilterCount(value);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="flex h-9 items-center gap-2 rounded-full bg-sunken px-3 text-sm shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--lumi)]">
        <Icon name="search" size={15} className="text-muted" />
        <input
          value={value.q ?? ''}
          onChange={(e) => onChange({ ...value, q: e.target.value || undefined })}
          placeholder={t('filters.search')}
          className="w-36 bg-transparent outline-none placeholder:text-muted"
        />
      </label>

      <Chip label={t('filters.assignee')} active={!!value.assigneeIds?.length}>
        {[{ id: 'me', name: t('filters.me') }, ...members].map((m) => (
          <Option key={m.id} selected={!!value.assigneeIds?.includes(m.id)} onClick={() => onChange({ ...value, assigneeIds: toggle(value.assigneeIds, m.id) })}>
            <Avatar name={m.name} size={20} /> {m.name}
          </Option>
        ))}
      </Chip>

      <Chip label={t('filters.priority')} active={!!value.priorities?.length}>
        {Priority.map((p) => (
          <Option key={p} selected={!!value.priorities?.includes(p)} onClick={() => onChange({ ...value, priorities: toggle(value.priorities, p) })}>
            <PriorityGlyph priority={p} size={12} /> {t(`priority.${p}`)}
          </Option>
        ))}
      </Chip>

      <Chip label={t('filters.status')} active={!!value.categories?.length}>
        {StatusCategory.map((c) => (
          <Option key={c} selected={!!value.categories?.includes(c)} onClick={() => onChange({ ...value, categories: toggle(value.categories, c) })}>
            {t(`categories.${c}`)}
          </Option>
        ))}
      </Chip>

      {labels.length > 0 && (
        <Chip label={t('filters.label')} active={!!value.labelIds?.length}>
          {labels.map((l) => (
            <Option key={l.id} selected={!!value.labelIds?.includes(l.id)} onClick={() => onChange({ ...value, labelIds: toggle(value.labelIds, l.id) })}>
              <span className="size-2.5 rounded-full" style={{ background: l.color }} /> {l.name}
            </Option>
          ))}
        </Chip>
      )}

      <Chip label={t('filters.due')} active={!!value.due}>
        {(['overdue', 'today', 'week', 'none'] as const).map((d) => (
          <Option key={d} selected={value.due === d} onClick={() => onChange({ ...value, due: value.due === d ? undefined : d })}>
            {t(`filters.${d}`)}
          </Option>
        ))}
      </Chip>

      {count > 0 && (
        <button onClick={() => onChange({ q: value.q })} className="flex h-9 items-center gap-1 rounded-full px-3 text-xs text-danger hover:bg-danger-soft">
          <Icon name="close" size={13} /> {t('filters.clear')} ({num(count, locale)})
        </button>
      )}
    </div>
  );
}

function Chip({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cx(
          'flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition',
          active ? 'bg-ink text-on-ink' : 'text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-sunken',
        )}
      >
        {label}
        <Icon name="chevronDown" size={13} />
      </button>
      {open && <div className="panel rise absolute top-full z-30 mt-2 max-h-72 w-56 overflow-y-auto p-1.5">{children}</div>}
    </div>
  );
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-start text-sm hover:bg-sunken">
      {children}
      {selected && <Icon name="check" size={14} className="ms-auto text-lumi" />}
    </button>
  );
}
