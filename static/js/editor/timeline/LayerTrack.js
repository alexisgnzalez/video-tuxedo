/**
 * Tuxedo Editor Timeline - Layer & Graphics Track
 * Renders visual overlays, stickers, and graphic items with duration bars.
 */

import { store } from '../store.js';

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
    const items = [
      ...(proj.layers || []).map(l => ({ ...l, type: 'image' })),
      ...(proj.graphics?.items || []).map(g => ({ ...g, type: 'graphic' })),
    ];

    items.forEach((item) => {
      const durSec = Math.max(0.3, (item.end || item.startTime || 0) - (item.start || item.startTime || 0));
      const startSec = item.start !== undefined ? item.start : (item.startTime || 0);
      const widthPx = durSec * zoom;
      const leftPx = startSec * zoom;

      const blockEl = document.createElement('div');
      blockEl.className = 'timeline-layer-block';
      if (item.type === 'graphic') {
        blockEl.style.backgroundColor = '#F59E0B';
        blockEl.style.borderColor = '#D97706';
      }
      if (item.id === selectedLayerId) {
        blockEl.style.border = '2px solid #FFF';
        blockEl.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.6)';
      }

      blockEl.style.left = `${leftPx}px`;
      blockEl.style.width = `${Math.max(16, widthPx)}px`;
      blockEl.setAttribute('data-layer-id', item.id);
      blockEl.textContent = item.name || item.component || 'Overlay';

      blockEl.addEventListener('click', (e) => {
        e.stopPropagation();
        store.selectLayer(item.id);
        store.setTime(startSec);
      });

      this.container.appendChild(blockEl);
    });
  }
}
