import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { OpticalStripes } from '../primitives/OpticalStripes';
import { KINETIC_CYCLE, KINETIC_SPRING, PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface BrutalistLowerThirdProps {
  text?: string;
  subtext?: string;
  category?: string;
  accentColor?: string;
  width?: number;
  style?: React.CSSProperties;
}

/**
 * BrutalistLowerThird — Heavy concrete & rust lower third slab.
 * Positioned in Zone B over the speaker's lower chest, capped by animated optical stripes.
 */
export const BrutalistLowerThird: React.FC<BrutalistLowerThirdProps> = ({
  text = 'ALEXIS GONZÁLEZ',
  subtext = 'CREADOR & EDITOR',
  category,
  accentColor = PALETTE.terracotta,
  width = 720,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const translateX = interpolate(entrance, [0, 1], [-60, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 1, 1]);

  return (
    <div
      style={{
        width,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transform: `translateX(${translateX}px)`,
        opacity,
        filter: `drop-shadow(6px 6px 0px ${PALETTE.abyssalBlue})`,
        ...style,
      }}
    >
      {/* Category / Super-title pill tag if provided */}
      {category && (
        <div
          style={{
            alignSelf: 'flex-start',
            backgroundColor: accentColor,
            border: `3px solid ${PALETTE.abyssalBlue}`,
            borderBottom: 'none',
            padding: '4px 14px',
            ...TYPOGRAPHY.tag,
            fontSize: 13,
            color: PALETTE.creamPaper,
          }}
        >
          {category}
        </div>
      )}

      {/* Main Structural Slab */}
      <div
        style={{
          display: 'flex',
          backgroundColor: PALETTE.abyssalBlue,
          border: `4px solid ${PALETTE.abyssalBlue}`,
          overflow: 'hidden',
        }}
      >
        {/* Left Optical Stripe Accent Spine */}
        <div style={{ width: 28, height: '100%', minHeight: 90 }}>
          <OpticalStripes
            width={28}
            height={120}
            stripeWidth={7}
            colors={KINETIC_CYCLE}
            speed={24}
            style={{ border: 'none' }}
          />
        </div>

        {/* Text Content Block */}
        <div
          style={{
            flex: 1,
            backgroundColor: PALETTE.skyTeal,
            padding: '14px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderLeft: `3px solid ${PALETTE.creamPaper}`,
          }}
        >
          <div
            style={{
              ...TYPOGRAPHY.calloutHeader,
              fontSize: 32,
              letterSpacing: '0.14em',
              textShadow: 'none',
              color: PALETTE.creamPaper,
            }}
          >
            {text}
          </div>
          {subtext && (
            <div
              style={{
                ...TYPOGRAPHY.tag,
                fontSize: 16,
                letterSpacing: '0.22em',
                color: PALETTE.warmOchre,
                marginTop: 4,
              }}
            >
              {subtext}
            </div>
          )}
        </div>

        {/* Right Geometric Corner Notch */}
        <div
          style={{
            width: 32,
            backgroundColor: PALETTE.terracotta,
            borderLeft: `3px solid ${PALETTE.abyssalBlue}`,
          }}
        />
      </div>

      {/* Bottom Concrete Underline */}
      <div
        style={{
          height: 6,
          backgroundColor: PALETTE.concreteGrey,
          border: `2px solid ${PALETTE.abyssalBlue}`,
          borderTop: 'none',
        }}
      />
    </div>
  );
};
