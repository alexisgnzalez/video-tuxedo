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

export class CueErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.error('Motion cue rendering error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

const renderCueComponentInner = (cue: VisualCue) => {
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

export const renderCueComponent = (cue: VisualCue) => {
  return (
    <CueErrorBoundary>
      {renderCueComponentInner(cue)}
    </CueErrorBoundary>
  );
};

export const normalizeSfxPath = (rawSfx?: string): string => {
  if (!rawSfx || rawSfx === 'none') return '';
  let clean = rawSfx.replace(/^\/+/, '').replace(/^public\//, '');
  if (!clean.startsWith('sfx/')) {
    clean = `sfx/${clean}`;
  }
  const hasExt = /\.(wav|mp3|aif|aiff|mp4|m4a)$/i.test(clean);
  if (!hasExt) {
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

  // 3. sfx array (e.g. { file: '...' } or { id: '...' })
  if ((cue as any).sfx && Array.isArray((cue as any).sfx) && (cue as any).sfx.length > 0) {
    const firstSfx = (cue as any).sfx[0];
    if (firstSfx && firstSfx.file && firstSfx.file !== 'none') return firstSfx.file;
    if (firstSfx && firstSfx.id && firstSfx.id !== 'none') return firstSfx.id;
  }

  // If cue explicitly declared 'none', don't play sound
  if (cue.sfxFile === 'none' || (cue as any).props?.sfxFile === 'none') {
    return undefined;
  }

  // 4. Intelligent DaVinci SFX library fallbacks for motion graphics
  const comp = (cue.component as string) || '';
  switch (comp) {
    case 'sandwich_text':
    case 'KineticTitleBehind':
      return 'davinci/WHOOSHES/Whoosh 17 (fast).wav';

    case 'kinetic_header':
    case 'KineticHeader':
      return 'davinci/WHOOSHES/Whoosh 26 (whip).wav';

    case 'punchline_card':
    case 'PunchlinePopup':
      return 'davinci/2. Transition Noises/2. Impacts/Impact 4 (good bite).wav';

    case 'subtle_pill':
    case 'SubtlePill':
    case 'status_badge':
      return 'davinci/5. Miscellaneous/Ding Sound Effect.mp3';

    case 'ComicAlertBanner':
      return 'davinci/2. Transition Noises/2. Impacts/Impact 1 (fear).wav';

    case 'modernist_plate':
    case 'ModernistPlate':
      return 'davinci/2. Transition Noises/4. Twirls/Twirl 8.wav';

    case 'lower_third':
    case 'EditorialLowerThird':
      return 'davinci/Whoosh-pass by/MA_Amenteramco_Whoosh_Pass-By_1.wav';

    default:
      return 'davinci/2. Transition Noises/2. Impacts/Impact 4 (good bite).wav';
  }
};

export const getSfxVolume = (sfxFile?: string): number => {
  if (!sfxFile || sfxFile === 'none') return 0;
  const lower = sfxFile.toLowerCase();
  if (lower.includes('vine_boom')) return 0.50;
  if (lower.includes('ding')) return 0.65;
  if (lower.includes('pop')) return 0.70;
  if (lower.includes('whoosh')) return 0.65;
  if (lower.includes('impact')) return 0.60;
  if (lower.includes('punch')) return 0.65;
  if (lower.includes('camera')) return 0.70;
  if (lower.includes('typing')) return 0.55;
  if (lower.includes('twirl')) return 0.60;
  return 0.65;
};
