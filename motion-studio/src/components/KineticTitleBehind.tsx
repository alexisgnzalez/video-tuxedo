import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { VisualCue } from '../schema';

export const KineticTitleBehind: React.FC<VisualCue> = ({
  headlineText,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Snappy entrance spring
  const enter = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 180, mass: 0.7 },
  });

  // Clean exit spring in the final 10 frames
  const exit = spring({
    frame: frame - (durationInFrames - 10),
    fps,
    config: { damping: 20, stiffness: 220 },
  });

  const scale = enter - exit;
  const translateY = interpolate(enter, [0, 1], [120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 220,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `translateY(${translateY}px) scale(${Math.max(0, scale)})`,
          fontFamily: 'Impact, Montserrat, Inter, system-ui, sans-serif',
          fontSize: 155,
          fontWeight: 900,
          lineHeight: 0.92,
          textAlign: 'center',
          textTransform: 'uppercase',
          color: accentColor,
          WebkitTextStroke: '8px #000000',
          textShadow: '0px 18px 0px #000000, 0px 25px 40px rgba(0,0,0,0.65)',
          padding: '0 40px',
          letterSpacing: '-3px',
          maxWidth: 960,
          wordBreak: 'break-word',
        }}
      >
        {headlineText}
      </div>
    </AbsoluteFill>
  );
};
