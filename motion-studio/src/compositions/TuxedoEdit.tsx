import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from 'remotion';
import { TuxedoEditProps } from '../editSchema';
import { ImageLayer } from '../components/ImageLayer';
import { EditCaptions } from '../components/EditCaptions';
import { getCueSfxFile, getSfxVolume, renderCueComponent } from '../components/CueRenderer';

export const TuxedoEdit: React.FC<TuxedoEditProps> = ({
  mode = 'edl',
  clips = [],
  sourceUrl = '',
  conformUrl = '',
  cutoutUrl = '',
  layers = [],
  captions = { enabled: true, cues: [], style: {} },
  graphics = { style: 'story_tuxedo', settings: {}, items: [] },
  preview = { showSafeZones: false, muteAudio: false },
}) => {
  const { fps, width, height } = useVideoConfig();

  const resolveMediaSrc = (raw: string) => {
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
      return raw;
    }
    const clean = raw.replace(/^\/+/, '');
    if (clean.startsWith('public/')) {
      return `/${clean}`;
    }
    return `/${clean}`;
  };

  const behindLayers = layers.filter((l) => l.z === 'behind');
  const frontLayers = layers.filter((l) => l.z === 'front');

  const behindGraphics = (graphics.items || []).filter((g) => g.layer === 'behind');
  const frontGraphics = (graphics.items || []).filter((g) => g.layer === 'front');

  // Compute active time ranges where behind elements exist.
  // CRITICAL OPTIMIZATION: Cutout video is ONLY rendered during intervals where behind graphics/layers exist.
  // Rendering cutout across the entire video causes dual-video decode drift, ghosting arms, and browser lag.
  const behindIntervals: Array<{ start: number; end: number }> = [];
  [...behindLayers, ...behindGraphics].forEach((item) => {
    if (typeof item.start === 'number' && typeof item.end === 'number' && item.end > item.start) {
      behindIntervals.push({ start: Math.max(0, item.start), end: item.end });
    }
  });

  behindIntervals.sort((a, b) => a.start - b.start);
  const mergedBehindRanges: Array<{ start: number; end: number }> = [];
  for (const interval of behindIntervals) {
    if (mergedBehindRanges.length === 0) {
      mergedBehindRanges.push({ ...interval });
    } else {
      const last = mergedBehindRanges[mergedBehindRanges.length - 1];
      if (interval.start <= last.end + 0.2) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedBehindRanges.push({ ...interval });
      }
    }
  }

  // Compute timeline placement for EDL clips
  let currentTimelineFrame = 0;
  const edlSequences = clips.map((clip) => {
    const fromFrame = currentTimelineFrame;
    const durSec = Math.max(0.05, clip.srcOut - clip.srcIn);
    const durFrames = Math.max(1, Math.round(durSec * fps));
    const srcInFrame = Math.round(clip.srcIn * fps);
    const srcOutFrame = Math.round(clip.srcOut * fps);
    currentTimelineFrame += durFrames;

    return {
      clip,
      fromFrame,
      durFrames,
      srcInFrame,
      srcOutFrame,
    };
  });

  const baseSource = sourceUrl ? resolveMediaSrc(sourceUrl) : '';
  const conformSource = conformUrl ? resolveMediaSrc(conformUrl) : '';
  const cutoutSource = cutoutUrl ? resolveMediaSrc(cutoutUrl) : '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', width, height, overflow: 'hidden' }}>
      {/* ============================================================== */}
      {/* LAYER 1: Base Talking Head Video (EDL mode or Conformed Flat) */}
      {/* ============================================================== */}
      <AbsoluteFill>
        {mode === 'edl' && baseSource ? (
          edlSequences.map((seq) => (
            <Sequence
              key={seq.clip.id}
              from={seq.fromFrame}
              durationInFrames={seq.durFrames}
              premountFor={15}
            >
              <OffthreadVideo
                src={baseSource}
                startFrom={seq.srcInFrame}
                endAt={seq.srcOutFrame}
                volume={preview.muteAudio ? 0 : 1}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Sequence>
          ))
        ) : conformSource ? (
          <Video
            src={conformSource}
            volume={preview.muteAudio ? 0 : 1}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : baseSource ? (
          <Video
            src={baseSource}
            volume={preview.muteAudio ? 0 : 1}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : null}
      </AbsoluteFill>

      {/* ============================================================== */}
      {/* LAYER 2: Image Overlays BEHIND Subject Cutout                  */}
      {/* ============================================================== */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {behindLayers.map((layer) => {
          const fromFrame = Math.round(layer.start * fps);
          const durFrames = Math.max(15, Math.round((layer.end - layer.start) * fps));
          return (
            <Sequence key={layer.id} from={fromFrame} durationInFrames={durFrames}>
              <ImageLayer {...layer} />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* ============================================================== */}
      {/* LAYER 3: Motion Graphics BEHIND Subject Cutout                 */}
      {/* ============================================================== */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {behindGraphics.map((item) => {
          const fromFrame = Math.round(item.start * fps);
          const durFrames = Math.max(15, Math.round((item.end - item.start) * fps));
          const sfx = getCueSfxFile(item as any);

          return (
            <Sequence key={item.id} from={fromFrame} durationInFrames={durFrames}>
              {sfx && (
                <Audio src={resolveMediaSrc(`sfx/${sfx}`)} volume={getSfxVolume(sfx)} />
              )}
              {renderCueComponent(item as any)}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* ============================================================== */}
      {/* LAYER 4: Isolated Subject Cutout (Transparent Alpha Mask)      */}
      {/* Active ONLY during intervals where behind graphics/layers exist*/}
      {/* ============================================================== */}
      {cutoutSource && mergedBehindRanges.length > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          {mode === 'edl' ? (
            edlSequences
              .filter((seq) => {
                const clipStart = seq.fromFrame / fps;
                const clipEnd = (seq.fromFrame + seq.durFrames) / fps;
                return mergedBehindRanges.some((r) => r.start < clipEnd && r.end > clipStart);
              })
              .map((seq) => (
                <Sequence
                  key={`cutout_${seq.clip.id}`}
                  from={seq.fromFrame}
                  durationInFrames={seq.durFrames}
                  premountFor={15}
                >
                  <Video
                    src={cutoutSource}
                    startFrom={seq.srcInFrame}
                    endAt={seq.srcOutFrame}
                    volume={0}
                    onError={(e) => console.warn('Cutout EDL video error:', e)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Sequence>
              ))
          ) : (
            mergedBehindRanges.map((range, idx) => {
              const fromFrame = Math.round(range.start * fps);
              const durFrames = Math.max(1, Math.round((range.end - range.start) * fps));
              return (
                <Sequence
                  key={`cutout_behind_${idx}`}
                  from={fromFrame}
                  durationInFrames={durFrames}
                  premountFor={15}
                >
                  <Video
                    src={cutoutSource}
                    startFrom={fromFrame}
                    endAt={fromFrame + durFrames}
                    volume={0}
                    onError={(e) => console.warn('Cutout flat video error:', e)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Sequence>
              );
            })
          )}
        </AbsoluteFill>
      )}

      {/* ============================================================== */}
      {/* LAYER 5: Image Overlays IN FRONT OF Subject Cutout             */}
      {/* ============================================================== */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {frontLayers.map((layer) => {
          const fromFrame = Math.round(layer.start * fps);
          const durFrames = Math.max(15, Math.round((layer.end - layer.start) * fps));
          return (
            <Sequence key={layer.id} from={fromFrame} durationInFrames={durFrames}>
              <ImageLayer {...layer} />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* ============================================================== */}
      {/* LAYER 6: Motion Graphics IN FRONT OF Subject Cutout            */}
      {/* ============================================================== */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {frontGraphics.map((item) => {
          const fromFrame = Math.round(item.start * fps);
          const durFrames = Math.max(15, Math.round((item.end - item.start) * fps));
          const sfx = getCueSfxFile(item as any);

          return (
            <Sequence key={item.id} from={fromFrame} durationInFrames={durFrames}>
              {sfx && (
                <Audio src={resolveMediaSrc(`sfx/${sfx}`)} volume={getSfxVolume(sfx)} />
              )}
              {renderCueComponent(item as any)}
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {/* ============================================================== */}
      {/* LAYER 7: Word-Level Bouncy Captions / Reference Overlay        */}
      {/* ============================================================== */}
      {captions.cues && captions.cues.length > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <EditCaptions
            cues={captions.cues}
            style={captions.style}
            mode={captions.enabled !== false ? 'styled' : 'reference'}
          />
        </AbsoluteFill>
      )}

      {/* ============================================================== */}
      {/* SAFE ZONES DEBUG OVERLAY (Preview mode only)                   */}
      {/* ============================================================== */}
      {preview.showSafeZones && (
        <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 999 }}>
          {/* Top TikTok safe margin (180px) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: 180,
              backgroundColor: 'rgba(217, 56, 30, 0.15)',
              borderBottom: '2px dashed #D97757',
            }}
          />
          {/* Bottom TikTok UI area (380px) */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 380,
              backgroundColor: 'rgba(217, 56, 30, 0.25)',
              borderTop: '2px dashed #D97757',
            }}
          />
          {/* Right TikTok buttons margin (140px) */}
          <div
            style={{
              position: 'absolute',
              top: 700,
              right: 0,
              width: 140,
              height: 800,
              backgroundColor: 'rgba(217, 56, 30, 0.20)',
              borderLeft: '2px dashed #D97757',
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
