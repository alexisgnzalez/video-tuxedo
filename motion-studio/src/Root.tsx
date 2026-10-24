import React from 'react';
import { Composition, staticFile } from 'remotion';
import { getVideoMetadata } from '@remotion/media-utils';
import { TalkingHeadOverlay } from './compositions/TalkingHeadOverlay';
import { PosterPlate } from './compositions/PosterPlate';
import { MainVideo } from './MainVideo';
import { MainVideoSchema, MainVideoProps } from './schema';
import defaultDirectorPlan from '../public/director_plan.json';
import { DEFAULT_PLAN, ScenePlan } from './types';
import { TuxedoEdit } from './compositions/TuxedoEdit';
import { TuxedoEditSchema } from './editSchema';



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
          if ((props as any).durationInFrames && (props as any).durationInFrames > 0) {
            return {
              durationInFrames: (props as any).durationInFrames,
              fps: (props as any).fps || 30,
              width: 1080,
              height: 1920,
              props,
            };
          }
          let durationInSeconds = 10;
          try {
            if (props.videoFileName) {
              let clean = props.videoFileName.replace(/^\/+/, '');
              if (clean.startsWith('public/')) clean = clean.replace(/^public\//, '');
              const videoSrc = `http://127.0.0.1:8000/public/${clean}`;
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

      {/* 4. Tuxedo Editor (End-to-End Comedic Jump-Cut & Kinetic Graphics) */}
      <Composition
        id="TuxedoEdit"
        component={TuxedoEdit as any}
        schema={TuxedoEditSchema as any}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          composition: 'TuxedoEdit',
          slug: 'demo',
          mode: 'edl',
          fps: 30,
          durationInFrames: 300,
          sourceUrl: '',
          conformUrl: '',
          cutoutUrl: '',
          clips: [],
          captions: { enabled: true, cues: [], style: {} },
          layers: [],
          graphics: { style: 'story_tuxedo', settings: {}, items: [] },
          preview: { showSafeZones: false, muteAudio: false },
        }}
        calculateMetadata={async ({ props }) => {
          const p = props as any;
          const fps = p.fps || 30;
          let durFrames = p.durationInFrames;
          if (!durFrames || durFrames <= 0) {
            if (p.conform && p.conform.duration && p.conform.duration > 0) {
              durFrames = Math.round(p.conform.duration * fps);
            } else if (p.clips && p.clips.length > 0) {
              const durSec = p.clips.reduce(
                (acc: number, c: any) => acc + Math.max(0, (c.srcOut || 0) - (c.srcIn || 0)),
                0
              );
              durFrames = Math.round(durSec * fps);
            } else if (p.source && p.source.duration && p.source.duration > 0) {
              durFrames = Math.round(p.source.duration * fps);
            } else {
              durFrames = 300;
            }
          }
          return {
            durationInFrames: Math.max(30, durFrames),
            fps,
            width: 1080,
            height: 1920,
            props: p,
          };
        }}
      />
    </>
  );
};

