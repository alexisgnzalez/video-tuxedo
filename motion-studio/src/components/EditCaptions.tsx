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
}

export const EditCaptions: React.FC<EditCaptionsProps> = ({
  cues,
  style = {},
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

  // Position: top (y ~280), middle (y ~960), lower-third (default: bottom ~420)
  const posSetting = style.position || 'lower-third';
  const justify =
    posSetting === 'top'
      ? 'flex-start'
      : posSetting === 'middle'
      ? 'center'
      : 'flex-end';
  const paddingTop = posSetting === 'top' ? 260 : 0;
  const paddingBottom = posSetting === 'lower-third' ? 420 : 0;

  const fontFam = style.font || 'Montserrat, Inter, system-ui, sans-serif';
  const fontSize = style.size || 68;
  const baseColor = style.color || '#FFFFFF';
  const highlightColor = style.highlight || '#FACC15';
  const isKaraoke = style.karaoke !== false;
  const isBoxed = style.preset === 'boxed';

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
        };
      });

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
          gap: 16,
          padding: isBoxed ? '16px 28px' : '0 40px',
          backgroundColor: isBoxed ? 'rgba(0,0,0,0.75)' : 'transparent',
          borderRadius: isBoxed ? 20 : 0,
          border: isBoxed ? '3px solid #FACC15' : 'none',
          maxWidth: 960,
        }}
      >
        {words.map((w, idx) => {
          const isActive = currentTime >= w.start && currentTime <= w.end;
          const isPast = currentTime > w.end;

          // Subtle spring bounce when word becomes active
          const wordFrame = Math.max(0, Math.round((currentTime - w.start) * fps));
          const bounce = spring({
            frame: wordFrame,
            fps,
            config: { damping: 11, stiffness: 240, mass: 0.5 },
          });

          const scale = isActive && isKaraoke ? 1.0 + bounce * 0.16 : 1.0;
          const textColor =
            isActive && isKaraoke
              ? highlightColor
              : isPast && isKaraoke
              ? '#E5E7EB'
              : baseColor;

          return (
            <span
              key={`${w.text}_${idx}`}
              style={{
                fontFamily: fontFam,
                fontSize,
                fontWeight: 900,
                color: textColor,
                textTransform: 'uppercase',
                transform: `scale(${scale})`,
                WebkitTextStroke: isBoxed ? 'none' : '6px #000000',
                textShadow: isBoxed
                  ? '0 4px 12px rgba(0,0,0,0.6)'
                  : '0 8px 16px rgba(0,0,0,0.85), 5px 5px 0 #000000',
                letterSpacing: '-1px',
                display: 'inline-block',
                transition: 'none',
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
