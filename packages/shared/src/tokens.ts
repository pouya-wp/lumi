/** Design tokens — source of truth: docs/DESIGN.md. Mirrored in apps/mobile/lib/core/theme. */
export const colors = {
  light: {
    primary: '#3D5AFE',
    primarySoft: '#EEF1FF',
    ink: '#0E1330',
    inkMuted: '#6B7194',
    surface: '#FFFFFF',
    surfaceRaised: '#F7F8FC',
  },
  dark: {
    primary: '#6C83FF',
    primarySoft: '#1C2250',
    ink: '#F2F4FF',
    inkMuted: '#9AA0C3',
    surface: '#0B0E22',
    surfaceRaised: '#141838',
  },
  night: ['#0A0F3C', '#1B1F6B'],
  pastel: {
    tasks: { bg: '#EEF0FF', accent: '#5B5BF0' },
    calendar: { bg: '#FFEFF1', accent: '#F2557A' },
    notes: { bg: '#FFF8DB', accent: '#E8A300' },
    daily: { bg: '#E6F8FB', accent: '#14A8C8' },
    goals: { bg: '#E9F9EF', accent: '#1DB46A' },
    time: { bg: '#FFF0E6', accent: '#FF7A2F' },
  },
  priority: { URGENT: '#FF4D4F', HIGH: '#FF8A00', MEDIUM: '#3D5AFE', LOW: '#9AA0C3', NONE: '#C9CCE0' },
} as const;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32 } as const;
