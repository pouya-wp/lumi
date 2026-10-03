'use client';

import { BADGE_EMOJI } from '@/components/reports/badges';
import { Heatmap, Ring } from '@/components/reports/charts';
import { Avatar, cx, Odometer, Panel, PanelHeader, Pill, Spinner } from '@/components/ui';
import { formatMinutes } from '@/lib/calendar';
import { timeAgo } from '@/lib/format';
import { num, useT } from '@/lib/i18n-client';
import { useGame } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { GameMember } from '@/lib/types';


export default function ArenaPage() {
  const { t, raw, locale } = useT();
  const { workspace, user } = useSession();
  const game = useGame(workspace?.id);

  if (!game.data) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    );
  }
  const { members, badges } = game.data;
  const me = members.find((m) => m.user.id === user?.id) ?? members[0];
  const levels = raw('game.levels') as string[];
  const title = (lvl: number) => levels[Math.min(levels.length - 1, lvl - 1)];
  const podium = [members[1], members[0], members[2]].filter(Boolean) as GameMember[];
  const mine = new Map(me?.badges.map((b) => [b.key, b.earnedAt]));

  return (
    <div className="flex flex-col gap-3">
      {/* Hero: night arena with podium */}
      <section className="night rise relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-white md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_120%,rgb(79_91_255/.45),transparent_70%),radial-gradient(40%_60%_at_90%_0%,rgb(249_115_22/.25),transparent_70%)]" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.2em] text-white/50 uppercase">{t('game.leaderboard')}</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{t('game.title')}</h1>
            <p className="mt-2 max-w-md text-sm text-white/60">{t('game.subtitle')}</p>
          </div>
          {me && (
            <div className="flex items-center gap-4 rounded-[24px] bg-white/8 p-3 pe-5 backdrop-blur-md shadow-[inset_0_0_0_1px_rgb(255_255_255/.12)]">
              <Ring value={me.progress} size={84} stroke={8}>
                <span>
                  <span className="block text-[10px] text-white/60">{t('game.level', { n: '' }).trim()}</span>
                  <span className="text-2xl font-bold">{num(me.level, locale)}</span>
                </span>
              </Ring>
              <div>
                <p className="text-lg font-semibold">{title(me.level)}</p>
                <p className="text-xs text-white/60">{t('game.xp', { n: me.xp })}</p>
                <p className="mt-1 text-[11px] text-white/45">{t('game.toNext', { n: me.next - me.xp })}</p>
              </div>
            </div>
          )}
        </div>

        <div className="relative mt-10 flex items-end justify-center gap-3 md:gap-6">
          {podium.map((m) => {
            const rank = members.indexOf(m);
            const heights = ['h-40', 'h-28', 'h-20'];
            const medal = ['🥇', '🥈', '🥉'][rank];
            return (
              <div key={m.user.id} className="flex w-28 flex-col items-center md:w-40" style={{ animation: `rise .7s var(--ease-lumi) ${rank * 120}ms both` }}>
                <span className={cx('relative mb-3 rounded-full', rank === 0 && 'shadow-[0_0_40px_rgb(250_204_21/.55)]')}>
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={rank === 0 ? 72 : 56} />
                  <span className="absolute -end-2 -bottom-1 text-2xl">{medal}</span>
                </span>
                <p className="max-w-full truncate text-sm font-semibold">{m.user.name}</p>
                <p className="text-[11px] text-white/55">
                  {title(m.level)} · {t('game.level', { n: m.level })}
                </p>
                <div
                  className={cx(
                    'mt-3 flex w-full flex-col items-center justify-start rounded-t-[22px] pt-3 shadow-[inset_0_1px_0_rgb(255_255_255/.25)]',
                    heights[rank],
                    rank === 0 ? 'bg-gradient-to-b from-[#4F5BFF] to-[#4F5BFF]/30' : 'bg-white/10',
                  )}
                >
                  <span className="text-2xl font-bold">
                    <Odometer value={m.weekXp} />
                  </span>
                  <span className="text-[10px] text-white/60">{t('game.weekXp')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_340px]">
        {/* Streak + heatmap */}
        {me && (
          <Panel aurora="#F97316" className="rise p-5 xl:col-span-2">
            <PanelHeader icon="bolt" title={t('game.streak')}>
              <Pill tone="warn">🔥 {t('game.daysStreak', { n: me.streak.current })}</Pill>
              <Pill>{t('game.best', { n: me.streak.best })}</Pill>
            </PanelHeader>
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_220px]">
              <div>
                <p className="mb-2 text-[11px] text-muted">{t('game.heatmap')}</p>
                <Heatmap heat={me.heat} />
              </div>
              <div className="grid grid-cols-2 gap-2 self-end">
                <Stat label={t('reports.done')} value={num(me.done, locale)} />
                <Stat label={t('reports.focus')} value={formatMinutes(me.focusMinutes, locale)} />
                <Stat label="XP" value={num(me.xp, locale)} />
                <Stat label={t('game.badgesTitle')} value={`${num(me.badges.length, locale)}/${num(badges.length, locale)}`} />
              </div>
            </div>
          </Panel>
        )}

        {/* Full leaderboard */}
        <Panel className="rise p-5" style={{ animationDelay: '80ms' }}>
          <PanelHeader icon="users" title={t('game.leaderboard')} />
          <ol className="mt-4 flex flex-col gap-2">
            {members.map((m, i) => (
              <li key={m.user.id} className={cx('flex items-center gap-3 rounded-[16px] p-2.5', m.user.id === user?.id ? 'bg-ink text-on-ink' : 'shadow-[inset_0_0_0_1px_var(--line)]')}>
                <span className="w-5 text-center text-sm font-semibold tabular-nums opacity-60">{num(i + 1, locale)}</span>
                <Avatar name={m.user.name} src={m.user.avatarUrl} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.user.name}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-current/15">
                    <span className="block h-full rounded-full bg-gradient-to-r from-[#4F5BFF] to-[#F97316]" style={{ width: `${m.progress * 100}%` }} />
                  </span>
                </span>
                <span className="text-end">
                  <span className="block text-sm font-semibold tabular-nums">{num(m.weekXp, locale)}</span>
                  <span className="text-[10px] opacity-60">{t('game.level', { n: m.level })}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <Panel className="rise p-5" style={{ animationDelay: '140ms' }}>
          <PanelHeader icon="sparkle" title={t('game.badgesTitle')}>
            <Pill tone="lumi">
              {num(me?.badges.length ?? 0, locale)} / {num(badges.length, locale)}
            </Pill>
          </PanelHeader>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {badges.map((key, i) => {
              const at = mine.get(key);
              return (
                <div
                  key={key}
                  className={cx(
                    'rise group relative flex flex-col items-center gap-2 rounded-[20px] p-4 text-center transition duration-300',
                    at ? 'bg-sunken shadow-[inset_0_0_0_1px_var(--line)] hover:-translate-y-1' : 'hatch opacity-55 grayscale',
                  )}
                  style={{ animationDelay: `${i * 25}ms` }}
                >
                  <span className={cx('grid size-14 place-items-center rounded-full text-3xl transition', at ? 'bg-panel shadow-panel group-hover:scale-110 group-hover:rotate-6' : 'bg-sunken')}>
                    {at ? BADGE_EMOJI[key] : '🔒'}
                  </span>
                  <span className="text-sm font-semibold">{t(`game.badges.${key}.name`)}</span>
                  <span className="text-[11px] leading-relaxed text-muted">{t(`game.badges.${key}.desc`)}</span>
                  {at && <span className="text-[10px] text-success">{t('game.earned', { when: timeAgo(at, locale) })}</span>}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="rise p-5" style={{ animationDelay: '200ms' }}>
          <PanelHeader icon="help" title={t('game.rules')} />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {[
              ['task', '+10'],
              ['priority', '+2…15'],
              ['onTime', '+5'],
              ['focus', '+1'],
              ['habit', '+3'],
              ['doc', '+5'],
              ['comment', '+2'],
              ['message', '+1'],
            ].map(([k, xp]) => (
              <li key={k} className="flex items-center gap-3 rounded-[12px] bg-sunken px-3 py-2">
                <span className="flex-1 text-ink-2">{t(`game.rule.${k}`)}</span>
                <b className="text-success tabular-nums" dir="ltr">
                  {xp}
                </b>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {levels.map((l, i) => (
              <span key={l} className={cx('rounded-full px-2.5 py-1 text-[11px]', me && i + 1 <= me.level ? 'bg-ink text-on-ink' : 'bg-sunken text-muted')}>
                {num(i + 1, locale)} · {l}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-sunken p-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <p className="truncate text-[10px] text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
