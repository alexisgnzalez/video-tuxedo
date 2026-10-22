/**
 * Tuxedo Editor Player Adapter & Transform Gizmo
 * Manages Remotion player instance and direct-manipulation transform handles.
 */

import { store } from './store.js';
import { getTimelineDuration } from './edl.js';

class EditorPlayerManager {
  constructor() {
    this.container = null;
    this.playerInstance = null;
    this.gizmoLayer = null;
    this.isPlaying = false;
    this.showSafeZones = false;
    this.isMuted = false;
    this.rafId = null;
  }

  mount(containerEl) {
    this.container = containerEl;
    if (!this.container) return;

    this.container.innerHTML = `
      <div id="playerMountTarget" style="width: 100%; height: 100%; position: relative;"></div>
      <div id="playerGizmoOverlay" style="position: absolute; inset: 0; pointer-events: none; z-index: 20;"></div>
      <div id="playerSafeZones" class="safe-zones-overlay" style="display: none;">
        <div class="safe-zone-top"></div>
        <div class="safe-zone-bottom"></div>
        <div class="safe-zone-right"></div>
      </div>
    `;

    const mountTarget = this.container.querySelector('#playerMountTarget');
    this.gizmoLayer = this.container.querySelector('#playerGizmoOverlay');

    const initialPlan = this.buildRemotionPlan();

    if (window.MotionPlayer && typeof window.MotionPlayer.create === 'function') {
      this.playerInstance = window.MotionPlayer.create(mountTarget, initialPlan, {
        onFrameUpdate: (frame) => {
          const fps = store.getProject()?.source?.fps || 30;
          store.setTime(frame / fps, frame);
        },
        onPlay: () => {
          this.isPlaying = true;
          store.emit('player:play');
        },
        onPause: () => {
          this.isPlaying = false;
          store.emit('player:pause');
        },
      });
    }

    // Subscribe to store changes to keep Remotion plan synchronized
    store.subscribe('change', () => this.syncPlan());
    store.subscribe('selection:layer', (layerId) => this.renderGizmo(layerId));
  }

  buildRemotionPlan() {
    const proj = store.getProject();
    if (!proj) {
      return {
        composition: 'TuxedoEdit',
        durationInFrames: 300,
        fps: 30,
        clips: [],
      };
    }

    const fps = proj.source?.fps || 30;
    const durSec = getTimelineDuration(proj.clips);
    const totalFrames = Math.max(30, Math.round(durSec * fps));

    const sourceUrl = `/api/editor/projects/${proj.slug}/files/${proj.source.webFile || proj.source.file || 'source.mp4'}`;
    const conformUrl = proj.conform?.exists
      ? `/api/editor/projects/${proj.slug}/files/conform.mp4?v=${proj.conform.hash || '1'}`
      : '';
    const cutoutUrl = proj.cutout?.exists
      ? `/api/editor/projects/${proj.slug}/files/${proj.cutout.file || 'cutout.webm'}?v=${proj.cutout.conformHash || '1'}`
      : '';

    return {
      composition: 'TuxedoEdit',
      slug: proj.slug,
      mode: proj.conform?.exists ? 'flat' : 'edl',
      fps,
      durationInFrames: totalFrames,
      sourceUrl,
      conformUrl,
      cutoutUrl,
      clips: (proj.clips || []).map(c => ({
        id: c.id,
        srcIn: c.srcIn,
        srcOut: c.srcOut,
      })),
      captions: {
        enabled: proj.captions?.enabled !== false,
        cues: proj.captions?.cues || [],
        style: proj.captions?.style || {},
      },
      layers: proj.layers || [],
      graphics: proj.graphics || { style: 'story_tuxedo', settings: {}, items: [] },
      preview: {
        showSafeZones: this.showSafeZones,
        muteAudio: this.isMuted,
      },
    };
  }

  syncPlan() {
    if (!this.playerInstance) return;
    const plan = this.buildRemotionPlan();
    this.playerInstance.update(plan);
  }

  seek(seconds) {
    if (!this.playerInstance) return;
    const fps = store.getProject()?.source?.fps || 30;
    const frame = Math.round(seconds * fps);
    this.playerInstance.seek(frame);
  }

  play() {
    if (this.playerInstance) this.playerInstance.play();
  }

  pause() {
    if (this.playerInstance) this.playerInstance.pause();
  }

  togglePlay() {
    if (this.playerInstance) this.playerInstance.togglePlay();
  }

  toggleSafeZones() {
    this.showSafeZones = !this.showSafeZones;
    const szEl = this.container?.querySelector('#playerSafeZones');
    if (szEl) szEl.style.display = this.showSafeZones ? 'block' : 'none';
    return this.showSafeZones;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.playerInstance) {
      this.playerInstance.setMuted(this.isMuted);
    }
    return this.isMuted;
  }

  // Direct Manipulation Transform Gizmo Layer
  renderGizmo(selectedLayerId) {
    if (!this.gizmoLayer) return;
    this.gizmoLayer.innerHTML = '';
    if (!selectedLayerId) return;

    const proj = store.getProject();
    const layer = (proj?.layers || []).find(l => l.id === selectedLayerId);
    if (!layer) return;

    // Convert Remotion coordinates (1080x1920) to viewport percentage
    const gizmoBox = document.createElement('div');
    gizmoBox.style.position = 'absolute';
    gizmoBox.style.pointerEvents = 'auto';
    gizmoBox.style.border = '2px solid #D97757';
    gizmoBox.style.boxSizing = 'border-box';
    gizmoBox.style.cursor = 'move';

    const widthPct = (300 * (layer.scale || 1)) / 1080 * 100;
    const heightPct = (300 * (layer.scale || 1)) / 1920 * 100;
    const leftPct = (layer.x / 1080) * 100 - (widthPct / 2);
    const topPct = (layer.y / 1920) * 100 - (heightPct / 2);

    gizmoBox.style.width = `${widthPct}%`;
    gizmoBox.style.height = `${heightPct}%`;
    gizmoBox.style.left = `${leftPct}%`;
    gizmoBox.style.top = `${topPct}%`;

    // Drag handling with pointer capture and RAF
    let startX = 0;
    let startY = 0;
    let initialX = layer.x;
    let initialY = layer.y;

    gizmoBox.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      gizmoBox.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      initialX = layer.x;
      initialY = layer.y;

      const onPointerMove = (ev) => {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
          const rect = this.container.getBoundingClientRect();
          const dxNorm = (ev.clientX - startX) / rect.width;
          const dyNorm = (ev.clientY - startY) / rect.height;

          const newX = Math.round(initialX + dxNorm * 1080);
          const newY = Math.round(initialY + dyNorm * 1920);

          gizmoBox.style.left = `${(newX / 1080) * 100 - (widthPct / 2)}%`;
          gizmoBox.style.top = `${(newY / 1920) * 100 - (heightPct / 2)}%`;
        });
      };

      const onPointerUp = (ev) => {
        gizmoBox.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        const rect = this.container.getBoundingClientRect();
        const dxNorm = (ev.clientX - startX) / rect.width;
        const dyNorm = (ev.clientY - startY) / rect.height;
        const finalX = Math.round(initialX + dxNorm * 1080);
        const finalY = Math.round(initialY + dyNorm * 1920);

        // Commit to store with undo/redo
        store.execute({
          name: 'Move Layer',
          do: () => {
            layer.x = finalX;
            layer.y = finalY;
          },
          undo: () => {
            layer.x = initialX;
            layer.y = initialY;
          },
        });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    this.gizmoLayer.appendChild(gizmoBox);
  }
}

export const player = new EditorPlayerManager();
