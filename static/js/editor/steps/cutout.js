/**
 * Tuxedo Editor Step 4: AI Subject Rotoscoping & 3-Layer Sandwich VFX
 */

import { store } from '../store.js?v=0.7.2';
import { showToast, createProgressLine } from '../ui.js';

export function renderStepCutout(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first.</p></div>';
    return;
  }

  const cutout = proj.cutout || { exists: false, feather: 3, target: 'person' };

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 4 of 6</div>
        <h2 class="step-title">Subject Rotoscoping</h2>
        <p class="step-desc">Extract a matte of the speaker using Apple Silicon hardware segmentation to sandwich motion graphics behind your body.</p>
      </div>

      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div class="editor-field">
          <label class="editor-label">Tracking Target</label>
          <select class="editor-select" id="selectCutoutTarget">
            <option value="person" ${cutout.target === 'person' ? 'selected' : ''}>Person (YOLO-Seg on Apple Silicon MPS)</option>
            <option value="object" ${cutout.target === 'object' ? 'selected' : ''}>Object / Fine Contour (SAM 2.1)</option>
          </select>
        </div>

        <div class="editor-field">
          <div class="editor-label">
            <span>Edge Feathering</span>
            <span id="labelCutoutFeather">${cutout.feather || 3}px</span>
          </div>
          <input type="range" class="editor-range" id="inputCutoutFeather" min="0" max="10" step="1" value="${cutout.feather || 3}">
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <span>Status:</span>
          <span style="font-weight: 600; color: ${cutout.exists ? 'var(--vt-accent-green)' : 'var(--vt-accent-amber)'};">
            ${cutout.exists ? '● Mask Extracted (3-Layer Ready)' : '○ No Mask Extracted'}
          </span>
        </div>

        <button class="vt-btn-primary" id="btnExtractMask">
          ${cutout.exists ? 'Re-extract Subject Mask' : 'Extract Subject Mask'}
        </button>

        <div id="cutoutProgressContainer" style="display: none; margin-top: 6px;"></div>
      </div>

      <div style="background: var(--vt-bg-surface); border: 1px solid var(--vt-border); border-radius: 8px; padding: 12px; font-size: 12px; line-height: 1.5; color: var(--vt-text-muted);">
        <strong>How the 3-Layer Sandwich works:</strong><br>
        1. <strong>Bottom Layer:</strong> Conformed background video.<br>
        2. <strong>Middle Layer:</strong> Big bold headlines, stickers, and shapes positioned behind you.<br>
        3. <strong>Top Layer:</strong> Conformed speaker cutout preserving hair and shoulders in front!
      </div>

      </div>
    </div>

    <!-- Always Visible Sticky Footer Navigation -->
    <div class="step-panel-footer">
      <button class="vt-btn-secondary" id="btnBackToStep3" style="flex: 1;">&larr; Back</button>
      <button class="vt-btn-primary" id="btnGoToStep5" style="flex: 2;">Next: Graphics & Overlays &rarr;</button>
    </div>
  `;

  bindCutoutEvents(container);
}

function bindCutoutEvents(container) {
  const proj = store.getProject();
  const progContainer = container.querySelector('#cutoutProgressContainer');

  const featherInput = container.querySelector('#inputCutoutFeather');
  const featherLabel = container.querySelector('#labelCutoutFeather');
  featherInput?.addEventListener('input', (e) => {
    featherLabel.textContent = `${e.target.value}px`;
    proj.cutout.feather = parseInt(e.target.value, 10);
  });

  const extractBtn = container.querySelector('#btnExtractMask');
  extractBtn?.addEventListener('click', async () => {
    extractBtn.disabled = true;
    progContainer.style.display = 'block';
    const progress = createProgressLine(progContainer);
    progress.update(5, 'Initializing segmentation neural engine...');

    const target = container.querySelector('#selectCutoutTarget')?.value || 'person';
    const feather = parseInt(featherInput?.value || '3', 10);

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/cutout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: target, feather }),
      });
      if (!res.ok) throw new Error('Cutout task failed to start');
      const data = await res.json();
      const taskId = data.task_id;

      const pollTimer = setInterval(async () => {
        try {
          const tRes = await fetch(`/api/editor/tasks/${taskId}`);
          const tData = await tRes.json();
          progress.update(tData.percent, tData.message);

          if (tData.status === 'completed') {
            clearInterval(pollTimer);
            progress.done('Subject mask generated!');
            extractBtn.disabled = false;
            const pRes = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}`);
            const refreshedProj = await pRes.json();
            store.setProject(refreshedProj);
            showToast('Subject mask ready! 3-Layer Sandwich enabled.', 'success');
            renderStepCutout(container);
          } else if (tData.status === 'failed') {
            clearInterval(pollTimer);
            progress.error(tData.error || 'Rotoscoping failed');
            extractBtn.disabled = false;
            showToast('Subject mask extraction failed', 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          extractBtn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      extractBtn.disabled = false;
      showToast(e.message, 'error');
    }
  });

  // Step navigation
  container.querySelector('#btnBackToStep3')?.addEventListener('click', () => store.setStep(3));
  container.querySelector('#btnGoToStep5')?.addEventListener('click', () => store.setStep(5));
}
