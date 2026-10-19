import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SotoLines } from '../primitives/SotoLines';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface PosterTitleCardProps {
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  showClouds?: boolean;
  showSotoLines?: boolean;
  style?: React.CSSProperties;
}

/**
 * PosterTitleCard — Iconic Caracas Mid-Century Travel Poster Header.
 * Features wide-tracked geometric caps in creamPaper on deep skyTeal,
 * with animated Soto vibration lines and vintage scalloped cloud banks.
 */
export const PosterTitleCard: React.FC<PosterTitleCardProps> = ({
  title = 'CARACAS',
  subtitle = 'EL ÁVILA Y SU CINETISMO',
  width = 960,
  height = 320,
  showClouds = true,
  showSotoLines = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const translateY = interpolate(entrance, [0, 1], [-50, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 1, 1]);

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        backgroundColor: PALETTE.skyTeal,
        border: `4px solid ${PALETTE.abyssalBlue}`,
        boxShadow: `6px 6px 0px ${PALETTE.abyssalBlue}`,
        overflow: 'hidden',
        transform: `translateY(${translateY}px)`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 1. Background Soto Vibration Lines */}
      {showSotoLines && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0.35,
          }}
        >
          <SotoLines
            width={width}
            height={height}
            spacing={10}
            strokeColor={PALETTE.creamPaper}
            strokeWidth={1.5}
          />
        </div>
      )}

      {/* 2. Scalloped Mid-Century Clouds at Left and Right Edges */}
      {showClouds && (
        <svg
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Left Cloud Bank */}
          <path
            d={`M -20 ${height} L -20 ${height * 0.45} Q 40 ${height * 0.45} 60 ${height * 0.35} Q 80 ${height * 0.15} 120 ${height * 0.25} Q 150 ${height * 0.38} 170 ${height * 0.55} L 180 ${height} Z`}
            fill={PALETTE.creamPaper}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="3"
            opacity="0.9"
          />
          {/* Right Cloud Bank */}
          <path
            d={`M ${width + 20} ${height} L ${width + 20} ${height * 0.4} Q ${width - 50} ${height * 0.42} ${width - 80} ${height * 0.28} Q ${width - 120} ${height * 0.12} ${width - 150} ${height * 0.28} Q ${width - 175} ${height * 0.45} ${width - 190} ${height} Z`}
            fill={PALETTE.creamPaper}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="3"
            opacity="0.9"
          />
        </svg>
      )}

      {/* 3. Poster Typography Tier */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          textAlign: 'center',
          padding: '0 40px',
        }}
      >
        <h1
          style={{
            ...TYPOGRAPHY.posterTitle,
            fontSize: Math.min(84, width * 0.088),
            letterSpacing: '0.24em',
            color: PALETTE.creamPaper,
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <div
            style={{
              ...TYPOGRAPHY.posterSubtitle,
              fontSize: Math.min(26, width * 0.032),
              letterSpacing: '0.3em',
              marginTop: 10,
              color: PALETTE.creamPaper,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* 4. Bottom Accent Border */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 6,
          backgroundColor: PALETTE.terracotta,
          borderTop: `2px solid ${PALETTE.abyssalBlue}`,
        }}
      />
    </div>
  );
};
