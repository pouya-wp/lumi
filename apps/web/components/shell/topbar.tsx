'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n-client';
import { useUnreadCount, useWorkspace } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useUi } from '@/lib/ui-state';
import { AvatarStack, Button, cx, Icon, IconButton, Kbd, Pill } from '../ui';
import { useAiPanel } from './ai-panel';
import { TimerPill } from './timer-pill';

export function Topbar() {
  const { t, locale } = useT();
  const { workspace, workspaces, setWorkspace } = useSession();
  const { setPaletteOpen, openQuickAdd, setNavOpen } = useUi();
  const { theme, set } = useTheme();
  const detail = useWorkspace(workspace?.id);
  const unread = useUnreadCount();
  const [switcher, setSwitcher] = useState(false);
  const ai = useAiPanel();

  return (
    <header className="flex h-[72px] items-center gap-3 px-4 lg:px-5">
      <IconButton icon="list" label={t('nav2.menu')} className="lg:hidden" onClick={() => setNavOpen(true)} />

      <div className="relative lg:w-[248px]">
        <button onClick={() => setSwitcher(!switcher)} className="flex items-center gap-3 rounded-full p-1 pe-3 transition hover:bg-sunken">
          <span className="grid size-10 place-items-center rounded-full bg-ink text-sm font-bold text-on-ink">
            {[...(workspace?.name ?? 'L')][0]}
          </span>
          <span className="hidden text-start sm:block">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {workspace?.name}
              <Pill tone="success" className="!px-1.5 !py-0 text-[10px]">
                ✦ {t(`roles.${workspace?.role ?? 'MEMBER'}`)}
              </Pill>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Icon name="lock" size={11} /> Beyondex
            </span>
          </span>
          <Icon name="chevronUpDown" size={14} className="text-muted" />
        </button>
        {switcher && (
          <div className="panel rise absolute top-14 z-30 w-64 p-1.5">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWorkspace(w.id);
                  setSwitcher(false);
                }}
                className={cx('flex w-full items-center gap-3 rounded-[14px] p-2 text-start text-sm hover:bg-sunken', w.id === workspace?.id && 'bg-sunken')}
              >
                <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-bold text-on-ink">{[...w.name][0]}</span>
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === workspace?.id && <Icon name="check" size={15} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        className="ms-auto flex h-11 max-w-md flex-1 items-center gap-2.5 rounded-full bg-sunken px-4 text-sm text-muted shadow-[inset_0_0_0_1px_var(--line)] transition hover:text-ink-2 md:ms-6 lg:ms-0"
      >
        <Icon name="search" size={17} />
        <span className="hidden flex-1 text-start sm:block">{t('nav2.search')}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <IconButton icon="plus" label={t('task.new')} onClick={() => openQuickAdd()} className="bg-lumi text-white shadow-[0_8px_20px_-8px_var(--lumi)] hover:bg-lumi" />

      <button
        onClick={() => ai.open()}
        className="group relative hidden h-11 items-center gap-2 overflow-hidden rounded-full bg-ink ps-3 pe-4 text-sm text-on-ink shadow-panel sm:flex"
      >
        <span className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(118,128,255,.55),transparent_40%)] opacity-0 transition group-hover:opacity-100 group-hover:animate-spin [animation-duration:3s]" />
        <span className="absolute inset-[1.5px] rounded-full bg-ink" />
        <Icon name="sparkle" size={16} className="relative" />
        <span className="relative">{t('ai.assistant')}</span>
      </button>
      <TimerPill />
      <div className="ms-auto hidden items-center gap-1 rounded-full bg-sunken p-1 shadow-[inset_0_0_0_1px_var(--line)] md:flex">
        {(['light', 'dark'] as const).map((mode) => (
          <button
            key={mode}
            aria-label={t(`common.${mode}`)}
            onClick={() => set(mode)}
            className={cx('grid size-8 place-items-center rounded-full transition', theme === mode ? 'bg-ink text-on-ink' : 'text-muted hover:text-ink')}
          >
            <Icon name={mode === 'light' ? 'sun' : 'moon'} size={16} />
          </button>
        ))}
      </div>
      <Link href={`/${locale}/app/inbox`} className="relative grid size-10 place-items-center rounded-full text-ink-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-sunken" aria-label={t('nav2.inbox')}>
        <Icon name="bell" size={17} />
        {!!unread.data?.count && <span className="absolute top-2 end-2.5 size-2 rounded-full bg-warn ring-2 ring-panel" />}
      </Link>
      <div className="hidden items-center gap-3 xl:flex">
        {detail.data && <AvatarStack users={detail.data.members} max={3} size={34} />}
        <Link href={`/${locale}/app/team`}>
          <Button variant="ink" className="h-11 ps-2">
            <span className="grid size-7 place-items-center rounded-full bg-on-ink/15">
              <Icon name="users" size={14} />
            </span>
            {t('nav2.invite')}
          </Button>
        </Link>
      </div>
    </header>
  );
}
