'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, post } from '@/lib/api';
import { useT } from '@/lib/i18n-client';
import { useSession } from '@/lib/session';
import { Button, Input } from '../ui';
import { AuthShell } from './auth-shell';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t, locale } = useT();
  const { signIn } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setLoading(true);
    setError(null);
    try {
      const body =
        mode === 'login'
          ? await post<{ accessToken: string; refreshToken: string }>('/auth/login', { email: form.email, password: form.password })
          : await post<{ accessToken: string; refreshToken: string }>('/auth/register', {
              name: form.name,
              email: form.email,
              password: form.password,
              workspaceName: form.workspace || undefined,
              locale,
            });
      signIn(body);
      router.replace(`/${locale}/app`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';
  return (
    <AuthShell
      title={t(isLogin ? 'auth.loginTitle' : 'auth.registerTitle')}
      subtitle={t(isLogin ? 'auth.loginSub' : 'auth.registerSub')}
      footer={
        <>
          {t(isLogin ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
          <Link className="font-medium text-ink underline-offset-4 hover:underline" href={`/${locale}/${isLogin ? 'register' : 'login'}`}>
            {t(isLogin ? 'auth.register' : 'auth.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {!isLogin && <Input name="name" required minLength={2} placeholder={t('auth.name')} autoComplete="name" />}
        <Input name="email" type="email" required placeholder={t('auth.email')} autoComplete="email" dir="ltr" />
        <Input
          name="password"
          type="password"
          required
          minLength={isLogin ? 1 : 8}
          placeholder={isLogin ? t('auth.password') : `${t('auth.password')} — ${t('auth.passwordHint')}`}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          dir="ltr"
        />
        {!isLogin && <Input name="workspace" placeholder={`${t('auth.workspace')} (Beyondex)`} />}
        {error && <p className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="ink" size="lg" loading={loading} className="mt-2">
          {t(isLogin ? 'auth.login' : 'auth.register')}
        </Button>
      </form>
    </AuthShell>
  );
}
