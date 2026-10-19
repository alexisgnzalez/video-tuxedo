import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FacetMountain } from '../primitives/FacetMountain';
import { KINETIC_SPRING, PALETTE, steppedFrame } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface AvilaPeakProps {
  label?: string;
  sublabel?: string;
  width?: number;
  height?: number;
  seed?: number;
  style?: React.CSSProperties;
}

/**
 * AvilaPeak — El Ávila summit & Hotel Humboldt monument badge.
 * Stepped 12fps vintage entrance with faceted polygon lighting and title tag.
 */
export const AvilaPeak: React.FC<AvilaPeakProps> = ({
  label = 'EL ÁVILA',
  sublabel = 'WARAIRA REPANO',
  width = 380,
  height = 320,
  seed = 1957,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Vintage 12fps stepped entrance
  const stepped = steppedFrame(frame, fps, 12);
  const entrance = spring({
    frame: stepped,
    fps,
    config: KINETIC_SPRING,
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 1, 1]);

  return (
    <div
      style={{
        width,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `translateY(${translateY}px)`,
        opacity,
        ...style,
      }}
    >
      {/* Mountain Facets with Humboldt Tower */}
      <div
        style={{
          width,
          height: height - 60,
          filter: `drop-shadow(5px 5px 0px ${PALETTE.abyssalBlue})`,
        }}
      >
        <FacetMountain
          width={width}
          height={height - 60}
          seed={seed}
          showHumboldtTower={true}
        />
      </div>

      {/* Modernist Pedestal Badge Tag */}
      <div
        style={{
          backgroundColor: PALETTE.abyssalBlue,
          border: `3px solid ${PALETTE.creamPaper}`,
          padding: '6px 18px',
          textAlign: 'center',
          boxShadow: `3px 3px 0px ${PALETTE.terracotta}`,
          marginTop: -8,
          zIndex: 3,
        }}
      >
        <div
          style={{
            ...TYPOGRAPHY.calloutHeader,
            fontSize: 20,
            letterSpacing: '0.18em',
            textShadow: 'none',
            color: PALETTE.creamPaper,
          }}
        >
          {label}
        </div>
        {sublabel && (
          <div
            style={{
              ...TYPOGRAPHY.tag,
              fontSize: 12,
              letterSpacing: '0.2em',
              color: PALETTE.warmOchre,
              marginTop: 2,
            }}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};
