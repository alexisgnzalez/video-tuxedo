import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { VisualCue } from '../schema';

export const PunchlinePopup: React.FC<VisualCue> = ({
  headlineText,
  emojiOrIcon,
  accentColor,
  position,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const pop = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 220, mass: 0.6 },
  });

  const exit = spring({
    frame: frame - (durationInFrames - 8),
    fps,
    config: { damping: 200 },
  });

  const scale = Math.max(0, pop - exit);
  const wiggle = Math.sin(frame / 2.5) * 4; // subtle comedic wobble

  const positionStyle: React.CSSProperties =
    position === 'bottom-left'
      ? { bottom: 480, left: 60 }
      : position === 'bottom-right'
      ? { bottom: 480, right: 60 }
      : position === 'top'
      ? { top: 320, left: '50%', transform: `translateX(-50%) scale(${scale}) rotate(${wiggle}deg)` }
      : { top: '45%', left: '50%', transform: `translate(-50%, -50%) scale(${scale}) rotate(${wiggle}deg)` };

  const isCentered = position === 'top' || position === 'center';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...positionStyle,
          transform: isCentered ? positionStyle.transform : `scale(${scale}) rotate(${wiggle}deg)`,
          backgroundColor: accentColor,
          border: '6px solid #000000',
          borderRadius: 28,
          padding: '22px 36px',
          boxShadow: '12px 12px 0px #000000',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          zIndex: 50,
          maxWidth: 900,
        }}
      >
        <span style={{ fontSize: 82 }}>{emojiOrIcon}</span>
        <span
          style={{
            fontFamily: 'Inter, Montserrat, system-ui, sans-serif',
            fontSize: 54,
            fontWeight: 900,
            color: '#000000',
            textTransform: 'uppercase',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}
        >
          {headlineText}
        </span>
      </div>
    </AbsoluteFill>
  );
};
