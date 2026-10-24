import { z } from 'zod';

export const ClipSchema = z.object({
  id: z.string(),
  srcIn: z.number(),
  srcOut: z.number(),
});

export const CaptionWordSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  start: z.number(),
  end: z.number(),
});

export const CaptionCueSchema = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  words: z.array(CaptionWordSchema).default([]),
});

export const ImageLayerSchema = z.object({
  id: z.string(),
  src: z.string(),
  start: z.number(), // timeline seconds
  end: z.number(),   // timeline seconds
  z: z.enum(['behind', 'front']).default('behind'),
  x: z.number().default(540),
  y: z.number().default(960),
  scale: z.number().default(1),
  rotation: z.number().default(0),
  opacity: z.number().default(1),
  enter: z.enum(['none', 'pop', 'slide-up', 'fade']).default('pop'),
  exit: z.enum(['none', 'pop', 'slide-down', 'fade']).default('fade'),
});

export const GraphicsItemSchema = z.object({
  id: z.string(),
  component: z.string(),
  start: z.number(),
  end: z.number(),
  layer: z.enum(['behind', 'front']).default('behind'),
  placement: z.record(z.string(), z.any()).default({ position: 'top' }),
  props: z.record(z.string(), z.any()).default({}),
  sfx: z.array(z.record(z.string(), z.any())).default([]),
  sfxFile: z.string().optional(),
  source: z.string().default('rules'),
});

export const TuxedoEditSchema = z.object({
  composition: z.literal('TuxedoEdit').default('TuxedoEdit'),
  slug: z.string().default('project'),
  mode: z.enum(['edl', 'flat']).default('edl'),
  fps: z.number().default(30),
  durationInFrames: z.number().default(300),
  sourceUrl: z.string().default(''),
  conformUrl: z.string().optional().default(''),
  cutoutUrl: z.string().optional().default(''),
  clips: z.array(ClipSchema).default([]),
  captions: z.object({
    enabled: z.boolean().default(true),
    cues: z.array(CaptionCueSchema).default([]),
    style: z.record(z.string(), z.any()).default({}),
  }).default({ enabled: true, cues: [], style: {} }),
  layers: z.array(ImageLayerSchema).default([]),
  graphics: z.object({
    style: z.string().default('story_tuxedo'),
    settings: z.record(z.string(), z.any()).default({}),
    items: z.array(GraphicsItemSchema).default([]),
  }).default({ style: 'story_tuxedo', settings: {}, items: [] }),
  preview: z.object({
    showSafeZones: z.boolean().default(false),
    muteAudio: z.boolean().default(false),
  }).default({ showSafeZones: false, muteAudio: false }),
});

export type TuxedoEditProps = z.infer<typeof TuxedoEditSchema>;
export type ImageLayerProps = z.infer<typeof ImageLayerSchema>;
export type CaptionCueProps = z.infer<typeof CaptionCueSchema>;
export type GraphicsItemProps = z.infer<typeof GraphicsItemSchema>;
export type ClipProps = z.infer<typeof ClipSchema>;
