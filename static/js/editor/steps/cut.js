/**
 * Tuxedo Editor Step 2: Silence Cutter & Non-Destructive Jump Cuts
 */

import { store } from '../store.js';
import { showToast, createProgressLine } from '../ui.js';

export function renderStepCut(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first in Step 1.</p></div>';
    return;
  }

  const sil = proj.silence || { minSilence: 0.45, padding: 0.12, threshold: 0.5 };

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 2 of 6</div>
        <h2 class="step-title">Silence Cutter & Jump Cuts</h2>
        <p class="step-desc">Detect speech pauses with local Silero VAD. Split clips, drag to reorder, or conform with smooth micro-crossfades.</p>
      </div>

      <!-- VAD Settings -->
      <div style="display: flex; flex-direction: column; gap: 12px; background: var(--vt-bg-subtle); padding: 14px; border-radius: 8px; border: 1px solid var(--vt-border);">
        <div class="editor-field">
          <div class="editor-label">
            <span>Min Silence Duration</span>
            <span id="labelMinSilence">${sil.minSilence}s</span>
          </div>
          <input type="range" class="editor-range" id="inputMinSilence" min="0.2" max="1.2" step="0.05" value="${sil.minSilence}">
        </div>

        <div class="editor-field">
          <div class="editor-label">
            <span>Speech Padding</span>
            <span id="labelPadding">${sil.padding}s</span>
          </div>
          <input type="range" class="editor-range" id="inputPadding" min="0.05" max="0.3" step="0.01" value="${sil.padding}">
        </div>

        <div class="editor-field">
          <div class="editor-label">
            <span>VAD Probability Threshold</span>
            <span id="labelThreshold">${sil.threshold}</span>
          </div>
          <input type="range" class="editor-range" id="inputThreshold" min="0.3" max="0.8" step="0.05" value="${sil.threshold}">
        </div>

        <button class="vt-btn-secondary" id="btnDetectSilence">
          Analyze Silences (Silero VAD)
        </button>
      </div>

      <!-- Silence Detection Results -->
      <div id="silenceResultsBox" style="display: none; background: var(--vt-bg-surface); border: 1px solid var(--vt-border); border-radius: 8px; padding: 12px; font-size: 12px;">
        <div style="font-weight: 600; margin-bottom: 6px;">Detection Results</div>
        <div id="silenceStatsText" style="color: var(--vt-text-muted); line-height: 1.4; margin-bottom: 10px;"></div>
        <button class="vt-btn-primary" id="btnApplyJumpCuts">
          Apply Jump Cuts to Timeline
        </button>
      </div>

      <!-- Conform Video (Micro-Crossfades) -->
      <div style="border-top: 1px solid var(--vt-border); padding-top: 14px;">
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">Render Conformed Video</div>
        <div style="font-size: 12px; color: var(--vt-text-muted); margin-bottom: 10px;">
          Hard-cuts speech segments with 15ms audio micro-crossfades to eliminate zero-crossing pops and enable instant scrubbing.
        </div>
        <button class="vt-btn-secondary" id="btnRenderConform">
          ${proj.conform?.exists ? 'Re-render Conform (smooth audio)' : 'Render Conformed Video (smooth audio)'}
        </button>
        <div id="conformProgressContainer" style="display: none; margin-top: 10px;"></div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="vt-btn-secondary" id="btnBackToStep1" style="flex: 1;">&larr; Back</button>
        <button class="vt-btn-primary" id="btnGoToStep3" style="flex: 2;">Next: Subtitles &rarr;</button>
      </div>
    </div>
  `;

  bindCutEvents(container);
}

function bindCutEvents(container) {
  const proj = store.getProject();

  const minSilInput = container.querySelector('#inputMinSilence');
  const minSilLabel = container.querySelector('#labelMinSilence');
  minSilInput?.addEventListener('input', (e) => {
    minSilLabel.textContent = `${e.target.value}s`;
    proj.silence.minSilence = parseFloat(e.target.value);
  });

  const padInput = container.querySelector('#inputPadding');
  const padLabel = container.querySelector('#labelPadding');
  padInput?.addEventListener('input', (e) => {
    padLabel.textContent = `${e.target.value}s`;
    proj.silence.padding = parseFloat(e.target.value);
  });

  const thInput = container.querySelector('#inputThreshold');
  const thLabel = container.querySelector('#labelThreshold');
  thInput?.addEventListener('input', (e) => {
    thLabel.textContent = e.target.value;
    proj.silence.threshold = parseFloat(e.target.value);
  });

  // Detect silences button
  const detectBtn = container.querySelector('#btnDetectSilence');
  const resBox = container.querySelector('#silenceResultsBox');
  const statsText = container.querySelector('#silenceStatsText');
  const applyBtn = container.querySelector('#btnApplyJumpCuts');

  let detectedSpeech = [];

  detectBtn?.addEventListener('click', async () => {
    detectBtn.disabled = true;
    detectBtn.textContent = 'Detecting speech with Silero VAD...';
    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_silence: proj.silence.minSilence,
          padding: proj.silence.padding,
          threshold: proj.silence.threshold,
        }),
      });
      if (!res.ok) throw new Error('Silence analysis failed');
      const data = await res.json();
      detectedSpeech = data.speech_segments || [];

      const silCount = data.silence_count ?? data.silence_segments_count ?? (data.silence_segments ? data.silence_segments.length : 0);
      const speechDur = data.speech_duration ?? data.total_speech_duration ?? 0;
      const totalDur = data.total_duration ?? (proj.source?.duration || 0);
      const timeSaved = Math.max(0, totalDur - speechDur);
      const timeSavedPct = data.time_saved_percent ?? data.silence_percentage ?? (totalDur > 0 ? ((timeSaved / totalDur) * 100).toFixed(1) : 0);

      resBox.style.display = 'block';
      statsText.innerHTML = `
        Found <strong>${silCount} silences</strong>.<br>
        Speech segments: <strong>${detectedSpeech.length}</strong>.<br>
        Original duration: ${Number(totalDur).toFixed(1)}s &rarr; New duration: <strong>${Number(speechDur).toFixed(1)}s</strong>.<br>
        Time saved: <strong>${Number(timeSaved).toFixed(1)}s (${timeSavedPct}%)</strong>.
      `;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      detectBtn.disabled = false;
      detectBtn.textContent = 'Analyze Silences (Silero VAD)';
    }
  });

  applyBtn?.addEventListener('click', () => {
    if (detectedSpeech.length === 0) return;
    const initialClips = [...proj.clips];
    const newClips = detectedSpeech.map((s, idx) => ({
      id: `clip_${idx + 1}`,
      srcIn: s.start,
      srcOut: s.end,
    }));

    store.execute({
      name: 'Apply Silence Cuts',
      do: () => {
        proj.clips = newClips;
      },
      undo: () => {
        proj.clips = initialClips;
      },
    });

    showToast(`Applied ${newClips.length} jump-cut clips to timeline!`, 'success');
  });

  // Render conform button
  const conformBtn = container.querySelector('#btnRenderConform');
  const conformProgContainer = container.querySelector('#conformProgressContainer');

  conformBtn?.addEventListener('click', async () => {
    conformBtn.disabled = true;
    conformProgContainer.style.display = 'block';
    const progress = createProgressLine(conformProgContainer);
    progress.update(5, 'Starting micro-crossfade conform render...');

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/conform`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Conform render failed to start');
      const data = await res.json();
      const taskId = data.task_id;

      // Poll task
      const pollTimer = setInterval(async () => {
        try {
          const tRes = await fetch(`/api/editor/tasks/${taskId}`);
          const tData = await tRes.json();
          progress.update(tData.percent, tData.message);

          if (tData.status === 'completed') {
            clearInterval(pollTimer);
            progress.done('Conform render complete!');
            conformBtn.disabled = false;
            conformBtn.textContent = 'Re-render Conform (smooth audio)';
            proj.conform.exists = true;
            proj.conform.hash = tData.result?.hash || String(Date.now());
            store.emit('change');
            showToast('Conform complete with audio micro-crossfades!', 'success');
          } else if (tData.status === 'failed') {
            clearInterval(pollTimer);
            progress.error(tData.error || 'Conform failed');
            conformBtn.disabled = false;
            showToast('Conform failed', 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          conformBtn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      conformBtn.disabled = false;
      showToast(e.message, 'error');
    }
  });

  // Step navigation
  container.querySelector('#btnBackToStep1')?.addEventListener('click', () => store.setStep(1));
  container.querySelector('#btnGoToStep3')?.addEventListener('click', () => store.setStep(3));
}
