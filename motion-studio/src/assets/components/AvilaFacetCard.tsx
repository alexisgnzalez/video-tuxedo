import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FacetMountain } from '../primitives/FacetMountain';
import { OpticalStripes } from '../primitives/OpticalStripes';
import { KINETIC_SPRING, PALETTE } from '../../styles/palette';
import { TYPOGRAPHY } from '../../styles/typography';

export interface AvilaFacetCardProps {
  heading?: string;
  subheading?: string;
  bullets?: string[];
  width?: number;
  seed?: number;
  style?: React.CSSProperties;
}

/**
 * AvilaFacetCard — Mountain-topped information card.
 * Crowned by faceted El Ávila peaks, containing staggered
 * brutalist bullet points and optical progress stripe base.
 */
export const AvilaFacetCard: React.FC<AvilaFacetCardProps> = ({
  heading = 'PUNTOS CLAVE',
  subheading,
  bullets = ['Primer concepto fundamental', 'Segunda idea de desarrollo', 'Conclusión y llamado a la acción'],
  width = 520,
  seed = 1957,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Snappy card entrance
  const cardEntrance = spring({
    frame,
    fps,
    config: KINETIC_SPRING,
  });

  const translateY = interpolate(cardEntrance, [0, 1], [60, 0], {
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(cardEntrance, [0, 0.3, 1], [0, 1, 1]);

  const mountainHeight = 110;

  return (
    <div
      style={{
        width,
        position: 'relative',
        transform: `translateY(${translateY}px)`,
        opacity,
        filter: `drop-shadow(6px 6px 0px ${PALETTE.abyssalBlue})`,
        ...style,
      }}
    >
      {/* 1. Mountain Facet Top Crown */}
      <div
        style={{
          width,
          height: mountainHeight,
          overflow: 'hidden',
          marginBottom: -4,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <FacetMountain
          width={width}
          height={mountainHeight + 20}
          seed={seed}
          showHumboldtTower={true}
        />
      </div>

      {/* 2. Main Card Slab */}
      <div
        style={{
          width,
          backgroundColor: PALETTE.skyTeal,
          border: `4px solid ${PALETTE.abyssalBlue}`,
          borderTop: 'none',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 3,
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            backgroundColor: PALETTE.abyssalBlue,
            padding: '12px 20px',
            borderBottom: `3px solid ${PALETTE.terracotta}`,
          }}
        >
          {subheading && (
            <div
              style={{
                ...TYPOGRAPHY.tag,
                fontSize: 14,
                color: PALETTE.warmOchre,
                marginBottom: 4,
              }}
            >
              {subheading}
            </div>
          )}
          <h2
            style={{
              ...TYPOGRAPHY.calloutHeader,
              fontSize: 26,
              color: PALETTE.creamPaper,
              textShadow: 'none',
            }}
          >
            {heading}
          </h2>
        </div>

        {/* Bullets List with staggered entrance */}
        <div style={{ padding: '18px 22px' }}>
          {bullets.map((bullet, idx) => {
            const bulletDelay = 12 + idx * 14;
            const bSpring = spring({
              frame: Math.max(0, frame - bulletDelay),
              fps,
              config: KINETIC_SPRING,
            });
            const bTranslateX = interpolate(bSpring, [0, 1], [-25, 0], {
              extrapolateRight: 'clamp',
            });
            const bOpacity = interpolate(bSpring, [0, 0.4, 1], [0, 1, 1]);

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  marginBottom: idx === bullets.length - 1 ? 0 : 14,
                  transform: `translateX(${bTranslateX}px)`,
                  opacity: bOpacity,
                }}
              >
                {/* Mid-century bullet point facet indicator */}
                <div
                  style={{
                    width: 14,
                    height: 14,
                    minWidth: 14,
                    backgroundColor: PALETTE.terracotta,
                    border: `2px solid ${PALETTE.creamPaper}`,
                    transform: 'rotate(45deg)',
                    marginTop: 5,
                    marginRight: 14,
                  }}
                />
                <div
                  style={{
                    ...TYPOGRAPHY.bullet,
                    fontSize: 20,
                  }}
                >
                  {bullet}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Cruz-Diez Stripe Footing */}
        <div style={{ width: '100%', height: 12, overflow: 'hidden' }}>
          <OpticalStripes
            width={width}
            height={12}
            stripeWidth={10}
            speed={12}
            angle={0}
            style={{ border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};
