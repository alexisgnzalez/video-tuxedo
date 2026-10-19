/**
 * Scene Plan — the single source of truth shared by the rule engine, the
 * Gemini drafter, the in-browser timeline editor, the Player preview and
 * the Remotion CLI render. Keep in sync with server/motion_graphics.py.
 */

export type ZoneId = 'T' | 'L' | 'R' | 'B' | 'FULL';
export type DepthMode = 'z-foreground' | 'z-frame' | 'z-background';
export type PlatformPreset = 'tiktok_reels' | 'linkedin_youtube' | 'clean_9_16';
export type SubjectOverride = 'auto' | 'center' | 'high' | 'low';
export type PlateVariant = 'avila' | 'petare';

export type ComponentId =
  | 'CruzDiezBadge'
  | 'AvilaFacetCard'
  | 'GegoMeshPointer'
  | 'BrutalistLowerThird'
  | 'ViaductProgress'
  | 'KineticCaption'
  | 'PosterTitleCard'
  | 'AvilaPeak'
  | 'PetareHill'
  | 'ViaductSweep'
  | 'CruzDiezWall'
  | 'HyparNet'
  | 'ForegroundFrame';

export type SfxId =
  | 'SFX_PAPER_SNAP'
  | 'SFX_KINETIC_HUM'
  | 'SFX_BRUTAL_THUD'
  | 'SFX_WIRE_SWISH'
  | 'SFX_TYPE_CLACK';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One YOLO person box sample, in 1080x1920 canvas coordinates. */
export interface SubjectSample extends Rect {
  /** Seconds from the start of the video. */
  t: number;
}

export interface SfxCue {
  id: SfxId;
  /** Frame offset relative to the scene start. */
  at: number;
  /** 1..4 — which synthesized/foley variant to play. */
  variant?: number;
  volume?: number;
}

export interface Scene {
  id: string;
  component: ComponentId;
  zone: ZoneId;
  /** Absolute start frame on the video timeline. */
  from: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  sfx: SfxCue[];
  /** Human-readable reason this scene exists (e.g. "srt#4: 'primero'"). */
  trigger?: string;
  source?: 'rules' | 'gemini' | 'manual';
}

export interface CaptionWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

export interface CaptionCue {
  id: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
  words?: CaptionWord[];
}

export interface ScenePlan {
  version: 1;
  slug: string;
  fps: number;
  width: 1080;
  height: 1920;
  durationInFrames: number;
  mode: DepthMode;
  platform: PlatformPreset;
  seed: number;
  subjectTrack: SubjectSample[];
  subjectOverride: SubjectOverride;
  scenes: Scene[];
  captions: {enabled: boolean; cues: CaptionCue[]};
  plate: {variant: PlateVariant; title: string; subtitle: string};
  source: {url?: string; path?: string; filename?: string};
  /** Preview-only toggles; ignored at render time. */
  preview?: {showSourceVideo?: boolean; showSafeZones?: boolean; muteSource?: boolean};
  /** Render-only overrides. */
  render?: {background?: 'transparent' | '#000000'};
}

export const DEFAULT_PLAN: ScenePlan = {
  version: 1,
  slug: 'demo',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 300,
  mode: 'z-foreground',
  platform: 'tiktok_reels',
  seed: 1957,
  subjectTrack: [],
  subjectOverride: 'auto',
  scenes: [],
  captions: {enabled: false, cues: []},
  plate: {variant: 'avila', title: 'CARACAS', subtitle: 'EL ÁVILA Y SU CINETISMO'},
  source: {},
};
