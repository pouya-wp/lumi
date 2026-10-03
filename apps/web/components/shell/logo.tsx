'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n-client';

export function Logo({ href }: { href?: string }) {
  const { t, locale } = useT();
  return (
    <Link href={href ?? `/${locale}`} className="flex items-center gap-2.5 font-bold">
      <img src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 drop-shadow-[0_6px_14px_rgba(79,91,255,.35)]" />
      <span className="text-lg">{t('brand')}</span>
    </Link>
  );
}
