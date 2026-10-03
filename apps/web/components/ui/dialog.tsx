'use client';

import { useEffect, type ReactNode } from 'react';
import { cx } from '.';

/** Centered modal (or side sheet) with blurred backdrop; Esc and backdrop click close it. */
export function Dialog({
  onClose,
  children,
  className,
  side,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  side?: boolean;
  label?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={cx('fixed inset-0 z-50 flex', side ? 'justify-end' : 'items-start justify-center px-4 pt-[12vh]')} role="dialog" aria-modal aria-label={label}>
      <div className="absolute inset-0 bg-[rgb(7_8_12/.35)] backdrop-blur-[3px] animate-[rise_.2s_ease]" onClick={onClose} />
      <div
        className={cx(
          'panel relative z-10 shadow-[0_30px_80px_-20px_rgb(0_0_0/.45)]',
          side ? 'm-2 h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-hidden animate-[slide_.35s_var(--ease-lumi)]' : 'rise w-full max-w-xl',
          className,
        )}
      >
        {children}
      </div>
      <style>{`@keyframes slide{from{transform:translateX(var(--slide,40px));opacity:0}to{transform:none;opacity:1}}[dir=rtl] [role=dialog]{--slide:-40px}`}</style>
    </div>
  );
}
