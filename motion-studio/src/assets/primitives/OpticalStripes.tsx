import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { KINETIC_CYCLE, PALETTE } from '../../styles/palette';

interface OpticalStripesProps {
  width: number;
  height: number;
  stripeWidth?: number;
  colors?: readonly string[];
  angle?: 0 | 45 | -45;
  speed?: number; // pixels per second
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Cruz-Diez Physichromie Optical Stripes.
 * Creates rhythmic optical colour bands cycling through strict palette tones.
 * Stripe animation runs at native fps for smooth moiré shimmer.
 */
export const OpticalStripes: React.FC<OpticalStripesProps> = ({
  width,
  height,
  stripeWidth = 14,
  colors = KINETIC_CYCLE,
  angle = 0,
  speed = 18,
  style,
}) => {
  const frame = useCurrentFrame();

  const cycleLength = colors.length * stripeWidth;
  const offset = (frame * (speed / 30)) % cycleLength;

  // Generate stripe slices
  const count = Math.ceil((width + (angle !== 0 ? height : 0) + cycleLength * 2) / stripeWidth);
  const stripes: React.ReactNode[] = [];

  for (let i = -colors.length; i < count; i++) {
    const color = colors[((i % colors.length) + colors.length) % colors.length];
    const x = i * stripeWidth + offset;

    stripes.push(
      <rect
        key={i}
        x={x}
        y={-height}
        width={stripeWidth}
        height={height * 3}
        fill={color}
      />
    );
  }

  const transform = angle !== 0 ? `rotate(${angle} ${width / 2} ${height / 2})` : undefined;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'block',
        overflow: 'hidden',
        border: `3px solid ${PALETTE.abyssalBlue}`,
        backgroundColor: PALETTE.abyssalBlue,
        ...style,
      }}
    >
      <g transform={transform}>
        {stripes}
      </g>
    </svg>
  );
};
