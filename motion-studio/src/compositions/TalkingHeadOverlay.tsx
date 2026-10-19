import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import { ComponentId, DEFAULT_PLAN, Scene, ScenePlan, SfxCue, ZoneId } from '../types';
import { resolveSceneZones } from '../styles/safeZones';
import { FontLoader } from '../styles/typography';
import { PALETTE } from '../styles/palette';

// Component imports
import { CruzDiezBadge } from '../assets/components/CruzDiezBadge';
import { AvilaFacetCard } from '../assets/components/AvilaFacetCard';
import { GegoMeshPointer } from '../assets/components/GegoMeshPointer';
import { BrutalistLowerThird } from '../assets/components/BrutalistLowerThird';
import { ViaductProgress } from '../assets/components/ViaductProgress';
import { KineticCaption } from '../assets/components/KineticCaption';
import { PosterTitleCard } from '../assets/components/PosterTitleCard';
import { AvilaPeak } from '../assets/components/AvilaPeak';
import { PetareHill } from '../assets/components/PetareHill';
import { ViaductSweep } from '../assets/components/ViaductSweep';
import { CruzDiezWall } from '../assets/components/CruzDiezWall';
import { HyparNet } from '../assets/components/HyparNet';
import { ForegroundFrame } from '../assets/components/ForegroundFrame';
import { PosterPlate } from './PosterPlate';

export interface TalkingHeadOverlayProps {
  plan?: ScenePlan;
}

export const TalkingHeadOverlay: React.FC<TalkingHeadOverlayProps> = ({
  plan = DEFAULT_PLAN,
}) => {
  const { fps, width, height } = useVideoConfig();

  // Helper to render component by ID
  const renderComponent = (componentId: ComponentId, props: Record<string, unknown>) => {
    switch (componentId) {
      case 'CruzDiezBadge':
        return <CruzDiezBadge {...props} />;
      case 'AvilaFacetCard':
        return <AvilaFacetCard {...props} />;
      case 'GegoMeshPointer':
        return <GegoMeshPointer {...props} />;
      case 'BrutalistLowerThird':
        return <BrutalistLowerThird {...props} />;
      case 'ViaductProgress':
        return <ViaductProgress {...props} />;
      case 'KineticCaption':
        return <KineticCaption {...props} />;
      case 'PosterTitleCard':
        return <PosterTitleCard {...props} />;
      case 'AvilaPeak':
        return <AvilaPeak {...props} />;
      case 'PetareHill':
        return <PetareHill {...props} />;
      case 'ViaductSweep':
        return <ViaductSweep {...props} />;
      case 'CruzDiezWall':
        return <CruzDiezWall {...props} />;
      case 'HyparNet':
        return <HyparNet {...props} />;
      case 'ForegroundFrame':
        return <ForegroundFrame {...props} />;
      default:
        return null;
    }
  };

  const isBackgroundMode = plan.mode === 'z-background';
  const showSafeZones = plan.preview?.showSafeZones ?? false;
  const showSourceVideo = plan.preview?.showSourceVideo ?? false;

  return (
    <AbsoluteFill
      style={{
        backgroundColor:
          plan.render?.background ||
          (isBackgroundMode ? PALETTE.skyTeal : PALETTE.transparent),
        width,
        height,
        overflow: 'hidden',
      }}
    >
      <FontLoader />

      {/* 1. Optional Preview Source Video Underneath (Preview Only) */}
      {showSourceVideo && plan.source?.url && (
        <video
          src={plan.source.url}
          muted={plan.preview?.muteSource ?? true}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            objectFit: 'cover',
            zIndex: 1,
          }}
        />
      )}

      {/* 2. Optional Background Plate (Mode 3: z-background) */}
      {isBackgroundMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
          <PosterPlate
            variant={plan.plate?.variant ?? 'avila'}
            title={plan.plate?.title ?? 'CARACAS'}
            subtitle={plan.plate?.subtitle ?? 'EL ÁVILA Y SU CINETISMO'}
            seed={plan.seed ?? 1957}
            showGrain={false}
          />
        </div>
      )}

      {/* 3. Dynamic Scene Sequences */}
      {plan.scenes.map((scene: Scene) => {
        const resolved = resolveSceneZones(
          plan.subjectTrack,
          scene.from,
          scene.durationInFrames,
          fps,
          plan.platform,
          plan.subjectOverride
        );

        const targetZone = resolved.zones[scene.zone] || resolved.zones.T;

        return (
          <Sequence
            key={scene.id}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
            name={`${scene.component} (${scene.zone})`}
          >
            {/* Position inside resolved safe zone */}
            <div
              style={{
                position: 'absolute',
                left: targetZone.x,
                top: targetZone.y,
                width: targetZone.w,
                height: targetZone.h,
                display: 'flex',
                alignItems:
                  scene.zone === 'B'
                    ? 'flex-end'
                    : scene.zone === 'T'
                    ? 'flex-start'
                    : 'center',
                justifyContent:
                  scene.zone === 'L'
                    ? 'flex-start'
                    : scene.zone === 'R'
                    ? 'flex-end'
                    : 'center',
                zIndex: 10,
              }}
            >
              {renderComponent(scene.component, scene.props)}
            </div>

            {/* Attached SFX Cues */}
            {scene.sfx &&
              scene.sfx.map((sfxCue: SfxCue, sIdx: number) => {
                const variantNum = sfxCue.variant || 1;
                const sfxFilename = `sfx/${sfxCue.id.toLowerCase()}_v${variantNum}.wav`;
                return (
                  <Sequence key={sIdx} from={sfxCue.at}>
                    <Audio
                      src={staticFile(sfxFilename)}
                      volume={sfxCue.volume ?? 0.35}
                    />
                  </Sequence>
                );
              })}
          </Sequence>
        );
      })}

      {/* 4. Global Captions (Zone B) if enabled */}
      {plan.captions?.enabled && plan.captions.cues?.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 360,
            left: 0,
            width: '100%',
            zIndex: 30,
          }}
        >
          <KineticCaption cues={plan.captions.cues} width={880} />
        </div>
      )}

      {/* 5. Safe Zone & Exclusion Debug Overlay (Preview Only) */}
      {showSafeZones && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          {(() => {
            const currentZones = resolveSceneZones(
              plan.subjectTrack,
              0,
              plan.durationInFrames,
              fps,
              plan.platform,
              plan.subjectOverride
            );

            return (
              <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Platform margins */}
                <rect
                  x="0"
                  y="0"
                  width={width}
                  height={currentZones.margins.top}
                  fill="rgba(217, 56, 30, 0.15)"
                />
                <rect
                  x="0"
                  y={height - currentZones.margins.bottom}
                  width={width}
                  height={currentZones.margins.bottom}
                  fill="rgba(217, 56, 30, 0.25)"
                />
                <rect
                  x={width - currentZones.margins.right}
                  y="0"
                  width={currentZones.margins.right}
                  height={height}
                  fill="rgba(217, 56, 30, 0.15)"
                />

                {/* Subject exclusion box */}
                <rect
                  x={currentZones.subjectBox.x}
                  y={currentZones.subjectBox.y}
                  width={currentZones.subjectBox.w}
                  height={currentZones.subjectBox.h}
                  fill="none"
                  stroke={PALETTE.warmOchre}
                  strokeWidth="2"
                  strokeDasharray="6 6"
                />

                {/* Face NO-GO box */}
                <rect
                  x={currentZones.faceNoGoBox.x}
                  y={currentZones.faceNoGoBox.y}
                  width={currentZones.faceNoGoBox.w}
                  height={currentZones.faceNoGoBox.h}
                  fill="rgba(217, 56, 30, 0.2)"
                  stroke={PALETTE.kineticRed}
                  strokeWidth="3"
                />
                <text
                  x={currentZones.faceNoGoBox.x + 10}
                  y={currentZones.faceNoGoBox.y + 24}
                  fill={PALETTE.creamPaper}
                  fontSize="14"
                  fontWeight="bold"
                >
                  FACE NO-GO ZONE
                </text>

                {/* Active Zone outlines */}
                {(['T', 'L', 'R', 'B'] as ZoneId[]).map((zid) => {
                  const z = currentZones.zones[zid];
                  return (
                    <g key={zid}>
                      <rect
                        x={z.x}
                        y={z.y}
                        width={z.w}
                        height={z.h}
                        fill="none"
                        stroke={PALETTE.kineticGreen}
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={z.x + 8}
                        y={z.y + 20}
                        fill={PALETTE.kineticGreen}
                        fontSize="14"
                        fontWeight="bold"
                      >
                        ZONE {zid}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>
      )}
    </AbsoluteFill>
  );
};
