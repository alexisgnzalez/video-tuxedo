import React, { useMemo } from 'react';
import { PALETTE } from '../../styles/palette';
import { createRNG, randRange } from '../../utils/seededRandom';

interface FacetMountainProps {
  width: number;
  height: number;
  seed?: number;
  showHumboldtTower?: boolean;
  style?: React.CSSProperties;
}

interface MountainFacet {
  points: string;
  fill: string;
}

/**
 * Faceted El Ávila mountain generator with stark geometric planes.
 * Light strikes sharply from the top-left (warm ochre highlights)
 * against deep terracotta and rust shadow facets, with forest green bases.
 */
export const FacetMountain: React.FC<FacetMountainProps> = ({
  width,
  height,
  seed = 1957,
  showHumboldtTower = true,
  style,
}) => {
  const { facets, tower } = useMemo(() => {
    const rng = createRNG(seed);
    const result: MountainFacet[] = [];

    const peakX = width * 0.5 + randRange(rng, -width * 0.04, width * 0.04);
    const peakY = height * 0.15;

    // Left ridge anchor points
    const leftMidX = width * 0.22;
    const leftMidY = height * 0.55;
    const leftBaseX = -width * 0.05;
    const leftBaseY = height;

    // Right ridge anchor points
    const rightMidX = width * 0.78;
    const rightMidY = height * 0.52;
    const rightBaseX = width * 1.05;
    const rightBaseY = height;

    // Central spine points
    const spine1X = peakX - randRange(rng, 10, 25);
    const spine1Y = height * 0.42;
    const spine2X = peakX + randRange(rng, 15, 30);
    const spine2Y = height * 0.72;

    // 1. Primary Left Sunlit Facet (Warm Ochre)
    result.push({
      points: `${peakX},${peakY} ${spine1X},${spine1Y} ${leftMidX},${leftMidY}`,
      fill: PALETTE.warmOchre,
    });

    // 2. Primary Right Shadow Facet (Terracotta)
    result.push({
      points: `${peakX},${peakY} ${rightMidX},${rightMidY} ${spine1X},${spine1Y}`,
      fill: PALETTE.terracotta,
    });

    // 3. Secondary Deep Shadow Facet (Deep Rust)
    result.push({
      points: `${spine1X},${spine1Y} ${rightMidX},${rightMidY} ${spine2X},${spine2Y}`,
      fill: PALETTE.deepRust,
    });

    // 4. Left Slope Highlight (Cream Paper tint / Pale Ochre)
    result.push({
      points: `${peakX},${peakY} ${leftMidX},${leftMidY} ${width * 0.08},${height * 0.38}`,
      fill: PALETTE.warmOchre,
    });

    // 5. Far Left Base Slope
    result.push({
      points: `${leftMidX},${leftMidY} ${leftBaseX},${leftBaseY} ${width * 0.35},${height}`,
      fill: PALETTE.terracotta,
    });

    // 6. Central Sunlit Slab (Warm Ochre)
    result.push({
      points: `${spine1X},${spine1Y} ${spine2X},${spine2Y} ${leftMidX},${leftMidY}`,
      fill: PALETTE.warmOchre,
    });

    // 7. Base Lush Shadow (Forest Green)
    result.push({
      points: `${leftMidX},${leftMidY} ${spine2X},${spine2Y} ${width * 0.45},${height} ${leftBaseX},${leftBaseY}`,
      fill: PALETTE.forestGreen,
    });

    // 8. Right Base Slope (Terracotta / Deep Rust)
    result.push({
      points: `${spine2X},${spine2Y} ${rightMidX},${rightMidY} ${rightBaseX},${rightBaseY} ${width * 0.45},${height}`,
      fill: PALETTE.terracotta,
    });

    // 9. Far Right Flank
    result.push({
      points: `${peakX},${peakY} ${width * 0.95},${height * 0.32} ${rightMidX},${rightMidY}`,
      fill: PALETTE.deepRust,
    });

    // Humboldt Tower at summit
    const towerW = Math.max(16, width * 0.045);
    const towerH = Math.max(34, height * 0.16);
    const towerX = peakX - towerW / 2;
    const towerY = peakY - towerH + 2;

    return {
      facets: result,
      tower: { x: towerX, y: towerY, w: towerW, h: towerH },
    };
  }, [width, height, seed]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'block',
        overflow: 'visible',
        ...style,
      }}
    >
      {/* Mountain Facet Polygons */}
      {facets.map((f, i) => (
        <polygon
          key={i}
          points={f.points}
          fill={f.fill}
          stroke={PALETTE.abyssalBlue}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ))}

      {/* Hotel Humboldt Tower atop summit */}
      {showHumboldtTower && (
        <g id="humboldt-tower">
          {/* Base pedestal */}
          <rect
            x={tower.x - 4}
            y={tower.y + tower.h - 6}
            width={tower.w + 8}
            height={8}
            fill={PALETTE.abyssalBlue}
          />
          {/* Main cylindrical tower */}
          <rect
            x={tower.x}
            y={tower.y}
            width={tower.w}
            height={tower.h}
            fill={PALETTE.creamPaper}
            stroke={PALETTE.abyssalBlue}
            strokeWidth="1.5"
          />
          {/* Cylindrical louvers / windows */}
          {Array.from({ length: 6 }).map((_, idx) => (
            <line
              key={idx}
              x1={tower.x + 2}
              y1={tower.y + 6 + idx * (tower.h / 7)}
              x2={tower.x + tower.w - 2}
              y2={tower.y + 6 + idx * (tower.h / 7)}
              stroke={PALETTE.terracotta}
              strokeWidth="2"
            />
          ))}
          {/* Antenna mast */}
          <line
            x1={tower.x + tower.w / 2}
            y1={tower.y - 12}
            x2={tower.x + tower.w / 2}
            y2={tower.y}
            stroke={PALETTE.creamPaper}
            strokeWidth="2"
          />
          <circle
            cx={tower.x + tower.w / 2}
            cy={tower.y - 12}
            r="2.5"
            fill={PALETTE.kineticRed}
          />
        </g>
      )}
    </svg>
  );
};
