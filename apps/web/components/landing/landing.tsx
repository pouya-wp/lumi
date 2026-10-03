'use client';

import Link from 'next/link';
import { useEffect, useRef, type CSSProperties } from 'react';
import { HatchBars, SegmentGauge } from '../dashboard/charts';
import { Logo } from '../shell/logo';
import { Avatar, AvatarStack, Button, Icon, Pill, PriorityGlyph } from '../ui';
import { useT } from '@/lib/i18n-client';
import { useTheme } from '@/lib/theme';

const AURORA: Record<string, string> = {
  tasks: '#4F5BFF',
  calendar: '#F43F5E',
  goals: '#16A34A',
  time: '#F97316',
  notes: '#EAB308',
  daily: '#8B5CF6',
};

const team = [
  { id: '1', name: 'Pouya', avatarUrl: null },
  { id: '2', name: 'Sara', avatarUrl: null },
  { id: '3', name: 'Ali', avatarUrl: null },
];

export function Landing() {
  const { t, raw, locale } = useT();
  const { theme, toggle } = useTheme();
  const other = locale === 'fa' ? 'en' : 'fa';
  const items = raw<{ key: string; emoji: string; title: string; body: string }[]>('bento.items');

  return (
    <main className="overflow-x-clip">
      <CursorLight />
      <nav className="fixed inset-x-0 top-3 z-30 mx-auto flex max-w-6xl items-center gap-4 rounded-full border border-line bg-panel/70 px-3 py-2 shadow-panel backdrop-blur-xl sm:px-4 [width:calc(100%-1.5rem)]">
        <Logo />
        <div className="ms-6 hidden gap-6 text-sm text-ink-2 md:flex">
          <a href="#features" className="hover:text-ink">{t('nav.features')}</a>
          <a href="#flow" className="hover:text-ink">{t('nav.methods')}</a>
          <a href="#night" className="hover:text-ink">{t('nav.ai')}</a>
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <button onClick={toggle} aria-label="theme" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
          <Link href={`/${other}`} className="grid size-9 place-items-center rounded-full text-xs text-ink-2 hover:bg-sunken">
            {other === 'fa' ? 'فا' : 'EN'}
          </Link>
          <Link href={`/${locale}/login`} className="hidden px-3 text-sm text-ink-2 hover:text-ink sm:block">
            {t('auth.login')}
          </Link>
          <Link href={`/${locale}/register`}>
            <Button variant="ink">{t('nav.start')}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pt-40 text-center">
        <span className="sticker rise bg-panel text-ink shadow-panel">
          <span className="pulse" /> {t('hero.sticker')}
        </span>
        <h1 className="rise mx-auto mt-8 max-w-4xl text-[clamp(2.6rem,7vw,5.5rem)] leading-[1.05] font-bold tracking-tight" style={{ animationDelay: '80ms' }}>
          {t('hero.title1')}
          <br />
          <span className="light-sweep">{t('hero.title2')}</span>
          <span className="float ms-3 inline-block align-top text-[0.5em]" style={{ '--r': '12deg' } as CSSProperties} aria-hidden>
            ✦
          </span>
        </h1>
        <p className="rise mx-auto mt-6 max-w-xl text-lg text-ink-2" style={{ animationDelay: '160ms' }}>
          {t('hero.subtitle')}
        </p>
        <div className="rise mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '240ms' }}>
          <Link href={`/${locale}/register`}>
            <Button variant="ink" size="lg" className="group">
              {t('hero.cta')}
              <Icon name="arrowUp" size={16} className="rotate-90 transition group-hover:translate-x-1 rtl:-rotate-90 rtl:group-hover:-translate-x-1" />
            </Button>
          </Link>
          <Button size="lg" variant="soft">
            📱 {t('hero.secondary')}
          </Button>
          <span className="flex items-center gap-2 ps-2 text-sm text-muted">
            <AvatarStack users={team} size={30} /> {t('by')}
          </span>
        </div>

        <Preview />
      </section>

      {/* Marquee */}
      <section className="relative mt-24 border-y border-line bg-panel py-5" dir="ltr">
        <div className="marquee flex w-max gap-10 text-2xl font-semibold text-ink-2">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10" aria-hidden={k === 1}>
              {raw<string[]>('landing.marquee').map((m) => (
                <span key={m} className="flex items-center gap-10 whitespace-nowrap">
                  {m} <span className="text-lumi">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-6xl px-4 pt-28">
        <h2 className="text-center text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight">{t('bento.title')}</h2>
        <p className="mt-3 text-center text-ink-2">{t('bento.subtitle')}</p>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {items.map((item, i) => (
            <article
              key={item.key}
              className={`panel aurora reveal group p-7 transition duration-300 hover:-translate-y-1 ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
              style={{ '--aurora': AURORA[item.key], '--ax': i % 2 ? '0%' : '100%' } as CSSProperties}
            >
              <span className="inline-block text-4xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6">{item.emoji}</span>
              <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 max-w-sm text-ink-2">{item.body}</p>
              {i === 0 && <MiniBoard />}
            </article>
          ))}
        </div>
      </section>

      {/* Proposal flow */}
      <section id="flow" className="mx-auto max-w-6xl px-4 pt-32">
        <div className="grid items-center gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="sticker bg-warn-soft text-warn">✦ Lumi Flow</span>
            <h2 className="mt-6 text-[clamp(2rem,4vw,3.2rem)] leading-tight font-bold tracking-tight">{t('landing.flowTitle')}</h2>
            <p className="mt-4 text-lg text-ink-2">{t('landing.flowSub')}</p>
          </div>
          <ol className="relative flex flex-col gap-3">
            {raw<{ emoji: string; title: string; body: string }[]>('landing.flow').map((step, i) => (
              <li key={step.title} className="panel reveal flex items-center gap-4 p-5" style={{ marginInlineStart: `${i * 28}px` }}>
                <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-sunken text-2xl">{step.emoji}</span>
                <div>
                  <p className="font-semibold">
                    <span className="me-2 text-muted tabular-nums">0{i + 1}</span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Night CTA */}
      <section id="night" className="mx-auto mt-32 max-w-6xl px-4">
        <div className="night relative overflow-hidden rounded-[var(--radius-frame)] px-6 py-24 text-center text-white">
          <div className="grid gap-6 sm:grid-cols-3">
            {raw<{ n: string; l: string }[]>('landing.stats').map((s) => (
              <div key={s.l}>
                <p className="text-6xl font-bold">{s.n}</p>
                <p className="mt-2 text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
          <h2 className="mx-auto mt-16 max-w-xl text-[clamp(1.8rem,4vw,3rem)] leading-tight font-bold">{t('night.title')} ✨</h2>
          <Link href={`/${locale}/register`} className="mt-10 inline-block">
            <Button size="lg" className="!bg-white !text-black">
              {t('night.cta')}
            </Button>
          </Link>
        </div>
      </section>

      <footer className="mx-auto mt-3 mb-3 flex max-w-6xl flex-col items-center justify-between gap-3 rounded-[var(--radius-frame)] bg-ink px-8 py-8 text-sm text-on-ink/60 sm:flex-row [width:calc(100%-1.5rem)]">
        <span className="font-semibold text-on-ink">
          {t('brand')} · {t('by')}
        </span>
        <span>{t('footer.rights')}</span>
      </footer>
    </main>
  );
}

/** Live dashboard preview that starts tilted in 3D and flattens as it scrolls into view. */
function Preview() {
  const { t } = useT();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return { date: d.toISOString(), count: [3, 5, 4, 7, 6, 9, 8][i], delta: [8, -5, 3, 12, -10, 5, 3][i] };
  });
  return (
    <div className="tilt relative mx-auto mt-20 max-w-5xl [perspective:1600px]">
      <div className="tilt-inner rounded-[var(--radius-frame)] bg-panel p-3 text-start shadow-[0_60px_120px_-40px_rgb(11_12_15/.45)] ring-1 ring-line">
        <div className="flex items-center gap-2 px-2 pb-3">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warn/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <Pill className="ms-auto">
            <span className="pulse !size-1.5" /> {t('landing.previewTag')}
          </Pill>
        </div>
        <div className="grid gap-3 rounded-[var(--radius-panel)] bg-canvas p-3 md:grid-cols-[1.6fr_1fr]">
          <div className="panel aurora p-5" style={{ '--aurora': '#16A34A', '--aurora-2': '#F97316' } as CSSProperties}>
            <p className="font-semibold">{t('dash.overview')}</p>
            <p className="mt-3 text-3xl font-semibold">42</p>
            <div className="mt-2">
              <HatchBars data={days} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="panel p-5">
              <p className="font-semibold">{t('dash.goal')}</p>
              <SegmentGauge value={80} label={t('dash.done')} />
            </div>
            <div className="panel beam p-4">
              <span className="beam-ring" />
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className="pulse" /> {t('dash.now')}
              </p>
              <p className="mt-1.5 text-sm font-medium">{t('scene.tasks.0')}</p>
              <div className="mt-3 flex items-center gap-2">
                <PriorityGlyph priority="URGENT" />
                <Pill tone="warn">{t('common.today')}</Pill>
                <span className="ms-auto">
                  <Avatar name="Sara" size={24} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="sticker float absolute -top-6 end-4 bg-lumi text-white sm:end-16" style={{ '--r': '8deg' } as CSSProperties}>
        AI ✦ Plan my day
      </span>
      <span className="sticker float absolute bottom-16 -start-2 bg-success-soft text-success sm:-start-8" style={{ '--r': '-8deg', animationDelay: '-2s' } as CSSProperties}>
        +68% 🚀
      </span>
    </div>
  );
}

function MiniBoard() {
  const { t } = useT();
  const cols = [
    { name: t('myTasks.today'), color: '#0EA5E9', cards: [t('scene.tasks.1'), t('scene.tasks.2')] },
    { name: t('dash.inProgress'), color: '#4F5BFF', cards: [t('scene.tasks.0')] },
  ];
  return (
    <div className="mt-8 grid grid-cols-2 gap-2">
      {cols.map((c) => (
        <div key={c.name} className="rounded-[18px] bg-sunken/80 p-2 shadow-[inset_0_0_0_1px_var(--line)]">
          <p className="flex items-center gap-2 px-1.5 py-1 text-xs font-semibold">
            <span className="size-2 rounded-full" style={{ background: c.color }} /> {c.name}
          </p>
          {c.cards.map((card, i) => (
            <div key={card} className="panel mt-2 p-3 text-xs" style={{ transform: `rotate(${i ? 1.5 : -1}deg)` }}>
              {card}
              <div className="mt-2 flex items-center justify-between">
                <PriorityGlyph priority={i ? 'MEDIUM' : 'HIGH'} size={11} />
                <Avatar name={i ? 'Ali' : 'Sara'} size={18} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A soft light that follows the cursor across the page background. */
function CursorLight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) return;
    const onMove = (e: PointerEvent) => {
      ref.current?.style.setProperty('transform', `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0 size-[600px] rounded-full opacity-60 blur-3xl transition-transform duration-700 ease-out"
      style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--lumi) 22%, transparent), transparent 65%)' }}
    />
  );
}
