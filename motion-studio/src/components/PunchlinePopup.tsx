import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { calculateAdaptiveMotion } from '../utils/motionTiming';

export const PunchlinePopup: React.FC<any> = (cue) => {
  const headline = cue.props?.headlineText || cue.headlineText || 'TRÁGAME TIERRA 💀';
  const emoji = cue.props?.emoji || cue.emojiOrIcon || '';
  const bg = cue.props?.color || cue.accentColor || '#FFE600';
  const position = cue.placement?.position || cue.position || 'bottom-right';

  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { scale, isResting } = calculateAdaptiveMotion(frame, fps, durationInFrames, {
    maxEnterFrames: 10,
    maxExitFrames: 7,
    damping: 11,
    stiffness: 240,
    mass: 0.5,
  });

  const wiggle = isResting ? Math.sin(frame / 2.5) * 3 : 0; // Gentle comedic wobble only during dwell window

  const customY = cue.placement?.y !== undefined ? cue.placement.y : (cue.placement?.offsetY !== undefined ? cue.placement.offsetY : undefined);
  const customX = cue.placement?.x !== undefined ? cue.placement.x : (cue.placement?.offsetX !== undefined ? cue.placement.offsetX : undefined);

  let positionStyle: React.CSSProperties;
  let isCentered = false;

  if (customY !== undefined) {
    if (customX !== undefined) {
      positionStyle = { top: customY, left: customX };
    } else {
      isCentered = true;
      positionStyle = { top: customY, left: '50%', transform: `translateX(-50%) scale(${scale}) rotate(${wiggle}deg)` };
    }
  } else if (position === 'collarbone') {
    isCentered = true;
    positionStyle = { bottom: 620, left: '50%', transform: `translateX(-50%) scale(${scale}) rotate(${wiggle}deg)` };
  } else if (position === 'lower' || position === 'lower-third') {
    isCentered = true;
    positionStyle = { bottom: 340, left: '50%', transform: `translateX(-50%) scale(${scale}) rotate(${wiggle}deg)` };
  } else if (position === 'bottom-left') {
    positionStyle = { bottom: 480, left: 60 };
  } else if (position === 'bottom-right') {
    positionStyle = { bottom: 480, right: 60 };
  } else if (position === 'top') {
    isCentered = true;
    positionStyle = { top: 320, left: '50%', transform: `translateX(-50%) scale(${scale}) rotate(${wiggle}deg)` };
  } else {
    isCentered = true;
    positionStyle = { top: '45%', left: '50%', transform: `translate(-50%, -50%) scale(${scale}) rotate(${wiggle}deg)` };
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...positionStyle,
          transform: isCentered ? positionStyle.transform : `scale(${scale}) rotate(${wiggle}deg)`,
          backgroundColor: bg,
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
        {emoji ? <span style={{ fontSize: 72 }}>{emoji}</span> : null}
        <span
          style={{
            fontFamily: 'Impact, Montserrat, system-ui, sans-serif',
            fontSize: cue.props?.fontSize || 54,
            fontWeight: 900,
            color: '#000000',
            textTransform: 'uppercase',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}
        >
          {headline}
        </span>
      </div>
    </AbsoluteFill>
  );
};
