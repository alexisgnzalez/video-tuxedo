import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Video,
  Audio,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { MainVideoProps, VisualCue } from './schema';
import { KineticTitleBehind } from './components/KineticTitleBehind';
import { PunchlinePopup } from './components/PunchlinePopup';
import { FloatingEmojiCluster } from './components/FloatingEmojiCluster';
import { ComicAlertBanner } from './components/ComicAlertBanner';
import { TikTokCaptions } from './components/TikTokCaptions';

const resolveMediaSrc = (fn?: string) => {
  if (!fn) return '';
  if (fn.startsWith('http://') || fn.startsWith('https://')) {
    return fn;
  }
  let clean = fn.replace(/^\/+/, '');
  if (clean.startsWith('public/')) {
    clean = clean.replace(/^public\//, '');
  }
  return `http://127.0.0.1:8000/public/${clean}`;
};

const renderCueComponent = (cue: VisualCue) => {
  const mergedProps = (cue as any).props ? { ...(cue as any).props, ...cue } : cue;
  switch (cue.component) {
    case 'KineticTitleBehind':
      return <KineticTitleBehind {...mergedProps} />;
    case 'FloatingEmojiCluster':
      return <FloatingEmojiCluster {...mergedProps} />;
    case 'ComicAlertBanner':
      return <ComicAlertBanner {...mergedProps} />;
    case 'PunchlinePopup':
    default:
      return <PunchlinePopup {...mergedProps} />;
  }
};

export interface ExtendedMainVideoProps extends MainVideoProps {
  previewMode?: boolean;
  showVideo?: boolean;
  volume?: number;
  muteAudio?: boolean;
  sourceUrl?: string;
}

const getCueSfxFile = (cue: VisualCue): string | undefined => {
  if (cue.sfxFile && cue.sfxFile !== 'none') return cue.sfxFile;
  if ((cue as any).sfx && Array.isArray((cue as any).sfx) && (cue as any).sfx.length > 0) {
    const firstSfx = (cue as any).sfx[0];
    if (firstSfx && firstSfx.id && firstSfx.id !== 'none') return firstSfx.id;
  }
  return undefined;
};

const getSfxVolume = (sfxFile?: string) => {
  if (!sfxFile || sfxFile === 'none') return 0;
  if (sfxFile.includes('vine_boom')) return 0.08; // Very subtle sub-bass boom so speech is never masked
  if (sfxFile.includes('ding')) return 0.10;
  if (sfxFile.includes('pop')) return 0.12;
  if (sfxFile.includes('whoosh')) return 0.10;
  return 0.10;
};

export const MainVideo: React.FC<ExtendedMainVideoProps> = ({
  videoFileName,
  maskVideoFileName,
  renderMode = 'full_composite',
  cues = [],
  words = [],
  previewMode = false,
  showVideo = true,
  volume = 1,
  muteAudio = false,
  sourceUrl,
}) => {
  const { fps } = useVideoConfig();

  const behindCues = cues.filter((c) => c.layer === 'behind_subject');
  const frontCues = cues.filter((c) => c.layer === 'in_front_of_subject');

  // In DaVinci alpha export, Layer 1 is omitted only if renderMode === 'overlays_only_for_davinci' and NOT in preview mode.
  // In the browser preview player, the creator MUST see the video and hear audio to review motion graphics.
  const isTransparentExport = !previewMode && renderMode === 'overlays_only_for_davinci';
  const shouldRenderVideo = showVideo && !isTransparentExport;
  const resolvedVideoSrc = resolveMediaSrc(sourceUrl || videoFileName);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isTransparentExport ? 'transparent' : '#000000',
        overflow: 'hidden',
      }}
    >
      {/* LAYER 1: Base Talking Head Video with Synced In-Browser Audio */}
      {shouldRenderVideo && resolvedVideoSrc && (
        <AbsoluteFill>
          <OffthreadVideo
            src={resolvedVideoSrc}
            volume={muteAudio ? 0 : volume}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      )}

      {/* LAYER 2: Motion Graphics BEHIND the Speaker */}
      <AbsoluteFill>
        {behindCues.map((cue) => {
          const fromFrame = typeof (cue as any).from === 'number'
            ? (cue as any).from
            : Math.round((cue.startTime ?? 0) * fps);
          const durationInFrames = typeof (cue as any).durationInFrames === 'number'
            ? (cue as any).durationInFrames
            : Math.max(15, Math.round(((cue.endTime ?? (cue.startTime ?? 0) + 2) - (cue.startTime ?? 0)) * fps));
          const sfx = getCueSfxFile(cue);

          return (
            <Sequence key={cue.id} from={fromFrame} durationInFrames={durationInFrames} name={`${cue.component} (behind)`}>
              {sfx && (
                <Audio src={resolveMediaSrc(`sfx/${sfx}`)} volume={getSfxVolume(sfx)} />
              )}
              {renderCueComponent(cue)}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* LAYER 3: Isolated Subject Cutout (Sits in front of Layer 2 graphics!) */}
      {maskVideoFileName && maskVideoFileName.trim() !== '' && (
        <AbsoluteFill>
          <OffthreadVideo
            src={resolveMediaSrc(maskVideoFileName)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      )}

      {/* LAYER 4: Motion Graphics IN FRONT of the Speaker */}
      <AbsoluteFill>
        {frontCues.map((cue) => {
          const fromFrame = typeof (cue as any).from === 'number'
            ? (cue as any).from
            : Math.round((cue.startTime ?? 0) * fps);
          const durationInFrames = typeof (cue as any).durationInFrames === 'number'
            ? (cue as any).durationInFrames
            : Math.max(15, Math.round(((cue.endTime ?? (cue.startTime ?? 0) + 2) - (cue.startTime ?? 0)) * fps));
          const sfx = getCueSfxFile(cue);

          return (
            <Sequence key={cue.id} from={fromFrame} durationInFrames={durationInFrames} name={`${cue.component} (front)`}>
              {sfx && (
                <Audio src={resolveMediaSrc(`sfx/${sfx}`)} volume={getSfxVolume(sfx)} />
              )}
              {renderCueComponent(cue)}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* LAYER 5: Word-Level Bouncy Subtitles */}
      {words && words.length > 0 && (
        <AbsoluteFill>
          <TikTokCaptions words={words} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
