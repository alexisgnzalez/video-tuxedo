/**
 * Tuxedo Editor Step 6: Export Presets & Project Bundle
 */

import { store } from '../store.js?v=0.7.2';
import { showToast, createProgressLine } from '../ui.js';

const PRESET_INFO = {
  mp4_composite: {
    badges: ['9:16 Vertical', '1080×1920', '30 FPS H.264', 'Stereo AAC + SFX'],
    desc: 'Full composite render with conformed talking head, cutout sandwich layers, kinetic titles, bouncy subtitles, and synchronized sound effects.',
    target: 'Instagram Reels, TikTok, YouTube Shorts',
  },
  prores_overlay: {
    badges: ['ProRes 4444 Alpha', 'yuva444p10le', 'Transparent Overlays'],
    desc: 'Isolated kinetic titles, lower-thirds, and graphics with transparency for DaVinci Resolve or Final Cut Pro timelines.',
    target: 'DaVinci Resolve, Final Cut Pro, Adobe Premiere Pro',
  },
  prores_master: {
    badges: ['ProRes 422 HQ', 'yuv422p10le', 'Lossless Master'],
    desc: 'High-bitrate ProRes 422 HQ master cut from conformed video for color grading and archival finishing.',
    target: 'Studio Archival, Color Grading, Broadcast Mastering',
  },
};

export function renderStepExport(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first.</p></div>';
    return;
  }

  const initialPreset = 'mp4_composite';
  const info = PRESET_INFO[initialPreset];

  container.innerHTML = `
    <div class="step-panel-inner" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="step-header">
        <div class="step-eyebrow">Step 6 of 6</div>
        <h2 class="step-title">Export & Share</h2>
        <p class="step-desc">Export high-resolution 1080×1920 vertical video, ProRes 4444 Alpha overlays for DaVinci, or subtitle files.</p>
      </div>

      <!-- Presets Card -->
      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
        <div class="editor-field" style="margin-bottom: 0;">
          <label class="editor-label" style="font-weight: 600;">Export Preset</label>
          <select class="editor-select" id="selectExportPreset" style="width: 100%;">
            <option value="mp4_composite" selected>Vertical 1080×1920 MP4 (Full Composite with SFX)</option>
            <option value="prores_overlay">Apple ProRes 4444 with Alpha (DaVinci Overlays)</option>
            <option value="prores_master">Apple ProRes 422 HQ Master (Lossless Finishing)</option>
          </select>
        </div>

        <!-- Dynamic Preset Info -->
        <div id="exportPresetInfo" style="background: var(--vt-bg-surface); border: 1px solid var(--vt-border); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
          <div id="exportPresetBadges" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${info.badges.map(b => `<span style="font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: rgba(99, 102, 241, 0.12); color: var(--vt-accent, #6366f1);">${b}</span>`).join('')}
          </div>
          <div id="exportPresetDesc" style="font-size: 11.5px; color: var(--vt-text-muted); line-height: 1.45;">
            ${info.desc}
          </div>
        </div>

        <button class="vt-btn-primary" id="btnStartExport" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer;">
          <span>🚀</span>
          <span>Start Video Render</span>
        </button>

        <div id="exportProgressContainer" style="display: none; padding-top: 4px;"></div>
        <div id="exportDownloadBox" style="display: none;"></div>
      </div>

      <!-- Subtitle & Project Bundle Downloads -->
      <div style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
        <span style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <span>📦</span>
          Subtitle & Project Bundle Files
        </span>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <a class="vt-btn-secondary" id="btnDownloadSrt" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/srt" download style="text-decoration: none; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 12px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: #10B981;">.SRT</span>
              <span>Subtitles (Premiere / CapCut / YouTube)</span>
            </span>
            <span style="font-size: 11px; opacity: 0.7;">⬇️ Download</span>
          </a>
          <a class="vt-btn-secondary" id="btnDownloadVtt" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/vtt" download style="text-decoration: none; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 12px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: #3B82F6;">.VTT</span>
              <span>Web Subtitles (HTML5 Video)</span>
            </span>
            <span style="font-size: 11px; opacity: 0.7;">⬇️ Download</span>
          </a>
          <a class="vt-btn-secondary" id="btnDownloadZip" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/zip" download style="text-decoration: none; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 12px;">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: #F59E0B;">.ZIP</span>
              <span>Complete Project Archive (JSON + Cuts)</span>
            </span>
            <span style="font-size: 11px; opacity: 0.7;">⬇️ Download</span>
          </a>
        </div>
      </div>

      <!-- Finder button -->
      <button class="vt-btn-secondary" id="btnRevealFinder" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; font-size: 12.5px;">
        <span>🖥️</span>
        Open Project in macOS Finder
      </button>
    </div>

    <!-- Always Visible Sticky Footer Navigation -->
    <div class="step-panel-footer">
      <button class="vt-btn-secondary" id="btnBackToStep5" style="width: 100%;">&larr; Back to Step 5</button>
    </div>
  `;

  bindExportEvents(container);
}

function bindExportEvents(container) {
  const proj = store.getProject();
  const progContainer = container.querySelector('#exportProgressContainer');
  const downloadBox = container.querySelector('#exportDownloadBox');
  const exportBtn = container.querySelector('#btnStartExport');
  const presetSelect = container.querySelector('#selectExportPreset');
  const badgesEl = container.querySelector('#exportPresetBadges');
  const descEl = container.querySelector('#exportPresetDesc');

  presetSelect?.addEventListener('change', (e) => {
    const p = e.target.value;
    const info = PRESET_INFO[p] || PRESET_INFO.mp4_composite;
    if (badgesEl) {
      badgesEl.innerHTML = info.badges
        .map(b => `<span style="font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: rgba(99, 102, 241, 0.12); color: var(--vt-accent, #6366f1);">${b}</span>`)
        .join('');
    }
    if (descEl) {
      descEl.textContent = info.desc;
    }
  });

  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.style.opacity = '0.7';
    exportBtn.innerHTML = `<span>⏳</span><span>Rendering Video Composition...</span>`;
    progContainer.style.display = 'block';
    downloadBox.style.display = 'none';

    const progress = createProgressLine(progContainer);
    progress.update(5, 'Starting Remotion render...');

    const preset = presetSelect?.value || 'mp4_composite';

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
            exportBtn.style.opacity = '1';
            exportBtn.innerHTML = `<span>🚀</span><span>Render Video Again</span>`;

            const filename = tData.result?.filename || 'video.mp4';
            const dlUrl = `/api/editor/projects/${encodeURIComponent(proj.slug)}/files/exports/${filename}`;
            const sizeStr = tData.result?.size_bytes ? (tData.result.size_bytes / 1024 / 1024).toFixed(1) + ' MB' : 'Ready';

            downloadBox.style.display = 'block';
            downloadBox.innerHTML = `
              <div style="margin-top: 10px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.28); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #10B981; color: #fff; font-size: 13px; font-weight: bold;">✓</span>
                    <span style="font-weight: 600; font-size: 13px; color: #10B981;">Render Complete</span>
                  </div>
                  <span style="font-size: 11px; padding: 3px 8px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #059669; font-weight: 600;">${sizeStr}</span>
                </div>

                <!-- Monospace Filename Card -->
                <div style="background: var(--vt-bg-surface); border: 1px solid var(--vt-border); border-radius: 6px; padding: 8px 10px;">
                  <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vt-text-muted); margin-bottom: 2px;">Rendered Export</div>
                  <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; font-weight: 600; color: var(--vt-text-primary); word-break: break-all; line-height: 1.4;">${filename}</div>
                </div>

                <!-- Primary Download Button -->
                <a class="vt-btn-primary" href="${dlUrl}" download style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; font-size: 13.5px; font-weight: 600; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-color: #059669; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); border-radius: 6px; color: #ffffff;">
                  <span>⬇️ Download Rendered Video</span>
                  <span style="opacity: 0.85; font-size: 11.5px; font-weight: normal;">(${sizeStr})</span>
                </a>

                <!-- Reveal in Project Exports Folder -->
                <button class="vt-btn-secondary" id="btnRevealExportFile" type="button" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; font-size: 12px; width: 100%;">
                  <span>📁</span>
                  <span>Show in Project Exports Folder</span>
                </button>

                <!-- Clean Location Metadata -->
                <div style="font-size: 11px; color: var(--vt-text-muted); display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--vt-border); padding-top: 8px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: 600; color: var(--vt-text-secondary); font-size: 10.5px;">📍 Project Exports:</span>
                    <code style="font-size: 10.5px; background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 4px; color: var(--vt-accent, #6366f1); word-break: break-all;">${proj.slug}/exports/${filename}</code>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: 600; color: var(--vt-text-secondary); font-size: 10.5px;">💾 macOS Downloads:</span>
                    <code style="font-size: 10.5px; background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 4px; color: var(--vt-text-muted); word-break: break-all;">~/Downloads/${filename}</code>
                  </div>
                </div>
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
            exportBtn.style.opacity = '1';
            exportBtn.innerHTML = `<span>🚀</span><span>Retry Video Render</span>`;
            showToast('Render failed: ' + (tData.error || 'Unknown error'), 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          exportBtn.disabled = false;
          exportBtn.style.opacity = '1';
          exportBtn.innerHTML = `<span>🚀</span><span>Start Video Render</span>`;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      exportBtn.disabled = false;
      exportBtn.style.opacity = '1';
      exportBtn.innerHTML = `<span>🚀</span><span>Start Video Render</span>`;
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
