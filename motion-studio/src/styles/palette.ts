/**
 * Strict Mid-Century Kinetic Poster palette.
 * Every SVG/HTML colour in the motion library MUST come from here
 * (enforced by scripts/palette-lint.mjs).
 */
export const PALETTE = {
  transparent: 'transparent', // Required for DaVinci Resolve alpha overlays
  skyTeal: '#1D6376', // Deep vintage teal background / primary card fill
  creamPaper: '#F3D7A6', // Typography, clouds, highlights, and primary strokes
  warmOchre: '#DDA059', // Mid-tone mountain facets & architecture
  terracotta: '#B64B26', // Shadow mountain facets & earthy accents
  deepRust: '#7A2E18', // Deep earth shadows & callout borders
  forestGreen: '#1D422E', // Lush foliage & mountain base shadows
  abyssalBlue: '#12202F', // Deepest structural shadows & dark text backing
  concreteGrey: '#C5B49A', // Brutalist roads, viaducts, and structural frames
  kineticRed: '#D9381E', // Optical stripe accent 1 (High Alert / Key Point)
  kineticGreen: '#007A53', // Optical stripe accent 2 (Growth / Secondary Point)
  kineticBlue: '#1B4D89', // Optical stripe accent 3 (Technical / Structural)
  barrioBlue: '#9DB8C4', // Petare house facades (pale powder blue) — vertical addendum
} as const;

export type PaletteKey = keyof typeof PALETTE;
export type PaletteColor = (typeof PALETTE)[PaletteKey];

/** Cruz-Diez Physichromie stripe cycle. */
export const KINETIC_CYCLE: string[] = [
  PALETTE.kineticRed,
  PALETTE.creamPaper,
  PALETTE.kineticGreen,
  PALETTE.creamPaper,
  PALETTE.kineticBlue,
  PALETTE.creamPaper,
];

/** Unified snappy brutalist spring for every card/banner/block entrance. */
export const KINETIC_SPRING = {damping: 14, mass: 0.8, stiffness: 160} as const;

/**
 * Poster-feel stepping: holds each drawing for N frames so character/object
 * entrances read as 12–15fps vintage animation, whatever the source fps is.
 * Optical stripe shimmer must NOT use this (keep it at native fps).
 */
export const steppedFrame = (frame: number, fps: number, posterFps = 12): number => {
  const hold = Math.max(1, Math.round(fps / posterFps));
  return Math.floor(frame / hold) * hold;
};

/** Resolve a palette key or pass through a palette hex (rejects anything else). */
export const paletteColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  if (value in PALETTE) return PALETTE[value as PaletteKey];
  const upper = value.toUpperCase();
  const match = (Object.values(PALETTE) as string[]).find((c) => c.toUpperCase() === upper);
  return match ?? fallback;
};
