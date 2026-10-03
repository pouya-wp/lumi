'use client';

const COLORS = ['#4F5BFF', '#F97316', '#16A34A', '#F43F5E', '#EAB308', '#8B5CF6'];

/** A short confetti burst from a point (defaults to screen centre); respects reduced motion. */
export function celebrate(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 34) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    const size = 5 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 220;
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${COLORS[i % COLORS.length]};border-radius:${Math.random() > 0.6 ? '50%' : '2px'}`;
    layer.appendChild(p);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * speed}px, ${Math.sin(angle) * speed - 80}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${Math.cos(angle) * speed * 1.2}px, ${Math.sin(angle) * speed + 160}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    );
  }
  setTimeout(() => layer.remove(), 1800);
}

let lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
}
/** Burst from wherever the user last clicked or tapped. */
export const celebrateAtPointer = () => (lastPointer.x ? celebrate(lastPointer.x, lastPointer.y) : celebrate());
