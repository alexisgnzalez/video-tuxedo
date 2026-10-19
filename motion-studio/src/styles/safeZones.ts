import { PlatformPreset, Rect, SubjectOverride, SubjectSample, ZoneId } from '../types';

export interface PlatformMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const PLATFORM_MARGINS: Record<PlatformPreset, PlatformMargins> = {
  tiktok_reels: {
    top: 90,
    bottom: 340, // Y 1580..1920 reserved for captions & handle
    left: 40,
    right: 120, // X 960..1080 reserved for engagement buttons
  },
  linkedin_youtube: {
    top: 60,
    bottom: 200, // Y 1720..1920
    left: 40,
    right: 60,
  },
  clean_9_16: {
    top: 40,
    bottom: 40,
    left: 40,
    right: 40,
  },
};

export interface ResolvedZones {
  subjectBox: Rect;
  faceNoGoBox: Rect;
  zones: Record<ZoneId, Rect>;
  margins: PlatformMargins;
}

/** Default 1080x1920 center-chest subject box when no tracking data exists */
export const DEFAULT_SUBJECT_BOX: Rect = {
  x: 210,
  y: 470,
  w: 660,
  h: 1450,
};

/** Compute face exclusion box from subject box (upper head region) */
export function deriveFaceNoGoBox(subject: Rect): Rect {
  const headW = Math.round(subject.w * 0.72);
  const headH = Math.round(subject.h * 0.36);
  const headX = Math.round(subject.x + (subject.w - headW) / 2);
  const headY = Math.round(subject.y + 50);
  return {
    x: headX,
    y: headY,
    w: headW,
    h: headH,
  };
}

/**
 * Resolves safe zones for a specific scene time range, incorporating:
 * 1. Platform UI margins
 * 2. Keyframed subject bounding box union over [fromFrame, fromFrame + duration]
 * 3. Subject override (center/high/low) if specified
 */
export function resolveSceneZones(
  subjectTrack: SubjectSample[] = [],
  fromFrame: number = 0,
  durationInFrames: number = 90,
  fps: number = 30,
  platform: PlatformPreset = 'tiktok_reels',
  override: SubjectOverride = 'auto'
): ResolvedZones {
  const margins = PLATFORM_MARGINS[platform] || PLATFORM_MARGINS.tiktok_reels;

  let activeSubject: Rect = { ...DEFAULT_SUBJECT_BOX };

  if (override === 'high') {
    activeSubject = { x: 210, y: 320, w: 660, h: 1600 };
  } else if (override === 'low') {
    activeSubject = { x: 210, y: 620, w: 660, h: 1300 };
  } else if (override === 'center') {
    activeSubject = { ...DEFAULT_SUBJECT_BOX };
  } else if (subjectTrack && subjectTrack.length > 0) {
    const startS = fromFrame / fps;
    const endS = (fromFrame + durationInFrames) / fps;

    const matching = subjectTrack.filter(
      (s) => s.t >= startS - 0.5 && s.t <= endS + 0.5
    );

    const samplesToUse = matching.length > 0 ? matching : subjectTrack;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const s of samplesToUse) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w);
      maxY = Math.max(maxY, s.y + s.h);
    }

    if (minX < maxX && minY < maxY) {
      activeSubject = {
        x: Math.round(minX),
        y: Math.round(minY),
        w: Math.round(maxX - minX),
        h: Math.round(maxY - minY),
      };
    }
  }

  const faceBox = deriveFaceNoGoBox(activeSubject);

  // Compute active dynamic zone bounds respecting subjectBox & margins
  const canvasW = 1080;
  const canvasH = 1920;

  // Zone T: Kinetic Canopy & Top Cards (above head)
  const zoneT: Rect = {
    x: margins.left + 20,
    y: margins.top + 10,
    w: canvasW - (margins.left + margins.right + 40),
    h: Math.max(180, Math.min(380, activeSubject.y - margins.top - 20)),
  };

  // Zone L: Left Shoulder Wing
  const leftAvailableW = Math.max(80, activeSubject.x - margins.left - 20);
  const zoneL: Rect = {
    x: margins.left,
    y: Math.max(480, activeSubject.y + 40),
    w: Math.min(360, leftAvailableW),
    h: 700,
  };

  // Zone R: Right Shoulder Wing
  const rightStartX = activeSubject.x + activeSubject.w + 20;
  const rightAvailableW = Math.max(80, canvasW - margins.right - rightStartX);
  const zoneR: Rect = {
    x: rightStartX,
    y: Math.max(480, activeSubject.y + 40),
    w: Math.min(360, rightAvailableW),
    h: 700,
  };

  // Zone B: Brutalist Lower Third & Captions (sits across lower chest, above bottom margin)
  const bottomMaxY = canvasH - margins.bottom;
  const zoneB: Rect = {
    x: margins.left + 20,
    y: Math.max(1200, bottomMaxY - 320),
    w: canvasW - (margins.left + margins.right + 40),
    h: 280,
  };

  // Zone FULL: Entire unlocked poster canvas
  const zoneFull: Rect = {
    x: 0,
    y: 0,
    w: canvasW,
    h: canvasH,
  };

  return {
    subjectBox: activeSubject,
    faceNoGoBox: faceBox,
    margins,
    zones: {
      T: zoneT,
      L: zoneL,
      R: zoneR,
      B: zoneB,
      FULL: zoneFull,
    },
  };
}
