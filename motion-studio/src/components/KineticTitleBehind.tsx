import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { calculateAdaptiveMotion } from '../utils/motionTiming';

export const KineticTitleBehind: React.FC<any> = (cue) => {
  const headline = cue.props?.headlineText || cue.headlineText || 'NARRATIVE HOOK';
  const color = cue.props?.color || cue.accentColor || '#FFE600';
  const fontSize = cue.props?.fontSize || 132;
  let topOffset = cue.placement?.y !== undefined ? cue.placement.y : (cue.placement?.offsetY || 220);
  if (cue.placement?.position === 'collarbone') topOffset = 1250;
  else if (cue.placement?.position === 'center') topOffset = 850;
  else if (cue.placement?.position === 'lower') topOffset = 1450;

  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adaptive timing: strict non-overlapping phases with guaranteed dwell window
  const { enter, scale } = calculateAdaptiveMotion(frame, fps, durationInFrames, {
    maxEnterFrames: 12,
    maxExitFrames: 8,
    damping: 12,
    stiffness: 200,
  });

  const translateY = interpolate(enter, [0, 1], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
          transform: `translateY(${translateY}px) scale(${Math.max(0, scale)})`,
          fontFamily: 'Impact, Montserrat, Inter, system-ui, sans-serif',
          fontSize,
          fontWeight: 900,
          lineHeight: 0.92,
          textAlign: 'center',
          textTransform: 'uppercase',
          color,
          WebkitTextStroke: '8px #000000',
          textShadow: '0px 18px 0px #000000, 0px 25px 40px rgba(0,0,0,0.65)',
          padding: '0 40px',
          letterSpacing: '-3px',
          maxWidth: 960,
          wordBreak: 'break-word',
        }}
      >
        {headline}
      </div>
    </AbsoluteFill>
  );
};
