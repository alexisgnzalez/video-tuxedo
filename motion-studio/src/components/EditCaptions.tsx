import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CaptionCueProps } from '../editSchema';

interface EditCaptionsProps {
  cues: CaptionCueProps[];
  style?: Record<string, any>;
  mode?: 'styled' | 'reference';
}

function reconcileCueWords(cue: CaptionCueProps): Array<{
  id?: string;
  text: string;
  start: number;
  end: number;
  emphasis?: boolean;
  highlightType?: string;
  isPunchline?: boolean;
}> {
  const cueText = (cue.text || '').trim();
  if (!cueText) return [];

  const rawWords = cueText.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const cueStart = cue.start ?? 0;
  const cueEnd = cue.end ?? (cueStart + 1.0);
  const totalDuration = Math.max(0.1, cueEnd - cueStart);
  const defaultSlotDur = totalDuration / rawWords.length;

  const existingWords = (cue.words || []).filter((w) => Boolean(w && typeof w.text === 'string' && w.text.trim()));

  const isExactCountMatch = existingWords.length === rawWords.length;
  if (isExactCountMatch) {
    const isExactTextMatch = existingWords.every((ew, i) => {
      const c1 = ew.text.toLowerCase().replace(/[.,!?:;¿¡"']/g, '');
      const c2 = rawWords[i].toLowerCase().replace(/[.,!?:;¿¡"']/g, '');
      return c1 === c2;
    });
    if (isExactTextMatch) {
      return existingWords.map((ew, i) => ({
        ...ew,
        text: rawWords[i],
        isPunchline: ew.isPunchline || (rawWords[i].length > 2 && rawWords[i] === rawWords[i].toUpperCase()),
      }));
    }
  }

  const result: Array<{
    id?: string;
    text: string;
    start: number;
    end: number;
    emphasis?: boolean;
    highlightType?: string;
    isPunchline?: boolean;
  }> = [];

  let existCursor = 0;
  for (let i = 0; i < rawWords.length; i++) {
    const rawWord = rawWords[i];
    const cleanRaw = rawWord.toLowerCase().replace(/[.,!?:;¿¡"']/g, '');

    let matchIdx = -1;
    for (let j = existCursor; j < existingWords.length; j++) {
      const cleanExist = (existingWords[j].text || '').toLowerCase().replace(/[.,!?:;¿¡"']/g, '');
      if (cleanExist === cleanRaw && cleanRaw.length > 0) {
        matchIdx = j;
        break;
      }
    }

    if (matchIdx !== -1) {
      const matched = existingWords[matchIdx];
      result.push({
        ...matched,
        text: rawWord,
        isPunchline: matched.isPunchline || (rawWord.length > 2 && rawWord === rawWord.toUpperCase()),
      });
      existCursor = matchIdx + 1;
    } else {
      const start = cueStart + i * defaultSlotDur;
      const end = cueStart + (i + 1) * defaultSlotDur;
      result.push({
        id: `w_gen_${i}`,
        text: rawWord,
        start,
        end,
        emphasis: false,
        highlightType: undefined,
        isPunchline: rawWord.length > 2 && rawWord === rawWord.toUpperCase(),
      });
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (i === 0) {
      result[i].start = Math.max(cueStart, result[i].start);
    } else {
      result[i].start = Math.max(result[i - 1].end, result[i].start);
    }
    const nextStart = (i + 1 < result.length) ? result[i + 1].start : cueEnd;
    if (result[i].end <= result[i].start || result[i].end > nextStart) {
      result[i].end = Math.max(result[i].start + 0.05, nextStart);
    }
  }

  return result;
}

export const EditCaptions: React.FC<EditCaptionsProps> = ({
  cues,
  style = {},
  mode = 'styled',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  if (!cues || cues.length === 0) {
    return null;
  }

  // Find the cue active at the current timeline timestamp
  const activeCue = cues.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  if (!activeCue) {
    return null;
  }

  // Reference mode: clean, minimal, non-rendered teleprompter preview
  if (mode === 'reference') {
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 220,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: 14,
            padding: '10px 24px',
            maxWidth: 920,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#94A3B8',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            [Reference Subtitle • Not Rendered]
          </div>
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', Inter, system-ui, -apple-system, sans-serif",
              fontSize: 30,
              fontWeight: 600,
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.35,
            }}
          >
            {activeCue.text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Preset configuration (TikTok Subtitle Style Guide)
  const preset = style.preset || 'standup_hybrid';
  const posSetting = style.position || 'collarbone';

  // The "Collarbone" Safe Zone (30% to 35% up from bottom of 1080x1920 frame)
  // ~600px - 620px ensures clean clearance above TikTok's native UI elements
  const justify =
    posSetting === 'top'
      ? 'flex-start'
      : posSetting === 'middle'
      ? 'center'
      : 'flex-end';
  const paddingTop = posSetting === 'top' ? 240 : 0;
  const paddingBottom =
    posSetting === 'collarbone'
      ? (style.paddingBottom || 600)
      : posSetting === 'lower-third'
      ? 460
      : 0;

  const fontFam = style.font || "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Montserrat', sans-serif";
  const fontSize = style.size || (preset === 'pill_box' ? 48 : preset === 'indie_cinema' ? 52 : 56);
  const baseColor = style.color || (preset === 'indie_cinema' ? '#FBF7EE' : '#FFFFFF');
  const highlightGold = style.highlight || '#FFD60A';
  const punchlineCoral = style.accent || '#FF4757';
  const isKaraoke = style.karaoke !== false;
  const isIndie = preset === 'indie_cinema';
  const isPill = preset === 'pill_box';

  const words = reconcileCueWords(activeCue);

  // Check if active cue is a comedic tag (1-2 words tagged for slight tilt)
  const isComedicTag = words.length <= 2 && (activeCue.cueType === 'punchline' || activeCue.cueType === 'slang');
  const containerRotation = isComedicTag ? -2.0 : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: justify,
        alignItems: 'center',
        paddingTop,
        paddingBottom,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isPill ? 12 : 14,
          padding: isPill ? '10px 28px' : '0 36px',
          backgroundColor: isPill ? 'rgba(10, 12, 18, 0.76)' : 'transparent',
          borderRadius: isPill ? 9999 : 0,
          border: isPill ? '1px solid rgba(255, 255, 255, 0.16)' : 'none',
          backdropFilter: isPill ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: isPill ? 'blur(16px)' : 'none',
          boxShadow: isPill
            ? '0 12px 36px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
            : 'none',
          maxWidth: 920,
          transform: `rotate(${containerRotation}deg)`,
          transition: 'transform 0.15s ease',
        }}
      >
        {words.map((w: any, idx) => {
          const isActive = currentTime >= w.start && currentTime <= w.end;
          const isPast = currentTime > w.end;

          // Word entrance bounce when it becomes active (snappy, subtle, polished)
          const wordFrame = Math.max(0, Math.round((currentTime - w.start) * fps));
          const bounce = spring({
            frame: wordFrame,
            fps,
            config: { damping: 16, stiffness: 260, mass: 0.4 },
          });

          // Check if word should be formatted as punchline
          const isWordPunchline = Boolean(
            w.isPunchline ||
            w.highlightType === 'punchline' ||
            (w.text && w.text.length > 2 && w.text === w.text.toUpperCase() && !isIndie)
          );

          // Casing rules: Sentence case for storytelling; uppercase for punchlines
          const textTransform = isWordPunchline ? 'uppercase' : 'none';

          // Animation scale (subtle micro-pop, not distracting)
          let scale = 1.0;
          if (isActive && isKaraoke && !isIndie) {
            scale = isWordPunchline ? 1.0 + bounce * 0.10 : 1.0 + bounce * 0.06;
          }

          // Refined modern palette
          let textColor = baseColor;
          let textShadowStyle = '0 2px 4px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)';

          if (isPill) {
            textShadowStyle = '0 2px 6px rgba(0,0,0,0.45)';
          } else if (isIndie) {
            textShadowStyle = '0 2px 6px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)';
          }

          if (isActive && isKaraoke) {
            if (isWordPunchline) {
              textColor = punchlineCoral;
              textShadowStyle = isPill
                ? '0 0 14px rgba(255, 71, 87, 0.6)'
                : '0 0 20px rgba(255, 71, 87, 0.65), 0 2px 6px rgba(0,0,0,0.9)';
            } else {
              textColor = highlightGold;
              textShadowStyle = isPill
                ? '0 0 14px rgba(255, 214, 10, 0.5)'
                : '0 0 18px rgba(255, 214, 10, 0.55), 0 2px 6px rgba(0,0,0,0.9)';
            }
          } else if (isPast && isKaraoke) {
            textColor = isIndie ? '#E2DEC9' : '#CBD5E1';
          } else {
            textColor = isIndie ? '#FBF7EE' : '#F8FAFC';
          }

          // Refined sub-pixel outline (never clunky, drawn behind fill)
          const strokeStyle = isPill
            ? 'none'
            : isIndie
            ? '1.5px rgba(0, 0, 0, 0.85)'
            : '2px rgba(0, 0, 0, 0.92)';

          return (
            <span
              key={`${w.text}_${idx}`}
              style={{
                fontFamily: fontFam,
                fontSize,
                fontWeight: isIndie ? 600 : isWordPunchline ? 900 : 800,
                color: textColor,
                textTransform: textTransform as any,
                transform: `scale(${scale})`,
                paintOrder: 'stroke fill',
                WebkitTextStroke: strokeStyle,
                textShadow: textShadowStyle,
                letterSpacing: isWordPunchline ? '0.02em' : '-0.02em',
                lineHeight: 1.2,
                display: 'inline-block',
                transition: 'color 0.08s ease, transform 0.08s ease',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
