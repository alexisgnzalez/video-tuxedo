import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';

export interface HyparNetProps {
  width?: number;
  height?: number;
  variant?: 'hypar' | 'polyhedron';
  style?: React.CSSProperties;
}

/**
 * HyparNet — Hyperbolic paraboloid tensile net and wireframe polyhedron sculpture.
 * Inspired by Carlos Raúl Villanueva's UCV architecture and Gego's wire meshes.
 */
export const HyparNet: React.FC<HyparNetProps> = ({
  width = 240,
  height = 240,
  variant = 'hypar',
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const scale = interpolate(entrance, [0, 1], [0.3, 1], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 1, 1]);

  if (variant === 'polyhedron') {
    // 3D wireframe geometric polyhedron (icosahedron wire)
    const rotation = (frame * 0.4) % 360;
    return (
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          opacity,
          ...style,
        }}
      >
        <svg width={width} height={height} viewBox="0 0 100 100">
          <g transform={`rotate(${rotation} 50 50)`}>
            {/* Outer Hexagon / Icosahedron outline */}
            <polygon
              points="50,10 85,30 85,70 50,90 15,70 15,30"
              fill="none"
              stroke={PALETTE.creamPaper}
              strokeWidth="2.5"
            />
            {/* Internal Triangulation Struts */}
            <line x1="50" y1="10" x2="50" y2="90" stroke={PALETTE.warmOchre} strokeWidth="1.5" />
            <line x1="15" y1="30" x2="85" y2="70" stroke={PALETTE.terracotta} strokeWidth="1.5" />
            <line x1="15" y1="70" x2="85" y2="30" stroke={PALETTE.terracotta} strokeWidth="1.5" />
            <polygon
              points="50,28 72,42 72,58 50,72 28,58 28,42"
              fill="none"
              stroke={PALETTE.creamPaper}
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>
    );
  }

  // Variant: Hypar Tensile Net on angled poles
  return (
    <div
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        opacity,
        ...style,
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Support Mast Poles */}
        <line
          x1={width * 0.15}
          y1={height * 0.9}
          x2={width * 0.25}
          y2={height * 0.1}
          stroke={PALETTE.abyssalBlue}
          strokeWidth="6"
        />
        <line
          x1={width * 0.85}
          y1={height * 0.95}
          x2={width * 0.75}
          y2={height * 0.15}
          stroke={PALETTE.abyssalBlue}
          strokeWidth="6"
        />

        {/* Parabolic Ruled Surface Netting */}
        {Array.from({ length: 10 }).map((_, idx) => {
          const t = idx / 9;
          const p1x = width * 0.25 + t * (width * 0.5);
          const p1y = height * 0.1 + t * (height * 0.6);
          const p2x = width * 0.15 + t * (width * 0.7);
          const p2y = height * 0.85 - t * (height * 0.4);

          return (
            <line
              key={idx}
              x1={p1x}
              y1={p1y}
              x2={p2x}
              y2={p2y}
              stroke={idx % 2 === 0 ? PALETTE.creamPaper : PALETTE.terracotta}
              strokeWidth="1.75"
            />
          );
        })}
      </svg>
    </div>
  );
};
