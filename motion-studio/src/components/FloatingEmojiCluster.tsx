import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { calculateAdaptiveMotion } from '../utils/motionTiming';
import { VisualCue } from '../schema';

export const FloatingEmojiCluster: React.FC<VisualCue> = ({
  headlineText,
  emojiOrIcon,
  accentColor,
  position,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { scale, isResting } = calculateAdaptiveMotion(frame, fps, durationInFrames, {
    maxEnterFrames: 10,
    maxExitFrames: 7,
    damping: 10,
    stiffness: 240,
    mass: 0.5,
  });

  const floatY = isResting ? Math.sin(frame / 3.0) * 12 : 0;

  // Render multiple emojis orbiting
  const emojis = [emojiOrIcon, emojiOrIcon, emojiOrIcon];

  const posStyle: React.CSSProperties =
    position === 'bottom-left'
      ? { bottom: 460, left: 80 }
      : position === 'bottom-right'
      ? { bottom: 460, right: 80 }
      : { top: 380, left: '50%', transform: `translateX(-50%)` };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...posStyle,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          transform: `scale(${scale}) translateY(${floatY}px)`,
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {emojis.map((em, idx) => {
            const stagger = spring({
              frame: frame - idx * 2,
              fps,
              config: { damping: 8, stiffness: 220 },
            });
            const rot = (idx - 1) * 18 + Math.sin((frame + idx * 5) / 4) * 8;
            return (
              <span
                key={idx}
                style={{
                  fontSize: idx === 1 ? 96 : 74,
                  transform: `scale(${Math.max(0, stagger)}) rotate(${rot}deg)`,
                  filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.5))',
                }}
              >
                {em}
              </span>
            );
          })}
        </div>

        {headlineText && (
          <div
            style={{
              backgroundColor: accentColor,
              color: '#000000',
              fontFamily: 'Impact, Inter, system-ui, sans-serif',
              fontSize: 48,
              fontWeight: 900,
              padding: '12px 28px',
              borderRadius: 20,
              border: '5px solid #000000',
              boxShadow: '8px 8px 0px #000000',
              textTransform: 'uppercase',
              letterSpacing: '-1px',
            }}
          >
            {headlineText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
