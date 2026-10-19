import React from 'react';
import { useCurrentFrame } from 'remotion';
import { PALETTE } from '../../styles/palette';

interface SotoLinesProps {
  width: number;
  height: number;
  spacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shimmerSpeed?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

/**
 * Jesús Soto Optical Vibration Lines.
 * Rhythmic thin vertical lines creating a moiré shimmer across sky cards.
 */
export const SotoLines: React.FC<SotoLinesProps> = ({
  width,
  height,
  spacing = 8,
  strokeColor = PALETTE.creamPaper,
  strokeWidth = 1.5,
  shimmerSpeed = 0.05,
  opacity = 0.85,
  style,
}) => {
  const frame = useCurrentFrame();
  const lineCount = Math.ceil(width / spacing);
  const lines: React.ReactNode[] = [];

  for (let i = 0; i <= lineCount; i++) {
    const x = i * spacing;
    // Subtle wave shimmer across the lines
    const wave = Math.sin(frame * shimmerSpeed + i * 0.2) * 1.5;

    lines.push(
      <line
        key={i}
        x1={x + wave}
        y1={0}
        x2={x - wave}
        y2={height}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'block',
        pointerEvents: 'none',
        overflow: 'hidden',
        ...style,
      }}
    >
      {lines}
    </svg>
  );
};
