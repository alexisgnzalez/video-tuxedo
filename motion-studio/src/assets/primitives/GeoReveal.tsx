import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING } from '../../styles/palette';

export type RevealStyle =
  | 'wipe-right'
  | 'wipe-up'
  | 'scale-y'
  | 'stepped-rise'
  | 'stamp';

interface GeoRevealProps {
  children: React.ReactNode;
  delay?: number;
  revealStyle?: RevealStyle;
  style?: React.CSSProperties;
}

/**
 * Geometric Reveal Wrapper.
 * Provides snappy Mid-Century polygon wipes and spring reveals
 * using unified KINETIC_SPRING physics.
 */
export const GeoReveal: React.FC<GeoRevealProps> = ({
  children,
  delay = 0,
  revealStyle = 'wipe-up',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: KINETIC_SPRING,
  });

  let clipPath: string | undefined;
  let transform: string | undefined;
  let opacity = 1;

  if (revealStyle === 'wipe-up') {
    const bottomCut = interpolate(progress, [0, 1], [100, 0], {
      extrapolateRight: 'clamp',
    });
    clipPath = `polygon(0% 0%, 100% 0%, 100% ${100 - bottomCut}%, 0% ${100 - bottomCut}%)`;
    transform = `translateY(${interpolate(progress, [0, 1], [30, 0], {
      extrapolateRight: 'clamp',
    })}px)`;
  } else if (revealStyle === 'wipe-right') {
    const rightCut = interpolate(progress, [0, 1], [0, 100], {
      extrapolateRight: 'clamp',
    });
    clipPath = `polygon(0% 0%, ${rightCut}% 0%, ${rightCut}% 100%, 0% 100%)`;
  } else if (revealStyle === 'scale-y') {
    const scaleY = interpolate(progress, [0, 1], [0, 1], {
      extrapolateRight: 'clamp',
    });
    transform = `scaleY(${scaleY})`;
  } else if (revealStyle === 'stamp') {
    const scale = interpolate(progress, [0, 1], [1.3, 1], {
      extrapolateRight: 'clamp',
    });
    opacity = interpolate(progress, [0, 0.4, 1], [0, 1, 1]);
    transform = `scale(${scale})`;
  } else if (revealStyle === 'stepped-rise') {
    // Vintage 12fps stepped rise
    const steppedP = Math.floor(progress * 8) / 8;
    transform = `translateY(${(1 - steppedP) * 50}px)`;
    opacity = steppedP > 0 ? 1 : 0;
  }

  return (
    <div
      style={{
        clipPath,
        transform,
        transformOrigin: 'bottom center',
        opacity,
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
