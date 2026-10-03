'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Avatar, Button, Icon, IconButton, Input, Panel, PanelHeader, Pill } from '@/components/ui';
import { del, patch, post } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { keys, useDashboard, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';

const ROLES = ['ADMIN', 'MEMBER', 'GUEST', 'VIEWER'] as const;

export default function TeamPage() {
  const { t, locale } = useT();
  const { workspace, user } = useSession();
  const detail = useWorkspace(workspace?.id);
  const dash = useDashboard(workspace?.id);
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('MEMBER');
  const canManage = workspace?.role === 'OWNER' || workspace?.role === 'ADMIN';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.workspace(workspace!.id) });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const invite = useMutation({
    mutationFn: () => post<{ status: 'added' | 'invited' }>(`/workspaces/${workspace!.id}/invites`, { email, role }),
    onSuccess: (r) => {
      toast(t(r.status === 'added' ? 'team.added' : 'team.invited'), r.status === 'added' ? '✨' : '✉️');
      setEmail('');
      refresh();
    },
    onError: (e: Error) => toast(e.message, '⚠️'),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => patch(`/workspaces/${workspace!.id}/members/${id}`, { role }),
    onSuccess: refresh,
    onError: (e: Error) => toast(e.message, '⚠️'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/workspaces/${workspace!.id}/members/${id}`),
    onSuccess: refresh,
    onError: (e: Error) => toast(e.message, '⚠️'),
  });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/workspaces/${workspace!.id}/invites/${id}`), onSuccess: refresh });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email) invite.mutate();
  };
  const stats = new Map(dash.data?.team.map((m) => [m.id, m]));

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
      <Panel className="rise p-5">
        <PanelHeader icon="users" title={t('team.title')}>
          <Pill>{num(detail.data?.members.length ?? 0, locale)}</Pill>
        </PanelHeader>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {detail.data?.members.map((m) => {
            const s = stats.get(m.id);
            return (
              <div key={m.id} className="panel aurora p-4" style={{ '--aurora': '#4F5BFF' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} src={m.avatarUrl} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {m.name} {m.id === user?.id && <span className="text-xs font-normal text-muted">({t('common.you')})</span>}
                    </p>
                    <p className="truncate text-xs text-muted" dir="ltr">
                      {m.email}
                    </p>
                  </div>
                  {canManage && m.role !== 'OWNER' && m.id !== user?.id && (
                    <IconButton icon="trash" label={t('team.remove')} className="size-8" onClick={() => remove.mutate(m.id)} />
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {canManage && m.role !== 'OWNER' ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                      className="h-8 rounded-full bg-sunken px-3 text-xs outline-none shadow-[inset_0_0_0_1px_var(--line)]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Pill tone="ink">{t(`roles.${m.role}`)}</Pill>
                  )}
                  {s && (
                    <span className="ms-auto flex gap-1.5">
                      <Pill>{t('dash.tasksOpen', { n: s.open })}</Pill>
                      <Pill tone="success">✓ {num(s.doneThisWeek, locale)}</Pill>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {canManage && (
        <div className="flex flex-col gap-3">
          <Panel aurora="#8B5CF6" className="rise p-5" style={{ animationDelay: '80ms' }}>
            <span className="sticker bg-warn-soft text-warn">✦ {t('nav2.invite')}</span>
            <h2 className="mt-4 text-lg font-semibold">{t('team.inviteTitle')}</h2>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
              <Input type="email" required icon="globe" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('team.invitePlaceholder')} />
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                  className="h-10 flex-1 rounded-full bg-sunken px-3 text-sm outline-none shadow-[inset_0_0_0_1px_var(--line)]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ink" loading={invite.isPending}>
                  <Icon name="plus" size={15} /> {t('team.sendInvite')}
                </Button>
              </div>
            </form>
          </Panel>
          {!!detail.data?.invites.length && (
            <Panel className="rise p-5" style={{ animationDelay: '140ms' }}>
              <PanelHeader icon="inbox" title={t('team.pending')} />
              <div className="mt-3 flex flex-col gap-1">
                {detail.data.invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-sunken">
                    <span className="grid size-8 place-items-center rounded-full bg-sunken text-sm">✉️</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" dir="ltr">
                        {inv.email}
                      </span>
                      <span className="text-[11px] text-muted">
                        {t(`roles.${inv.role}`)} · {timeAgo(inv.createdAt, locale)}
                      </span>
                    </span>
                    <IconButton icon="close" label={t('common.cancel')} className="size-8" onClick={() => revoke.mutate(inv.id)} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
