import { spring } from 'remotion';

export interface MotionPhases {
  enter: number;      // 0.0 -> 1.0 (settles cleanly within enterFrames)
  exit: number;       // 0.0 -> 1.0 (triggers strictly after dwell window)
  scale: number;      // max(0, enter - exit)
  progress: number;   // 0.0 -> 1.0 -> 0.0 clamped
  isResting: boolean; // True during the guaranteed static reading window
  enterFrames: number;
  exitFrames: number;
  holdFrames: number;
}

export interface AdaptiveTimingOptions {
  maxEnterFrames?: number; // Capped entrance length for long durations (default: 12 frames ~0.4s)
  maxExitFrames?: number;  // Capped exit length for long durations (default: 8 frames ~0.26s)
  enterRatio?: number;     // Proportion of total duration for intro (default: 0.22 = 22%)
  exitRatio?: number;      // Proportion of total duration for outro (default: 0.18 = 18%)
  damping?: number;        // Spring bounce damping
  stiffness?: number;      // Spring responsiveness
  mass?: number;
}

/**
 * Broadcast & Social Video Adaptive Motion Timing.
 *
 * Solves the Remotion animation conflict where short durations (e.g. 0.5s = 15 frames)
 * cause the exit spring to subtract from the entrance spring before the entrance finishes,
 * making text illegible and causing graphics to collapse mid-animation.
 *
 * Rules Enforced:
 * 1. Strict Phase Isolation: Exit can NEVER start while Entrance is active.
 * 2. Guaranteed Dwell Window: At least 55-60% of duration is 100% static resting text.
 * 3. Proportional Elastic Compression: On short durations (15-30 frames), entrance
 *    and exit compress down to snappy 3-frame pop-ins so text reaches full scale and holds.
 */
export function calculateAdaptiveMotion(
  frame: number,
  fps: number,
  durationInFrames: number,
  options: AdaptiveTimingOptions = {}
): MotionPhases {
  const total = Math.max(8, durationInFrames);
  const enterRatio = options.enterRatio ?? 0.22;
  const exitRatio = options.exitRatio ?? 0.18;

  const maxEnter = options.maxEnterFrames ?? 12;
  const maxExit = options.maxExitFrames ?? 8;

  // Elastic frame budgets: min 3 frames so spring math never divides by zero
  const enterFrames = Math.max(3, Math.min(maxEnter, Math.floor(total * enterRatio)));
  const exitFrames = Math.max(3, Math.min(maxExit, Math.floor(total * exitRatio)));

  // Exit MUST strictly begin after entrance completes + minimum 2-frame static hold
  const minHoldGap = 2;
  const naturalExitStart = total - exitFrames;
  const exitStart = Math.max(enterFrames + minHoldGap, naturalExitStart);

  // Entrance spring: finishes strictly at enterFrames
  const enter = spring({
    frame,
    fps,
    durationInFrames: enterFrames,
    config: {
      damping: options.damping ?? 13,
      stiffness: options.stiffness ?? 220,
      mass: options.mass ?? 0.6,
    },
  });

  // Exit spring: begins at exitStart, overdamped to prevent backward oscillation
  const exit = spring({
    frame: frame - exitStart,
    fps,
    durationInFrames: exitFrames,
    config: {
      damping: 200, // Critically overdamped for a clean, non-oscillating exit
    },
  });

  const scale = Math.max(0, enter - exit);
  const isResting = frame >= enterFrames && frame < exitStart;
  const holdFrames = Math.max(0, exitStart - enterFrames);

  return {
    enter,
    exit,
    scale,
    progress: scale,
    isResting,
    enterFrames,
    exitFrames,
    holdFrames,
  };
}

/**
 * Industry-standard reading speed duration calculator (Netflix / BBC standard).
 *
 * Formula:
 * - Adult reading speed: 15-17 Characters Per Second (~160-180 WPM)
 * - Cognitive recognition baseline: 0.6s (time for eyes to lock onto new graphic)
 * - Animation transition buffer: 0.5s (0.3s enter + 0.2s exit)
 * Total recommended = 1.1s + (textLength / 15 CPS), clamped between 1.5s and 6.0s.
 */
export function calculateSmartDuration(text: string): number {
  const clean = (text || '').trim();
  if (!clean) return 2.0;

  const charCount = clean.length;
  const cps = 15; // Characters per second
  const cognitiveBaseline = 0.6;
  const animationBuffer = 0.5;

  const rawSeconds = cognitiveBaseline + animationBuffer + (charCount / cps);
  // Round to nearest 0.1s
  const rounded = Math.round(rawSeconds * 10) / 10;
  return Math.min(6.0, Math.max(1.5, rounded));
}
