/**
 * Tuxedo Editor Step 3: Subtitles & Gemini Flash AI Polish
 */

import { store } from '../store.js';
import { showToast, createProgressLine, formatTime } from '../ui.js';

export function renderStepSubtitles(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = '<div class="step-panel-inner"><p>Please upload a video first.</p></div>';
    return;
  }

  const cues = proj.captions?.cues || [];
  const style = proj.captions?.style || {};
  const currentPreset = style.preset || 'standup_hybrid';
  const currentPos = style.position || 'collarbone';

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 3 of 6</div>
        <h2 class="step-title">Subtitles & AI Polish</h2>
        <p class="step-desc">Pace your dialogue with the TikTok "Setup vs. Punchline" Hybrid rule, polish colloquialisms with Gemini Flash, and align with Collarbone Safe Zones.</p>
      </div>

      <!-- Subtitle Style Preset Card -->
      <div style="background: var(--vt-bg-subtle); padding: 14px; border-radius: 8px; border: 1px solid var(--vt-border); display: flex; flex-direction: column; gap: 10px;">
        <div class="editor-field">
          <label class="editor-label">Subtitle Style Preset</label>
          <select class="editor-select" id="selectSubtitlePreset">
            <option value="standup_hybrid" ${currentPreset === 'standup_hybrid' ? 'selected' : ''}>🌟 Dynamic "Stand-Up" Hybrid (Recommended)</option>
            <option value="indie_cinema" ${currentPreset === 'indie_cinema' ? 'selected' : ''}>🎬 Warm "Indie Cinema" Captions (Nostalgic)</option>
            <option value="pill_box" ${currentPreset === 'pill_box' ? 'selected' : ''}>💬 Conversational Pill Box (Modern UI)</option>
          </select>
          <div style="font-size: 11px; color: var(--vt-text-muted); margin-top: 4px;" id="presetHelpText">
            ${currentPreset === 'indie_cinema' ? 'Warm yellow/off-white, thin outline, steady zero-bounce placement for nostalgic stories.' : currentPreset === 'pill_box' ? 'Clean semi-transparent pill container with rounded corners and modern sans-serif.' : 'Heavy sans-serif, sentence case setups, ALL CAPS punchlines, warm amber context & coral slang.'}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="editor-field">
            <label class="editor-label">Pacing Pacing Rule</label>
            <select class="editor-select" id="selectSubtitlePacing">
              <option value="standup_hybrid" selected>Setup/Punchline Hybrid</option>
              <option value="punchy">Punchy / Fast (2–4 words)</option>
              <option value="indie_cinema">Indie Natural (5–7 words)</option>
              <option value="broadcast">Broadcast (7–10 words)</option>
            </select>
          </div>

          <div class="editor-field">
            <label class="editor-label">Position / Safe Zone</label>
            <select class="editor-select" id="selectSubtitlePos">
              <option value="collarbone" ${currentPos === 'collarbone' ? 'selected' : ''}>Collarbone (30–35% up)</option>
              <option value="lower-third" ${currentPos === 'lower-third' ? 'selected' : ''}>Lower Third (480px)</option>
              <option value="middle" ${currentPos === 'middle' ? 'selected' : ''}>Center Screen</option>
              <option value="top" ${currentPos === 'top' ? 'selected' : ''}>Top Canopy</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Whisper Settings -->
      <div style="display: flex; flex-direction: column; gap: 10px; background: var(--vt-bg-subtle); padding: 14px; border-radius: 8px; border: 1px solid var(--vt-border); margin-top: 4px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="editor-field">
            <label class="editor-label">Whisper Model</label>
            <select class="editor-select" id="selectWhisperModel">
              <option value="base" selected>Base (Fastest, ~1s)</option>
              <option value="small">Small (High Accuracy)</option>
              <option value="medium">Medium (Studio Quality)</option>
            </select>
          </div>

          <div class="editor-field">
            <label class="editor-label">Language</label>
            <select class="editor-select" id="selectWhisperLang">
              <option value="" selected>Auto Detect</option>
              <option value="es">Spanish (Español)</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <button class="vt-btn-primary" id="btnTranscribeWhisper">
          Transcribe Dialogue (Local Whisper AI)
        </button>

        <button class="vt-btn-secondary" id="btnPolishGemini">
          AI Polish Casing, Accents & Slang (Gemini Flash)
        </button>

        <div id="subtitlesProgressContainer" style="display: none;"></div>
      </div>

      <!-- Subtitle Render / Reference Toggle -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--vt-bg-subtle); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--vt-border); margin-top: 4px;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 13px; font-weight: 600;">Burn / Render Subtitles</span>
          <span style="font-size: 11px; color: var(--vt-text-muted);" id="subtitleRenderHelpText">
            ${proj.captions?.enabled !== false ? '● Render kinetic styled subtitles on final export' : '○ Subtitles OFF in export (showing simple reference in editor)'}
          </span>
        </div>
        <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
          <input type="checkbox" id="chkRenderSubtitles" ${proj.captions?.enabled !== false ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--vt-accent-coral);">
        </label>
      </div>

      <!-- Cue List Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
        <span style="font-size: 13px; font-weight: 600;">Subtitle Cues (${cues.length})</span>
        <button class="vt-btn-secondary" id="btnAddCueBtn" style="width: auto; padding: 4px 10px; font-size: 11px;">+ Add Cue</button>
      </div>

      <!-- Cue List Scroll Container -->
      <div id="cuesScrollList" style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
        ${cues.length === 0 ? '<div style="font-size: 12px; color: var(--vt-text-muted); text-align: center; padding: 20px;">No subtitle cues yet. Click "Transcribe Dialogue" to generate subtitles.</div>' : ''}
      </div>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="vt-btn-secondary" id="btnBackToStep2" style="flex: 1;">&larr; Back</button>
        <button class="vt-btn-primary" id="btnGoToStep4" style="flex: 2;">Next: Subject Rotoscoping &rarr;</button>
      </div>
    </div>
  `;

  renderCueItems(container);
  bindSubtitleEvents(container);
}

function renderCueItems(container) {
  const listEl = container.querySelector('#cuesScrollList');
  if (!listEl) return;

  const proj = store.getProject();
  const cues = proj?.captions?.cues || [];
  if (cues.length === 0) return;

  listEl.innerHTML = '';
  cues.forEach((cue, index) => {
    const item = document.createElement('div');
    item.style.background = 'var(--vt-bg-surface)';
    item.style.border = '1px solid var(--vt-border)';
    item.style.borderRadius = '6px';
    item.style.padding = '8px 10px';
    item.style.display = 'flex';
    item.style.flexDirection = 'column';
    item.style.gap = '6px';
    item.style.fontSize = '12px';

    const isPunch = cue.cueType === 'punchline' || cue.cueType === 'slang' || (cue.text && cue.text.length > 2 && cue.text === cue.text.toUpperCase());
    const isHook = cue.cueType === 'hook' || cue.start <= 3.2;

    const badgeLabel = isPunch ? '⚡ PUNCHLINE' : isHook ? '🪝 HOOK' : '📖 SETUP';
    const badgeColor = isPunch ? '#FF595E' : isHook ? '#F59E0B' : 'var(--vt-text-muted)';
    const badgeBg = isPunch ? 'rgba(255, 89, 94, 0.12)' : isHook ? 'rgba(245, 158, 11, 0.12)' : 'var(--vt-bg-subtle)';

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-family: var(--vt-font-mono); font-size: 11px; cursor: pointer; color: var(--vt-text-muted);" title="Click to seek">
            ${formatTime(cue.start)} &rarr; ${formatTime(cue.end)}
          </span>
          <span class="cue-type-badge" style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; color: ${badgeColor}; background: ${badgeBg}; cursor: pointer;" title="Click to toggle punchline">
            ${badgeLabel}
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="toggle-punch-btn" style="background: none; border: none; color: ${isPunch ? '#FF595E' : 'var(--vt-text-dim)'}; cursor: pointer; font-size: 11px;" title="Toggle ALL CAPS punchline">
            ${isPunch ? 'Abc' : 'ABC'}
          </button>
          <button class="delete-cue-btn" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 11px;">Delete</button>
        </div>
      </div>
      <input type="text" class="editor-input cue-text-input" value="${cue.text.replace(/"/g, '&quot;')}" style="width: 100%; font-size: 13px; ${isPunch ? 'font-weight: 700; color: #FF595E;' : ''}" />
    `;

    // Click timestamp to seek
    item.querySelector('span')?.addEventListener('click', () => {
      store.setTime(cue.start);
      if (window.editorPlayer) window.editorPlayer.seek(cue.start);
    });

    // Inline edit
    const input = item.querySelector('.cue-text-input');
    input?.addEventListener('input', (e) => {
      cue.text = e.target.value;
      store.triggerAutosave();
      store.emit('change');
    });

    // Toggle punchline / casing button
    item.querySelector('.toggle-punch-btn')?.addEventListener('click', () => {
      if (cue.cueType === 'punchline' || cue.text === cue.text.toUpperCase()) {
        cue.cueType = 'setup';
        cue.text = cue.text.charAt(0).toUpperCase() + cue.text.slice(1).toLowerCase();
        (cue.words || []).forEach(w => {
          w.isPunchline = false;
          if (w.highlightType === 'punchline') w.highlightType = undefined;
        });
      } else {
        cue.cueType = 'punchline';
        cue.text = cue.text.toUpperCase();
        (cue.words || []).forEach(w => {
          w.isPunchline = true;
          w.highlightType = 'punchline';
        });
      }
      renderCueItems(container);
      store.triggerAutosave();
      store.emit('change');
    });

    // Delete cue
    item.querySelector('.delete-cue-btn')?.addEventListener('click', () => {
      proj.captions.cues = proj.captions.cues.filter(c => c.id !== cue.id);
      renderCueItems(container);
      store.triggerAutosave();
      store.emit('change');
    });

    listEl.appendChild(item);
  });
}

function bindSubtitleEvents(container) {
  const proj = store.getProject();
  const progContainer = container.querySelector('#subtitlesProgressContainer');

  // Preset Selection
  const presetSelect = container.querySelector('#selectSubtitlePreset');
  const presetHelp = container.querySelector('#presetHelpText');
  presetSelect?.addEventListener('change', (e) => {
    const preset = e.target.value;
    proj.captions = proj.captions || { cues: [], enabled: true };
    proj.captions.style = proj.captions.style || {};
    proj.captions.style.preset = preset;

    if (preset === 'standup_hybrid') {
      proj.captions.style.font = 'Montserrat';
      proj.captions.style.size = 68;
      proj.captions.style.color = '#FFFFFF';
      proj.captions.style.highlight = '#FFD166';
      proj.captions.style.accent = '#FF595E';
      proj.captions.style.position = 'collarbone';
      proj.captions.style.paddingBottom = 620;
      proj.captions.style.strokeWidth = 3.5;
      if (presetHelp) presetHelp.textContent = 'Heavy sans-serif, sentence case setups, ALL CAPS punchlines, warm amber context & coral slang.';
    } else if (preset === 'indie_cinema') {
      proj.captions.style.font = 'Montserrat';
      proj.captions.style.size = 62;
      proj.captions.style.color = '#F4D35E';
      proj.captions.style.highlight = '#FFFFFF';
      proj.captions.style.strokeWidth = 2.5;
      proj.captions.style.position = 'collarbone';
      proj.captions.style.paddingBottom = 580;
      if (presetHelp) presetHelp.textContent = 'Warm yellow/off-white, thin outline, steady zero-bounce placement for nostalgic stories.';
    } else if (preset === 'pill_box') {
      proj.captions.style.font = 'Inter';
      proj.captions.style.size = 54;
      proj.captions.style.color = '#FFFFFF';
      proj.captions.style.highlight = '#FFD166';
      proj.captions.style.position = 'collarbone';
      proj.captions.style.paddingBottom = 600;
      if (presetHelp) presetHelp.textContent = 'Clean semi-transparent pill container with rounded corners and modern sans-serif.';
    }

    store.triggerAutosave();
    store.emit('change', proj);
    showToast(`Preset switched to ${presetSelect.options[presetSelect.selectedIndex].text}`);
  });

  // Position Selection
  const posSelect = container.querySelector('#selectSubtitlePos');
  posSelect?.addEventListener('change', (e) => {
    const pos = e.target.value;
    proj.captions = proj.captions || { cues: [], enabled: true };
    proj.captions.style = proj.captions.style || {};
    proj.captions.style.position = pos;
    store.triggerAutosave();
    store.emit('change', proj);
  });

  // Transcribe button
  const transcribeBtn = container.querySelector('#btnTranscribeWhisper');
  transcribeBtn?.addEventListener('click', async () => {
    transcribeBtn.disabled = true;
    progContainer.style.display = 'block';
    const progress = createProgressLine(progContainer);
    progress.update(10, 'Running Whisper speech recognition...');

    const modelSize = container.querySelector('#selectWhisperModel')?.value || 'base';
    const lang = container.querySelector('#selectWhisperLang')?.value || null;
    const pacing = container.querySelector('#selectSubtitlePacing')?.value || 'standup_hybrid';

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_size: modelSize, language: lang, pacing }),
      });
      if (!res.ok) throw new Error('Transcription task failed to start');
      const data = await res.json();
      const taskId = data.task_id;

      const pollTimer = setInterval(async () => {
        try {
          const tRes = await fetch(`/api/editor/tasks/${taskId}`);
          const tData = await tRes.json();
          progress.update(tData.percent, tData.message);

          if (tData.status === 'completed') {
            clearInterval(pollTimer);
            progress.done('Transcription complete!');
            transcribeBtn.disabled = false;
            // Reload project cues
            const pRes = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}`);
            const refreshedProj = await pRes.json();
            store.setProject(refreshedProj);
            renderStepSubtitles(container);
            showToast(`Generated ${refreshedProj.captions?.cues?.length || 0} subtitle cues!`, 'success');
          } else if (tData.status === 'failed') {
            clearInterval(pollTimer);
            progress.error(tData.error || 'Transcription failed');
            transcribeBtn.disabled = false;
            showToast('Whisper transcription failed', 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          transcribeBtn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      transcribeBtn.disabled = false;
      showToast(e.message, 'error');
    }
  });

  // Polish with Gemini button
  const polishBtn = container.querySelector('#btnPolishGemini');
  polishBtn?.addEventListener('click', async () => {
    polishBtn.disabled = true;
    progContainer.style.display = 'block';
    const progress = createProgressLine(progContainer);
    progress.update(15, 'Contacting Gemini Flash for proofreading...');

    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: 'comedic' }),
      });
      if (!res.ok) throw new Error('AI Proofread failed to start');
      const data = await res.json();
      const taskId = data.task_id;

      const pollTimer = setInterval(async () => {
        try {
          const tRes = await fetch(`/api/editor/tasks/${taskId}`);
          const tData = await tRes.json();
          progress.update(tData.percent, tData.message);

          if (tData.status === 'completed') {
            clearInterval(pollTimer);
            progress.done('AI proofread complete!');
            polishBtn.disabled = false;
            const pRes = await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}`);
            const refreshedProj = await pRes.json();
            store.setProject(refreshedProj);
            renderStepSubtitles(container);
            showToast('Subtitles proofread and polished with comedic emphasis!', 'success');
          } else if (tData.status === 'failed') {
            clearInterval(pollTimer);
            progress.error(tData.error || 'Proofread failed');
            polishBtn.disabled = false;
            showToast('Gemini proofreading failed', 'error');
          }
        } catch (e) {
          clearInterval(pollTimer);
          polishBtn.disabled = false;
        }
      }, 1000);
    } catch (e) {
      progress.error(e.message);
      polishBtn.disabled = false;
      showToast(e.message, 'error');
    }
  });

  // Render Subtitles toggle
  const chkRender = container.querySelector('#chkRenderSubtitles');
  const helpText = container.querySelector('#subtitleRenderHelpText');
  chkRender?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    if (proj.captions) {
      proj.captions.enabled = isChecked;
    }
    if (helpText) {
      helpText.textContent = isChecked
        ? '● Render kinetic styled subtitles on final export'
        : '○ Subtitles OFF in export (showing simple reference in editor)';
    }
    store.triggerAutosave();
    store.emit('change', proj);
    showToast(isChecked ? 'Styled subtitles enabled' : 'Reference-only mode (subtitles will not be rendered on export)');
  });

  // Add cue button
  container.querySelector('#btnAddCueBtn')?.addEventListener('click', () => {
    const curTime = store.getTime();
    const newCue = {
      id: `cue_${Date.now()}`,
      start: curTime,
      end: curTime + 2.5,
      text: 'New subtitle cue',
      words: [],
    };
    proj.captions.cues = proj.captions.cues || [];
    proj.captions.cues.push(newCue);
    proj.captions.cues.sort((a, b) => a.start - b.start);
    renderCueItems(container);
    store.triggerAutosave();
    store.emit('change');
  });

  // Step navigation
  container.querySelector('#btnBackToStep2')?.addEventListener('click', () => store.setStep(2));
  container.querySelector('#btnGoToStep4')?.addEventListener('click', () => store.setStep(4));
}
