'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, post } from '@/lib/api';
import { useT } from '@/lib/i18n-client';
import { keys } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { Project } from '@/lib/types';
import { Button, cx, Input } from '../ui';
import { Dialog } from '../ui/dialog';

const ICONS = ['🚀', '📱', '🎨', '🧠', '📈', '🛠️', '🎯', '📚', '💡', '🌿'];
const COLORS = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#8B5CF6', '#0EA5E9', '#EAB308'];

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () => post<Project>(`/workspaces/${workspace!.id}/projects`, { name, icon, color }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: keys.projects(workspace!.id) });
      onClose();
      router.push(`/${locale}/app/projects/${project.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <Dialog onClose={onClose} label={t('project.new')}>
      <form onSubmit={submit} className="p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-[18px] text-2xl transition" style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}>
            {icon}
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t('project.new')}</h2>
            <p className="text-sm text-muted">{workspace?.name}</p>
          </div>
        </div>
        <Input autoFocus className="mt-6" placeholder={t('project.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button type="button" key={i} onClick={() => setIcon(i)} className={cx('grid size-10 place-items-center rounded-[12px] text-lg transition', i === icon ? 'bg-ink/10 scale-105' : 'hover:bg-sunken')}>
              {i}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} className={cx('size-7 rounded-full transition', c === color && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')} style={{ background: c }} />
          ))}
        </div>
        {create.error && <p className="mt-3 text-sm text-danger">{create.error instanceof ApiError ? create.error.message : t('common.error')}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="ink" loading={create.isPending} disabled={!name.trim()}>
            {t('project.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
