import React from 'react';
import { VisualCue } from '../schema';
import { KineticTitleBehind } from './KineticTitleBehind';
import { PunchlinePopup } from './PunchlinePopup';
import { FloatingEmojiCluster } from './FloatingEmojiCluster';
import { ComicAlertBanner } from './ComicAlertBanner';
import { KineticHeader } from './KineticHeader';
import { ModernistPlate } from './ModernistPlate';
import { EditorialLowerThird } from './EditorialLowerThird';
import { SubtlePill } from './SubtlePill';

export const renderCueComponent = (cue: VisualCue) => {
  const mergedProps = (cue as any).props ? { ...(cue as any).props, ...cue } : cue;
  const comp = (cue.component as string) || '';

  switch (comp) {
    case 'kinetic_header':
    case 'KineticHeader':
      return <KineticHeader {...mergedProps} />;

    case 'modernist_plate':
    case 'ModernistPlate':
      return <ModernistPlate {...mergedProps} />;

    case 'lower_third':
    case 'EditorialLowerThird':
      return <EditorialLowerThird {...mergedProps} />;

    case 'subtle_pill':
    case 'SubtlePill':
    case 'status_badge':
      return <SubtlePill {...mergedProps} />;

    case 'sandwich_text':
    case 'KineticTitleBehind':
      return <KineticTitleBehind {...mergedProps} />;

    case 'FloatingEmojiCluster':
      return <FloatingEmojiCluster {...mergedProps} />;

    case 'ComicAlertBanner':
      return <ComicAlertBanner {...mergedProps} />;

    case 'punchline_card':
    case 'PunchlinePopup':
    default:
      return <PunchlinePopup {...mergedProps} />;
  }
};

export const getCueSfxFile = (cue: VisualCue): string | undefined => {
  if (cue.sfxFile && cue.sfxFile !== 'none') return cue.sfxFile;
  if ((cue as any).sfx && Array.isArray((cue as any).sfx) && (cue as any).sfx.length > 0) {
    const firstSfx = (cue as any).sfx[0];
    if (firstSfx && firstSfx.id && firstSfx.id !== 'none') return firstSfx.id;
    if (firstSfx && firstSfx.file && firstSfx.file !== 'none') return firstSfx.file;
  }
  return undefined;
};

export const getSfxVolume = (sfxFile?: string): number => {
  if (!sfxFile || sfxFile === 'none') return 0;
  if (sfxFile.includes('vine_boom')) return 0.08;
  if (sfxFile.includes('ding')) return 0.10;
  if (sfxFile.includes('pop')) return 0.12;
  if (sfxFile.includes('whoosh')) return 0.10;
  return 0.10;
};
