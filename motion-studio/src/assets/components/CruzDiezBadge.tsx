import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OpticalStripes } from '../primitives/OpticalStripes';
import { KINETIC_CYCLE, KINETIC_SPRING, PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface CruzDiezBadgeProps {
  title?: string;
  subtitle?: string;
  size?: number;
  colorCycle?: readonly string[];
  shape?: 'octagon' | 'circle' | 'square';
  style?: React.CSSProperties;
}

/**
 * CruzDiezBadge — Venezuelan Kinetic Art optical moiré badge.
 * Octagonal or circular badge with rotating Physichromie stripes
 * and high-contrast brutalist typography banner.
 */
export const CruzDiezBadge: React.FC<CruzDiezBadgeProps> = ({
  title = 'KINETIC',
  subtitle,
  size = 280,
  colorCycle = KINETIC_CYCLE,
  shape = 'octagon',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const scale = interpolate(entrance, [0, 1], [0.4, 1], {
    extrapolateRight: 'clamp',
  });
  const rotation = interpolate(entrance, [0, 1], [-25, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 1, 1]);

  let clipPath: string | undefined;
  let borderRadius: string | undefined;

  if (shape === 'circle') {
    borderRadius = '50%';
  } else if (shape === 'octagon') {
    clipPath =
      'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        opacity,
        ...style,
      }}
    >
      {/* Outer hard shadow */}
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          top: 8,
          left: 8,
          backgroundColor: PALETTE.abyssalBlue,
          clipPath,
          borderRadius,
          zIndex: 1,
        }}
      />

      {/* Main Kinetic striped badge body */}
      <div
        style={{
          position: 'absolute',
          width: size,
          height: size,
          top: 0,
          left: 0,
          clipPath,
          borderRadius,
          border: `4px solid ${PALETTE.abyssalBlue}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <OpticalStripes
          width={size}
          height={size}
          stripeWidth={12}
          colors={colorCycle}
          speed={22}
          angle={45}
        />
      </div>

      {/* Inner concentric ring */}
      <div
        style={{
          position: 'absolute',
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: '50%',
          border: `3px solid ${PALETTE.creamPaper}`,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* Center typography banner */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          backgroundColor: PALETTE.abyssalBlue,
          border: `3px solid ${PALETTE.creamPaper}`,
          padding: '8px 18px',
          textAlign: 'center',
          boxShadow: `3px 3px 0px ${PALETTE.terracotta}`,
          maxWidth: size * 0.9,
        }}
      >
        <div
          style={{
            ...TYPOGRAPHY.calloutHeader,
            fontSize: Math.max(16, Math.min(32, size * 0.12)),
            letterSpacing: '0.16em',
            textShadow: 'none',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              ...TYPOGRAPHY.tag,
              fontSize: Math.max(12, Math.min(18, size * 0.07)),
              color: PALETTE.warmOchre,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
