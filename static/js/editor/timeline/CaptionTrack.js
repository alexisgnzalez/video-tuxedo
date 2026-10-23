/**
 * Tuxedo Editor Timeline - Caption Subtitle Track
 * Renders subtitle cue blocks with click-to-select and time syncing.
 */

import { store } from '../store.js';

export class CaptionTrack {
  constructor(containerEl) {
    this.container = containerEl;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const proj = store.getProject();
    if (!proj || !proj.captions || !proj.captions.cues) return;

    const zoom = store.getZoom();
    const selectedCueId = store.selectedCueId;

    proj.captions.cues.forEach((cue) => {
      const durSec = Math.max(0.2, cue.end - cue.start);
      const widthPx = durSec * zoom;
      const leftPx = cue.start * zoom;

      const isSelected = cue.id === selectedCueId;
      const cueEl = document.createElement('div');
      cueEl.className = `timeline-cue-block ${isSelected ? 'selected' : ''}`;
      cueEl.style.left = `${leftPx}px`;
      cueEl.style.width = `${Math.max(12, widthPx)}px`;
      cueEl.setAttribute('data-cue-id', cue.id);
      cueEl.textContent = cue.text;

      cueEl.addEventListener('click', (e) => {
        e.stopPropagation();
        store.selectClip(null);
        store.selectLayer(null);
        store.selectCue(cue.id);
        store.setTime(cue.start);
      });

      this.container.appendChild(cueEl);
    });
  }
}
