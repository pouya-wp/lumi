'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { tokens } from '@/lib/api';
import { useT } from '@/lib/i18n-client';
import { useRealtime } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { UiStateProvider, useUi } from '@/lib/ui-state';
import { TaskDrawer } from '../tasks/task-drawer';
import { cx, Spinner } from '../ui';
import { AiProvider } from './ai-panel';
import { CommandPalette } from './command-palette';
import { QuickAdd } from './quick-add';
import { Sidebar } from './sidebar';
import { Spotlight } from './spotlight';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UiStateProvider>
      <AiProvider>
        <Shell>{children}</Shell>
      </AiProvider>
    </UiStateProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, workspace, ready } = useSession();
  const { locale } = useT();
  const { navOpen, setNavOpen, openQuickAdd } = useUi();
  const router = useRouter();
  useRealtime(!!user);

  useEffect(() => {
    if (ready && (!tokens.access || !user)) router.replace(`/${locale}/login`);
  }, [ready, user, router, locale]);

  // "c" opens quick-add when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickAdd]);

  if (!user || !workspace) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="safe-shell min-h-dvh p-0 sm:p-3">
      <Spotlight />
      <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col bg-panel shadow-panel sm:rounded-[var(--radius-frame)]">
        <Topbar />
        <div className="flex flex-1 gap-0 px-0 pb-0 sm:px-3 sm:pb-3 lg:gap-2">
          <aside className="hidden w-[260px] shrink-0 lg:block">
            <div className="sticky top-3 h-[calc(100dvh-110px)]">
              <Sidebar />
            </div>
          </aside>
          <main className="min-w-0 flex-1 bg-canvas p-3 sm:rounded-[var(--radius-panel)] lg:p-4">{children}</main>
        </div>
      </div>

      <div className={cx('fixed inset-0 z-40 lg:hidden', !navOpen && 'pointer-events-none')}>
        <div className={cx('absolute inset-0 bg-black/30 transition', navOpen ? 'opacity-100' : 'opacity-0')} onClick={() => setNavOpen(false)} />
        <aside
          className={cx(
            'safe-drawer absolute inset-y-2 start-2 w-[280px] rounded-[var(--radius-panel)] bg-panel pt-4 shadow-panel transition duration-300 ease-[var(--ease-lumi)]',
            navOpen ? 'translate-x-0' : '-translate-x-[110%] rtl:translate-x-[110%]',
          )}
        >
          <Sidebar />
        </aside>
      </div>

      <TaskDrawer />
      <QuickAdd />
      <CommandPalette />
    </div>
  );
}
