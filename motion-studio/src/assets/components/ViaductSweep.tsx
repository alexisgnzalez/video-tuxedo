import React, { useMemo } from 'react';
import { getPointAtLength } from '@remotion/paths';
import { interpolate, useCurrentFrame } from 'remotion';
import { PALETTE } from '../../styles/palette';

export interface ViaductSweepProps {
  width?: number;
  height?: number;
  carProgress?: number; // 0 to 1, or animated if omitted
  showCyclist?: boolean;
  style?: React.CSSProperties;
}

/**
 * ViaductSweep — Elevated Caracas concrete viaduct curving through the frame.
 * Features concrete pillars, Gego hanging wire nets, and vintage car + cyclist.
 */
export const ViaductSweep: React.FC<ViaductSweepProps> = ({
  width = 720,
  height = 420,
  carProgress,
  showCyclist = true,
  style,
}) => {
  const frame = useCurrentFrame();

  const animCarProgress =
    carProgress !== undefined ? carProgress : ((frame * 0.008) % 1);
  const cyclistProgress = ((animCarProgress + 0.15) % 1);

  // Road Curve Geometry
  const roadCurve = useMemo(() => {
    // S-curve entering upper-right, swooping through center to bottom-left
    return `M ${width * 0.9} ${height * 0.25} C ${width * 0.55} ${height * 0.28}, ${width * 0.65} ${height * 0.65}, ${width * 0.15} ${height * 0.9}`;
  }, [width, height]);

  // Positions along curve
  const carPoint = useMemo(() => {
    try {
      const len = width * 1.1;
      const pt = getPointAtLength(roadCurve, animCarProgress * len);
      return pt || { x: width * 0.5, y: height * 0.5 };
    } catch {
      return { x: width * 0.5, y: height * 0.5 };
    }
  }, [roadCurve, animCarProgress, width, height]);

  const cyclistPoint = useMemo(() => {
    try {
      const len = width * 1.1;
      const pt = getPointAtLength(roadCurve, cyclistProgress * len);
      return pt || { x: width * 0.4, y: height * 0.6 };
    } catch {
      return { x: width * 0.4, y: height * 0.6 };
    }
  }, [roadCurve, cyclistProgress, width, height]);

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'visible',
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {/* 1. Support Pillars */}
        {[0.32, 0.54, 0.74].map((t, idx) => {
          const px = width * (0.2 + idx * 0.28);
          const py = height * (0.5 + idx * -0.08);
          return (
            <g key={idx}>
              <line
                x1={px}
                y1={py}
                x2={px}
                y2={height + 20}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="18"
              />
              <line
                x1={px}
                y1={py}
                x2={px}
                y2={height + 20}
                stroke={PALETTE.concreteGrey}
                strokeWidth="12"
              />
            </g>
          );
        })}

        {/* 2. Hanging Gego Parabolic Mesh under the spans */}
        {[0.38, 0.62].map((cxRatio, idx) => {
          const cx = width * cxRatio;
          const cy = height * 0.52;
          return (
            <g key={idx} opacity="0.75">
              {Array.from({ length: 8 }).map((_, lIdx) => (
                <line
                  key={lIdx}
                  x1={cx - 50 + lIdx * 14}
                  y1={cy - 10}
                  x2={cx + 50 - lIdx * 14}
                  y2={cy + 55}
                  stroke={PALETTE.creamPaper}
                  strokeWidth="1.25"
                />
              ))}
            </g>
          );
        })}

        {/* 3. Viaduct Concrete Highway Body */}
        {/* Dark Drop Cast Outline */}
        <path
          d={roadCurve}
          fill="none"
          stroke={PALETTE.abyssalBlue}
          strokeWidth="64"
          strokeLinecap="round"
        />
        {/* Main Concrete Deck */}
        <path
          d={roadCurve}
          fill="none"
          stroke={PALETTE.concreteGrey}
          strokeWidth="52"
          strokeLinecap="round"
        />
        {/* Inner Dark Road Surface */}
        <path
          d={roadCurve}
          fill="none"
          stroke={PALETTE.abyssalBlue}
          strokeWidth="42"
          strokeLinecap="round"
        />
        {/* Center Dashed Lane Marker */}
        <path
          d={roadCurve}
          fill="none"
          stroke={PALETTE.creamPaper}
          strokeWidth="3"
          strokeDasharray="18 12"
        />

        {/* 4. Moving Vintage Sedan Car */}
        <g transform={`translate(${carPoint.x}, ${carPoint.y})`}>
          {/* Shadow */}
          <ellipse cx="0" cy="8" rx="24" ry="7" fill={PALETTE.abyssalBlue} opacity="0.6" />
          {/* Body */}
          <rect
            x="-22"
            y="-10"
            width="44"
            height="18"
            fill={PALETTE.creamPaper}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="2.5"
            rx="4"
          />
          {/* Cabin */}
          <rect
            x="-10"
            y="-18"
            width="22"
            height="12"
            fill={PALETTE.skyTeal}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="2"
            rx="2"
          />
          {/* Wheels */}
          <circle cx="-14" cy="7" r="5" fill={PALETTE.abyssalBlue} />
          <circle cx="14" cy="7" r="5" fill={PALETTE.abyssalBlue} />
        </g>

        {/* 5. Moving Cyclist */}
        {showCyclist && (
          <g transform={`translate(${cyclistPoint.x}, ${cyclistPoint.y})`}>
            {/* Bicycle wheels */}
            <circle cx="-8" cy="5" r="4.5" fill="none" stroke={PALETTE.creamPaper} strokeWidth="2" />
            <circle cx="8" cy="5" r="4.5" fill="none" stroke={PALETTE.creamPaper} strokeWidth="2" />
            {/* Frame */}
            <line x1="-8" y1="5" x2="0" y2="1" stroke={PALETTE.kineticRed} strokeWidth="2" />
            <line x1="8" y1="5" x2="3" y2="1" stroke={PALETTE.kineticRed} strokeWidth="2" />
            <line x1="0" y1="1" x2="3" y2="1" stroke={PALETTE.kineticRed} strokeWidth="2" />
            {/* Cyclist body */}
            <circle cx="2" cy="-6" r="3.5" fill={PALETTE.creamPaper} />
            <line x1="2" y1="-3" x2="0" y2="2" stroke={PALETTE.kineticRed} strokeWidth="2.5" />
          </g>
        )}
      </svg>
    </div>
  );
};
