'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { num, useT } from '@/lib/i18n-client';
import { useChannels, useMyTasks, useProjects, useUnreadCount } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';
import { Avatar, cx, Icon, IconButton, type IconName } from '../ui';
import { DocTree } from '../docs/doc-tree';
import { useCreateDoc } from '../docs/use-create-doc';
import { NewProjectDialog } from './new-project-dialog';

export function Sidebar() {
  const { t, locale } = useT();
  const { user, workspace, signOut } = useSession();
  const { setNavOpen } = useUi();
  const pathname = usePathname();
  const projects = useProjects(workspace?.id);
  const unread = useUnreadCount();
  const today = useMyTasks(workspace?.id, 'today');
  const [newProject, setNewProject] = useState(false);
  const channels = useChannels(workspace?.id);
  const chatUnread = channels.data?.reduce((a, c) => a + c.unread, 0);
  const { create: createDoc } = useCreateDoc();
  const base = `/${locale}/app`;

  const item = (href: string, icon: IconName, label: string, badge?: number, exact = false) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={() => setNavOpen(false)}
        className={cx(
          'group flex h-10 items-center gap-3 rounded-full px-3.5 text-sm transition duration-200',
          active ? 'bg-ink text-on-ink shadow-panel' : 'text-ink-2 hover:bg-sunken',
        )}
      >
        <Icon name={icon} size={17} />
        <span className="flex-1 truncate">{label}</span>
        {!!badge && (
          <span className={cx('grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-semibold', active ? 'bg-on-ink/20' : 'bg-warn text-white')}>
            {num(badge, locale)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-4 pb-4 scrollbar-none">
      <p className="mt-2 text-[11px] text-muted">
        {workspace?.name} <span className="mx-1">›</span> <span className="text-ink-2">{t('nav2.home')}</span>
      </p>
      <h1 className="mb-5 mt-2 text-[22px] leading-tight font-semibold">
        {t('dash.welcome')}
        <br />
        {user?.name.split(' ')[0]} <span className="inline-block origin-bottom-right animate-[float_2.4s_ease-in-out_infinite]">👋</span>
      </h1>

      <Section title={t('nav2.menu')}>
        {item(base, 'home', t('nav2.home'), undefined, true)}
        {item(`${base}/today`, 'sparkle', t('nav2.today'))}
        {item(`${base}/my-tasks`, 'checkCircle', t('nav2.myTasks'), today.data?.length)}
        {item(`${base}/inbox`, 'inbox', t('nav2.inbox'), unread.data?.count)}
        {item(`${base}/team`, 'users', t('nav2.team'))}
      </Section>

      <Section title={t('nav2.collab')} action={<IconButton icon="plus" label={t('nav2.newDoc')} className="size-6" onClick={() => createDoc('blank')} />}>
        {item(`${base}/chat`, 'message', t('nav2.chat'), chatUnread)}
        {item(`${base}/docs`, 'doc', t('nav2.docs'), undefined, true)}
        <DocTree />
      </Section>

      <Section title={t('nav2.planning')}>
        {item(`${base}/calendar`, 'calendar', t('nav2.calendar'))}
        {item(`${base}/workload`, 'bolt', t('nav2.workload'))}
        {item(`${base}/timesheet`, 'clock', t('nav2.timesheet'))}
      </Section>

      <Section title={t('nav2.methods')}>
        {item(`${base}/goals`, 'flag', t('nav2.goals'))}
        {item(`${base}/focus`, 'sparkle', t('nav2.focus'))}
        {item(`${base}/habits`, 'checkCircle', t('nav2.habits'))}
        {item(`${base}/roadmap`, 'globe', t('nav2.roadmap'))}
      </Section>

      <Section
        title={t('nav2.projects')}
        action={<IconButton icon="plus" label={t('nav2.newProject')} className="size-6" onClick={() => setNewProject(true)} />}
      >
        {projects.data?.map((p) => {
          const href = `${base}/projects/${p.id}`;
          const active = pathname.startsWith(href);
          const open = (p.counts?.total ?? 0) - (p.counts?.DONE ?? 0) - (p.counts?.CANCELED ?? 0);
          return (
            <Link
              key={p.id}
              href={href}
              onClick={() => setNavOpen(false)}
              className={cx(
                'flex h-10 items-center gap-3 rounded-full px-3.5 text-sm transition',
                active ? 'bg-ink text-on-ink shadow-panel' : 'text-ink-2 hover:bg-sunken',
              )}
            >
              <span className="grid size-5 place-items-center rounded-md text-[12px]" style={{ background: `color-mix(in oklab, ${p.color ?? '#4F5BFF'} 18%, transparent)` }}>
                {p.icon ?? '◆'}
              </span>
              <span className="flex-1 truncate">{p.name}</span>
              <span className={cx('text-[11px] tabular-nums', active ? 'text-on-ink/60' : 'text-muted')}>{num(open, locale)}</span>
            </Link>
          );
        })}
      </Section>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-3 rounded-[18px] p-2 shadow-[inset_0_0_0_1px_var(--line)]">
          {user && <Avatar name={user.name} src={user.avatarUrl} size={38} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-[11px] text-muted" dir="ltr">
              {user?.email}
            </p>
          </div>
          <IconButton icon="logout" label={t('auth.logout')} onClick={signOut} className="size-8" />
        </div>
      </div>
      {newProject && <NewProjectDialog onClose={() => setNewProject(false)} />}
    </nav>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-line py-3 first-of-type:border-t">
      <div className="mb-2 flex items-center justify-between px-1">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
          {title}
          <Icon name="chevronDown" size={13} className={cx('transition', !open && '-rotate-90 rtl:rotate-90')} />
        </button>
        {action}
      </div>
      {open && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  );
}
