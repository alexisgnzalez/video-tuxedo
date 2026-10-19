import React from 'react';
import { Composition } from 'remotion';
import { TalkingHeadOverlay, TalkingHeadOverlayProps } from './compositions/TalkingHeadOverlay';
import { PosterPlate } from './compositions/PosterPlate';
import { DEFAULT_PLAN, ScenePlan } from './types';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TalkingHeadOverlay"
        component={TalkingHeadOverlay as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          plan: DEFAULT_PLAN,
        }}
        calculateMetadata={async ({ props }) => {
          const plan = (props as { plan?: ScenePlan }).plan || DEFAULT_PLAN;
          return {
            durationInFrames: Math.max(30, plan.durationInFrames || 300),
            fps: plan.fps || 30,
            width: 1080,
            height: 1920,
          };
        }}
      />

      <Composition
        id="PosterPlateAvila"
        component={PosterPlate}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          variant: 'avila' as const,
          title: 'CARACAS',
          subtitle: 'EL ÁVILA Y SU CINETISMO',
          seed: 1957,
          showGrain: true,
        }}
      />

      <Composition
        id="PosterPlatePetare"
        component={PosterPlate}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          variant: 'petare' as const,
          title: 'CARACAS',
          subtitle: 'PETARE Y SU MODERNISMO',
          seed: 1957,
          showGrain: true,
        }}
      />
    </>
  );
};
