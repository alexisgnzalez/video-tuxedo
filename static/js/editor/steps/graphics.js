/**
 * Tuxedo Editor Step 5: Multi-Style Motion Graphics & B-Roll Overlays
 */

import { store } from '../store.js';
import { showToast } from '../ui.js';

export async function renderStepGraphics(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first.</p></div>';
    return;
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

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="vt-btn-secondary" id="btnBackToStep4" style="flex: 1;">&larr; Back</button>
        <button class="vt-btn-primary" id="btnGoToStep6" style="flex: 2;">Next: Export Video &rarr;</button>
      </div>
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

    const el = document.createElement('div');
    el.style.background = 'var(--vt-bg-surface)';
    el.style.border = '1px solid var(--vt-border)';
    el.style.borderRadius = '6px';
    el.style.padding = '8px 10px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '6px';
    el.style.fontSize = '12px';

    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #D97706; text-transform: uppercase; font-size: 11px;">
          ${compDef.name || item.component}
        </span>
        <button class="del-item-btn" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 11px;">Delete</button>
      </div>
      <input type="text" class="editor-input headline-text-input" value="${(item.props?.headlineText || '').replace(/"/g, '&quot;')}" placeholder="Headline Text..." />
      <input type="text" class="editor-input subtext-input" value="${(item.props?.subText || '').replace(/"/g, '&quot;')}" placeholder="Subtitle / Kicker text (optional)..." style="font-size: 11px;" />
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--vt-text-muted);">
        <span>Layer Position:</span>
        <select class="editor-select z-select" style="font-size: 11px; padding: 2px 6px;">
          <option value="behind" ${item.layer === 'behind' ? 'selected' : ''}>Behind Speaker (Sandwich)</option>
          <option value="front" ${item.layer === 'front' ? 'selected' : ''}>In Front of Speaker</option>
        </select>
      </div>
    `;

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

    // Z-select change
    el.querySelector('.z-select')?.addEventListener('change', (e) => {
      item.layer = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    // Delete
    el.querySelector('.del-item-btn')?.addEventListener('click', () => {
      proj.graphics.items = proj.graphics.items.filter(g => g.id !== item.id);
      renderOverlayItems(container, selectedStyle);
      store.triggerAutosave();
      store.emit('change');
    });

    listEl.appendChild(el);
  });

  // Render Image Layers
  layers.forEach((layer) => {
    const el = document.createElement('div');
    el.style.background = 'var(--vt-bg-surface)';
    el.style.border = '1px solid var(--vt-border)';
    el.style.borderRadius = '6px';
    el.style.padding = '8px 10px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '6px';
    el.style.fontSize = '12px';

    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #8B5CF6;">Image Layer</span>
        <button class="del-layer-btn" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 11px;">Delete</button>
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
      proj.layers = proj.layers.filter(l => l.id !== layer.id);
      renderOverlayItems(container, selectedStyle);
      store.triggerAutosave();
      store.emit('change');
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
      sfx: compDef.defaultSfx && compDef.defaultSfx !== 'none'
        ? [{ file: compDef.defaultSfx, offsetMs: 0 }]
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
