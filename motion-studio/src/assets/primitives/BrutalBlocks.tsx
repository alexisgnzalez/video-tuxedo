import React, { useMemo } from 'react';
import { PALETTE } from '../../styles/palette';
import { createRNG, randChoice, randRange } from '../../utils/seededRandom';

interface BrutalBlocksProps {
  width: number;
  height: number;
  rows?: number;
  cols?: number;
  seed?: number;
  includeWindows?: boolean;
  style?: React.CSSProperties;
}

interface BlockDef {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  hasWindow: boolean;
  winX: number;
  winY: number;
}

const BLOCK_COLORS = [
  PALETTE.terracotta,
  PALETTE.warmOchre,
  PALETTE.concreteGrey,
  PALETTE.creamPaper,
  PALETTE.barrioBlue,
] as const;

/**
 * Procedural Tropical Brutalist / Petare modular block generator.
 * Staggered stacked rectangular volumes with clean borders and dark square window punctures.
 */
export const BrutalBlocks: React.FC<BrutalBlocksProps> = ({
  width,
  height,
  rows = 4,
  cols = 3,
  seed = 42,
  includeWindows = true,
  style,
}) => {
  const blocks = useMemo(() => {
    const rng = createRNG(seed);
    const list: BlockDef[] = [];
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Organic jitter to simulate stacked hillside volumes
        const jitterW = randRange(rng, -cellW * 0.15, cellW * 0.15);
        const jitterH = randRange(rng, -cellH * 0.12, cellH * 0.12);
        const bw = Math.max(20, cellW + jitterW);
        const bh = Math.max(16, cellH + jitterH);
        const bx = c * cellW + randRange(rng, -4, 4);
        const by = r * cellH + randRange(rng, -3, 3);
        const fill = randChoice(rng, BLOCK_COLORS);

        const hasWindow = includeWindows && rng() > 0.35;
        const winX = bx + bw * 0.35;
        const winY = by + bh * 0.3;

        list.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          fill,
          hasWindow,
          winX,
          winY,
        });
      }
    }
    return list;
  }, [width, height, rows, cols, seed, includeWindows]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'block',
        overflow: 'hidden',
        border: `3px solid ${PALETTE.abyssalBlue}`,
        backgroundColor: PALETTE.abyssalBlue,
        ...style,
      }}
    >
      {blocks.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={b.fill}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="2"
          />
          {b.hasWindow && (
            <rect
              x={b.winX}
              y={b.winY}
              width={Math.max(4, b.w * 0.26)}
              height={Math.max(4, b.h * 0.28)}
              fill={PALETTE.abyssalBlue}
            />
          )}
        </g>
      ))}
    </svg>
  );
};
