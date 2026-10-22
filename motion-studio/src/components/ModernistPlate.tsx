import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

interface ModernistPlateProps {
  headlineText?: string;
  subText?: string;
  props?: {
    headlineText?: string;
    subText?: string;
    color?: string;
    fontSize?: number;
  };
  placement?: {
    position?: string;
    offsetX?: number;
    offsetY?: number;
  };
}

/**
 * Caracas Modernist Architectural Plate (1957)
 * Features dark charcoal floating panel with terracotta accent bar and Swiss typography.
 */
export const ModernistPlate: React.FC<ModernistPlateProps> = (cueProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headline = cueProps.props?.headlineText || cueProps.headlineText || 'AURA Y RITMO';
  const subtext = cueProps.props?.subText || cueProps.subText || 'CARACAS 1957';
  const terracotta = '#E2725B';

  const pop = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });

  const exit = spring({
    frame: frame - (durationInFrames - 8),
    fps,
    config: { damping: 200 },
  });

  const scale = Math.max(0, pop - exit);
  const slideX = interpolate(pop, [0, 1], [-80, 0]);

  const bottomOffset = cueProps.placement?.offsetY || 380;
  const leftOffset = cueProps.placement?.offsetX || 60;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          left: leftOffset,
          transform: `translateX(${slideX}px) scale(${scale})`,
          backgroundColor: 'rgba(20, 20, 19, 0.92)',
          borderLeft: `8px solid ${terracotta}`,
          borderRadius: 4,
          padding: '18px 28px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: 620,
        }}
      >
        <div
          style={{
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: cueProps.props?.fontSize || 54,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#FAF9F5',
            lineHeight: 1.1,
          }}
        >
          {headline}
        </div>
        {subtext && (
          <div
            style={{
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: terracotta,
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
