'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { useT } from '@/lib/i18n-client';
import { Logo } from '../shell/logo';

/** Split auth layout: form on one side, a living night scene on the other. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const { t, locale } = useT();
  return (
    <main className="grid min-h-dvh gap-3 p-3 lg:grid-cols-[1fr_1.1fr]">
      <section className="panel flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href={locale === 'fa' ? '/en/login' : '/fa/login'} className="text-sm text-muted hover:text-ink">
            {locale === 'fa' ? 'EN' : 'فا'}
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="rise text-3xl font-bold">{title}</h1>
          <p className="rise mt-2 text-muted" style={{ animationDelay: '60ms' }}>
            {subtitle}
          </p>
          <div className="rise mt-8" style={{ animationDelay: '120ms' }}>
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </div>
        <p className="text-center text-xs text-muted">{t('by')}</p>
      </section>

      <section
        className="relative hidden overflow-hidden rounded-[var(--radius-panel)] lg:block"
        style={{ background: 'radial-gradient(120% 90% at 80% 10%, #1b1f6b 0%, #0a0f3c 45%, #05060f 100%)' }}
      >
        <Stars />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative w-[78%] max-w-md">
            <FloatingCard className="relative z-10" style={{ '--r': '-3deg' } as CSSProperties}>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span className="pulse" /> {t('dash.now')}
              </div>
              <p className="mt-2 text-lg font-semibold text-white">{t('scene.tasks.0')}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-l from-[#7680ff] to-[#a5b4fc]" />
              </div>
            </FloatingCard>
            <FloatingCard className="absolute -top-16 -end-10 w-44" style={{ '--r': '6deg', animationDelay: '-2s' } as CSSProperties}>
              <p className="text-xs text-white/60">{t('dash.done')}</p>
              <p className="mt-1 text-3xl font-bold text-white" dir="ltr">
                +68%
              </p>
            </FloatingCard>
            <FloatingCard className="absolute -bottom-20 -start-8 w-52" style={{ '--r': '-5deg', animationDelay: '-3.5s' } as CSSProperties}>
              <p className="text-xs text-white/60">{t('task.proposalFor', { name: 'Sara' })}</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black">{t('task.accept')}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{t('task.counter')}</span>
              </div>
            </FloatingCard>
          </div>
        </div>
        <p className="absolute bottom-8 inset-x-0 text-center text-5xl font-bold tracking-tight text-white/90">
          {t('hero.title1')} <span className="text-[#a5b4fc]">{t('hero.title2')}</span>
        </p>
      </section>
    </main>
  );
}

function FloatingCard({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={`float rounded-[22px] border border-white/10 bg-white/[.06] p-5 backdrop-blur-xl ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}

function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 37) % 100,
    y: (i * 61) % 100,
    s: (i % 3) + 1,
    d: (i % 7) * 0.6,
  }));
  return (
    <div className="absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: 0.25 + (i % 4) * 0.15, animation: `pulse 3s ${s.d}s ease-in-out infinite alternate` }}
        />
      ))}
    </div>
  );
}
