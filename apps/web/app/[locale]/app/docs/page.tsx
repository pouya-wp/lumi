'use client';

import Link from 'next/link';
import { Button, cx, Empty, Icon, Panel, PanelHeader, Pill, Spinner } from '@/components/ui';
import { useCreateDoc } from '@/components/docs/use-create-doc';
import { formatDate, formatTime, timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useDocs } from '@/lib/queries';
import { useSession } from '@/lib/session';

const TEMPLATES = [
  { id: 'blank', emoji: '📄', tone: 'bg-sunken' },
  { id: 'meeting', emoji: '🗓️', tone: 'hatch-ink text-on-ink' },
  { id: 'prd', emoji: '🚀', tone: 'bg-[color-mix(in_oklab,var(--lumi)_14%,var(--panel))]' },
  { id: 'retro', emoji: '🔁', tone: 'bg-[color-mix(in_oklab,#F97316_14%,var(--panel))]' },
  { id: 'onboarding', emoji: '🧭', tone: 'hatch bg-[color-mix(in_oklab,#16A34A_12%,var(--panel))]' },
] as const;

export default function DocsHome() {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const docs = useDocs(workspace?.id);
  const { create, busy } = useCreateDoc();

  if (!docs.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }
  const recent = [...docs.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const meetings = docs.data
    .filter((d) => d.kind === 'MEETING' && d.meetingAt)
    .sort((a, b) => b.meetingAt!.localeCompare(a.meetingAt!))
    .slice(0, 5);
  const roots = docs.data.filter((d) => !d.parentId);
  const childCount = (id: string) => docs.data!.filter((d) => d.parentId === id).length;

  return (
    <div className="flex flex-col gap-3">
      <Panel aurora="#4F5BFF" aurora2="#F97316" className="rise overflow-hidden p-6 md:p-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.14em] text-muted uppercase">{workspace?.name}</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{t('docs.title')}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">{t('docs.subtitle')}</p>
          </div>
          <Button variant="ink" size="lg" loading={busy === 'blank'} onClick={() => create('blank')}>
            <Icon name="plus" size={17} /> {t('docs.new')}
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2.5 md:grid-cols-5">
          {TEMPLATES.map((tpl, i) => (
            <button
              key={tpl.id}
              onClick={() => create(tpl.id)}
              disabled={!!busy}
              className={cx(
                'rise group flex min-h-36 flex-col justify-between rounded-[22px] p-4 text-start shadow-[inset_0_0_0_1px_var(--line)] transition duration-300 ease-[var(--ease-lumi)] hover:-translate-y-1 hover:shadow-panel',
                tpl.tone,
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-3xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6">{busy === tpl.id ? <Spinner /> : tpl.emoji}</span>
              <span>
                <span className="block text-sm font-semibold">{t(`docs.tpl.${tpl.id}`)}</span>
                <span className="mt-0.5 block text-[11px] opacity-65">{t(`docs.tplHint.${tpl.id}`)}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1fr_360px]">
        <Panel className="rise p-5" style={{ animationDelay: '80ms' }}>
          <PanelHeader icon="clock" title={t('docs.recent')} />
          {recent.length === 0 ? (
            <Empty emoji="✍️" text={t('docs.empty')} />
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {recent.map((d) => (
                <Link
                  key={d.id}
                  href={`/${locale}/app/docs/${d.id}`}
                  className="group flex items-center gap-3 rounded-[18px] p-3 shadow-[inset_0_0_0_1px_var(--line)] transition hover:bg-sunken"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-sunken text-xl transition group-hover:scale-105">{d.icon ?? '📄'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.title || t('docs.untitled')}</span>
                    <span className="text-[11px] text-muted">{timeAgo(d.updatedAt, locale)}</span>
                  </span>
                  {d.kind === 'MEETING' && <Pill tone="lumi">{t('docs.meetings')}</Pill>}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="rise p-5" style={{ animationDelay: '140ms' }}>
          <PanelHeader icon="calendar" title={t('docs.meetings')}>
            <Button size="sm" variant="soft" onClick={() => create('meeting')}>
              <Icon name="plus" size={14} /> {t('docs.newMeeting')}
            </Button>
          </PanelHeader>
          <div className="mt-3 flex flex-col">
            {meetings.length === 0 && <Empty emoji="🗓️" text="—" />}
            {meetings.map((m) => (
              <Link key={m.id} href={`/${locale}/app/docs/${m.id}`} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-sunken">
                <span className="flex w-12 flex-col items-center rounded-[12px] bg-ink py-1.5 text-on-ink">
                  <span className="text-[10px] opacity-70">{formatDate(m.meetingAt!, locale, { month: 'short' })}</span>
                  <span className="text-lg leading-none font-semibold">{formatDate(m.meetingAt!, locale, { day: 'numeric' })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.title}</span>
                  <span className="text-[11px] text-muted">{formatTime(m.meetingAt!, locale)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="rise p-5" style={{ animationDelay: '200ms' }}>
        <PanelHeader icon="doc" title={t('docs.all')}>
          <Pill>{num(docs.data.length, locale)}</Pill>
        </PanelHeader>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {roots.map((d) => (
            <Link key={d.id} href={`/${locale}/app/docs/${d.id}`} className="hatch flex items-center gap-3 rounded-[16px] bg-sunken px-3 py-2.5 transition hover:-translate-y-0.5">
              <span className="text-lg">{d.icon ?? '📄'}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{d.title || t('docs.untitled')}</span>
              {childCount(d.id) > 0 && <span className="text-[11px] text-muted">+{num(childCount(d.id), locale)}</span>}
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
