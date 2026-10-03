'use client';

import { useEffect } from 'react';

/** Feeds pointer position into the hovered `.panel` as --mx/--my for the cursor-light effect. */
export function Spotlight() {
  useEffect(() => {
    if (matchMedia('(pointer: coarse)').matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = (e.target as Element | null)?.closest?.('.panel') as HTMLElement | null;
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        panel.style.setProperty('--my', `${e.clientY - rect.top}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);
  return null;
}
