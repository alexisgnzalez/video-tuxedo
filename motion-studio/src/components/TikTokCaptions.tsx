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

const VENEZUELAN_SLANG_WORDS = new Set([
  'chinazo', 'tijerazo', 'bigote', 'chamo', 'marico', 'vaina', 'arrecho',
  'ladilla', 'pana', 'cédula', 'cedula', 'secador', 'discoteca', 'discotecas',
  'empatarse', 'calentar', 'humilde', 'trágame', 'tierra', 'monitores', 'caracas'
]);

export const TikTokCaptions: React.FC<TikTokCaptionsProps> = ({
  words,
  activeColor = '#FFD60A', // Refined Vibrant Gold
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
    const nearbyIdx = words.findIndex(
      (w) => Math.abs(currentTime - w.start) <= 0.25 || Math.abs(currentTime - w.end) <= 0.25
    );
    if (nearbyIdx === -1) {
      return null;
    }
  }

  const currentIdx = activeIndex !== -1 ? activeIndex : 0;

  // Group into natural spoken breath clauses (4-5 words)
  const chunkSize = 5;
  const chunkStart = Math.floor(currentIdx / chunkSize) * chunkSize;
  const visibleWords = words.slice(chunkStart, chunkStart + chunkSize);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 600, // Collarbone Safe Zone (30% to 35% up from bottom)
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
          padding: '0 36px',
          maxWidth: 920,
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
            config: { damping: 16, stiffness: 260, mass: 0.4 },
          });

          const cleanWord = w.word.toLowerCase().replace(/[.,!?:;¿¡"']/g, '');
          const isPunchlineOrSlang = VENEZUELAN_SLANG_WORDS.has(cleanWord) || (w.word.length > 2 && w.word === w.word.toUpperCase());

          // Casing rule: ALL CAPS for punchlines/slang, Sentence case for setups
          const textTransform = isPunchlineOrSlang ? 'uppercase' : 'none';

          // Animation scale (subtle, snappy)
          const scale = isActive ? (isPunchlineOrSlang ? 1.0 + bounce * 0.10 : 1.0 + bounce * 0.06) : 1.0;

          // Palette: Narrative White (#F8FAFC), Vibrant Gold (#FFD60A), Punchline Coral (#FF4757)
          const textColor = isActive
            ? (isPunchlineOrSlang ? '#FF4757' : activeColor)
            : '#F8FAFC';

          const textShadowStyle = isActive
            ? (isPunchlineOrSlang
                ? '0 0 20px rgba(255, 71, 87, 0.65), 0 2px 6px rgba(0,0,0,0.9)'
                : '0 0 18px rgba(255, 214, 10, 0.55), 0 2px 6px rgba(0,0,0,0.9)')
            : '0 2px 4px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)';

          return (
            <span
              key={`${w.word}_${globalIdx}`}
              style={{
                fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Montserrat', sans-serif",
                fontSize: 56,
                fontWeight: isPunchlineOrSlang ? 900 : 800,
                color: textColor,
                textTransform: textTransform as any,
                transform: `scale(${scale})`,
                paintOrder: 'stroke fill',
                WebkitTextStroke: '2px rgba(0, 0, 0, 0.92)',
                textShadow: textShadowStyle,
                letterSpacing: isPunchlineOrSlang ? '0.02em' : '-0.02em',
                lineHeight: 1.2,
                display: 'inline-block',
                transition: 'color 0.08s ease, transform 0.08s ease',
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
