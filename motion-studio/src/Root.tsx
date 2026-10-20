import React from 'react';
import { Composition, staticFile } from 'remotion';
import { getVideoMetadata } from '@remotion/media-utils';
import { TalkingHeadOverlay } from './compositions/TalkingHeadOverlay';
import { PosterPlate } from './compositions/PosterPlate';
import { MainVideo } from './MainVideo';
import { MainVideoSchema, MainVideoProps } from './schema';
import defaultDirectorPlan from '../public/director_plan.json';
import { DEFAULT_PLAN, ScenePlan } from './types';

export const Root: React.FC = () => {
  return (
    <>
      {/* 1. Comedic Storytelling 3-Layer Sandwich Composition */}
      <Composition
        id="StoryTuxedo"
        component={MainVideo as any}
        schema={MainVideoSchema}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultDirectorPlan as MainVideoProps}
        calculateMetadata={async ({ props }) => {
          let durationInSeconds = 10;
          try {
            if (props.videoFileName) {
              let clean = props.videoFileName.replace(/^\/+/, '');
              if (clean.startsWith('public/')) clean = clean.replace(/^public\//, '');
              const videoSrc = staticFile(clean);
              const metadata = await getVideoMetadata(videoSrc);
              if (metadata && metadata.durationInSeconds > 0) {
                durationInSeconds = metadata.durationInSeconds;
              }
            }
          } catch {
            // Fallback: estimate from cues or words timing
            const maxCueTime = Math.max(
              10,
              ...(props.cues || []).map((c) => c.endTime),
              ...(props.words || []).map((w) => w.end)
            );
            durationInSeconds = maxCueTime;
          }

          return {
            durationInFrames: Math.max(30, Math.floor(durationInSeconds * 30)),
            fps: 30,
            width: 1080,
            height: 1920,
            props,
          };
        }}
      />

      {/* 2. Caracas Mid-Century Kinetic Poster Talking Head Overlay */}
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

      {/* 3. Fullscreen Cutaway Poster Plates */}
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

