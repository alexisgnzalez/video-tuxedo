import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';
import { WordTiming } from '../schema';

interface TikTokCaptionsProps {
  words: WordTiming[];
  activeColor?: string;
}

export const TikTokCaptions: React.FC<TikTokCaptionsProps> = ({
  words,
  activeColor = '#FACC15',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  if (!words || words.length === 0) {
    return null;
  }

  // Find index of currently spoken word
  const activeIndex = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  if (activeIndex === -1) {
    // If between words or before/after, check if close to any word within 0.25s
    const nearbyIdx = words.findIndex(
      (w) => Math.abs(currentTime - w.start) <= 0.25 || Math.abs(currentTime - w.end) <= 0.25
    );
    if (nearbyIdx === -1) {
      return null;
    }
  }

  const currentIdx = activeIndex !== -1 ? activeIndex : 0;

  // Group into compact chunks of 3-4 words for high readability
  const chunkSize = 4;
  const chunkStart = Math.floor(currentIdx / chunkSize) * chunkSize;
  const visibleWords = words.slice(chunkStart, chunkStart + chunkSize);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 420, // Above TikTok UI bottom safe zone
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          padding: '0 40px',
          maxWidth: 960,
        }}
      >
        {visibleWords.map((w, idx) => {
          const globalIdx = chunkStart + idx;
          const isActive = globalIdx === currentIdx;

          // Word entrance bounce when it becomes active
          const wordFrame = Math.max(0, Math.round((currentTime - w.start) * fps));
          const bounce = spring({
            frame: wordFrame,
            fps,
            config: { damping: 10, stiffness: 220, mass: 0.5 },
          });

          const scale = isActive ? 1.0 + bounce * 0.18 : 1.0;
          const textColor = isActive ? activeColor : '#FFFFFF';

          return (
            <span
              key={`${w.word}_${globalIdx}`}
              style={{
                fontFamily: 'Impact, Montserrat, system-ui, sans-serif',
                fontSize: 68,
                fontWeight: 900,
                color: textColor,
                textTransform: 'uppercase',
                transform: `scale(${scale})`,
                WebkitTextStroke: '6px #000000',
                textShadow: '0 8px 16px rgba(0,0,0,0.8), 6px 6px 0 #000000',
                letterSpacing: '-1px',
                display: 'inline-block',
                transition: 'none',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
