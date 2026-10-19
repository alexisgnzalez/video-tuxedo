import React, { useMemo } from 'react';
import { getPointAtLength } from '@remotion/paths';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface ViaductProgressProps {
  progress?: number; // 0 to 1
  chapters?: string[];
  activeChapterIndex?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

/**
 * ViaductProgress — Elevated concrete viaduct highway progress tracker.
 * Sweeps across Zone T at the top of the canvas with brutalist pillars and
 * an animated transit marker following the curve.
 */
export const ViaductProgress: React.FC<ViaductProgressProps> = ({
  progress = 0.5,
  chapters = ['INTRO', 'DESARROLLO', 'CLAVE', 'CIERRE'],
  activeChapterIndex = 1,
  width = 960,
  height = 90,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  // Viaduct S-curve path string
  const pathData = useMemo(() => {
    const y1 = height * 0.45;
    const y2 = height * 0.65;
    const cp1x = width * 0.35;
    const cp2x = width * 0.65;
    return `M 20 ${y1} C ${cp1x} ${y1 - 25}, ${cp2x} ${y2 + 25}, ${width - 20} ${y2}`;
  }, [width, height]);

  // Interpolate marker along curve based on progress
  const markerPos = useMemo(() => {
    try {
      // Estimate path length
      const approxLength = width * 1.05;
      const targetLength = Math.max(0, Math.min(approxLength, progress * approxLength));
      const pt = getPointAtLength(pathData, targetLength);
      return pt || { x: width * progress, y: height * 0.5 };
    } catch {
      return { x: width * progress, y: height * 0.5 };
    }
  }, [pathData, progress, width, height]);

  const translateY = interpolate(entrance, [0, 1], [-40, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 1, 1]);

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        transform: `translateY(${translateY}px)`,
        opacity,
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {/* Concrete Pillars */}
        {chapters.map((_, idx) => {
          const px = 40 + idx * ((width - 80) / Math.max(1, chapters.length - 1));
          const py = height * 0.55;
          return (
            <g key={idx}>
              <line
                x1={px}
                y1={py}
                x2={px}
                y2={height + 15}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="10"
              />
              <line
                x1={px}
                y1={py}
                x2={px}
                y2={height + 15}
                stroke={PALETTE.concreteGrey}
                strokeWidth="6"
              />
            </g>
          );
        })}

        {/* Viaduct Base Highway Slab */}
        <path
          d={pathData}
          fill="none"
          stroke={PALETTE.abyssalBlue}
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d={pathData}
          fill="none"
          stroke={PALETTE.concreteGrey}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Center Road Marking Stripes */}
        <path
          d={pathData}
          fill="none"
          stroke={PALETTE.creamPaper}
          strokeWidth="2.5"
          strokeDasharray="14 10"
        />

        {/* Progress highlight highway path */}
        <path
          d={pathData}
          fill="none"
          stroke={PALETTE.terracotta}
          strokeWidth="5"
          strokeDasharray={`${width * progress} ${width}`}
        />

        {/* Moving transit marker (stylized vintage car / node) */}
        <g transform={`translate(${markerPos.x}, ${markerPos.y})`}>
          <rect
            x="-16"
            y="-10"
            width="32"
            height="20"
            fill={PALETTE.abyssalBlue}
            rx="3"
          />
          <rect
            x="-14"
            y="-8"
            width="28"
            height="16"
            fill={PALETTE.kineticRed}
            rx="2"
          />
          {/* Headlights */}
          <circle cx="10" cy="-4" r="2.5" fill={PALETTE.creamPaper} />
          <circle cx="10" cy="4" r="2.5" fill={PALETTE.creamPaper} />
        </g>

        {/* Chapter milestone tags */}
        {chapters.map((ch, idx) => {
          const px = 40 + idx * ((width - 80) / Math.max(1, chapters.length - 1));
          const isActive = idx === activeChapterIndex;
          const isPassed = idx < activeChapterIndex;

          return (
            <g key={idx} transform={`translate(${px}, ${height * 0.2})`}>
              <rect
                x="-40"
                y="-14"
                width="80"
                height="22"
                fill={
                  isActive
                    ? PALETTE.kineticRed
                    : isPassed
                    ? PALETTE.forestGreen
                    : PALETTE.abyssalBlue
                }
                stroke={PALETTE.creamPaper}
                strokeWidth="1.5"
                rx="2"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                fill={PALETTE.creamPaper}
                style={{
                  ...TYPOGRAPHY.tag,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                {ch}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
