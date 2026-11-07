/**
 * Tuxedo Editor Player Adapter & Transform Gizmo
 * Manages Remotion player instance and direct-manipulation transform handles.
 */

import { store } from './store.js?v=0.7.5';
import { getTimelineDuration } from './edl.js?v=0.7.5';

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
    this.updateStageAspectRatio();
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

    const fps = proj.conform?.exists ? 30 : (proj.source?.fps || 30);
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
        cues: (proj.captions?.cues || []).map(c => ({
          ...c,
          words: Array.isArray(c.words) ? c.words.map(w => ({ ...w })) : [],
        })),
        style: { ...(proj.captions?.style || {}) },
      },
      layers: proj.layers || [],
      graphics: proj.graphics || { style: 'story_tuxedo', settings: {}, items: [] },
      preview: {
        showSafeZones: this.showSafeZones,
        muteAudio: this.isMuted,
      },
    };
  }

  updateStageAspectRatio() {
    const proj = store.getProject();
    const wrap = document.getElementById('editorStageCanvasWrap');
    const stage = document.getElementById('editorStage');
    if (!wrap) return;

    const w = proj?.width || proj?.source?.width || 1080;
    const h = proj?.height || proj?.source?.height || 1920;

    let cssRatio = '9 / 16';
    const ratioVal = w / h;
    const isVertical = ratioVal <= 1.05;

    if (stage) {
      if (isVertical) {
        stage.classList.add('is-vertical');
      } else {
        stage.classList.remove('is-vertical');
      }
    }

    if (Math.abs(ratioVal - 9 / 16) < 0.05) {
      cssRatio = '9 / 16';
    } else if (Math.abs(ratioVal - 16 / 9) < 0.05) {
      cssRatio = '16 / 9';
    } else if (Math.abs(ratioVal - 1.0) < 0.05) {
      cssRatio = '1 / 1';
    } else if (Math.abs(ratioVal - 4 / 5) < 0.05) {
      cssRatio = '4 / 5';
    } else {
      cssRatio = `${w} / ${h}`;
    }

    wrap.style.aspectRatio = cssRatio;
  }

  syncPlan() {
    this.updateStageAspectRatio();
    if (!this.playerInstance) return;
    const plan = this.buildRemotionPlan();
    this.playerInstance.update(plan);
  }

  seek(seconds) {
    if (!this.playerInstance) return;
    const proj = store.getProject();
    const fps = proj?.conform?.exists ? 30 : (proj?.source?.fps || 30);
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

  // Direct Manipulation Transform Gizmo Layer for Graphics & Layers
  renderGizmo(selectedLayerId) {
    if (!this.gizmoLayer) return;
    this.gizmoLayer.innerHTML = '';
    if (!selectedLayerId) return;

    const proj = store.getProject();
    const layer = (proj?.layers || []).find(l => l.id === selectedLayerId);
    const graphic = (proj?.graphics?.items || []).find(g => g.id === selectedLayerId);
    if (!layer && !graphic) return;

    const isGraphic = !!graphic;
    const item = graphic || layer;

    // Determine current position coordinates (1080x1920 space)
    let posX = isGraphic ? (graphic.placement?.x ?? 540) : (layer.x ?? 540);
    let posY = isGraphic
      ? (graphic.placement?.y ?? graphic.placement?.offsetY ?? (graphic.placement?.position === 'collarbone' ? 1350 : graphic.placement?.position === 'top' ? 240 : graphic.placement?.position === 'lower' ? 1550 : 960))
      : (layer.y ?? 960);

    const title = isGraphic
      ? (graphic.props?.headlineText || graphic.component?.replace(/_/g, ' ') || 'Graphic')
      : (layer.name || 'Image Layer');

    const themeColor = isGraphic ? '#F59E0B' : '#8B5CF6';

    const widthPct = isGraphic ? 74 : Math.min(90, Math.max(20, (320 * (layer.scale || 1)) / 1080 * 100));
    const heightPct = isGraphic ? 11 : Math.min(90, Math.max(15, (320 * (layer.scale || 1)) / 1920 * 100));
    const leftPct = (posX / 1080) * 100 - (widthPct / 2);
    const topPct = (posY / 1920) * 100 - (heightPct / 2);

    const gizmoBox = document.createElement('div');
    gizmoBox.className = 'editor-canvas-gizmo';
    gizmoBox.style.position = 'absolute';
    gizmoBox.style.pointerEvents = 'auto';
    gizmoBox.style.border = `2px dashed ${themeColor}`;
    gizmoBox.style.backgroundColor = isGraphic ? 'rgba(245, 158, 11, 0.08)' : 'rgba(139, 92, 246, 0.08)';
    gizmoBox.style.borderRadius = '8px';
    gizmoBox.style.boxSizing = 'border-box';
    gizmoBox.style.cursor = 'grab';
    gizmoBox.style.zIndex = '45';

    gizmoBox.style.width = `${widthPct}%`;
    gizmoBox.style.height = `${heightPct}%`;
    gizmoBox.style.left = `${leftPct}%`;
    gizmoBox.style.top = `${topPct}%`;

    gizmoBox.innerHTML = `
      <div style="position: absolute; top: -24px; left: 0; background: ${themeColor}; color: #000; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <span>${isGraphic ? '✨' : '🖼️'}</span>
        <span>${title}</span>
        <span style="opacity: 0.8; font-weight: 500;">(${posX}, ${posY})</span>
      </div>
      <div style="position: absolute; bottom: -20px; right: 0; font-size: 9px; color: ${themeColor}; font-weight: 600; pointer-events: none;">
        Drag to reposition on canvas
      </div>
    `;

    // Drag handling with pointer capture and smooth animation
    let startX = 0;
    let startY = 0;
    let initialX = posX;
    let initialY = posY;
    let hasDragged = false;

    gizmoBox.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      gizmoBox.setPointerCapture(e.pointerId);
      gizmoBox.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      initialX = posX;
      initialY = posY;
      hasDragged = false;

      const onPointerMove = (ev) => {
        if (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2) {
          hasDragged = true;
        }
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => {
          const rect = this.container.getBoundingClientRect();
          const dxNorm = (ev.clientX - startX) / rect.width;
          const dyNorm = (ev.clientY - startY) / rect.height;

          const newX = Math.round(initialX + dxNorm * 1080);
          const newY = Math.round(initialY + dyNorm * 1920);

          gizmoBox.style.left = `${(newX / 1080) * 100 - (widthPct / 2)}%`;
          gizmoBox.style.top = `${(newY / 1920) * 100 - (heightPct / 2)}%`;

          const tag = gizmoBox.querySelector('span:last-child');
          if (tag) tag.textContent = `(${newX}, ${newY})`;
        });
      };

      const onPointerUp = (ev) => {
        try {
          gizmoBox.releasePointerCapture(ev.pointerId);
        } catch {}
        gizmoBox.style.cursor = 'grab';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        if (!hasDragged) return;

        const rect = this.container.getBoundingClientRect();
        const dxNorm = (ev.clientX - startX) / rect.width;
        const dyNorm = (ev.clientY - startY) / rect.height;
        const finalX = Math.round(initialX + dxNorm * 1080);
        const finalY = Math.round(initialY + dyNorm * 1920);

        posX = finalX;
        posY = finalY;

        // Commit to store with undo/redo
        store.execute({
          name: isGraphic ? `Move Graphic ${title}` : `Move Layer ${title}`,
          do: () => {
            if (isGraphic) {
              graphic.placement = graphic.placement || {};
              graphic.placement.x = finalX;
              graphic.placement.y = finalY;
              graphic.placement.offsetY = finalY;
            } else {
              layer.x = finalX;
              layer.y = finalY;
            }
          },
          undo: () => {
            if (isGraphic) {
              graphic.placement = graphic.placement || {};
              graphic.placement.x = initialX;
              graphic.placement.y = initialY;
              graphic.placement.offsetY = initialY;
            } else {
              layer.x = initialX;
              layer.y = initialY;
            }
          },
        });

        // Re-render inspector & stage wings if active
        if (window.stageWings) {
          window.stageWings.renderRightWing(store.getStep());
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    this.gizmoLayer.appendChild(gizmoBox);
  }
}

export const player = new EditorPlayerManager();
