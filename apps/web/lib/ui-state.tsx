'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface UiState {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  quickAdd: { projectId?: string; statusId?: string; parentId?: string } | null;
  openQuickAdd: (opts?: { projectId?: string; statusId?: string; parentId?: string }) => void;
  closeQuickAdd: () => void;
  openTask: (id: string) => void;
  closeTask: () => void;
  taskId: string | null;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
}

const UiContext = createContext<UiState | null>(null);

/** Cross-cutting UI state: command palette, quick-add, mobile nav and the task drawer (?task=ID). */
export function UiStateProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState<UiState['quickAdd']>(null);
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const taskId = params.get('task');

  const withTask = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set('task', id);
      else next.delete('task');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const value = useMemo<UiState>(
    () => ({
      paletteOpen,
      setPaletteOpen,
      quickAdd,
      openQuickAdd: (opts = {}) => setQuickAdd(opts),
      closeQuickAdd: () => setQuickAdd(null),
      openTask: (id) => withTask(id),
      closeTask: () => withTask(null),
      taskId,
      navOpen,
      setNavOpen,
    }),
    [paletteOpen, quickAdd, taskId, navOpen, withTask],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside UiStateProvider');
  return ctx;
}
