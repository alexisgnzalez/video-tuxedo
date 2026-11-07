/**
 * Tuxedo Editor Main Controller
 * Coordinates the Step Rail, Remotion Player, Timeline, Undo/Redo, and Autosave.
 */

import { store } from './store.js?v=0.7.6';
import { player } from './player.js?v=0.7.6';
import { Timeline } from './timeline/Timeline.js?v=0.7.6';
import { renderStepUpload } from './steps/upload.js?v=0.7.6';
import { renderStepCut } from './steps/cut.js?v=0.7.6';
import { renderStepSubtitles } from './steps/subtitles.js?v=0.7.6';
import { renderStepCutout } from './steps/cutout.js?v=0.7.6';
import { renderStepGraphics } from './steps/graphics.js?v=0.7.6';
import { renderStepExport } from './steps/export.js?v=0.7.6';
import { formatTimecode, showToast } from './ui.js?v=0.7.6';
import { StageWings } from './stageWings.js?v=0.7.6';

let timelineInstance = null;
let stageWingsInstance = null;
let isInitialized = false;

export async function initEditor(slug = null, targetStep = null) {
  const viewEl = document.getElementById('editorToolView');
  if (!viewEl) return;

  if (isInitialized) {
    if (slug) {
      await loadProjectBySlug(slug, targetStep);
    } else {
      const curProj = store.getProject();
      const step = targetStep || ((curProj?.clips && curProj.clips.length > 0) ? 2 : 1);
      store.setStep(step);
      renderActiveStep(step);
    }
    return;
  }
  isInitialized = true;

  // Window global reference so timeline can trigger player actions
  window.editorPlayer = player;

  // Mount player
  const playerContainer = document.getElementById('editorPlayerContainer');
  if (playerContainer) {
    player.mount(playerContainer);
  }

  // Mount stage wings (Creator HUD & Dynamic Step Inspector)
  const leftWing = document.getElementById('stageWingLeft');
  const rightWing = document.getElementById('stageWingRight');
  if (leftWing && rightWing) {
    stageWingsInstance = new StageWings(leftWing, rightWing);
    stageWingsInstance.mount();
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

  // Wire Global Keyboard Shortcuts
  wireKeyboardShortcuts();

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

  // Subscribe to project loads to update top bar title
  store.subscribe('project:load', (proj) => {
    const nameInput = document.getElementById('editorProjectName');
    if (nameInput) {
      nameInput.value = proj?.name || proj?.slug || 'Untitled Project';
    }
  });

  // Load project if slug provided
  if (slug) {
    await loadProjectBySlug(slug, targetStep);
  } else {
    // Open Step 1 (Upload)
    store.setStep(1);
    renderActiveStep(1);
  }
}

export async function loadProjectBySlug(slug, targetStep = null) {
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

    // Default to Step 2 if clips exist, else Step 1 (or targetStep if requested)
    const initialStep = targetStep || ((proj.clips && proj.clips.length > 0) ? 2 : 1);
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

  // Toggle Sidebar button
  const toggleSidebarBtn = document.getElementById('editorToggleSidebarBtn');
  toggleSidebarBtn?.addEventListener('click', () => {
    const panel = document.getElementById('editorStepPanelContainer');
    if (panel) {
      const isCollapsed = panel.classList.toggle('collapsed');
      toggleSidebarBtn.classList.toggle('active', isCollapsed);
      showToast(isCollapsed ? 'Sidebar Collapsed (Focus Mode)' : 'Sidebar Restored', 'info');
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
  const wingsBtn = document.getElementById('btnToggleStudioWings');
  const tlHeightBtn = document.getElementById('btnToggleTimelineHeight');
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

  // Safe Zones Mode Cycling
  const safeModes = ['none', 'tiktok', 'reels', 'collarbone', 'grid'];
  safeZonesBtn?.addEventListener('click', () => {
    if (stageWingsInstance) {
      const curIdx = safeModes.indexOf(stageWingsInstance.activeSafeZone);
      const nextMode = safeModes[(curIdx + 1) % safeModes.length];
      stageWingsInstance.activeSafeZone = nextMode;
      stageWingsInstance.renderLeftWing();
      safeZonesBtn.classList.toggle('active', nextMode !== 'none');
      showToast(`Safe Zones: ${nextMode.toUpperCase()}`, 'info');
    } else {
      const active = player.toggleSafeZones();
      safeZonesBtn.style.color = active ? 'var(--vt-accent-coral)' : 'var(--vt-text-light)';
    }
  });

  // Toggle Studio Wings
  wingsBtn?.addEventListener('click', () => {
    const stage = document.getElementById('editorStage');
    if (stage) {
      const isCollapsed = stage.classList.toggle('wings-collapsed');
      wingsBtn.classList.toggle('active', !isCollapsed);
      showToast(isCollapsed ? 'Studio Wings Hidden' : 'Vertical Studio Wings Visible', 'info');
    }
  });

  // Toggle Timeline Height (Maximize Stage)
  tlHeightBtn?.addEventListener('click', () => {
    const tlPanel = document.getElementById('editorTimelinePanel');
    if (tlPanel) {
      const isCollapsed = tlPanel.classList.toggle('collapsed');
      tlHeightBtn.classList.toggle('active', isCollapsed);
      showToast(isCollapsed ? 'Stage Maximized (Timeline Compact)' : 'Timeline Restored', 'info');
    }
  });

  muteBtn?.addEventListener('click', () => {
    const muted = player.toggleMute();
    muteBtn.style.color = muted ? '#EF4444' : 'var(--vt-text-light)';
  });
}

function wireKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ignore keyboard shortcuts when user is typing in form inputs or textareas
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Toggle Sidebar: Cmd+B or Ctrl+B
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.getElementById('editorToggleSidebarBtn')?.click();
      return;
    }

    // Toggle Studio Wings: W
    if (e.key === 'w' || e.key === 'W') {
      document.getElementById('btnToggleStudioWings')?.click();
      return;
    }

    // Toggle Timeline Maximize: T
    if (e.key === 't' || e.key === 'T') {
      document.getElementById('btnToggleTimelineHeight')?.click();
      return;
    }
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
