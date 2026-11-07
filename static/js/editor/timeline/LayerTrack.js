/**
 * Tuxedo Editor Timeline - Layer & Graphics Track
 * Renders visual overlays, stickers, and Remotion graphic items with interactive:
 *  - Drag to reposition in timeline (change when they appear)
 *  - Left & Right trim handles (change duration)
 *  - One-click deletion and undo/redo support
 */

import { store } from '../store.js?v=0.7.4';
import { formatTime } from '../ui.js?v=0.7.4';

export class LayerTrack {
  constructor(containerEl) {
    this.container = containerEl;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const proj = store.getProject();
    if (!proj) return;

    const zoom = store.getZoom();
    const selectedLayerId = store.selectedLayerId;

    // Combine image layers and graphic items
    const rawItems = [
      ...(proj.layers || []).map(l => ({ ...l, type: 'image' })),
      ...(proj.graphics?.items || []).map(g => ({ ...g, type: 'graphic' })),
    ];

    rawItems.forEach((raw) => {
      // Find true reference in project data
      const isGraphic = raw.type === 'graphic';
      const item = isGraphic
        ? (proj.graphics?.items || []).find(g => g.id === raw.id)
        : (proj.layers || []).find(l => l.id === raw.id);

      if (!item) return;

      const startSec = item.start !== undefined ? item.start : (item.startTime || 0);
      const endSec = item.end !== undefined ? item.end : (item.endTime || (startSec + 2.5));
      const durSec = Math.max(0.2, endSec - startSec);
      const widthPx = durSec * zoom;
      const leftPx = startSec * zoom;

      const isSelected = item.id === selectedLayerId;
      const blockEl = document.createElement('div');
      blockEl.className = `timeline-layer-block ${isSelected ? 'selected' : ''} ${isGraphic ? 'is-graphic' : 'is-image'}`;
      blockEl.setAttribute('data-layer-id', item.id);
      blockEl.style.left = `${leftPx}px`;
      blockEl.style.width = `${Math.max(28, widthPx)}px`;

      const title = isGraphic
        ? (item.props?.headlineText || item.component?.replace(/_/g, ' ') || 'Graphic')
        : (item.name || 'Image Layer');

      const timeRangeText = `${formatTime(startSec)} → ${formatTime(endSec)} (${durSec.toFixed(1)}s)`;
      blockEl.title = `${title} • ${timeRangeText}`;

      blockEl.innerHTML = `
        <div class="layer-trim-handle layer-trim-in" title="Drag to adjust start time"></div>
        <div class="layer-block-content">
          <span class="layer-block-icon">${isGraphic ? '✨' : '🖼️'}</span>
          <span class="layer-block-title">${title}</span>
          <span class="layer-block-dur">${durSec.toFixed(1)}s</span>
        </div>
        <button class="layer-block-del" title="Eliminate Graphic">&times;</button>
        <div class="layer-trim-handle layer-trim-out" title="Drag to adjust duration"></div>
      `;

      // Select layer on click
      blockEl.addEventListener('click', (e) => {
        e.stopPropagation();
        store.selectClip(null);
        store.selectCue(null);
        store.selectLayer(item.id);
        store.setTime(startSec);
        if (window.editorPlayer) {
          window.editorPlayer.renderGizmo(item.id);
          window.editorPlayer.seek(startSec);
        }
      });

      // Trim In Handle (adjust start time)
      const handleIn = blockEl.querySelector('.layer-trim-in');
      if (handleIn) {
        this.attachTrimHandler(handleIn, blockEl, item, 'in', isGraphic);
      }

      // Trim Out Handle (adjust end time / duration)
      const handleOut = blockEl.querySelector('.layer-trim-out');
      if (handleOut) {
        this.attachTrimHandler(handleOut, blockEl, item, 'out', isGraphic);
      }

      // Center Drag Handle (translate when graphic appears)
      const contentEl = blockEl.querySelector('.layer-block-content');
      if (contentEl) {
        this.attachMoveHandler(contentEl, blockEl, item, isGraphic);
      }

      // Delete Button (eliminate graphic)
      const delBtn = blockEl.querySelector('.layer-block-del');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.eliminateItem(item.id, isGraphic);
        });
      }

      this.container.appendChild(blockEl);
    });
  }

  attachTrimHandler(handleEl, blockEl, item, side, isGraphic) {
    handleEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleEl.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const zoom = store.getZoom();
      const initialStart = item.start !== undefined ? item.start : (item.startTime || 0);
      const initialEnd = item.end !== undefined ? item.end : (item.endTime || (initialStart + 2.5));

      let currentStart = initialStart;
      let currentEnd = initialEnd;

      blockEl.classList.add('trimming');

      const onPointerMove = (ev) => {
        const deltaPx = ev.clientX - startX;
        const deltaSec = deltaPx / zoom;

        if (side === 'in') {
          // Adjust start, clamp so min duration is 0.6s (broadcast readable floor)
          currentStart = Math.max(0, Math.min(initialEnd - 0.6, initialStart + deltaSec));
          const newDur = Math.max(0.6, currentEnd - currentStart);
          blockEl.style.left = `${currentStart * zoom}px`;
          blockEl.style.width = `${newDur * zoom}px`;
          const durBadge = blockEl.querySelector('.layer-block-dur');
          if (durBadge) durBadge.textContent = `${newDur.toFixed(1)}s`;
        } else {
          // Adjust end, clamp so min duration is 0.6s
          currentEnd = Math.max(currentStart + 0.6, initialEnd + deltaSec);
          const newDur = currentEnd - currentStart;
          blockEl.style.width = `${newDur * zoom}px`;
          const durBadge = blockEl.querySelector('.layer-block-dur');
          if (durBadge) durBadge.textContent = `${newDur.toFixed(1)}s`;
        }
      };

      const onPointerUp = (ev) => {
        try {
          handleEl.releasePointerCapture(ev.pointerId);
        } catch {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        blockEl.classList.remove('trimming');

        if (Math.abs(currentStart - initialStart) > 0.01 || Math.abs(currentEnd - initialEnd) > 0.01) {
          const finalStart = Math.round(currentStart * 100) / 100;
          const finalEnd = Math.round(currentEnd * 100) / 100;

          store.execute({
            name: `Change Graphic Duration (${side.toUpperCase()})`,
            do: () => {
              item.start = finalStart;
              item.end = finalEnd;
              if (item.startTime !== undefined) item.startTime = finalStart;
              if (item.endTime !== undefined) item.endTime = finalEnd;
            },
            undo: () => {
              item.start = initialStart;
              item.end = initialEnd;
              if (item.startTime !== undefined) item.startTime = initialStart;
              if (item.endTime !== undefined) item.endTime = initialEnd;
            },
          });
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  attachMoveHandler(contentEl, blockEl, item, isGraphic) {
    contentEl.addEventListener('pointerdown', (e) => {
      // Don't trigger move on delete button click
      if (e.target.closest('.layer-block-del')) return;

      e.stopPropagation();
      e.preventDefault();
      contentEl.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const zoom = store.getZoom();
      const initialStart = item.start !== undefined ? item.start : (item.startTime || 0);
      const initialEnd = item.end !== undefined ? item.end : (item.endTime || (initialStart + 2.5));
      const durSec = Math.max(0.2, initialEnd - initialStart);

      let currentStart = initialStart;
      let currentEnd = initialEnd;
      let hasDragged = false;

      blockEl.classList.add('dragging');

      const onPointerMove = (ev) => {
        const deltaPx = ev.clientX - startX;
        if (Math.abs(deltaPx) > 3) hasDragged = true;

        const deltaSec = deltaPx / zoom;
        currentStart = Math.max(0, initialStart + deltaSec);
        currentEnd = currentStart + durSec;

        blockEl.style.left = `${currentStart * zoom}px`;
      };

      const onPointerUp = (ev) => {
        try {
          contentEl.releasePointerCapture(ev.pointerId);
        } catch {}
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        blockEl.classList.remove('dragging');

        if (hasDragged && Math.abs(currentStart - initialStart) > 0.02) {
          const finalStart = Math.round(currentStart * 100) / 100;
          const finalEnd = Math.round(currentEnd * 100) / 100;

          store.execute({
            name: 'Shift Graphic Appearance Time',
            do: () => {
              item.start = finalStart;
              item.end = finalEnd;
              if (item.startTime !== undefined) item.startTime = finalStart;
              if (item.endTime !== undefined) item.endTime = finalEnd;
            },
            undo: () => {
              item.start = initialStart;
              item.end = initialEnd;
              if (item.startTime !== undefined) item.startTime = initialStart;
              if (item.endTime !== undefined) item.endTime = initialEnd;
            },
          });
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  eliminateItem(itemId, isGraphic) {
    const proj = store.getProject();
    if (!proj) return;

    if (isGraphic && proj.graphics?.items) {
      const initialItems = [...proj.graphics.items];
      const newItems = initialItems.filter(g => g.id !== itemId);
      store.execute({
        name: 'Eliminate Motion Graphic',
        do: () => {
          proj.graphics.items = newItems;
          if (store.selectedLayerId === itemId) store.selectLayer(null);
        },
        undo: () => {
          proj.graphics.items = initialItems;
          store.selectLayer(itemId);
        },
      });
    } else if (proj.layers) {
      const initialLayers = [...proj.layers];
      const newLayers = initialLayers.filter(l => l.id !== itemId);
      store.execute({
        name: 'Eliminate Image Layer',
        do: () => {
          proj.layers = newLayers;
          if (store.selectedLayerId === itemId) store.selectLayer(null);
        },
        undo: () => {
          proj.layers = initialLayers;
          store.selectLayer(itemId);
        },
      });
    }
  }
}
