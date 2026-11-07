import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { calculateAdaptiveMotion } from '../utils/motionTiming';

interface SubtlePillProps {
  headlineText?: string;
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

export const SubtlePill: React.FC<SubtlePillProps> = (cueProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const text = cueProps.props?.headlineText || cueProps.headlineText || 'CHAPTER 01';
  const color = cueProps.props?.color || '#D97757';

  const { scale } = calculateAdaptiveMotion(frame, fps, durationInFrames, {
    maxEnterFrames: 10,
    maxExitFrames: 7,
    damping: 12,
    stiffness: 220,
  });

  let topOffset = cueProps.placement?.y !== undefined ? cueProps.placement.y : (cueProps.placement?.offsetY || 200);
  if (cueProps.placement?.position === 'collarbone') topOffset = 1350;
  else if (cueProps.placement?.position === 'lower') topOffset = 1550;
  else if (cueProps.placement?.position === 'center') topOffset = 960;
  const rightOffset = cueProps.placement?.offsetX || 60;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: topOffset,
          right: rightOffset,
          transform: `scale(${scale})`,
          backgroundColor: 'rgba(15, 15, 17, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 9999,
          padding: '10px 22px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        <div
          style={{
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: cueProps.props?.fontSize || 24,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
