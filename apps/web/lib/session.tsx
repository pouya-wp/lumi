'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { post, tokens } from './api';
import { useT } from './i18n-client';
import { useMe, useWorkspaces } from './queries';
import type { User, Workspace } from './types';

const WS_KEY = 'lumi.ws';

interface Session {
  user: User | undefined;
  workspaces: Workspace[];
  workspace: Workspace | undefined;
  setWorkspace: (id: string) => void;
  signIn: (body: { accessToken: string; refreshToken: string }) => void;
  signOut: () => void;
  ready: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // null until the token has been read from storage on mount.
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [wsId, setWsId] = useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const { locale } = useT();

  useEffect(() => {
    setHasToken(!!tokens.access);
    try {
      setWsId(localStorage.getItem(WS_KEY));
    } catch {}
  }, []);

  const me = useMe(hasToken === true);
  const workspaces = useWorkspaces(hasToken === true && me.isSuccess);

  const signOut = useCallback(() => {
    const refreshToken = tokens.refresh;
    if (refreshToken) post('/auth/logout', { refreshToken }).catch(() => {});
    tokens.clear();
    setHasToken(false);
    qc.clear();
    router.replace(`/${locale}/login`);
  }, [qc, router, locale]);

  useEffect(() => {
    const onLogout = () => {
      setHasToken(false);
      qc.clear();
      router.replace(`/${locale}/login`);
    };
    window.addEventListener('lumi:logout', onLogout);
    return () => window.removeEventListener('lumi:logout', onLogout);
  }, [qc, router, locale]);

  const value = useMemo<Session>(() => {
    const list = workspaces.data ?? [];
    return {
      user: me.data,
      workspaces: list,
      workspace: list.find((w) => w.id === wsId) ?? list[0],
      setWorkspace: (id) => {
        setWsId(id);
        try {
          localStorage.setItem(WS_KEY, id);
        } catch {}
      },
      signIn: ({ accessToken, refreshToken }) => {
        tokens.set(accessToken, refreshToken);
        setHasToken(true);
        qc.invalidateQueries();
      },
      signOut,
      ready: hasToken === null ? false : !hasToken ? true : me.isFetched && (me.isError || workspaces.isFetched),
    };
  }, [me.data, me.isFetched, me.isError, workspaces.data, workspaces.isFetched, wsId, hasToken, qc, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
