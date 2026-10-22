import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ImageLayerProps } from '../editSchema';

export const ImageLayer: React.FC<ImageLayerProps> = ({
  src,
  x,
  y,
  scale = 1.0,
  rotation = 0,
  opacity = 1.0,
  enter = 'pop',
  exit = 'fade',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Enter spring (local sequence frames)
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.7 },
  });

  // Exit spring in the last 8 frames
  const exitSpring = spring({
    frame: frame - (durationInFrames - 8),
    fps,
    config: { damping: 20, stiffness: 220 },
  });

  // Compute transform based on enter/exit animations
  let enterScale = 1.0;
  let enterTranslateY = 0;
  let enterOpacity = 1.0;

  if (enter === 'pop') {
    enterScale = enterSpring;
  } else if (enter === 'slide-up') {
    enterTranslateY = interpolate(enterSpring, [0, 1], [150, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    enterOpacity = interpolate(enterSpring, [0, 0.4, 1], [0, 0.8, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (enter === 'fade') {
    enterOpacity = enterSpring;
  }

  let exitScale = 0;
  let exitTranslateY = 0;
  let exitOpacity = 0;

  if (exit === 'pop') {
    exitScale = exitSpring;
  } else if (exit === 'slide-down') {
    exitTranslateY = interpolate(exitSpring, [0, 1], [0, 150], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    exitOpacity = exitSpring;
  } else if (exit === 'fade') {
    exitOpacity = exitSpring;
  }

  const finalScale = Math.max(0, scale * (enterScale - exitScale));
  const finalTranslateY = enterTranslateY + exitTranslateY;
  const finalOpacity = Math.max(0, Math.min(1, opacity * (enterOpacity - exitOpacity)));

  const resolveImgSrc = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const clean = url.replace(/^\/+/, '');
    if (clean.startsWith('public/')) {
      return `/${clean}`;
    }
    return `/${clean}`;
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: `translate(-50%, -50%) translateY(${finalTranslateY}px) scale(${finalScale}) rotate(${rotation}deg)`,
          opacity: finalOpacity,
          transformOrigin: 'center center',
        }}
      >
        <Img
          src={resolveImgSrc(src)}
          style={{
            maxWidth: 1080,
            maxHeight: 1920,
            display: 'block',
            filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
