/**
 * Tuxedo Editor Step 6: Export Presets & Project Bundle
 */

import { store } from '../store.js';
import { showToast, createProgressLine } from '../ui.js';

export function renderStepExport(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 6 of 6</div>
        <h2 class="step-title">Export & Share</h2>
        <p class="step-desc">Export high-resolution 1080x1920 vertical video, ProRes 4444 Alpha overlays for DaVinci, or subtitle files.</p>
      </div>

      <!-- Presets -->
      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div class="editor-field">
          <label class="editor-label">Export Preset</label>
          <select class="editor-select" id="selectExportPreset">
            <option value="mp4_composite" selected>Vertical 1080x1920 MP4 (Full Composite)</option>
            <option value="prores_overlay">Apple ProRes 4444 with Alpha (DaVinci Overlays)</option>
            <option value="prores_master">Apple ProRes 422 HQ Master (Lossless Finishing)</option>
          </select>
        </div>

        <button class="vt-btn-primary" id="btnStartExport">
          Start Video Render
        </button>

        <div id="exportProgressContainer" style="display: none;"></div>
        <div id="exportDownloadBox" style="display: none; padding-top: 6px;"></div>
      </div>

      <!-- Subtitle & Project Bundle Downloads -->
      <div style="border-top: 1px solid var(--vt-border); padding-top: 14px;">
        <span style="font-size: 13px; font-weight: 600;">Subtitle & Project Bundle Files</span>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
          <a class="vt-btn-secondary" id="btnDownloadSrt" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/srt" download>
            Download Subtitles (.SRT)
          </a>
          <a class="vt-btn-secondary" id="btnDownloadVtt" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/vtt" download>
            Download Subtitles (.VTT)
          </a>
          <a class="vt-btn-secondary" id="btnDownloadZip" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/zip" download>
            Download Project Backup (.ZIP)
          </a>
        </div>
      </div>

      <!-- Finder button -->
      <button class="vt-btn-secondary" id="btnRevealFinder" style="margin-top: 8px;">
        Open Project in macOS Finder
      </button>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="vt-btn-secondary" id="btnBackToStep5" style="flex: 1;">&larr; Back</button>
      </div>
    </div>
  `;

  bindExportEvents(container);
}

function bindExportEvents(container) {
  const proj = store.getProject();
  const progContainer = container.querySelector('#exportProgressContainer');
  const downloadBox = container.querySelector('#exportDownloadBox');
  const exportBtn = container.querySelector('#btnStartExport');

  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    progContainer.style.display = 'block';
    downloadBox.style.display = 'none';

    const progress = createProgressLine(progContainer);
    progress.update(5, 'Starting Remotion render...');

    const preset = container.querySelector('#selectExportPreset')?.value || 'mp4_composite';

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) throw new Error('Export failed to start');
      const data = await res.json();
      const taskId = data.task_id;

      const pollTimer = setInterval(async () => {
        try {
          const tRes = await fetch(`/api/editor/tasks/${taskId}`);
          const tData = await tRes.json();
          progress.update(tData.percent, tData.message);

          if (tData.status === 'completed') {
            clearInterval(pollTimer);
            progress.done('Render complete!');
            exportBtn.disabled = false;

            const filename = tData.result?.filename || 'video.mp4';
            const dlUrl = `/api/editor/projects/${encodeURIComponent(proj.slug)}/files/exports/${filename}`;
            const sizeStr = tData.result?.size_bytes ? (tData.result.size_bytes / 1024 / 1024).toFixed(1) + ' MB' : 'Ready';

            downloadBox.style.display = 'block';
            downloadBox.innerHTML = `
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                <a class="vt-btn-primary" href="${dlUrl}" download style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
                  <span>⬇️ Download ${filename}</span>
                  <span style="opacity: 0.8; font-size: 12px;">(${sizeStr})</span>
                </a>
                <button class="vt-btn-secondary" id="btnRevealExportFile" type="button" style="display: inline-flex; align-items: center; gap: 6px;">
                  📁 Show in Project Exports
                </button>
              </div>
              <div style="font-size: 12px; color: var(--vt-text-secondary, #94a3b8); line-height: 1.5;">
                <div>📍 <strong>Project Exports:</strong> <code style="color: var(--vt-accent, #6366f1);">${proj.slug}/exports/${filename}</code></div>
                <div>💾 <strong>Backup:</strong> <code style="color: var(--vt-text-muted, #64748b);">~/Downloads/${filename}</code></div>
              </div>
            `;

            downloadBox.querySelector('#btnRevealExportFile')?.addEventListener('click', async () => {
              try {
                const r = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/reveal?file=exports/${encodeURIComponent(filename)}`, { method: 'POST' });
                if (r.ok) showToast('Opened in Finder exports folder!', 'success');
              } catch (e) {
                showToast(e.message, 'error');
              }
            });

            showToast('Render completed successfully!', 'success');
          } else if (tData.status === 'failed') {
            clearInterval(pollTimer);
            progress.error(tData.error || 'Render failed');
            exportBtn.disabled = false;
            showToast('Render failed', 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          exportBtn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      exportBtn.disabled = false;
      showToast(e.message, 'error');
    }
  });

  // Reveal in Finder
  container.querySelector('#btnRevealFinder')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/reveal`, { method: 'POST' });
      if (res.ok) showToast('Opened in Finder!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // Step nav
  container.querySelector('#btnBackToStep5')?.addEventListener('click', () => store.setStep(5));
}
