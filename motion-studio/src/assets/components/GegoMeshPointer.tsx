import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';

export interface GegoMeshPointerProps {
  start?: [number, number]; // [x, y]
  end?: [number, number]; // [x, y]
  lineCount?: number;
  label?: string;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * GegoMeshPointer — Gego (Gertrud Goldschmidt) inspired hyperbolic wire mesh connector.
 * Draws mathematical ruled-surface parabolic strings connecting the speaker to a graphic callout.
 */
export const GegoMeshPointer: React.FC<GegoMeshPointerProps> = ({
  start = [150, 400],
  end = [420, 220],
  lineCount = 12,
  label,
  color = PALETTE.creamPaper,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const [x1, y1] = start;
  const [x2, y2] = end;

  // Midpoint curvature control
  const cx = (x1 + x2) / 2 + (y2 - y1) * 0.25;
  const cy = (y1 + y2) / 2 - (x2 - x1) * 0.25;

  const lines: React.ReactNode[] = [];

  for (let i = 0; i < lineCount; i++) {
    const t = i / (lineCount - 1);
    // Interpolate points on two parametric curves
    const lx1 = x1 + (cx - x1) * t;
    const ly1 = y1 + (cy - y1) * t;

    const lx2 = cx + (x2 - cx) * t;
    const ly2 = cy + (y2 - cy) * t;

    const strokeDraw = interpolate(progress, [0, 1], [0, 1], {
      extrapolateRight: 'clamp',
    });

    lines.push(
      <line
        key={i}
        x1={lx1}
        y1={ly1}
        x2={lx1 + (lx2 - lx1) * strokeDraw}
        y2={ly1 + (ly2 - ly1) * strokeDraw}
        stroke={i % 2 === 0 ? color : PALETTE.terracotta}
        strokeWidth={i === 0 || i === lineCount - 1 ? 2.5 : 1.5}
        strokeOpacity={0.9}
      />
    );
  }

  // Target indicator node
  const nodeScale = interpolate(progress, [0.6, 1], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const minX = Math.min(x1, x2, cx) - 40;
  const minY = Math.min(y1, y2, cy) - 40;
  const maxX = Math.max(x1, x2, cx) + 40;
  const maxY = Math.max(y1, y2, cy) + 40;
  const width = Math.max(100, maxX - minX);
  const height = Math.max(100, maxY - minY);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <g>{lines}</g>

        {/* Start node */}
        <circle
          cx={x1}
          cy={y1}
          r={6 * nodeScale}
          fill={PALETTE.warmOchre}
          stroke={PALETTE.abyssalBlue}
          strokeWidth="2"
        />

        {/* End node arrow/ring */}
        <circle
          cx={x2}
          cy={y2}
          r={9 * nodeScale}
          fill="none"
          stroke={PALETTE.creamPaper}
          strokeWidth="3"
        />
        <circle
          cx={x2}
          cy={y2}
          r={4 * nodeScale}
          fill={PALETTE.kineticRed}
        />
      </svg>
    </div>
  );
};
