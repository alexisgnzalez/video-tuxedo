import React from 'react';
import { staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

interface PaperGrainProps {
  /** If provided, limits the grain overlay strictly to this bounding box */
  width?: number;
  height?: number;
  /** Opacity of the grain (default 0.18) */
  opacity?: number;
  /** Unique ID for SVG pattern defs if using multiple on the same page */
  patternId?: string;
}

/**
 * Vintage Screen-Printed Paper Grain texture.
 * Uses pre-rendered seamless PNG tiles cycling at 12fps (poster-boil)
 * without expensive live SVG feTurbulence calculation.
 * Clean RGBA alpha is preserved for DaVinci Resolve transparent overlays.
 */
export const PaperGrain: React.FC<PaperGrainProps> = ({
  width = 1080,
  height = 1920,
  opacity = 0.22,
  patternId = 'paper-grain-pattern',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cycle through 3 grain textures at 12fps vintage boil
  const step = Math.floor((frame / Math.max(1, Math.round(fps / 12)))) % 3;
  const tileNumber = (step + 1).toString().padStart(2, '0');
  const grainSrc = staticFile(`textures/grain_${tileNumber}.png`);

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        zIndex: 99,
        mixBlendMode: 'multiply',
        opacity,
      }}
    >
      <defs>
        <pattern
          id={patternId}
          width="512"
          height="512"
          patternUnits="userSpaceOnUse"
        >
          <image
            href={grainSrc}
            width="512"
            height="512"
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${patternId})`} />
    </svg>
  );
};
