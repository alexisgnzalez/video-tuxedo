import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { VisualCue } from '../schema';

export const ComicAlertBanner: React.FC<VisualCue> = ({
  headlineText,
  subText,
  emojiOrIcon,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });

  const exit = spring({
    frame: frame - (durationInFrames - 8),
    fps,
    config: { damping: 160 },
  });

  const scale = Math.max(0, enter - exit);
  const slideX = interpolate(enter, [0, 1], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 340,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          transform: `translateX(${slideX}px) scale(${scale}) rotate(-2deg)`,
          backgroundColor: accentColor,
          border: '7px solid #000000',
          borderRadius: 24,
          padding: '24px 44px',
          boxShadow: '14px 14px 0px #000000',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          maxWidth: 940,
        }}
      >
        <div
          style={{
            fontSize: 78,
            animation: 'none',
            transform: `scale(${1 + Math.sin(frame / 2.0) * 0.1})`,
          }}
        >
          {emojiOrIcon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'Impact, Montserrat, system-ui, sans-serif',
              fontSize: 58,
              fontWeight: 900,
              color: '#000000',
              textTransform: 'uppercase',
              lineHeight: 1,
              letterSpacing: '-1.5px',
            }}
          >
            {headlineText}
          </span>
          {subText && (
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 26,
                fontWeight: 700,
                color: '#1e293b',
                textTransform: 'uppercase',
                marginTop: 6,
                letterSpacing: '1px',
              }}
            >
              {subText}
            </span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
