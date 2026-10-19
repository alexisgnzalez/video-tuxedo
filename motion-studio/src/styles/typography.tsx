import React from 'react';
import { staticFile } from 'remotion';
import { PALETTE } from './palette';

/**
 * Self-hosted font face declarations matching public/fonts.
 * Ensures 100% offline rendering with full Spanish accent support (Á, É, Í, Ó, Ú, Ñ).
 */
export const FONT_FACES_CSS = `
@font-face {
  font-family: 'Federo';
  src: url('${staticFile('fonts/federo-latin-400-normal.woff2')}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Josefin Sans';
  src: url('${staticFile('fonts/josefin-sans-latin-600-normal.woff2')}') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Josefin Sans';
  src: url('${staticFile('fonts/josefin-sans-latin-400-normal.woff2')}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Jost';
  src: url('${staticFile('fonts/jost-latin-600-normal.woff2')}') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Montserrat';
  src: url('${staticFile('fonts/montserrat-latin-800-normal.woff2')}') format('woff2');
  font-weight: 800;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Montserrat';
  src: url('${staticFile('fonts/montserrat-latin-600-normal.woff2')}') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
`;

export const FONT_STACKS = {
  posterTitle: "'Josefin Sans', 'Federo', 'Jost', sans-serif",
  calloutHeader: "'Montserrat', 'Jost', sans-serif",
  monoTag: "'SF Mono', Menlo, Monaco, Consolas, monospace",
  bodySans: "'Jost', 'Montserrat', sans-serif",
} as const;

export const TYPOGRAPHY = {
  /**
   * Tier 1: Poster Title (CARACAS - El Ávila style)
   * Wide-tracked geometric sans, medium weight, NO drop shadow.
   */
  posterTitle: {
    fontFamily: FONT_STACKS.posterTitle,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: PALETTE.creamPaper,
    lineHeight: 1.1,
    margin: 0,
  },

  /**
   * Tier 1b: Poster Subtitle / Tagline
   * Clean tracked subtitle sitting beneath poster titles.
   */
  posterSubtitle: {
    fontFamily: FONT_STACKS.posterTitle,
    fontWeight: 400,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.28em',
    color: PALETTE.creamPaper,
    opacity: 0.92,
    margin: 0,
  },

  /**
   * Tier 2: Callout Header (floating over talking head)
   * High-contrast heavyweight sans with brutalist solid drop shadow.
   */
  calloutHeader: {
    fontFamily: FONT_STACKS.calloutHeader,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.14em',
    color: PALETTE.creamPaper,
    textShadow: `4px 4px 0px ${PALETTE.abyssalBlue}`,
    lineHeight: 1.15,
    margin: 0,
  },

  /**
   * Tier 3: Brutalist Tag / Category Badge
   * Monospace or tracked sans housed inside solid block tags.
   */
  tag: {
    fontFamily: FONT_STACKS.monoTag,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    fontSize: 18,
    color: PALETTE.creamPaper,
    margin: 0,
  },

  /**
   * Tier 4: Bullet list text / explanation item
   */
  bullet: {
    fontFamily: FONT_STACKS.bodySans,
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: PALETTE.creamPaper,
    lineHeight: 1.35,
    margin: 0,
  },
} as const;

/** Helper component injecting font definitions into Remotion DOM */
export const FontLoader: React.FC = () => {
  return <style dangerouslySetInnerHTML={{ __html: FONT_FACES_CSS }} />;
};
