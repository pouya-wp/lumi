/** Page covers are stored as a short key; each maps to a layered CSS background. */
export const COVERS: Record<string, string> = {
  aurora: 'radial-gradient(80% 120% at 0% 0%, #4F5BFF 0%, transparent 60%), radial-gradient(70% 120% at 100% 0%, #F97316 0%, transparent 55%), linear-gradient(120deg, #0B0C0F, #1d1f3a)',
  sunset: 'radial-gradient(90% 140% at 100% 100%, #F43F5E 0%, transparent 60%), linear-gradient(140deg, #FDBA74, #F97316 45%, #7C2D12)',
  mint: 'radial-gradient(70% 120% at 10% 100%, #22C55E 0%, transparent 60%), linear-gradient(150deg, #ECFDF5, #A7F3D0 50%, #0F766E)',
  ink: 'repeating-linear-gradient(135deg, rgb(255 255 255 / .07) 0 1px, transparent 1px 9px), linear-gradient(120deg, #0B0C0F, #23262f)',
  lilac: 'radial-gradient(60% 120% at 80% 0%, #C084FC 0%, transparent 60%), linear-gradient(160deg, #EEF2FF, #A5B4FC 55%, #4338CA)',
  sand: 'repeating-linear-gradient(45deg, rgb(0 0 0 / .045) 0 1px, transparent 1px 8px), linear-gradient(120deg, #FAF7F0, #EADBC8)',
};
export const COVER_KEYS = Object.keys(COVERS);
export const PAGE_EMOJIS = ['📄', '📝', '📚', '🧭', '🚀', '🎯', '💡', '🧪', '📊', '🗓️', '🤝', '🧠', '🛠️', '🎨', '📌', '✨', '🔥', '🌱', '🏁', '🪐'];
