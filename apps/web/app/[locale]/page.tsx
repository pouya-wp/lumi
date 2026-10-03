import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';

const pastel: Record<string, string> = {
  tasks: 'bg-tasks text-tasks-accent',
  calendar: 'bg-calendar text-calendar-accent',
  goals: 'bg-goals text-goals-accent',
  time: 'bg-time text-time-accent',
  notes: 'bg-notes text-notes-accent',
  daily: 'bg-daily text-daily-accent',
};

// Bento spans: wide+normal, three normals, full-width AI card.
const spans = ['md:col-span-2', '', '', '', '', 'md:col-span-3'];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const other = locale === 'fa' ? 'en' : 'fa';

  return (
    <main className="mx-auto max-w-6xl px-4 pb-6">
      {/* Glass pill nav */}
      <nav className="sticky top-3 z-20 mt-3 flex items-center justify-between rounded-full border border-ink/5 bg-surface/70 px-4 py-2 shadow-card backdrop-blur-xl">
        <div className="flex items-center gap-2 font-black">
          <span className="grid size-8 place-items-center rounded-xl bg-primary text-white shadow-glow">✦</span>
          {t.brand}
        </div>
        <div className="hidden gap-6 text-sm text-ink-muted md:flex">
          <a href="#features">{t.nav.features}</a>
          <a href="#features">{t.nav.methods}</a>
          <a href="#ai">{t.nav.ai}</a>
          <a href="#download">{t.nav.download}</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${other}`} className="rounded-full px-3 py-1.5 text-sm text-ink-muted hover:bg-primary-soft">
            {other.toUpperCase()}
          </Link>
          <a className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-glow">{t.nav.start}</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-16 text-center">
        <span className="sticker bg-calendar text-calendar-accent">{t.hero.sticker}</span>
        <h1 className="mt-6 text-4xl leading-tight font-black tracking-tight md:text-6xl">
          {t.hero.title1}{' '}
          <span className="relative inline-block text-primary">
            {t.hero.title2}
            <span className="absolute -top-4 -end-6 hidden text-3xl float md:block" aria-hidden>💡</span>
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">{t.hero.subtitle}</p>
        <div className="mt-8 flex justify-center gap-3">
          <a className="rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-glow transition hover:-translate-y-0.5">
            {t.hero.cta}
          </a>
          <a className="rounded-2xl border border-ink/10 bg-surface-raised px-6 py-3 font-bold">📱 {t.hero.secondary}</a>
        </div>
      </section>

      {/* Scene with live widgets */}
      <section className="scene-sky relative mt-14 overflow-hidden rounded-[var(--radius-bento)] p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white/80 p-5 text-ink shadow-card backdrop-blur-xl md:col-span-2 md:row-span-2">
            <p className="text-sm text-ink-muted">{t.scene.date}</p>
            <h2 className="mt-1 text-2xl font-black">{t.scene.greeting} 👋</h2>
            <h3 className="mt-5 mb-2 text-sm font-bold text-ink-muted">{t.scene.today}</h3>
            <ul className="space-y-2">
              {t.scene.tasks.map((task, i) => (
                <li key={task} className="flex items-center gap-3 rounded-2xl bg-surface-raised px-3 py-2.5">
                  <span className={`size-5 rounded-full border-2 ${i === 0 ? 'border-primary bg-primary' : 'border-ink/20'}`} />
                  <span className={i === 0 ? 'text-ink-muted line-through' : ''}>{task}</span>
                  <span className="ms-auto size-2 rounded-full" style={{ background: ['#FF4D4F', '#FF8A00', '#3D5AFE'][i] }} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-night-1/90 p-5 text-white shadow-card">
            <p className="text-sm opacity-70">{t.scene.focus} 🍅</p>
            <p className="mt-2 text-4xl font-black tabular-nums">24:17</p>
            <div className="mt-3 h-2 rounded-full bg-white/15">
              <div className="h-2 w-3/5 rounded-full bg-time-accent" />
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 text-ink shadow-card backdrop-blur-xl">
            <p className="text-sm text-ink-muted">{t.scene.team}</p>
            <div className="mt-3 flex -space-x-3 rtl:space-x-reverse">
              {['🧑🏻‍💻', '👩🏻‍🎨', '🧔🏻'].map((a) => (
                <span key={a} className="grid size-11 place-items-center rounded-full border-2 border-white bg-tasks text-xl">{a}</span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 text-ink shadow-card backdrop-blur-xl md:col-span-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t.scene.progress}</span>
              <span className="font-black text-goals-accent">68%</span>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {[30, 45, 40, 60, 55, 75, 68, 82, 70, 90].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-lg bg-primary/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
        <span className="sticker absolute bottom-6 start-6 hidden bg-notes text-notes-accent md:inline-flex">AI ✦ Plan my day</span>
      </section>

      {/* Bento features */}
      <section id="features" className="pt-24">
        <h2 className="text-center text-3xl font-black">{t.bento.title} 🚀</h2>
        <p className="mt-2 text-center text-ink-muted">{t.bento.subtitle}</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {t.bento.items.map((item, i) => (
            <article
              key={item.key}
              className={`group relative overflow-hidden rounded-[var(--radius-bento)] p-7 transition hover:-translate-y-1 hover:shadow-card ${pastel[item.key]} ${spans[i]}`}
            >
              <span className="text-4xl transition group-hover:scale-110 inline-block">{item.emoji}</span>
              <h3 className="mt-4 text-xl font-black text-ink">{item.title}</h3>
              <p className="mt-2 text-ink-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Starry night CTA */}
      <section id="ai" className="stars mt-24 rounded-[var(--radius-bento)] px-6 py-20 text-center text-white">
        <h2 className="mx-auto max-w-md text-3xl leading-snug font-black md:text-4xl">{t.night.title} ✨</h2>
        <a className="mt-8 inline-block rounded-2xl bg-white px-6 py-3 font-bold text-night-1">{t.night.cta}</a>
      </section>

      <footer id="download" className="mt-6 flex flex-col items-center justify-between gap-2 rounded-[var(--radius-bento)] bg-ink px-8 py-8 text-sm text-surface/70 md:flex-row">
        <span className="font-black text-surface">{t.brand} · {t.by}</span>
        <span>{t.footer.rights}</span>
      </footer>
    </main>
  );
}
