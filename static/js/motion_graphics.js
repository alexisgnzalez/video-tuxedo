/**
 * Video Tuxedo — Tool 4: Motion Graphics Studio (Remotion + DaVinci Resolve)
 * Mid-Century Kinetic Poster procedural motion graphics engine.
 */

class MotionGraphicsStudio {
  constructor() {
    this.currentPlan = null;
    this.registry = null;
    this.activeSceneId = null;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.renderTaskId = null;
    this.pollInterval = null;

    this.initElements();
    this.bindEvents();
    this.loadRegistry();
  }

  initElements() {
    // Step views
    this.loadStep = document.getElementById('motionLoadStep');
    this.workspaceStep = document.getElementById('motionWorkspaceStep');

    // Load inputs
    this.pathInput = document.getElementById('motionPathInput');
    this.loadPathBtn = document.getElementById('motionLoadPathBtn');
    this.dropzone = document.getElementById('motionDropzone');
    this.fileInput = document.getElementById('motionFileInput');
    this.srtPathInput = document.getElementById('motionSrtPathInput');

    // Header controls
    this.slugText = document.getElementById('motionSlugText');
    this.fpsBadge = document.getElementById('motionFpsBadge');
    this.durationBadge = document.getElementById('motionDurationBadge');
    this.depthModeSelect = document.getElementById('motionDepthModeSelect');
    this.platformSelect = document.getElementById('motionPlatformSelect');
    this.safeZoneToggle = document.getElementById('motionSafeZoneToggle');
    this.showVideoToggle = document.getElementById('motionShowVideoToggle');
    this.redraftBtn = document.getElementById('motionRedraftBtn');
    this.renderBtn = document.getElementById('motionRenderBtn');

    // Player controls
    this.playerContainer = document.getElementById('motionPlayerContainer');
    this.playBtn = document.getElementById('motionPlayBtn');
    this.stepBackBtn = document.getElementById('motionStepBackBtn');
    this.stepFwdBtn = document.getElementById('motionStepFwdBtn');
    this.timecodeText = document.getElementById('motionTimecodeText');
    this.frameText = document.getElementById('motionFrameText');

    // Timeline elements
    this.timelineRuler = document.getElementById('motionTimelineRuler');
    this.timelineTracks = document.getElementById('motionTimelineTracks');
    this.timelinePlayhead = document.getElementById('motionTimelinePlayhead');
    this.timelineContainer = document.getElementById('motionTimelineContainer');

    // Sidebar / Inspector
    this.inspectorTabBtn = document.getElementById('motionInspectorTabBtn');
    this.libraryTabBtn = document.getElementById('motionLibraryTabBtn');
    this.inspectorPane = document.getElementById('motionInspectorPane');
    this.libraryPane = document.getElementById('motionLibraryPane');

    // Inspector fields
    this.activeComponentSelect = document.getElementById('motionActiveComponentSelect');
    this.activeZoneSelect = document.getElementById('motionActiveZoneSelect');
    this.activeStartInput = document.getElementById('motionActiveStartInput');
    this.activeDurInput = document.getElementById('motionActiveDurInput');
    this.activePropsContainer = document.getElementById('motionActivePropsContainer');
    this.activeSfxSelect = document.getElementById('motionActiveSfxSelect');
    this.activeSfxVariantSelect = document.getElementById('motionActiveSfxVariantSelect');
    this.deleteSceneBtn = document.getElementById('motionDeleteSceneBtn');
    this.duplicateSceneBtn = document.getElementById('motionDuplicateSceneBtn');
    this.addSceneBtn = document.getElementById('motionAddSceneBtn');
    this.assetLibraryGrid = document.getElementById('motionAssetLibraryGrid');

    // Render Progress Dialog
    this.renderModal = document.getElementById('motionRenderModal');
    this.renderProgressBar = document.getElementById('motionRenderProgressBar');
    this.renderPercentText = document.getElementById('motionRenderPercentText');
    this.renderFrameText = document.getElementById('motionRenderFrameText');
    this.renderFpsText = document.getElementById('motionRenderFpsText');
    this.renderEtaText = document.getElementById('motionRenderEtaText');
    this.renderCancelBtn = document.getElementById('motionRenderCancelBtn');
  }

  bindEvents() {
    // Load events
    if (this.loadPathBtn) {
      this.loadPathBtn.addEventListener('click', () => this.handleLoadPath());
    }
    if (this.pathInput) {
      this.pathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLoadPath();
      });
    }

    // Dropzone
    if (this.dropzone && this.fileInput) {
      this.dropzone.addEventListener('click', () => this.fileInput.click());
      this.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropzone.classList.add('drag-over');
      });
      this.dropzone.addEventListener('dragleave', () => this.dropzone.classList.remove('drag-over'));
      this.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Playback buttons
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlayback());
    }
    if (this.stepBackBtn) {
      this.stepBackBtn.addEventListener('click', () => this.seekDelta(-1));
    }
    if (this.stepFwdBtn) {
      this.stepFwdBtn.addEventListener('click', () => this.seekDelta(1));
    }

    // Timeline scrubbing
    if (this.timelineContainer) {
      this.timelineContainer.addEventListener('click', (e) => {
        const rect = this.timelineTracks.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const totalFrames = this.currentPlan?.durationInFrames || 300;
        const targetFrame = Math.max(0, Math.min(totalFrames - 1, Math.round((clickX / rect.width) * totalFrames)));
        this.seekToFrame(targetFrame);
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only active if Motion view is visible
      const view = document.getElementById('motionToolView');
      if (!view || !view.classList.contains('active')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.seekDelta(e.shiftKey ? -Math.round(this.currentPlan?.fps || 30) : -1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.seekDelta(e.shiftKey ? Math.round(this.currentPlan?.fps || 30) : 1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.activeSceneId) {
          e.preventDefault();
          this.deleteActiveScene();
        }
      }
    });

    // Header controls
    if (this.depthModeSelect) {
      this.depthModeSelect.addEventListener('change', () => {
        if (!this.currentPlan) return;
        this.currentPlan.mode = this.depthModeSelect.value;
        this.updatePlayer();
      });
    }

    if (this.platformSelect) {
      this.platformSelect.addEventListener('change', () => {
        if (!this.currentPlan) return;
        this.currentPlan.platform = this.platformSelect.value;
        this.updatePlayer();
        this.renderTimeline();
      });
    }

    if (this.safeZoneToggle) {
      this.safeZoneToggle.addEventListener('change', () => {
        if (!this.currentPlan) return;
        this.currentPlan.preview = this.currentPlan.preview || {};
        this.currentPlan.preview.showSafeZones = this.safeZoneToggle.checked;
        this.updatePlayer();
      });
    }

    if (this.showVideoToggle) {
      this.showVideoToggle.addEventListener('change', () => {
        if (!this.currentPlan) return;
        this.currentPlan.preview = this.currentPlan.preview || {};
        this.currentPlan.preview.showSourceVideo = this.showVideoToggle.checked;
        this.updatePlayer();
      });
    }

    if (this.redraftBtn) {
      this.redraftBtn.addEventListener('click', () => this.handleRedraftPlan());
    }

    if (this.renderBtn) {
      this.renderBtn.addEventListener('click', () => this.startRender());
    }

    // Sidebar tab buttons
    if (this.inspectorTabBtn && this.libraryTabBtn) {
      this.inspectorTabBtn.addEventListener('click', () => this.switchTab('inspector'));
      this.libraryTabBtn.addEventListener('click', () => this.switchTab('library'));
    }

    // Inspector changes
    if (this.activeComponentSelect) {
      this.activeComponentSelect.addEventListener('change', () => {
        const sc = this.getActiveScene();
        if (!sc) return;
        sc.component = this.activeComponentSelect.value;
        this.buildPropsEditor(sc);
        this.updatePlayer();
        this.renderTimeline();
      });
    }

    if (this.activeZoneSelect) {
      this.activeZoneSelect.addEventListener('change', () => {
        const sc = this.getActiveScene();
        if (!sc) return;
        sc.zone = this.activeZoneSelect.value;
        this.updatePlayer();
        this.renderTimeline();
      });
    }

    if (this.activeStartInput) {
      this.activeStartInput.addEventListener('change', () => {
        const sc = this.getActiveScene();
        if (!sc) return;
        sc.from = Math.max(0, parseInt(this.activeStartInput.value, 10) || 0);
        this.updatePlayer();
        this.renderTimeline();
      });
    }

    if (this.activeDurInput) {
      this.activeDurInput.addEventListener('change', () => {
        const sc = this.getActiveScene();
        if (!sc) return;
        sc.durationInFrames = Math.max(10, parseInt(this.activeDurInput.value, 10) || 30);
        this.updatePlayer();
        this.renderTimeline();
      });
    }

    if (this.activeSfxSelect) {
      this.activeSfxSelect.addEventListener('change', () => {
        const sc = this.getActiveScene();
        if (!sc) return;
        const sfxId = this.activeSfxSelect.value;
        if (sfxId === 'none') {
          sc.sfx = [];
        } else {
          sc.sfx = [{ id: sfxId, at: 0, variant: parseInt(this.activeSfxVariantSelect.value, 10) || 1, volume: 0.35 }];
        }
        this.updatePlayer();
      });
    }

    if (this.deleteSceneBtn) {
      this.deleteSceneBtn.addEventListener('click', () => this.deleteActiveScene());
    }

    if (this.duplicateSceneBtn) {
      this.duplicateSceneBtn.addEventListener('click', () => this.duplicateActiveScene());
    }

    if (this.addSceneBtn) {
      this.addSceneBtn.addEventListener('click', () => this.addNewSceneAtPlayhead('CruzDiezBadge', 'R'));
    }

    if (this.renderCancelBtn) {
      this.renderCancelBtn.addEventListener('click', () => this.cancelRender());
    }
  }

  async loadRegistry() {
    try {
      const res = await fetch('/api/motion/registry');
      if (res.ok) {
        this.registry = await res.json();
        this.populateRegistryLibrary();
      }
    } catch (err) {
      console.warn('Could not load motion registry:', err);
    }
  }

  populateRegistryLibrary() {
    if (!this.registry || !this.assetLibraryGrid) return;

    this.assetLibraryGrid.innerHTML = '';
    for (const c of this.registry.components) {
      const card = document.createElement('div');
      card.className = 'motion-asset-card';
      card.innerHTML = `
        <div class="motion-asset-badge">${c.defaultZone}</div>
        <div class="motion-asset-name">${c.name}</div>
        <div class="motion-asset-desc">${c.description}</div>
      `;
      card.addEventListener('click', () => {
        this.addNewSceneAtPlayhead(c.id, c.defaultZone);
        this.switchTab('inspector');
      });
      this.assetLibraryGrid.appendChild(card);
    }
  }

  switchTab(tab) {
    if (tab === 'inspector') {
      this.inspectorTabBtn.classList.add('active');
      this.libraryTabBtn.classList.remove('active');
      this.inspectorPane.style.display = 'block';
      this.libraryPane.style.display = 'none';
    } else {
      this.libraryTabBtn.classList.add('active');
      this.inspectorTabBtn.classList.remove('active');
      this.libraryPane.style.display = 'block';
      this.inspectorPane.style.display = 'none';
    }
  }

  async handleLoadPath() {
    const rawPath = (this.pathInput.value || '').trim();
    if (!rawPath) {
      if (window.showToast) window.showToast('Please enter a video file path on your Mac', 'error');
      return;
    }

    const srtPath = (this.srtPathInput ? this.srtPathInput.value : '').trim();

    try {
      if (this.loadPathBtn) {
        this.loadPathBtn.disabled = true;
        this.loadPathBtn.textContent = 'Analyzing & Tracking Subject...';
      }

      const res = await fetch('/api/motion/load-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: rawPath, srt_path: srtPath || null }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load video file');
      }

      const data = await res.json();
      this.currentPlan = data.plan;
      this.initWorkspace();
      if (window.showToast) {
        window.showToast(`Loaded ${data.filename} (${data.fps} FPS, ${data.duration}s)`, 'success');
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
    } finally {
      if (this.loadPathBtn) {
        this.loadPathBtn.disabled = false;
        this.loadPathBtn.textContent = 'Load & Inspect Video';
      }
    }
  }

  async handleFileUpload(file) {
    if (window.showToast) window.showToast(`Uploading ${file.name}...`, 'success');
    // Save to temp_media and redirect to load-path
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/magic-mask/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload file');
      const data = await res.json();
      this.pathInput.value = data.media_path;
      this.handleLoadPath();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
    }
  }

  initWorkspace() {
    if (!this.currentPlan) return;

    this.loadStep.style.display = 'none';
    this.workspaceStep.style.display = 'grid';

    // Update header badges
    if (this.slugText) this.slugText.textContent = this.currentPlan.slug;
    if (this.fpsBadge) this.fpsBadge.textContent = `${this.currentPlan.fps} FPS`;
    const durSec = (this.currentPlan.durationInFrames / this.currentPlan.fps).toFixed(1);
    if (this.durationBadge) this.durationBadge.textContent = `${durSec}s (${this.currentPlan.durationInFrames} frames)`;

    // Mount live Remotion Player
    if (window.MotionPlayer && this.playerContainer) {
      this.playerContainer.innerHTML = '';
      window.MotionPlayer.mount(this.playerContainer, this.currentPlan, {
        onFrameUpdate: (f) => this.onPlayerFrameUpdate(f),
        onPlay: () => {
          this.isPlaying = true;
          if (this.playBtn) this.playBtn.textContent = '⏸ Pause';
        },
        onPause: () => {
          this.isPlaying = false;
          if (this.playBtn) this.playBtn.textContent = '▶ Play';
        },
      });
    }

    // Select first scene
    if (this.currentPlan.scenes.length > 0) {
      this.activeSceneId = this.currentPlan.scenes[0].id;
    }

    this.renderTimeline();
    this.updateInspector();
  }

  updatePlayer() {
    if (window.MotionPlayer && this.currentPlan) {
      window.MotionPlayer.update(this.currentPlan);
    }
  }

  togglePlayback() {
    if (window.MotionPlayer) {
      window.MotionPlayer.togglePlay();
    }
  }

  seekDelta(deltaFrames) {
    const total = this.currentPlan?.durationInFrames || 300;
    const target = Math.max(0, Math.min(total - 1, this.currentFrame + deltaFrames));
    this.seekToFrame(target);
  }

  seekToFrame(frame) {
    this.currentFrame = frame;
    if (window.MotionPlayer) {
      window.MotionPlayer.seek(frame);
    }
    this.updatePlayheadPosition();
  }

  onPlayerFrameUpdate(frame) {
    this.currentFrame = frame;
    this.updatePlayheadPosition();

    // Timecode string format
    const fps = this.currentPlan?.fps || 30;
    const totalSec = frame / fps;
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    const f = Math.floor(frame % fps);
    const tcStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;

    if (this.timecodeText) this.timecodeText.textContent = tcStr;
    if (this.frameText) this.frameText.textContent = `F: ${frame}`;
  }

  updatePlayheadPosition() {
    if (!this.timelinePlayhead || !this.currentPlan) return;
    const totalFrames = this.currentPlan.durationInFrames || 300;
    const pct = (this.currentFrame / totalFrames) * 100;
    this.timelinePlayhead.style.left = `${pct}%`;
  }

  renderTimeline() {
    if (!this.currentPlan || !this.timelineTracks) return;

    const totalFrames = this.currentPlan.durationInFrames || 300;
    this.timelineTracks.innerHTML = '';

    // Render 4 Spatial Lanes: T, L, R, B
    const zones = ['T', 'L', 'R', 'B'];
    const zoneLabels = { T: 'Zone T (Top / Canopy)', L: 'Zone L (Left Wing)', R: 'Zone R (Right Wing)', B: 'Zone B (Lower Third)' };

    for (const z of zones) {
      const row = document.createElement('div');
      row.className = 'motion-timeline-row';
      row.innerHTML = `<div class="motion-lane-label">${z}</div><div class="motion-lane-track" id="trackLane_${z}"></div>`;
      this.timelineTracks.appendChild(row);

      const track = row.querySelector(`#trackLane_${z}`);

      // Filter scenes belonging to this zone
      const scenesInZone = this.currentPlan.scenes.filter((s) => s.zone === z);
      for (const sc of scenesInZone) {
        const leftPct = (sc.from / totalFrames) * 100;
        const widthPct = (sc.durationInFrames / totalFrames) * 100;

        const block = document.createElement('div');
        block.className = `motion-scene-block ${sc.id === this.activeSceneId ? 'active' : ''}`;
        block.style.left = `${leftPct}%`;
        block.style.width = `${Math.max(1.5, widthPct)}%`;
        block.innerHTML = `
          <span class="motion-block-name">${sc.component}</span>
          <div class="motion-resize-handle"></div>
        `;

        block.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeSceneId = sc.id;
          this.updateInspector();
          this.renderTimeline();
          this.seekToFrame(sc.from);
        });

        // Simple drag repositioning
        this.makeBlockDraggable(block, sc, totalFrames);

        track.appendChild(block);
      }
    }
  }

  makeBlockDraggable(blockEl, scene, totalFrames) {
    let startX = 0;
    let originalFrom = scene.from;

    const onMouseDown = (e) => {
      if (e.target.classList.contains('motion-resize-handle')) {
        this.makeBlockResizable(e, scene, totalFrames);
        return;
      }
      e.stopPropagation();
      startX = e.clientX;
      originalFrom = scene.from;

      const onMouseMove = (ev) => {
        const rect = this.timelineTracks.getBoundingClientRect();
        const deltaPx = ev.clientX - startX;
        const deltaFrames = Math.round((deltaPx / rect.width) * totalFrames);
        scene.from = Math.max(0, Math.min(totalFrames - scene.durationInFrames, originalFrom + deltaFrames));
        this.renderTimeline();
        this.updateInspector();
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.updatePlayer();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    blockEl.addEventListener('mousedown', onMouseDown);
  }

  makeBlockResizable(e, scene, totalFrames) {
    e.stopPropagation();
    const startX = e.clientX;
    const originalDur = scene.durationInFrames;

    const onMouseMove = (ev) => {
      const rect = this.timelineTracks.getBoundingClientRect();
      const deltaPx = ev.clientX - startX;
      const deltaFrames = Math.round((deltaPx / rect.width) * totalFrames);
      scene.durationInFrames = Math.max(15, originalDur + deltaFrames);
      this.renderTimeline();
      this.updateInspector();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.updatePlayer();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  getActiveScene() {
    if (!this.currentPlan || !this.activeSceneId) return null;
    return this.currentPlan.scenes.find((s) => s.id === this.activeSceneId) || null;
  }

  updateInspector() {
    const sc = this.getActiveScene();
    if (!sc) {
      if (this.inspectorPane) this.inspectorPane.style.opacity = '0.5';
      return;
    }

    if (this.inspectorPane) this.inspectorPane.style.opacity = '1';

    if (this.activeComponentSelect) this.activeComponentSelect.value = sc.component;
    if (this.activeZoneSelect) this.activeZoneSelect.value = sc.zone;
    if (this.activeStartInput) this.activeStartInput.value = sc.from;
    if (this.activeDurInput) this.activeDurInput.value = sc.durationInFrames;

    // Attached SFX
    if (this.activeSfxSelect) {
      this.activeSfxSelect.value = sc.sfx && sc.sfx.length > 0 ? sc.sfx[0].id : 'none';
    }
    if (this.activeSfxVariantSelect) {
      this.activeSfxVariantSelect.value = sc.sfx && sc.sfx.length > 0 ? (sc.sfx[0].variant || 1) : 1;
    }

    this.buildPropsEditor(sc);
  }

  buildPropsEditor(scene) {
    if (!this.activePropsContainer) return;
    this.activePropsContainer.innerHTML = '';

    const props = scene.props || {};

    // Common editable text props based on component
    for (const [key, val] of Object.entries(props)) {
      if (typeof val === 'string' || typeof val === 'number') {
        const field = document.createElement('div');
        field.className = 'motion-field-row';
        field.innerHTML = `
          <label class="motion-field-label">${key}</label>
          <input type="${typeof val === 'number' ? 'number' : 'text'}" class="input-text motion-prop-input" value="${val}" data-prop="${key}" />
        `;
        const inp = field.querySelector('.motion-prop-input');
        inp.addEventListener('input', (e) => {
          scene.props[key] = typeof val === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
          this.updatePlayer();
        });
        this.activePropsContainer.appendChild(field);
      } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        // Bullet points / lists
        const field = document.createElement('div');
        field.className = 'motion-field-group';
        field.innerHTML = `<label class="motion-field-label">${key} (items)</label>`;
        val.forEach((item, bIdx) => {
          const bRow = document.createElement('input');
          bRow.type = 'text';
          bRow.className = 'input-text motion-prop-input';
          bRow.style.marginBottom = '6px';
          bRow.value = item;
          bRow.addEventListener('input', (e) => {
            scene.props[key][bIdx] = e.target.value;
            this.updatePlayer();
          });
          field.appendChild(bRow);
        });
        this.activePropsContainer.appendChild(field);
      }
    }
  }

  addNewSceneAtPlayhead(componentId, defaultZone) {
    if (!this.currentPlan) return;

    const fps = this.currentPlan.fps || 30;
    const dur = Math.round(fps * 3.5);

    const newScene = {
      id: `scene_${Date.now()}`,
      component: componentId,
      zone: defaultZone || 'T',
      from: this.currentFrame,
      durationInFrames: dur,
      props: {
        title: 'NUEVO TÍTULO',
        subtitle: 'CINETISMO VENEZOLANO',
        heading: 'PUNTOS CLAVE',
        subtext: 'SUBTÍTULO',
        text: 'NUEVO BLOQUE',
        bullets: ['Concepto 1', 'Concepto 2', 'Concepto 3'],
      },
      sfx: [{ id: 'SFX_PAPER_SNAP', at: 0, variant: 1, volume: 0.35 }],
      source: 'manual',
    };

    this.currentPlan.scenes.push(newScene);
    this.activeSceneId = newScene.id;
    this.renderTimeline();
    this.updateInspector();
    this.updatePlayer();
  }

  deleteActiveScene() {
    if (!this.currentPlan || !this.activeSceneId) return;
    this.currentPlan.scenes = this.currentPlan.scenes.filter((s) => s.id !== this.activeSceneId);
    this.activeSceneId = this.currentPlan.scenes.length > 0 ? this.currentPlan.scenes[0].id : null;
    this.renderTimeline();
    this.updateInspector();
    this.updatePlayer();
  }

  duplicateActiveScene() {
    const sc = this.getActiveScene();
    if (!sc || !this.currentPlan) return;

    const dup = JSON.parse(JSON.stringify(sc));
    dup.id = `scene_${Date.now()}`;
    dup.from = dup.from + dup.durationInFrames + 10;

    this.currentPlan.scenes.push(dup);
    this.activeSceneId = dup.id;
    this.renderTimeline();
    this.updateInspector();
    this.updatePlayer();
  }

  async handleRedraftPlan() {
    if (!this.currentPlan) return;
    try {
      if (this.redraftBtn) this.redraftBtn.disabled = true;
      const res = await fetch('/api/motion/draft-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.currentPlan.source?.path,
          platform: this.currentPlan.platform,
          seed: this.currentPlan.seed,
        }),
      });
      if (!res.ok) throw new Error('Failed to redraft plan');
      const data = await res.json();
      this.currentPlan = data.plan;
      this.initWorkspace();
      if (window.showToast) window.showToast('Fresh scene plan drafted from SRT!', 'success');
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
    } finally {
      if (this.redraftBtn) this.redraftBtn.disabled = false;
    }
  }

  async startRender() {
    if (!this.currentPlan) return;

    try {
      if (this.renderBtn) this.renderBtn.disabled = true;

      // Ensure plan preview overlays are off for rendering
      const exportPlan = JSON.parse(JSON.stringify(this.currentPlan));
      if (exportPlan.preview) {
        exportPlan.preview.showSourceVideo = false;
        exportPlan.preview.showSafeZones = false;
      }

      const res = await fetch('/api/motion/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: exportPlan,
          filename: `${exportPlan.slug}_prores4444.mov`,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start render');
      }

      const data = await res.json();
      this.renderTaskId = data.task_id;
      this.showRenderModal();
      this.startProgressPolling();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
      if (this.renderBtn) this.renderBtn.disabled = false;
    }
  }

  showRenderModal() {
    if (this.renderModal) this.renderModal.classList.add('open');
    if (this.renderProgressBar) this.renderProgressBar.style.width = '0%';
    if (this.renderPercentText) this.renderPercentText.textContent = '0%';
    if (this.renderFrameText) this.renderFrameText.textContent = 'Starting Remotion engine...';
  }

  hideRenderModal() {
    if (this.renderModal) this.renderModal.classList.remove('open');
    if (this.renderBtn) this.renderBtn.disabled = false;
  }

  startProgressPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      if (!this.renderTaskId) return;

      try {
        const res = await fetch(`/api/motion/progress/${this.renderTaskId}`);
        if (!res.ok) return;
        const task = await res.json();

        if (this.renderProgressBar) this.renderProgressBar.style.width = `${task.percent}%`;
        if (this.renderPercentText) this.renderPercentText.textContent = `${task.percent}%`;
        if (this.renderFrameText) this.renderFrameText.textContent = `Frame ${task.frame} / ${task.total_frames}`;
        if (this.renderFpsText) this.renderFpsText.textContent = `${task.fps} FPS`;
        if (this.renderEtaText) this.renderEtaText.textContent = `ETA: ${task.eta_s}s`;

        if (task.status === 'completed') {
          clearInterval(this.pollInterval);
          this.hideRenderModal();
          if (window.showToast) {
            window.showToast(`ProRes 4444 saved directly to ~/Downloads/${task.result.filename}!`, 'success');
          }
          // Show DaVinci Resolve import guide
          const modal = document.getElementById('davinciModalOverlay');
          if (modal) modal.classList.add('open');
        } else if (task.status === 'error' || task.status === 'cancelled') {
          clearInterval(this.pollInterval);
          this.hideRenderModal();
          if (window.showToast) window.showToast(`Render failed: ${task.error}`, 'error');
        }
      } catch (err) {
        console.warn('Progress poll error:', err);
      }
    }, 700);
  }

  async cancelRender() {
    if (!this.renderTaskId) return;
    try {
      await fetch(`/api/motion/cancel/${this.renderTaskId}`, { method: 'POST' });
      clearInterval(this.pollInterval);
      this.hideRenderModal();
      if (window.showToast) window.showToast('Render cancelled', 'warning');
    } catch (err) {
      console.warn('Cancel error:', err);
    }
  }
}

// Attach globally
window.MotionGraphicsStudio = MotionGraphicsStudio;
