import React, { useRef, useState, useEffect } from 'react';
import { createRoot, Root as ReactRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { TalkingHeadOverlay } from './compositions/TalkingHeadOverlay';
import { MainVideo } from './MainVideo';
import { PosterPlate } from './compositions/PosterPlate';
import { TuxedoEdit } from './compositions/TuxedoEdit';
import { DEFAULT_PLAN, ScenePlan } from './types';

export interface PlayerWrapperProps {
  plan: any;
  onFrameUpdate?: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onPlayerReady?: (player: PlayerRef | null) => void;
}

export const MotionPlayerWrapper: React.FC<PlayerWrapperProps> = ({
  plan,
  onFrameUpdate,
  onPlay,
  onPause,
  onPlayerReady,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    const p = playerRef.current;
    if (onPlayerReady) {
      onPlayerReady(p);
    }
    if (!p) return;

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
  }, [onFrameUpdate, onPlay, onPause, onPlayerReady]);

  useEffect(() => {
    (window as any).__activePlayer = playerRef.current;
  }, [plan]);

  let TargetComponent: any = TalkingHeadOverlay;
  let targetProps: any = { plan };

  if (plan?.composition === 'TuxedoEdit') {
    TargetComponent = TuxedoEdit;
    targetProps = plan;
  } else if (
    plan?.composition === 'StoryTuxedo' ||
    Boolean(plan?.cues && plan?.words)
  ) {
    TargetComponent = MainVideo;
    targetProps = {
      ...plan,
      previewMode: true,
      showVideo: plan?.preview?.showSourceVideo ?? true,
      muteAudio: plan?.preview?.muteSource ?? false,
      sourceUrl: plan?.source?.url,
      videoFileName: plan?.videoFileName || plan?.source?.filename,
    };
  }

  const durationInFrames = Math.max(30, plan?.durationInFrames || 300);
  const fps = plan?.fps || 30;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141413',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Player
        ref={playerRef}
        component={TargetComponent}
        durationInFrames={durationInFrames}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={fps}
        inputProps={targetProps}
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

export interface PlayerInstance {
  update: (newPlan: any) => void;
  seek: (frame: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  getCurrentFrame: () => number;
  toggleMute: () => boolean;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  destroy: () => void;
  getPlayerRef: () => PlayerRef | null;
}

export function createPlayerInstance(
  container: HTMLElement,
  initialPlan: any,
  callbacks?: {
    onFrameUpdate?: (frame: number) => void;
    onPlay?: () => void;
    onPause?: () => void;
  }
): PlayerInstance {
  let root: ReactRoot | null = createRoot(container);
  let activePlan = initialPlan || DEFAULT_PLAN;
  let activePlayerRef: PlayerRef | null = null;

  const render = () => {
    if (!root) return;
    root.render(
      <MotionPlayerWrapper
        plan={activePlan}
        onFrameUpdate={callbacks?.onFrameUpdate}
        onPlay={callbacks?.onPlay}
        onPause={callbacks?.onPause}
        onPlayerReady={(p) => {
          activePlayerRef = p;
        }}
      />
    );
  };

  render();

  return {
    update: (newPlan: any) => {
      activePlan = { ...newPlan };
      render();
    },
    seek: (frame: number) => {
      if (activePlayerRef) {
        activePlayerRef.seekTo(frame);
      }
    },
    play: () => {
      if (activePlayerRef) {
        activePlayerRef.play();
      }
    },
    pause: () => {
      if (activePlayerRef) {
        activePlayerRef.pause();
      }
    },
    togglePlay: () => {
      if (activePlayerRef) {
        if (activePlayerRef.isPlaying()) {
          activePlayerRef.pause();
        } else {
          activePlayerRef.play();
        }
      }
    },
    getCurrentFrame: (): number => {
      return activePlayerRef ? activePlayerRef.getCurrentFrame() : 0;
    },
    toggleMute: (): boolean => {
      if (activePlan) {
        activePlan.preview = activePlan.preview || {};
        activePlan.preview.muteAudio = !activePlan.preview.muteAudio;
        if (activePlan.preview.muteSource !== undefined) {
          activePlan.preview.muteSource = activePlan.preview.muteAudio;
        }
        render();
        return Boolean(activePlan.preview.muteAudio);
      }
      return false;
    },
    setMuted: (muted: boolean) => {
      if (activePlan) {
        activePlan.preview = activePlan.preview || {};
        activePlan.preview.muteAudio = muted;
        activePlan.preview.muteSource = muted;
        render();
      }
    },
    isMuted: (): boolean => {
      return Boolean(activePlan?.preview?.muteAudio || activePlan?.preview?.muteSource);
    },
    destroy: () => {
      if (root) {
        root.unmount();
        root = null;
      }
      activePlayerRef = null;
    },
    getPlayerRef: () => activePlayerRef,
  };
}

// Global default instance for backwards-compatibility
let defaultInstance: PlayerInstance | null = null;

(window as any).MotionPlayer = {
  create: createPlayerInstance,

  mount: (
    container: HTMLElement,
    initialPlan: any,
    callbacks?: {
      onFrameUpdate?: (frame: number) => void;
      onPlay?: () => void;
      onPause?: () => void;
    }
  ) => {
    if (defaultInstance) {
      defaultInstance.destroy();
    }
    defaultInstance = createPlayerInstance(container, initialPlan, callbacks);
    return defaultInstance;
  },

  update: (newPlan: any) => {
    if (defaultInstance) {
      defaultInstance.update(newPlan);
    }
  },

  seek: (frame: number) => {
    if (defaultInstance) {
      defaultInstance.seek(frame);
    }
  },

  play: () => {
    if (defaultInstance) {
      defaultInstance.play();
    }
  },

  pause: () => {
    if (defaultInstance) {
      defaultInstance.pause();
    }
  },

  togglePlay: () => {
    if (defaultInstance) {
      defaultInstance.togglePlay();
    }
  },

  getCurrentFrame: (): number => {
    return defaultInstance ? defaultInstance.getCurrentFrame() : 0;
  },

  toggleMute: (): boolean => {
    return defaultInstance ? defaultInstance.toggleMute() : false;
  },

  setMuted: (muted: boolean) => {
    if (defaultInstance) {
      defaultInstance.setMuted(muted);
    }
  },

  isMuted: (): boolean => {
    return defaultInstance ? defaultInstance.isMuted() : false;
  },
};
