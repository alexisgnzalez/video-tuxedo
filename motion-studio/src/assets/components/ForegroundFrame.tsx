import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';

export interface ForegroundFrameProps {
  width?: number;
  height?: number;
  showStoneWall?: boolean;
  showFoliage?: boolean;
  style?: React.CSSProperties;
}

/**
 * ForegroundFrame — Stone masonry wall and tropical foliage framing.
 * Anchors the bottom corners of the video frame, framing the speaker's chest and shoulders.
 */
export const ForegroundFrame: React.FC<ForegroundFrameProps> = ({
  width = 1080,
  height = 400,
  showStoneWall = true,
  showFoliage = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const translateY = interpolate(entrance, [0, 1], [60, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 1, 1]);

  // Gentle tropical foliage breeze sway
  const sway = Math.sin(frame * 0.04) * 3;

  return (
    <div
      style={{
        width,
        height,
        position: 'absolute',
        bottom: 0,
        left: 0,
        pointerEvents: 'none',
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
        {/* 1. Stone Masonry Wall (Bottom-Left Corner) */}
        {showStoneWall && (
          <g id="stone-wall">
            {/* Base Wall Polygon */}
            <polygon
              points={`0,${height} 0,${height * 0.45} ${width * 0.22},${height * 0.58} ${width * 0.25},${height}`}
              fill={PALETTE.warmOchre}
              stroke={PALETTE.abyssalBlue}
              strokeWidth="4"
            />
            {/* Cut stone mortar courses */}
            {[0.55, 0.68, 0.82].map((yRatio, idx) => (
              <line
                key={idx}
                x1="0"
                y1={height * yRatio}
                x2={width * 0.23}
                y2={height * (yRatio + 0.08)}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="3"
              />
            ))}
            {/* Vertical mortar joins */}
            <line x1={width * 0.08} y1={height * 0.48} x2={width * 0.08} y2={height * 0.55} stroke={PALETTE.abyssalBlue} strokeWidth="3" />
            <line x1={width * 0.16} y1={height * 0.52} x2={width * 0.16} y2={height * 0.68} stroke={PALETTE.abyssalBlue} strokeWidth="3" />
            <line x1={width * 0.06} y1={height * 0.68} x2={width * 0.06} y2={height * 0.82} stroke={PALETTE.abyssalBlue} strokeWidth="3" />
            <line x1={width * 0.18} y1={height * 0.74} x2={width * 0.18} y2={height} stroke={PALETTE.abyssalBlue} strokeWidth="3" />
          </g>
        )}

        {/* 2. Lush Tropical Foliage (Right and Bottom-Center) */}
        {showFoliage && (
          <g id="tropical-foliage" transform={`rotate(${sway} ${width * 0.8} ${height})`}>
            {/* Shadow foliage layer (Forest Green) */}
            <path
              d={`M ${width * 0.55} ${height} Q ${width * 0.65} ${height * 0.7} ${width * 0.78} ${height * 0.65} Q ${width * 0.9} ${height * 0.75} ${width} ${height * 0.55} L ${width} ${height} Z`}
              fill={PALETTE.forestGreen}
              stroke={PALETTE.abyssalBlue}
              strokeWidth="3"
            />

            {/* Foreground foliage cluster (Terracotta & Ochre) */}
            <path
              d={`M ${width * 0.68} ${height} Q ${width * 0.75} ${height * 0.78} ${width * 0.86} ${height * 0.72} Q ${width * 0.95} ${height * 0.82} ${width} ${height * 0.75} L ${width} ${height} Z`}
              fill={PALETTE.terracotta}
              stroke={PALETTE.abyssalBlue}
              strokeWidth="3"
            />

            {/* Individual stylized leaf blades */}
            {[
              { cx: width * 0.75, cy: height * 0.72, r: 24, rot: -20, fill: PALETTE.forestGreen },
              { cx: width * 0.84, cy: height * 0.68, r: 28, rot: 15, fill: PALETTE.warmOchre },
              { cx: width * 0.92, cy: height * 0.62, r: 32, rot: -35, fill: PALETTE.forestGreen },
              { cx: width * 0.96, cy: height * 0.78, r: 22, rot: 40, fill: PALETTE.terracotta },
            ].map((leaf, idx) => (
              <ellipse
                key={idx}
                cx={leaf.cx}
                cy={leaf.cy}
                rx={leaf.r}
                ry={leaf.r * 0.5}
                transform={`rotate(${leaf.rot} ${leaf.cx} ${leaf.cy})`}
                fill={leaf.fill}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="2.5"
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};
