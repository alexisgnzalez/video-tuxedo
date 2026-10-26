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
  activeColor = '#FFD166', // Warm Amber from TikTok style guide
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
        paddingBottom: 620, // The "Collarbone" Safe Zone: 30% to 35% up from bottom
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
            config: { damping: 12, stiffness: 220, mass: 0.5 },
          });

          const cleanWord = w.word.toLowerCase().replace(/[.,!?:;¿¡"']/g, '');
          const isPunchlineOrSlang = VENEZUELAN_SLANG_WORDS.has(cleanWord) || (w.word.length > 2 && w.word === w.word.toUpperCase());

          // Casing rule: ALL CAPS for punchlines/slang, Sentence case for setups
          const textTransform = isPunchlineOrSlang ? 'uppercase' : 'none';

          // Animation scale
          const scale = isActive ? (isPunchlineOrSlang ? 1.0 + bounce * 0.14 : 1.0 + bounce * 0.08) : 1.0;

          // Palette: Narrative White (#FFFFFF), Warm Amber (#FFD166), Punchline Coral (#FF595E)
          const textColor = isActive
            ? (isPunchlineOrSlang ? '#FF595E' : activeColor)
            : '#FFFFFF';

          return (
            <span
              key={`${w.word}_${globalIdx}`}
              style={{
                fontFamily: 'Montserrat, -apple-system, sans-serif',
                fontSize: 68,
                fontWeight: isPunchlineOrSlang ? 900 : 800,
                color: textColor,
                textTransform: textTransform as any,
                transform: `scale(${scale})`,
                WebkitTextStroke: '3.5px #000000',
                textShadow: '0 6px 14px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.40)',
                letterSpacing: isPunchlineOrSlang ? '0px' : '-0.5px',
                display: 'inline-block',
                transition: 'color 0.1s ease',
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
