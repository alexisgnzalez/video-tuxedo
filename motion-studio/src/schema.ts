import { z } from 'zod';

export const VisualCueSchema = z.object({
  id: z.string(),
  startTime: z.number(), // in seconds
  endTime: z.number(),   // in seconds
  layer: z.enum(['behind_subject', 'in_front_of_subject']),
  component: z.enum([
    'KineticTitleBehind',
    'PunchlinePopup',
    'FloatingEmojiCluster',
    'ComicAlertBanner',
  ]),
  headlineText: z.string(),
  subText: z.string().optional().default(''),
  emojiOrIcon: z.string(),
  accentColor: z.string().default('#FACC15'), // Brand Yellow
  position: z.enum(['top', 'center', 'bottom-left', 'bottom-right']).default('bottom-right'),
  sfxFile: z.enum(['whoosh.mp3', 'pop.mp3', 'vine_boom.mp3', 'ding.mp3', 'none']).default('pop.mp3'),
});

export const WordTimingSchema = z.object({
  word: z.string(),
  start: z.number(), // in seconds
  end: z.number(),   // in seconds
});

export const MainVideoSchema = z.object({
  videoFileName: z.string().default('chopped_video.mp4'),
  maskVideoFileName: z.string().optional().default(''),
  renderMode: z.enum(['full_composite', 'overlays_only_for_davinci']).default('full_composite'),
  cues: z.array(VisualCueSchema).default([]),
  words: z.array(WordTimingSchema).default([]),
});

export type MainVideoProps = z.infer<typeof MainVideoSchema>;
export type VisualCue = z.infer<typeof VisualCueSchema>;
export type WordTiming = z.infer<typeof WordTimingSchema>;
