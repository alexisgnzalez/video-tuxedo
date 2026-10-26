/**
 * Tuxedo Editor State Store
 * Manages project data, command-pattern undo/redo, dirty tracking, and 800ms debounced autosave.
 */

import { showToast } from './ui.js';

class EditorStore {
  constructor() {
    this.project = null;
    this.currentStep = 1;
    this.currentTime = 0; // Timeline seconds
    this.currentFrame = 0;
    this.zoom = 100; // Pixels per second
    this.selectedClipId = null;
    this.selectedCueId = null;
    this.selectedLayerId = null;

    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Map();
    this.saveTimeout = null;
    this.isSaving = false;
  }

  setProject(proj) {
    this.project = proj;
    this.undoStack = [];
    this.redoStack = [];
    this.emit('project:load', this.project);
    this.emit('change', this.project);
  }

  getProject() {
    return this.project;
  }

  // Event Subscription
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in editor store listener for ${event}:`, e);
        }
      }
    }
  }

  // Step Management (1 to 6)
  setStep(stepNum) {
    if (stepNum < 1 || stepNum > 6) return;
    this.currentStep = stepNum;
    this.emit('step:change', this.currentStep);
  }

  getStep() {
    return this.currentStep;
  }

  // Time & Playhead
  setTime(seconds, frame = null) {
    let maxDur = 0;
    if (this.project?.clips?.length) {
      maxDur = this.project.clips.reduce((acc, c) => acc + Math.max(0, (c.srcOut || 0) - (c.srcIn || 0)), 0);
    } else if (this.project?.source?.duration) {
      maxDur = this.project.source.duration;
    }
    const clampedSec = maxDur > 0 ? Math.max(0, Math.min(maxDur, seconds)) : Math.max(0, seconds);
    this.currentTime = clampedSec;
    const fps = this.project?.source?.fps || 30;
    this.currentFrame = frame !== null ? frame : Math.round(this.currentTime * fps);
    this.emit('time:change', { time: this.currentTime, frame: this.currentFrame });
  }

  getTime() {
    return this.currentTime;
  }

  getFrame() {
    return this.currentFrame;
  }

  // Zoom
  setZoom(pxPerSec) {
    this.zoom = Math.max(20, Math.min(400, pxPerSec));
    this.emit('zoom:change', this.zoom);
  }

  getZoom() {
    return this.zoom;
  }

  // Selection
  selectClip(clipId) {
    this.selectedClipId = clipId;
    this.emit('selection:clip', clipId);
  }

  selectCue(cueId) {
    this.selectedCueId = cueId;
    this.emit('selection:cue', cueId);
  }

  selectLayer(layerId) {
    this.selectedLayerId = layerId;
    this.emit('selection:layer', layerId);
  }

  // Command Pattern Execution (Undo / Redo)
  execute(command) {
    if (!command || typeof command.do !== 'function') return;
    command.do();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action
    if (this.undoStack.length > 50) this.undoStack.shift(); // Cap history
    this.emit('change', this.project);
    this.triggerAutosave();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const command = this.undoStack.pop();
    if (typeof command.undo === 'function') {
      command.undo();
      this.redoStack.push(command);
      this.emit('change', this.project);
      this.triggerAutosave();
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const command = this.redoStack.pop();
    if (typeof command.do === 'function') {
      command.do();
      this.undoStack.push(command);
      this.emit('change', this.project);
      this.triggerAutosave();
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  // Debounced Autosave (800ms)
  triggerAutosave() {
    if (!this.project || !this.project.slug) return;
    this.emit('save:status', 'saving');
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, 800);
  }

  async saveNow() {
    if (!this.project || !this.project.slug) return;
    this.isSaving = true;
    this.emit('save:status', 'saving');
    try {
      const res = await fetch(`/api/editor/projects/${encodeURIComponent(this.project.slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.project),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      this.emit('save:status', 'saved');
    } catch (e) {
      console.error('Autosave error:', e);
      this.emit('save:status', 'error');
    } finally {
      this.isSaving = false;
    }
  }
}

// Guaranteed singleton across any module specifier or bundle boundary
const storeSingleton = window.__tuxedoEditorStore || new EditorStore();
window.__tuxedoEditorStore = storeSingleton;
export const store = storeSingleton;
