'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n-client';
import { useSearch } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useUi } from '@/lib/ui-state';
import { cx, Icon, Kbd, PriorityGlyph, StatusDot, type IconName } from '../ui';
import { Dialog } from '../ui/dialog';

interface Item {
  id: string;
  group: string;
  label: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUi();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);

  return paletteOpen ? <Palette onClose={() => setPaletteOpen(false)} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const { workspace } = useSession();
  const { openTask, openQuickAdd } = useUi();
  const { toggle } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const search = useSearch(workspace?.id, q);

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => {
      router.push(`/${locale}/app${path}`);
      onClose();
    };
    const action = (id: string, icon: IconName, label: string, run: () => void, hint?: string): Item => ({
      id,
      group: t('palette.actions'),
      label,
      icon: <Icon name={icon} size={16} />,
      run,
      hint: hint && <Kbd>{hint}</Kbd>,
    });
    const actions = [
      action('new', 'plus', t('palette.newTask'), () => {
        onClose();
        openQuickAdd();
      }, 'C'),
      action('home', 'home', t('palette.goHome'), go('')),
      action('mine', 'checkCircle', t('palette.goMine'), go('/my-tasks')),
      action('inbox', 'inbox', t('palette.goInbox'), go('/inbox')),
      action('theme', 'moon', t('palette.toggleTheme'), () => {
        toggle();
        onClose();
      }),
    ].filter((a) => !q || String(a.label).toLowerCase().includes(q.toLowerCase()));

    const tasks: Item[] = (q ? (search.data?.tasks ?? []) : []).map((task) => ({
      id: task.id,
      group: t('palette.tasks'),
      label: task.title,
      hint: <span className="text-[11px] text-muted" dir="ltr">{task.key}</span>,
      icon: (
        <span className="flex items-center gap-2">
          <PriorityGlyph priority={task.priority} size={12} />
          <StatusDot color={task.status.color} category={task.status.category} size={9} />
        </span>
      ),
      run: () => {
        onClose();
        openTask(task.id);
      },
    }));
    const projects: Item[] = (q ? (search.data?.projects ?? []) : []).map((p) => ({
      id: p.id,
      group: t('palette.projects'),
      label: p.name,
      icon: <span>{p.icon ?? '◆'}</span>,
      run: go(`/projects/${p.id}`),
    }));
    return [...tasks, ...projects, ...actions];
  }, [q, search.data, t, locale, router, onClose, openQuickAdd, openTask, toggle]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = '';
  return (
    <Dialog onClose={onClose} label="Command palette" className="!max-w-2xl overflow-hidden !bg-panel/85 backdrop-blur-2xl">
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Icon name="search" className="text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
        <Kbd>esc</Kbd>
      </div>
      <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
        {items.length === 0 && <p className="py-10 text-center text-sm text-muted">{t('palette.noResults')}</p>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={`${item.group}-${item.id}`}>
              {header && <p className="px-3 pt-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted uppercase">{header}</p>}
              <button
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={item.run}
                className={cx('flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-start text-sm transition', i === active ? 'bg-ink text-on-ink' : 'text-ink-2')}
              >
                <span className="grid w-7 place-items-center">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint}
              </button>
            </div>
          );
        })}
      </div>
      <p className="border-t border-line px-5 py-2.5 text-[11px] text-muted">{t('palette.hint')}</p>
    </Dialog>
  );
}
