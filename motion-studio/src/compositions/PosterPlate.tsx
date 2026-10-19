import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PaperGrain } from '../assets/primitives/PaperGrain';
import { PosterTitleCard } from '../assets/components/PosterTitleCard';
import { AvilaPeak } from '../assets/components/AvilaPeak';
import { PetareHill } from '../assets/components/PetareHill';
import { ViaductSweep } from '../assets/components/ViaductSweep';
import { CruzDiezWall } from '../assets/components/CruzDiezWall';
import { HyparNet } from '../assets/components/HyparNet';
import { ForegroundFrame } from '../assets/components/ForegroundFrame';
import { PALETTE } from '../styles/palette';

export interface PosterPlateProps {
  variant?: 'avila' | 'petare';
  title?: string;
  subtitle?: string;
  seed?: number;
  showGrain?: boolean;
}

/**
 * PosterPlate — Full 1080x1920 Mid-Century Kinetic Poster Scene.
 * Recreates the complete Caracas poster aesthetic across all landscape layers.
 */
export const PosterPlate: React.FC<PosterPlateProps> = ({
  variant = 'avila',
  title = 'CARACAS',
  subtitle = variant === 'avila' ? 'EL ÁVILA Y SU CINETISMO' : 'PETARE Y SU MODERNISMO',
  seed = 1957,
  showGrain = true,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: PALETTE.skyTeal,
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 1. Sky & Title Header (Zone T) */}
      <div style={{ position: 'absolute', top: 80, left: 60, zIndex: 10 }}>
        <PosterTitleCard
          title={title}
          subtitle={subtitle}
          width={960}
          height={320}
        />
      </div>

      {/* 2. Mountain Summit / Petare Hill Layer */}
      <div
        style={{
          position: 'absolute',
          top: 380,
          left: 0,
          width: 1080,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 3,
        }}
      >
        {variant === 'avila' ? (
          <AvilaPeak
            width={780}
            height={580}
            seed={seed}
            label={title}
            sublabel={subtitle}
          />
        ) : (
          <PetareHill
            width={760}
            height={520}
            seed={seed}
          />
        )}
      </div>

      {/* 3. Modernist Architecture & Hypar Sculptures */}
      <div style={{ position: 'absolute', top: 780, left: 60, zIndex: 4 }}>
        <HyparNet width={220} height={220} variant="polyhedron" />
      </div>
      <div style={{ position: 'absolute', top: 740, right: 60, zIndex: 4 }}>
        <HyparNet width={260} height={260} variant="hypar" />
      </div>

      {/* 4. Viaduct Highway S-Curve with vehicles */}
      <div style={{ position: 'absolute', top: 920, left: 40, zIndex: 5 }}>
        <ViaductSweep width={1000} height={520} showCyclist={true} />
      </div>

      {/* 5. Cruz-Diez Architectural Physichromie Wall */}
      <div style={{ position: 'absolute', bottom: 320, right: 60, zIndex: 6 }}>
        <CruzDiezWall width={580} height={180} speed={20} />
      </div>

      {/* 6. Foreground Stone Wall & Foliage Framing */}
      <ForegroundFrame width={1080} height={420} showStoneWall={true} showFoliage={true} />

      {/* 7. Screen-Printed Vintage Paper Texture Overlay */}
      {showGrain && <PaperGrain width={1080} height={1920} opacity={0.2} />}
    </AbsoluteFill>
  );
};
