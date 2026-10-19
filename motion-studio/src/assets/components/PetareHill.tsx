import React, { useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING, PALETTE, steppedFrame } from '../../styles/palette';
import { createRNG, randChoice, randRange } from '../../utils/seededRandom';

export interface PetareHillProps {
  width?: number;
  height?: number;
  seed?: number;
  title?: string;
  style?: React.CSSProperties;
}

interface House {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  windowCount: number;
  delay: number;
}

const HOUSE_PALETTE = [
  PALETTE.barrioBlue,
  PALETTE.terracotta,
  PALETTE.warmOchre,
  PALETTE.creamPaper,
  PALETTE.concreteGrey,
] as const;

/**
 * PetareHill — Procedural hillside community from the "Petare y su Modernismo" poster.
 * Hill of stacked modernist modular cubic houses punctuated by dark windows and zig-zag stairways.
 */
export const PetareHill: React.FC<PetareHillProps> = ({
  width = 460,
  height = 360,
  seed = 1957,
  title,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stepped = steppedFrame(frame, fps, 12);

  const { houses, stairs } = useMemo(() => {
    const rng = createRNG(seed);
    const houseList: House[] = [];
    const layers = 5;

    for (let layer = 0; layer < layers; layer++) {
      const layerProgress = layer / (layers - 1); // 0 (top) to 1 (bottom)
      const rowY = height * 0.15 + layerProgress * (height * 0.7);
      const rowW = width * (0.35 + layerProgress * 0.65);
      const startX = (width - rowW) / 2;
      const count = 3 + layer * 2;
      const houseW = rowW / count;

      for (let i = 0; i < count; i++) {
        const hx = startX + i * houseW + randRange(rng, -6, 6);
        const hy = rowY + randRange(rng, -8, 8);
        const hw = houseW * randRange(rng, 0.85, 1.15);
        const hh = Math.max(22, 28 + randRange(rng, -6, 12));
        const color = randChoice(rng, HOUSE_PALETTE);
        const windowCount = Math.floor(randRange(rng, 1, 4));
        const delay = Math.floor(layer * 4 + i * 2);

        houseList.push({
          x: hx,
          y: hy,
          w: hw,
          h: hh,
          color,
          windowCount,
          delay,
        });
      }
    }

    // Zig-zag concrete stairs winding down the hill
    const stairSegments = [
      `M ${width * 0.5} ${height * 0.1} L ${width * 0.46} ${height * 0.3} L ${width * 0.53} ${height * 0.52} L ${width * 0.44} ${height * 0.75} L ${width * 0.51} ${height * 0.95}`,
    ];

    return { houses: houseList, stairs: stairSegments };
  }, [width, height, seed]);

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {/* Background Hill Silhouette */}
        <polygon
          points={`${width * 0.5},${height * 0.08} ${width * 0.95},${height} ${width * 0.05},${height}`}
          fill={PALETTE.forestGreen}
          stroke={PALETTE.abyssalBlue}
          strokeWidth="3"
        />

        {/* Houses building up with staggered vintage spring */}
        {houses.map((h, idx) => {
          const hEntrance = spring({
            frame: Math.max(0, stepped - h.delay),
            fps,
            config: KINETIC_SPRING,
          });

          const scale = interpolate(hEntrance, [0, 1], [0.3, 1], {
            extrapolateRight: 'clamp',
          });
          const opacity = interpolate(hEntrance, [0, 0.3, 1], [0, 1, 1]);

          return (
            <g
              key={idx}
              transform={`translate(${h.x + h.w / 2}, ${h.y + h.h / 2}) scale(${scale}) translate(${-h.x - h.w / 2}, ${-h.y - h.h / 2})`}
              opacity={opacity}
            >
              {/* House volume */}
              <rect
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                fill={h.color}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="1.75"
              />
              {/* Roof overhang line */}
              <line
                x1={h.x - 2}
                y1={h.y}
                x2={h.x + h.w + 2}
                y2={h.y}
                stroke={PALETTE.abyssalBlue}
                strokeWidth="2.5"
              />
              {/* Punctured dark windows */}
              {Array.from({ length: h.windowCount }).map((_, wIdx) => {
                const winSpacing = h.w / (h.windowCount + 1);
                const winX = h.x + (wIdx + 1) * winSpacing - 3;
                const winY = h.y + h.h * 0.35;
                return (
                  <rect
                    key={wIdx}
                    x={winX}
                    y={winY}
                    width="6"
                    height="7"
                    fill={PALETTE.abyssalBlue}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Concrete Zig-Zag Hillside Stairway */}
        {stairs.map((d, sIdx) => (
          <path
            key={sIdx}
            d={d}
            fill="none"
            stroke={PALETTE.creamPaper}
            strokeWidth="3"
            strokeDasharray="4 4"
          />
        ))}
      </svg>
    </div>
  );
};
