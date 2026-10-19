import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OpticalStripes } from '../primitives/OpticalStripes';
import { KINETIC_CYCLE, KINETIC_SPRING, PALETTE } from '../../styles/palette';

export interface CruzDiezWallProps {
  width?: number;
  height?: number;
  speed?: number;
  style?: React.CSSProperties;
}

/**
 * CruzDiezWall — Iconic architectural stripe wall from the Caracas posters.
 * Combines vertical Physichromie color columns with a dynamic 45° diagonal section.
 */
export const CruzDiezWall: React.FC<CruzDiezWallProps> = ({
  width = 640,
  height = 180,
  speed = 18,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 1, 1]);

  const leftW = Math.round(width * 0.38);
  const diagW = Math.round(width * 0.32);
  const rightW = width - (leftW + diagW);

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        border: `4px solid ${PALETTE.abyssalBlue}`,
        boxShadow: `6px 6px 0px ${PALETTE.abyssalBlue}`,
        overflow: 'hidden',
        backgroundColor: PALETTE.abyssalBlue,
        transform: `translateY(${translateY}px)`,
        opacity,
        ...style,
      }}
    >
      {/* 1. Left Vertical Stripes Section */}
      <div style={{ width: leftW, height, overflow: 'hidden' }}>
        <OpticalStripes
          width={leftW}
          height={height}
          stripeWidth={12}
          colors={KINETIC_CYCLE}
          speed={speed}
          angle={0}
          style={{ border: 'none' }}
        />
      </div>

      {/* 2. Middle 45° Diagonal Stripes Section */}
      <div
        style={{
          width: diagW,
          height,
          overflow: 'hidden',
          borderLeft: `3px solid ${PALETTE.abyssalBlue}`,
          borderRight: `3px solid ${PALETTE.abyssalBlue}`,
        }}
      >
        <OpticalStripes
          width={diagW}
          height={height}
          stripeWidth={12}
          colors={KINETIC_CYCLE}
          speed={speed}
          angle={45}
          style={{ border: 'none' }}
        />
      </div>

      {/* 3. Right Vertical Stripes Section */}
      <div style={{ width: rightW, height, overflow: 'hidden' }}>
        <OpticalStripes
          width={rightW}
          height={height}
          stripeWidth={12}
          colors={KINETIC_CYCLE}
          speed={speed}
          angle={0}
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};
