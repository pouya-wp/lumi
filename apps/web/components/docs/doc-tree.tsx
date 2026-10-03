'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/lib/i18n-client';
import { useDocs } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useUi } from '@/lib/ui-state';
import type { DocBrief } from '@/lib/types';
import { cx, Icon } from '../ui';
import { useCreateDoc } from './use-create-doc';

/** Nested page tree for the sidebar; pages expand to show their sub-pages. */
export function DocTree() {
  const { workspace } = useSession();
  const docs = useDocs(workspace?.id).data ?? [];
  const pages = docs.filter((d) => d.kind === 'PAGE');
  const roots = pages.filter((d) => !d.parentId || !pages.some((p) => p.id === d.parentId));
  return (
    <div className="flex flex-col">
      {roots.slice(0, 12).map((d) => (
        <Node key={d.id} doc={d} all={pages} depth={0} />
      ))}
    </div>
  );
}

function Node({ doc, all, depth }: { doc: DocBrief; all: DocBrief[]; depth: number }) {
  const { t, locale } = useT();
  const { setNavOpen } = useUi();
  const pathname = usePathname();
  const { create } = useCreateDoc();
  const href = `/${locale}/app/docs/${doc.id}`;
  const kids = all.filter((d) => d.parentId === doc.id);
  const active = pathname === href;
  const [open, setOpen] = useState(() => kids.some((k) => pathname.includes(k.id)));
  return (
    <>
      <div
        className={cx('group flex h-8 items-center gap-1 rounded-full pe-1 text-[13px] transition', active ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-sunken')}
        style={{ paddingInlineStart: depth * 14 + 6 }}
      >
        <button
          onClick={() => setOpen(!open)}
          className={cx('grid size-5 shrink-0 place-items-center rounded-md opacity-50 hover:opacity-100', !kids.length && 'invisible')}
          aria-label="toggle"
        >
          <Icon name="chevronDown" size={12} className={cx('transition', !open && '-rotate-90 rtl:rotate-90')} />
        </button>
        <Link href={href} onClick={() => setNavOpen(false)} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[13px]">{doc.icon ?? '📄'}</span>
          <span className="truncate">{doc.title || t('docs.untitled')}</span>
        </Link>
        <button
          onClick={() => {
            setOpen(true);
            create('blank', doc.id);
          }}
          className="grid size-6 shrink-0 place-items-center rounded-full opacity-0 transition group-hover:opacity-70 hover:!opacity-100"
          aria-label={t('docs.blocks.subpage')}
        >
          <Icon name="plus" size={13} />
        </button>
      </div>
      {open && kids.map((k) => <Node key={k.id} doc={k} all={all} depth={depth + 1} />)}
    </>
  );
}
