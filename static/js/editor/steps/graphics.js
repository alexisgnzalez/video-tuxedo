/**
 * Tuxedo Editor Step 5: Multi-Style Motion Graphics & B-Roll Overlays
 */

import { store } from '../store.js?v=0.7.6';
import { showToast } from '../ui.js?v=0.7.6';
import { fetchSfxCatalog, playSfxAudition, buildSfxSelectOptions } from '../sfxLibrary.js?v=0.7.6';

let currentSfxCatalog = null;

export async function renderStepGraphics(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = `
      <div class="step-panel-inner">
        <div class="step-header">
          <div class="step-eyebrow">Step 5 of 6</div>
          <h2 class="step-title">Graphics & Overlays</h2>
          <p class="step-desc">Open an existing project or upload footage to edit motion graphics.</p>
        </div>
        <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 18px; text-align: center; display: flex; flex-direction: column; gap: 10px;">
          <span style="font-size: 28px;">🎬</span>
          <span style="font-size: 13px; font-weight: 600;">No Active Project Selected</span>
          <p style="font-size: 11px; color: var(--vt-text-muted); margin: 0;">Select a project from your library in Step 1 to begin editing titles and sandwich effects.</p>
          <button class="vt-btn-primary" id="btnStep5BackToUpload" style="font-size: 12px; margin-top: 4px;">
            &larr; Open Project in Step 1
          </button>
        </div>
      </div>
    `;
    container.querySelector('#btnStep5BackToUpload')?.addEventListener('click', () => store.setStep(1));
    return;
  }

  // Pre-load DaVinci SFX library if not yet cached
  if (!currentSfxCatalog) {
    try {
      currentSfxCatalog = await fetchSfxCatalog();
    } catch (e) {
      console.warn('Failed to pre-load DaVinci SFX catalog:', e);
    }
  }

  // Fetch registered styles from server
  let styles = [];
  try {
    const sRes = await fetch('/api/editor/styles');
    if (sRes.ok) styles = await sRes.json();
  } catch (e) {
    console.error('Error fetching styles:', e);
  }

  const currentStyleId = proj.graphics?.style || 'story_tuxedo';
  const selectedStyle = styles.find(s => s.id === currentStyleId) || styles[0] || {
    id: 'story_tuxedo',
    name: 'Comedic Storytelling',
    components: []
  };

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 5 of 6</div>
        <h2 class="step-title">Graphics & B-Roll</h2>
        <p class="step-desc">Choose a visual aesthetic theme and drop headlines, stickers, and image layers behind or in front of your subject.</p>
      </div>

      <!-- Style Selector -->
      <div class="editor-field">
        <label class="editor-label">Visual Theme / Aesthetic</label>
        <select class="editor-select" id="selectGraphicStyle">
          ${styles.map(s => `
            <option value="${s.id}" ${s.id === currentStyleId ? 'selected' : ''}>
              ${s.name} (${s.badge})
            </option>
          `).join('')}
        </select>
        <div style="font-size: 11px; color: var(--vt-text-muted); margin-top: 2px;">
          ${selectedStyle.description}
        </div>
      </div>

      <!-- Auto-Generate Graphics with AI -->
      <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.12) 100%); border: 1.5px solid #F59E0B; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; font-weight: 700; color: #B45309; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
            </svg>
            Auto-Generate Graphics (AI)
          </span>
          <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #B45309;">1-Click</span>
        </div>
        <p style="font-size: 11px; color: var(--vt-text-muted); margin: 0; line-height: 1.4;">
          Automatically places opening hooks, punchline cards, and emphasis badges using speech analysis & Gemini. You can then polish, move, or delete any cue.
        </p>
        <button class="vt-btn-primary" id="btnAutoGenerateGraphics" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); border-color: #D97706; font-weight: 600; cursor: pointer;">
          ⚡ Auto-Generate All Titles & Emphasis
        </button>
      </div>

      <!-- Add Graphic Component -->
      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size: 12px; font-weight: 600;">Add Graphic Cue at Playhead</span>
        <div style="display: flex; gap: 6px;">
          <select class="editor-select" id="selectComponentType" style="flex: 1;">
            ${(selectedStyle.components || []).map(c => `
              <option value="${c.id}">${c.name}</option>
            `).join('')}
          </select>
          <button class="vt-btn-primary" id="btnAddGraphicBtn" style="width: auto; padding: 6px 12px; font-size: 12px;">+ Add</button>
        </div>
      </div>

      <!-- Upload Image Overlay / B-Roll Sticker -->
      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <span style="font-size: 12px; font-weight: 600;">Upload Image Layer / Sticker</span>
        <input type="file" id="inputLayerImage" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;" />
        <button class="vt-btn-secondary" id="btnUploadImageLayer">
          Upload Image File (PNG / JPG / WebP)
        </button>
      </div>

      <!-- Layers & Items List -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
        <span style="font-size: 13px; font-weight: 600;">Active Overlays & Cues</span>
      </div>

      <div id="graphicsLayersList" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
        <!-- Rendered items -->
      </div>

      </div>
    </div>

    <!-- Always Visible Sticky Footer Navigation -->
    <div class="step-panel-footer">
      <button class="vt-btn-secondary" id="btnBackToStep4" style="flex: 1;">&larr; Back</button>
      <button class="vt-btn-primary" id="btnGoToStep6" style="flex: 2;">Next: Export Video &rarr;</button>
    </div>
  `;

  renderOverlayItems(container, styles);
  bindGraphicsEvents(container, styles);
}

function renderOverlayItems(container, styles = []) {
  const listEl = container.querySelector('#graphicsLayersList');
  if (!listEl) return;

  const proj = store.getProject();
  const layers = proj.layers || [];
  const graphicItems = proj.graphics?.items || [];

  if (layers.length === 0 && graphicItems.length === 0) {
    listEl.innerHTML = '<div style="font-size: 12px; color: var(--vt-text-muted); text-align: center; padding: 16px;">No overlays added yet. Add a headline or upload an image.</div>';
    return;
  }

  listEl.innerHTML = '';

  const allComponents = styles.flatMap(s => s.components || []);

  // Render Graphic Items
  graphicItems.forEach((item, index) => {
    // Find component definition
    const compDef = allComponents.find(c => c.id === item.component) || {
      name: item.component?.replace(/_/g, ' ')?.toUpperCase() || 'Graphic Cue',
    };

    const startVal = item.start !== undefined ? item.start : (item.startTime || 0);
    const endVal = item.end !== undefined ? item.end : (item.endTime || (startVal + 2.5));
    const durVal = Math.max(0.2, endVal - startVal);
    const currentPos = item.placement?.position || 'top';
    const currentY = item.placement?.y ?? item.placement?.offsetY ?? (currentPos === 'collarbone' ? 1350 : currentPos === 'top' ? 240 : currentPos === 'lower' ? 1550 : 960);

    const textContent = `${item.props?.headlineText || ''} ${item.props?.subText || ''}`.trim();
    const smartDur = Math.min(6.0, Math.max(1.5, Math.round((1.1 + (textContent.length / 15)) * 10) / 10));
    const curSfx = item.sfxFile || (typeof item.sfx === 'string' ? item.sfx : (Array.isArray(item.sfx) && item.sfx[0]?.file ? item.sfx[0].file : ''));

    const el = document.createElement('div');
    el.className = 'editor-overlay-card';
    el.style.background = 'var(--vt-bg-surface)';
    el.style.border = '1px solid var(--vt-border)';
    el.style.borderRadius = '8px';
    el.style.padding = '10px 12px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';
    el.style.fontSize = '12px';
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: #D97706; text-transform: uppercase; font-size: 11px; display: flex; align-items: center; gap: 4px;">
          <span>✨</span> ${compDef.name || item.component}
        </span>
        <button class="del-item-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #DC2626; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight: 600;">🗑️ Eliminate</button>
      </div>

      <!-- Text Inputs -->
      <input type="text" class="editor-input headline-text-input" value="${(item.props?.headlineText || '').replace(/"/g, '&quot;')}" placeholder="Headline Text..." />
      <input type="text" class="editor-input subtext-input" value="${(item.props?.subText || '').replace(/"/g, '&quot;')}" placeholder="Subtitle / Kicker text (optional)..." style="font-size: 11px;" />

      <!-- Timing & Duration (When it appears & duration) -->
      <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--vt-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
          <span style="font-size: 11px; font-weight: 600; color: var(--vt-text-primary);">⏱️ Timing & Readability</span>
          <div style="display: flex; gap: 4px;">
            <button class="btn-snap-playhead" style="font-size: 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #B45309; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-weight: 600;">⏱️ Snap Playhead</button>
            <button class="btn-smart-read" style="font-size: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #2563EB; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-weight: 600;" title="Auto-calculate optimal reading time based on 15 Characters Per Second">⚡ Smart Read (${smartDur.toFixed(1)}s)</button>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 10px; color: var(--vt-text-muted);">Starts At (s)</span>
            <input type="number" step="0.1" min="0" class="editor-input item-start-input" value="${startVal.toFixed(1)}" style="padding: 4px 6px; font-size: 11px;" />
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 10px; color: var(--vt-text-muted);">Duration (s)</span>
            <input type="number" step="0.1" min="0.6" max="30" class="editor-input item-dur-input" value="${durVal.toFixed(1)}" style="padding: 4px 6px; font-size: 11px;" />
          </div>
        </div>
      </div>

      <!-- Placement & Coordinates (Move them around) -->
      <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--vt-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--vt-text-primary);">🎯 Placement & Position</span>
        <div style="display: flex; gap: 6px;">
          <select class="editor-select item-pos-select" style="flex: 1; font-size: 11px; padding: 3px 6px;">
            <option value="top" ${currentPos === 'top' ? 'selected' : ''}>Top Hook Canopy</option>
            <option value="collarbone" ${currentPos === 'collarbone' ? 'selected' : ''}>Collarbone Safe Zone</option>
            <option value="center" ${currentPos === 'center' ? 'selected' : ''}>Dead Center</option>
            <option value="lower" ${currentPos === 'lower' || currentPos === 'lower-third' ? 'selected' : ''}>Lower Third</option>
            <option value="bottom-right" ${currentPos === 'bottom-right' ? 'selected' : ''}>Bottom-Right Popup</option>
            <option value="bottom-left" ${currentPos === 'bottom-left' ? 'selected' : ''}>Bottom-Left Popup</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 10px; color: var(--vt-text-muted); min-width: 55px;">Height Y:</span>
          <input type="range" class="editor-range item-y-slider" min="180" max="1700" step="10" value="${currentY}" style="flex: 1;" />
          <span class="item-y-val" style="font-size: 10px; font-weight: 600; min-width: 45px; text-align: right;">${currentY}px</span>
        </div>
      </div>

      <!-- Sound Effect (DaVinci SFX Library) -->
      <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--vt-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 600; color: var(--vt-text-primary);">🔊 Motion Sound (DaVinci SFX)</span>
          <button class="btn-audition-sfx" style="font-size: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #059669; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-weight: 600;" title="Audition this sound effect">▶ Audition</button>
        </div>
        <select class="editor-select item-sfx-select" style="font-size: 11px; padding: 3px 6px;">
          ${buildSfxSelectOptions(currentSfxCatalog, curSfx)}
        </select>
      </div>

      <!-- Sandwich Layer Position -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--vt-text-muted);">
        <span>Layer Depth:</span>
        <select class="editor-select z-select" style="font-size: 11px; padding: 2px 6px;">
          <option value="behind" ${item.layer === 'behind' ? 'selected' : ''}>Behind Speaker (3-Layer Sandwich)</option>
          <option value="front" ${item.layer === 'front' ? 'selected' : ''}>In Front of Speaker</option>
        </select>
      </div>
    `;

    // Click card to select & show gizmo
    el.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return;
      store.selectLayer(item.id);
      if (window.editorPlayer) window.editorPlayer.renderGizmo(item.id);
    });

    // SFX select change
    el.querySelector('.item-sfx-select')?.addEventListener('change', (e) => {
      const selected = e.target.value;
      item.sfxFile = selected;
      item.sfx = selected;
      store.triggerAutosave();
      store.emit('change');
      if (selected && selected !== 'none') {
        playSfxAudition(selected, currentSfxCatalog);
      }
    });

    // SFX audition button
    el.querySelector('.btn-audition-sfx')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const sfxSelect = el.querySelector('.item-sfx-select');
      const sfxPath = sfxSelect?.value || item.sfxFile || (typeof item.sfx === 'string' ? item.sfx : (Array.isArray(item.sfx) && item.sfx[0]?.file ? item.sfx[0].file : ''));
      if (sfxPath && sfxPath !== 'none') {
        playSfxAudition(sfxPath, currentSfxCatalog);
      } else {
        showToast('No SFX selected for this cue', 'info');
      }
    });

    // Headline change
    el.querySelector('.headline-text-input')?.addEventListener('input', (e) => {
      item.props = item.props || {};
      item.props.headlineText = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    // Subtext change
    el.querySelector('.subtext-input')?.addEventListener('input', (e) => {
      item.props = item.props || {};
      item.props.subText = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    // Start time input (change when they appear)
    el.querySelector('.item-start-input')?.addEventListener('change', (e) => {
      const newStart = Math.max(0, parseFloat(e.target.value) || 0);
      const curDur = (item.end || (startVal + 2.5)) - (item.start || startVal);
      item.start = newStart;
      item.end = newStart + Math.max(0.2, curDur);
      if (item.startTime !== undefined) item.startTime = item.start;
      if (item.endTime !== undefined) item.endTime = item.end;
      store.triggerAutosave();
      store.emit('change');
      showToast(`Graphic appearance time: ${newStart.toFixed(1)}s`, 'info');
    });

    // Duration input (change duration)
    el.querySelector('.item-dur-input')?.addEventListener('change', (e) => {
      const newDur = Math.min(30.0, Math.max(0.6, parseFloat(e.target.value) || 1.5));
      const curStart = item.start !== undefined ? item.start : startVal;
      item.start = curStart;
      item.end = curStart + newDur;
      if (item.startTime !== undefined) item.startTime = item.start;
      if (item.endTime !== undefined) item.endTime = item.end;
      store.triggerAutosave();
      store.emit('change');
      showToast(`Graphic duration: ${newDur.toFixed(1)}s`, 'info');
    });

    // Smart reading duration button (15 CPS broadcast standard)
    el.querySelector('.btn-smart-read')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = `${item.props?.headlineText || ''} ${item.props?.subText || ''}`.trim();
      const calculatedDur = Math.min(6.0, Math.max(1.5, Math.round((1.1 + (text.length / 15)) * 10) / 10));
      const curStart = item.start !== undefined ? item.start : startVal;
      item.start = curStart;
      item.end = curStart + calculatedDur;
      if (item.startTime !== undefined) item.startTime = item.start;
      if (item.endTime !== undefined) item.endTime = item.end;

      const durInput = el.querySelector('.item-dur-input');
      if (durInput) durInput.value = calculatedDur.toFixed(1);

      store.triggerAutosave();
      store.emit('change');
      showToast(`Applied Smart Read Time: ${calculatedDur.toFixed(1)}s (${text.length} chars @ 15 CPS)`, 'success');
    });

    // Snap to playhead
    el.querySelector('.btn-snap-playhead')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const playhead = store.getTime();
      const curDur = (item.end || (startVal + 2.5)) - (item.start || startVal);
      item.start = Math.round(playhead * 100) / 100;
      item.end = Math.round((playhead + Math.max(0.6, curDur)) * 100) / 100;
      if (item.startTime !== undefined) item.startTime = item.start;
      if (item.endTime !== undefined) item.endTime = item.end;
      store.triggerAutosave();
      store.emit('change');
      renderOverlayItems(container, styles);
      showToast(`Graphic moved to playhead (${playhead.toFixed(1)}s)`, 'success');
    });

    // Placement preset select (move them around)
    el.querySelector('.item-pos-select')?.addEventListener('change', (e) => {
      const pos = e.target.value;
      item.placement = item.placement || {};
      item.placement.position = pos;
      let newY = 960;
      if (pos === 'top') newY = 240;
      else if (pos === 'collarbone') newY = 1350;
      else if (pos === 'center') newY = 960;
      else if (pos === 'lower') newY = 1550;
      else if (pos === 'bottom-right' || pos === 'bottom-left') newY = 1440;

      item.placement.y = newY;
      item.placement.offsetY = newY;

      const slider = el.querySelector('.item-y-slider');
      const valSpan = el.querySelector('.item-y-val');
      if (slider) slider.value = newY;
      if (valSpan) valSpan.textContent = `${newY}px`;

      store.triggerAutosave();
      store.emit('change');
      if (window.editorPlayer) window.editorPlayer.renderGizmo(item.id);
      showToast(`Position preset: ${pos}`, 'success');
    });

    // Vertical Y slider (move them around)
    el.querySelector('.item-y-slider')?.addEventListener('input', (e) => {
      const yVal = parseInt(e.target.value, 10);
      item.placement = item.placement || {};
      item.placement.y = yVal;
      item.placement.offsetY = yVal;
      const valSpan = el.querySelector('.item-y-val');
      if (valSpan) valSpan.textContent = `${yVal}px`;

      store.triggerAutosave();
      store.emit('change');
      if (window.editorPlayer) window.editorPlayer.renderGizmo(item.id);
    });

    // Z-select change
    el.querySelector('.z-select')?.addEventListener('change', (e) => {
      item.layer = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    // Delete / Eliminate button
    el.querySelector('.del-item-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const initialItems = [...(proj.graphics.items || [])];
      const newItems = initialItems.filter(g => g.id !== item.id);
      store.execute({
        name: 'Eliminate Graphic',
        do: () => {
          proj.graphics.items = newItems;
          if (store.selectedLayerId === item.id) store.selectLayer(null);
        },
        undo: () => {
          proj.graphics.items = initialItems;
          store.selectLayer(item.id);
        },
      });
      renderOverlayItems(container, styles);
      showToast('Graphic eliminated', 'info');
    });

    listEl.appendChild(el);
  });

  // Render Image Layers
  layers.forEach((layer) => {
    const startVal = layer.start || 0;
    const endVal = layer.end || (startVal + 3.0);
    const durVal = Math.max(0.2, endVal - startVal);

    const el = document.createElement('div');
    el.className = 'editor-overlay-card';
    el.style.background = 'var(--vt-bg-surface)';
    el.style.border = '1px solid var(--vt-border)';
    el.style.borderRadius = '8px';
    el.style.padding = '10px 12px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';
    el.style.fontSize = '12px';

    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: #8B5CF6; display: flex; align-items: center; gap: 4px;">
          <span>🖼️</span> Image Overlay Layer
        </span>
        <button class="del-layer-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #DC2626; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight: 600;">🗑️ Eliminate</button>
      </div>

      <!-- Timing & Duration -->
      <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--vt-border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 600; color: var(--vt-text-primary);">⏱️ Timing & Duration</span>
          <button class="btn-snap-playhead-layer" style="font-size: 10px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); color: #7C3AED; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-weight: 600;">⏱️ Snap to Playhead</button>
        </div>
        <div style="display: flex; gap: 8px;">
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 10px; color: var(--vt-text-muted);">Starts At (s)</span>
            <input type="number" step="0.1" min="0" class="editor-input layer-start-input" value="${startVal.toFixed(1)}" style="padding: 4px 6px; font-size: 11px;" />
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 10px; color: var(--vt-text-muted);">Duration (s)</span>
            <input type="number" step="0.1" min="0.2" class="editor-input layer-dur-input" value="${durVal.toFixed(1)}" style="padding: 4px 6px; font-size: 11px;" />
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--vt-text-muted);">
        <span>Layer Position:</span>
        <select class="editor-select layer-z-select" style="font-size: 11px; padding: 2px 6px;">
          <option value="behind" ${layer.z === 'behind' ? 'selected' : ''}>Behind Speaker (Sandwich)</option>
          <option value="front" ${layer.z === 'front' ? 'selected' : ''}>In Front of Speaker</option>
        </select>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--vt-text-muted);">
        <span>Animation:</span>
        <select class="editor-select anim-select" style="font-size: 11px; padding: 2px 6px;">
          <option value="pop" ${layer.enter === 'pop' ? 'selected' : ''}>Pop In</option>
          <option value="slide-up" ${layer.enter === 'slide-up' ? 'selected' : ''}>Slide Up</option>
          <option value="fade" ${layer.enter === 'fade' ? 'selected' : ''}>Fade In</option>
        </select>
      </div>
    `;

    el.querySelector('.layer-start-input')?.addEventListener('change', (e) => {
      const newStart = Math.max(0, parseFloat(e.target.value) || 0);
      const curDur = (layer.end || (startVal + 3.0)) - (layer.start || startVal);
      layer.start = newStart;
      layer.end = newStart + Math.max(0.2, curDur);
      store.triggerAutosave();
      store.emit('change');
    });

    el.querySelector('.layer-dur-input')?.addEventListener('change', (e) => {
      const newDur = Math.max(0.2, parseFloat(e.target.value) || 1);
      const curStart = layer.start !== undefined ? layer.start : startVal;
      layer.start = curStart;
      layer.end = curStart + newDur;
      store.triggerAutosave();
      store.emit('change');
    });

    el.querySelector('.btn-snap-playhead-layer')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const playhead = store.getTime();
      const curDur = (layer.end || (startVal + 3.0)) - (layer.start || startVal);
      layer.start = Math.round(playhead * 100) / 100;
      layer.end = Math.round((playhead + Math.max(0.2, curDur)) * 100) / 100;
      store.triggerAutosave();
      store.emit('change');
      renderOverlayItems(container, styles);
      showToast(`Image layer moved to playhead (${playhead.toFixed(1)}s)`, 'success');
    });

    el.querySelector('.layer-z-select')?.addEventListener('change', (e) => {
      layer.z = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    el.querySelector('.anim-select')?.addEventListener('change', (e) => {
      layer.enter = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    el.querySelector('.del-layer-btn')?.addEventListener('click', () => {
      const initialLayers = [...(proj.layers || [])];
      const newLayers = initialLayers.filter(l => l.id !== layer.id);
      store.execute({
        name: 'Eliminate Image Layer',
        do: () => {
          proj.layers = newLayers;
          if (store.selectedLayerId === layer.id) store.selectLayer(null);
        },
        undo: () => {
          proj.layers = initialLayers;
          store.selectLayer(layer.id);
        },
      });
      renderOverlayItems(container, styles);
      showToast('Image layer eliminated', 'info');
    });

    listEl.appendChild(el);
  });
}

function bindGraphicsEvents(container, styles) {
  const proj = store.getProject();

  // Style change
  const styleSelect = container.querySelector('#selectGraphicStyle');
  styleSelect?.addEventListener('change', (e) => {
    proj.graphics = proj.graphics || {};
    proj.graphics.style = e.target.value;
    const s = styles.find(item => item.id === e.target.value) || styles[0];
    renderStepGraphics(container);
    store.triggerAutosave();
    store.emit('change');
  });

  // Auto-generate Graphics button
  const autoBtn = container.querySelector('#btnAutoGenerateGraphics');
  autoBtn?.addEventListener('click', async () => {
    autoBtn.disabled = true;
    autoBtn.textContent = 'Drafting AI graphics & punchlines...';
    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/graphics/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_id: proj.graphics?.style || 'story_tuxedo' }),
      });
      if (!res.ok) throw new Error('Auto-generation failed');
      const data = await res.json();
      if (proj.graphics) {
        proj.graphics.items = data.items || [];
      }
      store.triggerAutosave();
      store.emit('change', proj);
      renderOverlayItems(container, styles);
      showToast(`Generated ${data.count || 0} motion graphics from AI speech analysis!`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      autoBtn.disabled = false;
      autoBtn.textContent = '⚡ Auto-Generate All Titles & Emphasis';
    }
  });

  // Add Graphic Cue
  container.querySelector('#btnAddGraphicBtn')?.addEventListener('click', () => {
    const compType = container.querySelector('#selectComponentType')?.value;
    const curStyle = styles.find(s => s.id === (proj.graphics?.style || 'story_tuxedo')) || styles[0];
    const compDef = (curStyle?.components || []).find(c => c.id === compType) || curStyle?.components?.[0] || {
      id: compType || 'sandwich_text',
      name: 'Graphic Cue',
      layer: 'behind',
      defaultPlacement: { position: 'top', offsetY: 240 },
      defaultProps: { headlineText: 'HEADLINE', subText: '' },
      defaultSfx: 'whoosh.mp3',
    };

    const curTime = store.getTime();
    const defaultSfxChoice = compDef.defaultSfx || 'davinci/WHOOSHES/Whoosh 17 (fast).wav';
    const newGraphic = {
      id: `graphic_${Date.now()}`,
      component: compDef.id,
      style: curStyle?.id || 'story_tuxedo',
      start: curTime,
      end: curTime + 2.5,
      layer: compDef.layer || 'behind',
      placement: compDef.defaultPlacement || { position: 'top', offsetY: 240 },
      props: {
        headlineText: compDef.defaultProps?.headlineText || compDef.name || 'HEADLINE',
        subText: compDef.defaultProps?.subText || '',
        color: compDef.defaultProps?.color || curStyle?.palette?.primary || '#FFFFFF',
        fontSize: compDef.defaultProps?.fontSize || 80,
      },
      sfxFile: defaultSfxChoice,
      sfx: defaultSfxChoice && defaultSfxChoice !== 'none'
        ? [{ file: defaultSfxChoice, offsetMs: 0 }]
        : [],
    };

    proj.graphics = proj.graphics || { style: 'story_tuxedo', settings: {}, items: [] };
    proj.graphics.items = proj.graphics.items || [];
    proj.graphics.items.push(newGraphic);

    renderStepGraphics(container);
    store.triggerAutosave();
    store.emit('change');
    showToast(`Added ${compDef.name} at playhead!`, 'success');
  });

  // Upload image layer
  const imgInput = container.querySelector('#inputLayerImage');
  container.querySelector('#btnUploadImageLayer')?.addEventListener('click', () => imgInput?.click());

  imgInput?.addEventListener('change', async () => {
    if (!imgInput.files || imgInput.files.length === 0) return;
    const file = imgInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/layers/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload image layer');
      const uploadRes = await res.json();

      const curTime = store.getTime();
      const newLayer = {
        id: `layer_${Date.now()}`,
        src: uploadRes.src,
        start: curTime,
        end: curTime + 3.0,
        z: 'behind',
        x: 540,
        y: 960,
        scale: 1,
        rotation: 0,
        opacity: 1,
        enter: 'pop',
        exit: 'fade',
      };

      proj.layers = proj.layers || [];
      proj.layers.push(newLayer);

      renderStepGraphics(container);
      store.selectLayer(newLayer.id);
      store.triggerAutosave();
      store.emit('change');
      showToast('Image layer added! Drag on player to reposition.', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // Navigation
  container.querySelector('#btnBackToStep4')?.addEventListener('click', () => store.setStep(4));
  container.querySelector('#btnGoToStep6')?.addEventListener('click', () => store.setStep(6));
}
