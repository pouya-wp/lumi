/** Design tokens — source of truth: docs/DESIGN.md. Mirrored in apps/mobile/lib/core/theme. */
export const colors = {
  light: {
    canvas: '#F1F2F4',
    panel: '#FFFFFF',
    panelSunken: '#F7F8FA',
    ink: '#0B0C0F',
    ink2: '#3A3D45',
    muted: '#8A8F99',
    line: '#E8E9EC',
  },
  dark: {
    canvas: '#07080C',
    panel: '#111319',
    panelSunken: '#181B23',
    ink: '#F4F5F7',
    ink2: '#C9CCD3',
    muted: '#7D8390',
    line: '#22252E',
  },
  lumi: '#4F5BFF',
  success: { base: '#16A34A', soft: '#DCFCE7' },
  warn: { base: '#F97316', soft: '#FFEDD5' },
  danger: { base: '#EF4444', soft: '#FEE2E2' },
  info: { base: '#0EA5E9', soft: '#E0F2FE' },
  aurora: {
    tasks: '#4F5BFF',
    calendar: '#F43F5E',
    goals: '#16A34A',
    time: '#F97316',
    docs: '#EAB308',
    ai: '#8B5CF6',
  },
  priority: { URGENT: '#EF4444', HIGH: '#F97316', MEDIUM: '#4F5BFF', LOW: '#8A8F99', NONE: '#C4C7CE' },
} as const;

export const radius = { frame: 28, panel: 22, inner: 14, pill: 999 } as const;
