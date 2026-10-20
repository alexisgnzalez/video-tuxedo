import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
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

const renderCueComponent = (cue: VisualCue) => {
  switch (cue.component) {
    case 'KineticTitleBehind':
      return <KineticTitleBehind {...cue} />;
    case 'FloatingEmojiCluster':
      return <FloatingEmojiCluster {...cue} />;
    case 'ComicAlertBanner':
      return <ComicAlertBanner {...cue} />;
    case 'PunchlinePopup':
    default:
      return <PunchlinePopup {...cue} />;
  }
};

export const MainVideo: React.FC<MainVideoProps> = ({
  videoFileName,
  maskVideoFileName,
  renderMode = 'full_composite',
  cues = [],
  words = [],
}) => {
  const { fps } = useVideoConfig();

  const behindCues = cues.filter((c) => c.layer === 'behind_subject');
  const frontCues = cues.filter((c) => c.layer === 'in_front_of_subject');

  const isTransparent = renderMode === 'overlays_only_for_davinci';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: isTransparent ? 'transparent' : '#000000',
        overflow: 'hidden',
      }}
    >
      {/* LAYER 1: Base Talking Head Video (Skipped if exporting transparent overlays for DaVinci) */}
      {!isTransparent && videoFileName && (
        <AbsoluteFill>
          <OffthreadVideo src={staticFile(videoFileName)} />
        </AbsoluteFill>
      )}

      {/* LAYER 2: Motion Graphics BEHIND the Speaker */}
      <AbsoluteFill>
        {behindCues.map((cue) => {
          const fromFrame = Math.round(cue.startTime * fps);
          const durationInFrames = Math.max(15, Math.round((cue.endTime - cue.startTime) * fps));

          return (
            <Sequence key={cue.id} from={fromFrame} durationInFrames={durationInFrames} name={`${cue.component} (behind)`}>
              {cue.sfxFile && cue.sfxFile !== 'none' && (
                <Audio src={staticFile(`sfx/${cue.sfxFile}`)} volume={0.4} />
              )}
              {renderCueComponent(cue)}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* LAYER 3: Isolated Subject Cutout (Sits in front of Layer 2 graphics!) */}
      {!isTransparent && maskVideoFileName && maskVideoFileName.trim() !== '' && (
        <AbsoluteFill>
          <OffthreadVideo src={staticFile(maskVideoFileName)} transparent />
        </AbsoluteFill>
      )}

      {/* LAYER 4: Motion Graphics IN FRONT of the Speaker */}
      <AbsoluteFill>
        {frontCues.map((cue) => {
          const fromFrame = Math.round(cue.startTime * fps);
          const durationInFrames = Math.max(15, Math.round((cue.endTime - cue.startTime) * fps));

          return (
            <Sequence key={cue.id} from={fromFrame} durationInFrames={durationInFrames} name={`${cue.component} (front)`}>
              {cue.sfxFile && cue.sfxFile !== 'none' && (
                <Audio src={staticFile(`sfx/${cue.sfxFile}`)} volume={0.5} />
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
