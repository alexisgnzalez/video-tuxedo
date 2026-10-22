/**
 * Tuxedo Editor Timeline - Video EDL Track
 * Renders clips with in/out trim handles using pointer capture, drag-reorder, and waveform background.
 */

import { store } from '../store.js';
import { trimClip, moveClip } from '../edl.js';

export class VideoTrack {
  constructor(containerEl, peaks = []) {
    this.container = containerEl;
    this.peaks = peaks;
  }

  setPeaks(peaks) {
    this.peaks = peaks;
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const proj = store.getProject();
    if (!proj || !proj.clips) return;

    const zoom = store.getZoom();
    const selectedClipId = store.selectedClipId;
    let offsetSec = 0;

    proj.clips.forEach((clip, index) => {
      const durSec = Math.max(0, clip.srcOut - clip.srcIn);
      const widthPx = durSec * zoom;
      const leftPx = offsetSec * zoom;

      const clipEl = document.createElement('div');
      clipEl.className = `timeline-clip ${clip.id === selectedClipId ? 'selected' : ''}`;
      clipEl.style.left = `${leftPx}px`;
      clipEl.style.width = `${Math.max(12, widthPx)}px`;
      clipEl.setAttribute('data-clip-id', clip.id);
      clipEl.setAttribute('data-clip-index', index);

      // Clip title / duration
      const titleSpan = document.createElement('span');
      titleSpan.style.pointerEvents = 'none';
      titleSpan.style.overflow = 'hidden';
      titleSpan.style.textOverflow = 'ellipsis';
      titleSpan.textContent = `Clip ${index + 1} (${durSec.toFixed(1)}s)`;
      clipEl.appendChild(titleSpan);

      // Selection on click
      clipEl.addEventListener('click', (e) => {
        e.stopPropagation();
        store.selectClip(clip.id);
      });

      // Trim In Handle (left edge)
      const trimIn = document.createElement('div');
      trimIn.className = 'clip-trim-handle clip-trim-in';
      this.attachTrimHandler(trimIn, clip.id, 'in');
      clipEl.appendChild(trimIn);

      // Trim Out Handle (right edge)
      const trimOut = document.createElement('div');
      trimOut.className = 'clip-trim-handle clip-trim-out';
      this.attachTrimHandler(trimOut, clip.id, 'out');
      clipEl.appendChild(trimOut);

      // Drag to reorder
      this.attachDragReorder(clipEl, index);

      this.container.appendChild(clipEl);
      offsetSec += durSec;
    });
  }

  attachTrimHandler(handleEl, clipId, side) {
    handleEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      handleEl.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const zoom = store.getZoom();
      const proj = store.getProject();
      const initialClips = JSON.parse(JSON.stringify(proj.clips));

      let currentClips = proj.clips;

      const onPointerMove = (ev) => {
        const deltaPx = ev.clientX - startX;
        const deltaSec = deltaPx / zoom;
        currentClips = trimClip(initialClips, clipId, side, deltaSec, proj.source?.duration || 9999);
        proj.clips = currentClips;
        this.render();
      };

      const onPointerUp = (ev) => {
        handleEl.releasePointerCapture(ev.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        // Commit with undo/redo
        store.execute({
          name: `Trim Clip ${side.toUpperCase()}`,
          do: () => {
            proj.clips = currentClips;
          },
          undo: () => {
            proj.clips = initialClips;
          },
        });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  attachDragReorder(clipEl, fromIndex) {
    clipEl.draggable = true;

    clipEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(fromIndex));
      clipEl.style.opacity = '0.5';
    });

    clipEl.addEventListener('dragend', () => {
      clipEl.style.opacity = '1';
    });

    clipEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      clipEl.style.borderLeft = '3px solid #D97757';
    });

    clipEl.addEventListener('dragleave', () => {
      clipEl.style.borderLeft = '';
    });

    clipEl.addEventListener('drop', (e) => {
      e.preventDefault();
      clipEl.style.borderLeft = '';
      const srcIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(srcIndex) && srcIndex !== fromIndex) {
        const proj = store.getProject();
        const initialClips = [...proj.clips];
        const newClips = moveClip(proj.clips, srcIndex, fromIndex);

        store.execute({
          name: 'Reorder Clips',
          do: () => {
            proj.clips = newClips;
          },
          undo: () => {
            proj.clips = initialClips;
          },
        });
      }
    });
  }
}
