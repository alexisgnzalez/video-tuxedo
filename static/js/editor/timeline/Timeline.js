/**
 * Tuxedo Editor Master Timeline Coordinator
 * Viewport-sized canvas ruler & waveform peaks, 4 synchronized tracks, and playhead scrubber.
 */

import { store } from '../store.js';
import { VideoTrack } from './VideoTrack.js';
import { CaptionTrack } from './CaptionTrack.js';
import { LayerTrack } from './LayerTrack.js';
import { splitClipAt, removeClip, getTimelineDuration } from '../edl.js';
import { formatTimecode, formatTime } from '../ui.js';

export class Timeline {
  constructor(containerEl) {
    this.container = containerEl;
    this.scrollArea = null;
    this.canvasContainer = null;
    this.rulerCanvas = null;
    this.rulerCtx = null;
    this.playhead = null;

    this.videoTrack = null;
    this.captionTrack = null;
    this.layerTrack = null;

    this.peaks = [];
  }

  mount() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="timeline-toolbar">
        <div class="timeline-tools-left">
          <button class="timeline-tool-btn" id="tlSplitBtn" title="Split Clip at Playhead (S)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
              <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
            </svg>
            Split (S)
          </button>
          <button class="timeline-tool-btn" id="tlDeleteBtn" title="Delete Selected Clip or Cue (D or Del)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete (D)
          </button>
        </div>

        <div class="timeline-tools-right">
          <span style="font-size: 11px; color: var(--vt-text-muted);">Zoom</span>
          <input type="range" class="editor-range" id="tlZoomSlider" min="30" max="250" value="100" style="width: 90px;" />
        </div>
      </div>

      <div class="timeline-body">
        <div class="timeline-track-headers">
          <div class="track-header">Video</div>
          <div class="track-header">Captions</div>
          <div class="track-header">Graphics</div>
        </div>

        <div class="timeline-scroll-area" id="tlScrollArea">
          <div class="timeline-canvas-container" id="tlCanvasContainer">
            <canvas class="timeline-ruler-canvas" id="tlRulerCanvas" height="24"></canvas>

            <div class="timeline-tracks-lane">
              <div class="track-lane" id="tlVideoLane"></div>
              <div class="track-lane" id="tlCaptionLane"></div>
              <div class="track-lane" id="tlLayerLane"></div>
            </div>

            <div class="timeline-playhead" id="tlPlayhead">
              <div class="timeline-playhead-head"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.scrollArea = this.container.querySelector('#tlScrollArea');
    this.canvasContainer = this.container.querySelector('#tlCanvasContainer');
    this.rulerCanvas = this.container.querySelector('#tlRulerCanvas');
    this.rulerCtx = this.rulerCanvas?.getContext('2d');
    this.playhead = this.container.querySelector('#tlPlayhead');

    // Initialize track controllers
    this.videoTrack = new VideoTrack(this.container.querySelector('#tlVideoLane'), this.peaks);
    this.captionTrack = new CaptionTrack(this.container.querySelector('#tlCaptionLane'));
    this.layerTrack = new LayerTrack(this.container.querySelector('#tlLayerLane'));

    // Bind UI events
    this.bindEvents();

    // Subscribe to store updates
    store.subscribe('change', () => this.render());
    store.subscribe('selection:clip', () => this.videoTrack?.render());
    store.subscribe('selection:cue', () => this.captionTrack?.render());
    store.subscribe('selection:layer', () => this.layerTrack?.render());
    store.subscribe('time:change', ({ time }) => this.updatePlayheadPosition(time));
    store.subscribe('zoom:change', () => this.render());

    // Initial render
    this.render();
  }

  setPeaks(peaks) {
    this.peaks = peaks;
    if (this.videoTrack) this.videoTrack.setPeaks(peaks);
    this.drawRuler();
  }

  bindEvents() {
    // Zoom slider
    const zoomSlider = this.container.querySelector('#tlZoomSlider');
    zoomSlider?.addEventListener('input', (e) => {
      store.setZoom(parseFloat(e.target.value));
    });

    // Split button
    const splitBtn = this.container.querySelector('#tlSplitBtn');
    splitBtn?.addEventListener('click', () => this.splitAtPlayhead());

    // Delete button
    const delBtn = this.container.querySelector('#tlDeleteBtn');
    delBtn?.addEventListener('click', () => this.deleteSelection());

    // Helper to calculate target seconds from a pointer event clamped to project duration
    const getClampedSecFromPointer = (ev) => {
      const proj = store.getProject();
      const maxDur = (proj && proj.clips && proj.clips.length > 0)
        ? getTimelineDuration(proj.clips)
        : (proj?.source?.duration || 0);
      const rect = this.canvasContainer.getBoundingClientRect();
      const clickX = ev.clientX - rect.left;
      const zoom = store.getZoom();
      const rawSec = clickX / zoom;
      return maxDur > 0 ? Math.max(0, Math.min(maxDur, rawSec)) : Math.max(0, rawSec);
    };

    // Click / Drag on Ruler to seek
    const rulerEl = this.rulerCanvas;
    rulerEl?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      rulerEl.setPointerCapture(e.pointerId);

      const seekFromPointer = (ev) => {
        const targetSec = getClampedSecFromPointer(ev);
        store.setTime(targetSec);
        if (window.editorPlayer) {
          window.editorPlayer.seek(targetSec);
        }
      };

      seekFromPointer(e);

      const onPointerMove = (ev) => seekFromPointer(ev);
      const onPointerUp = (ev) => {
        rulerEl.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Scrubber head drag
    const playheadHead = this.playhead?.querySelector('.timeline-playhead-head');
    playheadHead?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      playheadHead.setPointerCapture(e.pointerId);

      const onPointerMove = (ev) => {
        const targetSec = getClampedSecFromPointer(ev);
        store.setTime(targetSec);
        if (window.editorPlayer) {
          window.editorPlayer.seek(targetSec);
        }
      };

      const onPointerUp = (ev) => {
        playheadHead.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Click on empty track lanes to seek
    const tracksLane = this.container.querySelector('.timeline-tracks-lane');
    tracksLane?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.clip-block') || e.target.closest('.caption-cue-block') || e.target.closest('.layer-item-block')) {
        return;
      }
      const targetSec = getClampedSecFromPointer(e);
      store.setTime(targetSec);
      if (window.editorPlayer) {
        window.editorPlayer.seek(targetSec);
      }
    });

    // Scroll listener to update ruler
    this.scrollArea?.addEventListener('scroll', () => {
      this.drawRuler();
    });

    // Global keyboard shortcuts for timeline
    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        this.splitAtPlayhead();
      } else if (e.code === 'KeyD' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        this.deleteSelection();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        this.deleteSelection();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (window.editorPlayer) {
          window.editorPlayer.togglePlay();
        }
      } else if (e.code === 'KeyZ' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }
    });
  }

  splitAtPlayhead() {
    const proj = store.getProject();
    if (!proj || !proj.clips) return;

    const currentTime = store.getTime();
    const initialClips = JSON.parse(JSON.stringify(proj.clips));
    const { clips: newClips, didSplit } = splitClipAt(proj.clips, currentTime);

    if (didSplit) {
      store.execute({
        name: 'Split Clip',
        do: () => {
          proj.clips = newClips;
        },
        undo: () => {
          proj.clips = initialClips;
        },
      });
    }
  }

  deleteSelection() {
    const proj = store.getProject();
    if (!proj) return;

    if (store.selectedClipId && proj.clips) {
      const clipId = store.selectedClipId;
      const initialClips = [...proj.clips];
      const newClips = removeClip(proj.clips, clipId);

      if (newClips.length !== initialClips.length) {
        store.execute({
          name: 'Delete Clip',
          do: () => {
            proj.clips = newClips;
            store.selectClip(null);
          },
          undo: () => {
            proj.clips = initialClips;
            store.selectClip(clipId);
          },
        });
      }
      return;
    }

    if (store.selectedCueId && proj.captions?.cues) {
      const cueId = store.selectedCueId;
      const initialCues = [...proj.captions.cues];
      const newCues = proj.captions.cues.filter(c => c.id !== cueId);

      if (newCues.length !== initialCues.length) {
        store.execute({
          name: 'Delete Subtitle Cue',
          do: () => {
            proj.captions.cues = newCues;
            store.selectCue(null);
          },
          undo: () => {
            proj.captions.cues = initialCues;
            store.selectCue(cueId);
          },
        });
      }
      return;
    }

    if (store.selectedLayerId) {
      const layerId = store.selectedLayerId;
      const initialItems = [...(proj.graphics?.items || [])];
      const initialLayers = [...(proj.layers || [])];
      const newItems = initialItems.filter(i => i.id !== layerId);
      const newLayers = initialLayers.filter(l => l.id !== layerId);

      if (newItems.length !== initialItems.length || newLayers.length !== initialLayers.length) {
        store.execute({
          name: 'Delete Graphic Layer',
          do: () => {
            if (proj.graphics) proj.graphics.items = newItems;
            proj.layers = newLayers;
            store.selectLayer(null);
          },
          undo: () => {
            if (proj.graphics) proj.graphics.items = initialItems;
            proj.layers = initialLayers;
            store.selectLayer(layerId);
          },
        });
      }
      return;
    }
  }

  deleteSelectedClip() {
    this.deleteSelection();
  }

  render() {
    const proj = store.getProject();
    if (!proj) return;

    const zoom = store.getZoom();
    const totalDuration = getTimelineDuration(proj.clips) || proj.source?.duration || 10;
    const scrollWidth = this.scrollArea?.clientWidth || 800;
    const totalWidthPx = Math.max(scrollWidth, Math.ceil(totalDuration * zoom + 60));

    if (this.canvasContainer) {
      this.canvasContainer.style.width = `${totalWidthPx}px`;
    }

    this.drawRuler();
    this.videoTrack?.render();
    this.captionTrack?.render();
    this.layerTrack?.render();
    this.updatePlayheadPosition(store.getTime());
  }

  drawRuler() {
    if (!this.rulerCanvas || !this.rulerCtx) return;

    const proj = store.getProject();
    const totalDuration = proj ? (getTimelineDuration(proj.clips) || proj.source?.duration || 10) : 10;
    const zoom = store.getZoom();

    const canvasWidth = this.canvasContainer?.offsetWidth || 1000;
    this.rulerCanvas.width = canvasWidth;
    this.rulerCanvas.height = 24;

    const ctx = this.rulerCtx;
    ctx.clearRect(0, 0, canvasWidth, 24);

    ctx.fillStyle = '#6B6860';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.strokeStyle = '#D5D2CB';
    ctx.lineWidth = 1;

    // Step interval based on zoom level
    let stepSec = 1;
    if (zoom < 50) stepSec = 5;
    if (zoom < 25) stepSec = 10;

    // Only draw ruler ticks up to the end of the video plus a tiny margin
    const maxSec = Math.min(Math.ceil(totalDuration), Math.ceil(canvasWidth / zoom));

    for (let s = 0; s <= maxSec; s += stepSec) {
      const x = Math.round(s * zoom);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 14);
      ctx.lineTo(x + 0.5, 24);
      ctx.stroke();

      // Time label
      ctx.fillText(formatTime(s), x + 4, 12);

      // Sub-ticks
      if (stepSec > 1) {
        const subCount = stepSec;
        for (let sub = 1; sub < subCount; sub++) {
          const subS = s + sub;
          if (subS > totalDuration) break;
          const subX = Math.round(subS * zoom);
          ctx.beginPath();
          ctx.moveTo(subX + 0.5, 18);
          ctx.lineTo(subX + 0.5, 24);
          ctx.stroke();
        }
      }
    }

    // End boundary line
    if (totalDuration > 0) {
      const endX = Math.round(totalDuration * zoom);
      ctx.save();
      ctx.strokeStyle = 'var(--vt-accent-coral, #E25D34)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endX + 0.5, 0);
      ctx.lineTo(endX + 0.5, 24);
      ctx.stroke();
      ctx.restore();
    }
  }

  updatePlayheadPosition(seconds) {
    if (!this.playhead) return;
    const proj = store.getProject();
    const maxDur = (proj && proj.clips && proj.clips.length > 0)
      ? getTimelineDuration(proj.clips)
      : (proj?.source?.duration || 0);
    const clampedSec = maxDur > 0 ? Math.max(0, Math.min(maxDur, seconds)) : Math.max(0, seconds);
    const zoom = store.getZoom();
    const x = clampedSec * zoom;
    this.playhead.style.left = `${x}px`;
  }
}
