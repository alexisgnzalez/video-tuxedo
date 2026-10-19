import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionCue } from '../../types';
import { PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface KineticCaptionProps {
  cues?: CaptionCue[];
  width?: number;
  style?: React.CSSProperties;
}

/**
 * KineticCaption — Mid-Century Brutalist styled subtitle captions.
 * Renders in Zone B across lower chest with word-by-word active highlighting.
 */
export const KineticCaption: React.FC<KineticCaptionProps> = ({
  cues = [],
  width = 820,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSeconds = frame / fps;

  // Find active cue
  const activeCue = cues.find(
    (c) => currentSeconds >= c.start && currentSeconds <= c.end
  );

  if (!activeCue) return null;

  return (
    <div
      style={{
        width,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        ...style,
      }}
    >
      <div
        style={{
          backgroundColor: PALETTE.abyssalBlue,
          border: `3px solid ${PALETTE.creamPaper}`,
          padding: '10px 24px',
          boxShadow: `4px 4px 0px ${PALETTE.terracotta}`,
          maxWidth: width,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {activeCue.words && activeCue.words.length > 0 ? (
          activeCue.words.map((w, idx) => {
            const isWordActive =
              currentSeconds >= w.start && currentSeconds <= w.end;
            return (
              <span
                key={idx}
                style={{
                  ...TYPOGRAPHY.calloutHeader,
                  fontSize: 28,
                  textShadow: 'none',
                  color: isWordActive ? PALETTE.kineticRed : PALETTE.creamPaper,
                  backgroundColor: isWordActive
                    ? PALETTE.creamPaper
                    : 'transparent',
                  padding: isWordActive ? '2px 8px' : '2px 0',
                  borderRadius: 2,
                  transition: 'color 0.1s ease',
                }}
              >
                {w.text}
              </span>
            );
          })
        ) : (
          <span
            style={{
              ...TYPOGRAPHY.calloutHeader,
              fontSize: 28,
              textShadow: 'none',
              color: PALETTE.creamPaper,
            }}
          >
            {activeCue.text}
          </span>
        )}
      </div>
    </div>
  );
};
