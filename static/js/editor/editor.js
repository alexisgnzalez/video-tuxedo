/**
 * Tuxedo Editor Main Controller
 * Coordinates the Step Rail, Remotion Player, Timeline, Undo/Redo, and Autosave.
 */

import { store } from './store.js?v=0.6.4';
import { player } from './player.js?v=0.6.4';
import { Timeline } from './timeline/Timeline.js?v=0.6.4';
import { renderStepUpload } from './steps/upload.js?v=0.6.4';
import { renderStepCut } from './steps/cut.js?v=0.6.4';
import { renderStepSubtitles } from './steps/subtitles.js?v=0.6.4';
import { renderStepCutout } from './steps/cutout.js?v=0.6.4';
import { renderStepGraphics } from './steps/graphics.js?v=0.6.4';
import { renderStepExport } from './steps/export.js?v=0.6.4';
import { formatTimecode, showToast } from './ui.js?v=0.6.4';

let timelineInstance = null;

export async function initEditor(slug = null) {
  const viewEl = document.getElementById('editorToolView');
  if (!viewEl) return;

  // Window global reference so timeline can trigger player actions
  window.editorPlayer = player;

  // Mount player
  const playerContainer = document.getElementById('editorPlayerContainer');
  if (playerContainer) {
    player.mount(playerContainer);
  }

  // Mount timeline
  const timelinePanel = document.getElementById('editorTimelinePanel');
  if (timelinePanel) {
    timelineInstance = new Timeline(timelinePanel);
    timelineInstance.mount();
  }

  // Wire Top Bar Controls
  wireTopBar();

  // Wire Floating Transport Bar Controls
  wireTransportBar();

  // Subscribe to step changes
  store.subscribe('step:change', (stepNum) => {
    updateStepRailUI(stepNum);
    renderActiveStep(stepNum);
  });

  // Subscribe to project title/save changes
  store.subscribe('save:status', (status) => {
    const dot = document.getElementById('editorSaveDot');
    const label = document.getElementById('editorSaveLabel');
    if (dot && label) {
      if (status === 'saving') {
        dot.className = 'editor-save-dot saving';
        label.textContent = 'Saving...';
      } else if (status === 'saved') {
        dot.className = 'editor-save-dot';
        label.textContent = 'Saved';
      } else if (status === 'error') {
        dot.className = 'editor-save-dot';
        dot.style.backgroundColor = '#EF4444';
        label.textContent = 'Save Error';
      }
    }
  });

  // Subscribe to Undo/Redo button states
  store.subscribe('change', () => {
    const undoBtn = document.getElementById('editorUndoBtn');
    const redoBtn = document.getElementById('editorRedoBtn');
    if (undoBtn) undoBtn.disabled = !store.canUndo();
    if (redoBtn) redoBtn.disabled = !store.canRedo();
  });

  // Load project if slug provided
  if (slug) {
    await loadProjectBySlug(slug);
  } else {
    // Open Step 1 (Upload)
    store.setStep(1);
    renderActiveStep(1);
  }
}

export async function loadProjectBySlug(slug) {
  try {
    const res = await fetch(`/api/editor/projects/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Failed to load project');
    const proj = await res.json();
    store.setProject(proj);

    // Fetch waveform peaks
    try {
      const peaksRes = await fetch(`/api/editor/projects/${encodeURIComponent(slug)}/peaks`);
      if (peaksRes.ok) {
        const peaks = await peaksRes.json();
        if (timelineInstance) timelineInstance.setPeaks(peaks);
      }
    } catch (e) {
      console.warn('Could not load waveform peaks:', e);
    }

    // Update project name input
    const nameInput = document.getElementById('editorProjectName');
    if (nameInput) {
      nameInput.value = proj.name || proj.slug;
    }

    // Default to Step 2 if clips exist, else Step 1
    const initialStep = (proj.clips && proj.clips.length > 0) ? 2 : 1;
    store.setStep(initialStep);
    renderActiveStep(initialStep);
  } catch (err) {
    showToast(`Error loading project: ${err.message}`, 'error');
    store.setStep(1);
    renderActiveStep(1);
  }
}

function wireTopBar() {
  // Back button
  document.getElementById('editorBackBtn')?.addEventListener('click', () => {
    if (window.switchView) {
      window.switchView('toolsView');
    }
  });

  // Project title renaming
  const nameInput = document.getElementById('editorProjectName');
  nameInput?.addEventListener('change', async (e) => {
    const newName = e.target.value.trim();
    const proj = store.getProject();
    if (!proj || !newName) return;
    proj.name = newName;
    try {
      await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      showToast('Project renamed', 'success');
    } catch (err) {
      showToast('Failed to rename project', 'error');
    }
  });

  // Step rail tabs click
  const tabs = document.querySelectorAll('.editor-step-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const stepNum = parseInt(tab.getAttribute('data-step'), 10);
      if (!isNaN(stepNum)) {
        store.setStep(stepNum);
      }
    });
  });

  // Undo / Redo buttons
  document.getElementById('editorUndoBtn')?.addEventListener('click', () => store.undo());
  document.getElementById('editorRedoBtn')?.addEventListener('click', () => store.redo());

  // Reveal in Finder button
  document.getElementById('editorFinderBtn')?.addEventListener('click', async () => {
    const proj = store.getProject();
    if (!proj) return;
    try {
      await fetch(`/api/editor/projects/${encodeURIComponent(proj.slug)}/reveal`, { method: 'POST' });
    } catch (e) {}
  });
}

function wireTransportBar() {
  const playBtn = document.getElementById('btnTransportPlay');
  const stepBackBtn = document.getElementById('btnTransportStepBack');
  const stepFwdBtn = document.getElementById('btnTransportStepFwd');
  const safeZonesBtn = document.getElementById('btnTransportSafeZones');
  const muteBtn = document.getElementById('btnTransportMute');
  const timecodeEl = document.getElementById('transportTimecode');

  playBtn?.addEventListener('click', () => {
    player.togglePlay();
  });

  store.subscribe('player:play', () => {
    if (playBtn) playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
  });

  store.subscribe('player:pause', () => {
    if (playBtn) playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  });

  store.subscribe('time:change', ({ frame }) => {
    if (timecodeEl) {
      const fps = store.getProject()?.source?.fps || 30;
      timecodeEl.textContent = formatTimecode(frame, fps);
    }
  });

  stepBackBtn?.addEventListener('click', () => {
    const fps = store.getProject()?.source?.fps || 30;
    const curFrame = store.getFrame();
    const newFrame = Math.max(0, curFrame - 1);
    store.setTime(newFrame / fps, newFrame);
    player.seek(newFrame / fps);
  });

  stepFwdBtn?.addEventListener('click', () => {
    const fps = store.getProject()?.source?.fps || 30;
    const curFrame = store.getFrame();
    const newFrame = curFrame + 1;
    store.setTime(newFrame / fps, newFrame);
    player.seek(newFrame / fps);
  });

  safeZonesBtn?.addEventListener('click', () => {
    const active = player.toggleSafeZones();
    safeZonesBtn.style.color = active ? 'var(--vt-accent-coral)' : 'var(--vt-text-light)';
    showToast(active ? '9:16 Safe Zones Visible' : 'Safe Zones Hidden', 'info');
  });

  muteBtn?.addEventListener('click', () => {
    const muted = player.toggleMute();
    muteBtn.style.color = muted ? '#EF4444' : 'var(--vt-text-light)';
  });
}

function updateStepRailUI(stepNum) {
  const tabs = document.querySelectorAll('.editor-step-tab');
  tabs.forEach(tab => {
    const s = parseInt(tab.getAttribute('data-step'), 10);
    if (s === stepNum) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function renderActiveStep(stepNum) {
  const panelContainer = document.getElementById('editorStepPanelContainer');
  if (!panelContainer) return;

  switch (stepNum) {
    case 1:
      renderStepUpload(panelContainer);
      break;
    case 2:
      renderStepCut(panelContainer);
      break;
    case 3:
      renderStepSubtitles(panelContainer);
      break;
    case 4:
      renderStepCutout(panelContainer);
      break;
    case 5:
      renderStepGraphics(panelContainer);
      break;
    case 6:
      renderStepExport(panelContainer);
      break;
    default:
      renderStepUpload(panelContainer);
  }
}
