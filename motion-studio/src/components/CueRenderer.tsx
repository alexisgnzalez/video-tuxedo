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

export const normalizeSfxPath = (rawSfx?: string): string => {
  if (!rawSfx || rawSfx === 'none') return '';
  let clean = rawSfx.replace(/^\/+/, '').replace(/^public\//, '');
  if (!clean.startsWith('sfx/')) {
    clean = `sfx/${clean}`;
  }
  if (!clean.endsWith('.mp3') && !clean.endsWith('.wav')) {
    clean = `${clean}.mp3`;
  }
  return clean;
};

export const getCueSfxFile = (cue: VisualCue): string | undefined => {
  // 1. Direct sfxFile property on cue
  if (cue.sfxFile && cue.sfxFile !== 'none') return cue.sfxFile;

  // 2. sfxFile inside props
  if ((cue as any).props?.sfxFile && (cue as any).props.sfxFile !== 'none') {
    return (cue as any).props.sfxFile;
  }

  // 3. sfx array (e.g. { file: 'whoosh.mp3' } or { id: 'whoosh.mp3' })
  if ((cue as any).sfx && Array.isArray((cue as any).sfx) && (cue as any).sfx.length > 0) {
    const firstSfx = (cue as any).sfx[0];
    if (firstSfx && firstSfx.file && firstSfx.file !== 'none') return firstSfx.file;
    if (firstSfx && firstSfx.id && firstSfx.id !== 'none') return firstSfx.id;
  }

  // If cue explicitly declared 'none', don't play sound
  if (cue.sfxFile === 'none' || (cue as any).props?.sfxFile === 'none') {
    return undefined;
  }

  // 4. Intelligent component-type fallbacks so titles and graphics always have punchy audio
  const comp = (cue.component as string) || '';
  switch (comp) {
    case 'sandwich_text':
    case 'KineticTitleBehind':
    case 'kinetic_header':
    case 'KineticHeader':
      return 'whoosh.mp3';

    case 'punchline_card':
    case 'PunchlinePopup':
      return 'pop.mp3';

    case 'subtle_pill':
    case 'SubtlePill':
    case 'status_badge':
      return 'ding.mp3';

    case 'ComicAlertBanner':
      return 'vine_boom.mp3';

    case 'modernist_plate':
    case 'ModernistPlate':
    case 'lower_third':
    case 'EditorialLowerThird':
      return 'pop.mp3';

    default:
      return 'pop.mp3';
  }
};

export const getSfxVolume = (sfxFile?: string): number => {
  if (!sfxFile || sfxFile === 'none') return 0;
  if (sfxFile.includes('vine_boom')) return 0.50;
  if (sfxFile.includes('ding')) return 0.65;
  if (sfxFile.includes('pop')) return 0.70;
  if (sfxFile.includes('whoosh')) return 0.65;
  return 0.60;
};
