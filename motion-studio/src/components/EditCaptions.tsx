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
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            borderRadius: 14,
            padding: '10px 24px',
            maxWidth: 920,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              fontSize: 13,
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
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              fontSize: 32,
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

  // The "Collarbone" Safe Zone (30% to 35% up from bottom of frame)
  // In a 1080x1920 canvas, 32% from bottom = ~620px
  const justify =
    posSetting === 'top'
      ? 'flex-start'
      : posSetting === 'middle'
      ? 'center'
      : 'flex-end';
  const paddingTop = posSetting === 'top' ? 260 : 0;
  const paddingBottom =
    posSetting === 'collarbone'
      ? (style.paddingBottom || 620)
      : posSetting === 'lower-third'
      ? 480
      : 0;

  const fontFam = style.font || (preset === 'pill_box' ? 'Inter, Montserrat, sans-serif' : 'Montserrat, -apple-system, sans-serif');
  const fontSize = style.size || (preset === 'pill_box' ? 54 : preset === 'indie_cinema' ? 62 : 68);
  const baseColor = style.color || (preset === 'indie_cinema' ? '#F4D35E' : '#FFFFFF');
  const highlightAmber = style.highlight || '#FFD166';
  const punchlineCoral = style.accent || '#FF595E';
  const isKaraoke = style.karaoke !== false;
  const isIndie = preset === 'indie_cinema';
  const isPill = preset === 'pill_box';

  const words = activeCue.words && activeCue.words.length > 0
    ? activeCue.words
    : activeCue.text.split(' ').map((w, i) => {
        const totalW = Math.max(1, activeCue.text.split(' ').length);
        const dur = (activeCue.end - activeCue.start) / totalW;
        return {
          id: `w_${i}`,
          text: w,
          start: activeCue.start + i * dur,
          end: activeCue.start + (i + 1) * dur,
          emphasis: false,
          highlightType: undefined,
          isPunchline: false,
        };
      });

  // Check if active cue is a comedic tag (1-2 words tagged for slight tilt)
  const isComedicTag = words.length <= 2 && (activeCue.cueType === 'punchline' || activeCue.cueType === 'slang');
  const containerRotation = isComedicTag ? -2.5 : 0;

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
          gap: isPill ? 14 : 16,
          padding: isPill ? '12px 32px' : '0 40px',
          backgroundColor: isPill ? 'rgba(15, 23, 42, 0.82)' : 'transparent',
          borderRadius: isPill ? 9999 : 0,
          border: isPill ? '1.5px solid rgba(255, 255, 255, 0.20)' : 'none',
          backdropFilter: isPill ? 'blur(8px)' : 'none',
          boxShadow: isPill ? '0 8px 24px rgba(0,0,0,0.45)' : 'none',
          maxWidth: 960,
          transform: `rotate(${containerRotation}deg)`,
          transition: 'transform 0.15s ease',
        }}
      >
        {words.map((w: any, idx) => {
          const isActive = currentTime >= w.start && currentTime <= w.end;
          const isPast = currentTime > w.end;

          // Word entrance bounce when it becomes active
          const wordFrame = Math.max(0, Math.round((currentTime - w.start) * fps));
          const bounce = spring({
            frame: wordFrame,
            fps,
            config: { damping: 12, stiffness: 220, mass: 0.5 },
          });

          // Check if word should be formatted as punchline
          const isWordPunchline = Boolean(w.isPunchline || w.highlightType === 'punchline' || (w.text && w.text.length > 2 && w.text === w.text.toUpperCase() && !isIndie));

          // Pacing & Casing rules:
          // Sentence case for 90% setup storytelling; ALL CAPS reserved strictly for punchlines/slang
          const textTransform = isWordPunchline ? 'uppercase' : 'none';

          // Animation scale:
          // Indie cinema: zero bounce
          // Setup words: smooth micro-pop (100% to 108%)
          // Punchline words: scale pop (100% to 114%)
          let scale = 1.0;
          if (isActive && isKaraoke && !isIndie) {
            scale = isWordPunchline ? 1.0 + bounce * 0.14 : 1.0 + bounce * 0.08;
          }

          // Purpose-driven color palette:
          // Base: Pure White (#FFFFFF) or warm Indie Yellow (#F4D35E)
          // Context/hook: Warm Amber (#FFD166)
          // Punchline/slang: Coral Red (#FF595E)
          let textColor = baseColor;
          if (isActive && isKaraoke) {
            if (isWordPunchline) {
              textColor = punchlineCoral;
            } else if (w.highlightType === 'context' || w.emphasis) {
              textColor = highlightAmber;
            } else {
              textColor = highlightAmber;
            }
          } else if (isPast && isKaraoke) {
            textColor = isIndie ? '#FAF9F5' : '#E5E7EB';
          } else {
            textColor = isIndie ? '#F4D35E' : '#FFFFFF';
          }

          // Stroke and shadow parameters from the style guide:
          // Thin dark charcoal / black outline (3px - 5px)
          // Soft black drop shadow (40% - 60% opacity)
          const strokeStyle = isPill
            ? 'none'
            : isIndie
            ? '2.5px #000000'
            : '3.5px #000000';

          const shadowStyle = isPill
            ? 'none'
            : isIndie
            ? '0 4px 10px rgba(0,0,0,0.45)'
            : '0 6px 14px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.40)';

          return (
            <span
              key={`${w.text}_${idx}`}
              style={{
                fontFamily: fontFam,
                fontSize,
                fontWeight: isIndie ? 700 : isWordPunchline ? 900 : 800,
                color: textColor,
                textTransform: textTransform as any,
                transform: `scale(${scale})`,
                WebkitTextStroke: strokeStyle,
                textShadow: shadowStyle,
                letterSpacing: isWordPunchline ? '0px' : '-0.5px',
                display: 'inline-block',
                transition: 'color 0.1s ease',
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
