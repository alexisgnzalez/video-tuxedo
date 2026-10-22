import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

interface LowerThirdProps {
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
    offsetY?: number;
  };
}

export const EditorialLowerThird: React.FC<LowerThirdProps> = (cueProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headline = cueProps.props?.headlineText || cueProps.headlineText || 'Alexis González';
  const subtext = cueProps.props?.subText || cueProps.subText || 'Software Architect';

  const enter = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 160 },
  });

  const exit = spring({
    frame: frame - (durationInFrames - 8),
    fps,
    config: { damping: 200 },
  });

  const scale = Math.max(0, enter - exit);
  const slideY = interpolate(enter, [0, 1], [40, 0]);

  const bottomOffset = cueProps.placement?.offsetY || 320;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: bottomOffset,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `translateY(${slideY}px) scale(${scale})`,
          backgroundColor: 'rgba(12, 12, 14, 0.88)',
          borderLeft: '6px solid #D97757',
          borderRadius: 8,
          padding: '16px 28px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 320,
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontSize: cueProps.props?.fontSize || 48,
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.15,
          }}
        >
          {headline}
        </div>
        {subtext && (
          <div
            style={{
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontSize: 22,
              fontWeight: 500,
              color: '#A1A1AA',
            }}
          >
            {subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
