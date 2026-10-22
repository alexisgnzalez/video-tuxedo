import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

interface KineticHeaderProps {
  headlineText?: string;
  subText?: string;
  color?: string;
  accentColor?: string;
  props?: {
    headlineText?: string;
    subText?: string;
    color?: string;
    fontSize?: number;
  };
  placement?: {
    position?: string;
    offsetY?: number;
  };
}

/**
 * Caracas Mid-Century Kinetic Header (1957 Modernist)
 * Inspired by Carlos Raúl Villanueva and Carlos Cruz-Diez cinetismo.
 * Features architectural Swiss typography and animated terracotta / navy cinetismo slats.
 */
export const KineticHeader: React.FC<KineticHeaderProps> = (cueProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headline = cueProps.props?.headlineText || cueProps.headlineText || 'EL ÁVILA';
  const subtext = cueProps.props?.subText || cueProps.subText || 'CINETISMO MODERNO';
  const primaryColor = cueProps.props?.color || cueProps.color || '#FAF9F5';
  const terracotta = '#E2725B';
  const avilaNavy = '#2B4C7E';

  // Kinetic spring in
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.8 },
  });

  // Smooth exit
  const exitSpring = spring({
    frame: frame - (durationInFrames - 10),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  const progress = Math.max(0, enterSpring - exitSpring);
  const slideY = interpolate(progress, [0, 1], [-60, 0]);
  const barWidth = interpolate(progress, [0, 1], [0, 100]);

  const topOffset = cueProps.placement?.offsetY || 240;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: topOffset,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `translateY(${slideY}px)`,
          opacity: progress,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Animated Cruz-Diez Cinetismo Geometric Slats */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            height: 10,
            width: `${barWidth}%`,
            maxWidth: 580,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: i % 2 === 0 ? terracotta : avilaNavy,
                transform: `skewX(-24deg) scaleY(${Math.sin((frame + i * 3) / 8) * 0.3 + 0.85})`,
                transition: 'transform 0.1s',
              }}
            />
          ))}
        </div>

        {/* Main Architectural Headline */}
        <div
          style={{
            fontFamily: '"Helvetica Neue", Arial, -apple-system, sans-serif',
            fontSize: cueProps.props?.fontSize || 84,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: primaryColor,
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.85)',
            textAlign: 'center',
            padding: '0 30px',
            lineHeight: 1.05,
          }}
        >
          {headline}
        </div>

        {/* Subtitle Plate */}
        {subtext && (
          <div
            style={{
              backgroundColor: terracotta,
              color: '#FAF9F5',
              padding: '6px 20px',
              borderRadius: 3,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5)',
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
