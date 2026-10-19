import React, { useRef, useState, useEffect } from 'react';
import { createRoot, Root as ReactRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { TalkingHeadOverlay } from './compositions/TalkingHeadOverlay';
import { PosterPlate } from './compositions/PosterPlate';
import { DEFAULT_PLAN, ScenePlan } from './types';

interface PlayerWrapperProps {
  plan: ScenePlan;
  onFrameUpdate?: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

const MotionPlayerWrapper: React.FC<PlayerWrapperProps> = ({
  plan,
  onFrameUpdate,
  onPlay,
  onPause,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    // Attach frame change listener
    const onTimeUpdate = () => {
      if (onFrameUpdate) {
        onFrameUpdate(p.getCurrentFrame());
      }
    };

    p.addEventListener('timeupdate', onTimeUpdate);
    p.addEventListener('play', () => onPlay && onPlay());
    p.addEventListener('pause', () => onPause && onPause());

    return () => {
      p.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [onFrameUpdate, onPlay, onPause]);

  // Expose player controller methods to window.__activePlayer
  useEffect(() => {
    (window as any).__activePlayer = playerRef.current;
  }, [plan]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0c141c',
      }}
    >
      <Player
        ref={playerRef}
        component={TalkingHeadOverlay}
        durationInFrames={Math.max(30, plan.durationInFrames || 300)}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={plan.fps || 30}
        inputProps={{ plan }}
        style={{
          width: '100%',
          height: '100%',
          aspectRatio: '9 / 16',
          maxHeight: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
        controls={false}
        loop={true}
        autoPlay={false}
      />
    </div>
  );
};

// Global API exposed for vanilla JavaScript
let reactRoot: ReactRoot | null = null;
let currentPlan: ScenePlan = DEFAULT_PLAN;

(window as any).MotionPlayer = {
  mount: (
    container: HTMLElement,
    initialPlan: ScenePlan,
    callbacks?: {
      onFrameUpdate?: (frame: number) => void;
      onPlay?: () => void;
      onPause?: () => void;
    }
  ) => {
    currentPlan = initialPlan || DEFAULT_PLAN;
    if (!reactRoot) {
      reactRoot = createRoot(container);
    }
    reactRoot.render(
      <MotionPlayerWrapper
        plan={currentPlan}
        onFrameUpdate={callbacks?.onFrameUpdate}
        onPlay={callbacks?.onPlay}
        onPause={callbacks?.onPause}
      />
    );
  },

  update: (newPlan: ScenePlan) => {
    currentPlan = { ...newPlan };
    const p = (window as any).__activePlayer;
    if (reactRoot) {
      // Re-render with new plan
      const container = (reactRoot as any)._internalRoot?.containerInfo;
      if (container) {
        reactRoot.render(<MotionPlayerWrapper plan={currentPlan} />);
      }
    }
  },

  seek: (frame: number) => {
    const p = (window as any).__activePlayer as PlayerRef | undefined;
    if (p) {
      p.seekTo(frame);
    }
  },

  play: () => {
    const p = (window as any).__activePlayer as PlayerRef | undefined;
    if (p) {
      p.play();
    }
  },

  pause: () => {
    const p = (window as any).__activePlayer as PlayerRef | undefined;
    if (p) {
      p.pause();
    }
  },

  togglePlay: () => {
    const p = (window as any).__activePlayer as PlayerRef | undefined;
    if (p) {
      if (p.isPlaying()) {
        p.pause();
      } else {
        p.play();
      }
    }
  },

  getCurrentFrame: (): number => {
    const p = (window as any).__activePlayer as PlayerRef | undefined;
    return p ? p.getCurrentFrame() : 0;
  },
};
