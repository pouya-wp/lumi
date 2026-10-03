'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n-client';

export function Logo({ href }: { href?: string }) {
  const { t, locale } = useT();
  return (
    <Link href={href ?? `/${locale}`} className="flex items-center gap-2.5 font-bold">
      <span className="relative grid size-9 place-items-center rounded-[12px] bg-ink text-on-ink">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
        </svg>
        <span className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full bg-lumi shadow-[0_0_10px_var(--lumi)]" />
      </span>
      <span className="text-lg">{t('brand')}</span>
    </Link>
  );
}
