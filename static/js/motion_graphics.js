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
    this.subtitlesStep = document.getElementById('motionSubtitlesStep');
    this.workspaceStep = document.getElementById('motionWorkspaceStep');

    // Subtitle review elements
    this.subtitlesVideo = document.getElementById('motionSubtitlesVideo');
    this.subtitlesOverlay = document.getElementById('motionSubtitlesOverlay');
    this.subVideoPlayBtn = document.getElementById('motionSubVideoPlayBtn');
    this.subVideoPlayIcon = document.getElementById('motionSubVideoPlayIcon');
    this.subVideoTime = document.getElementById('motionSubVideoTime');
    this.subVideoFpsBadge = document.getElementById('motionSubVideoFpsBadge');
    this.subtitlesList = document.getElementById('motionSubtitlesList');
    this.subtitlesCountBadge = document.getElementById('motionSubtitlesCountBadge');
    this.addSubCueBtn = document.getElementById('motionAddSubCueBtn');
    this.subtitlesBackBtn = document.getElementById('motionSubtitlesBackBtn');
    this.subtitlesSkipBtn = document.getElementById('motionSubtitlesSkipBtn');
    this.subtitlesConfirmBtn = document.getElementById('motionSubtitlesConfirmBtn');
    this.confirmSpinner = document.getElementById('motionConfirmSpinner');
    this.confirmBtnText = document.getElementById('motionConfirmBtnText');
    this.editSubtitlesFromStudioBtn = document.getElementById('motionEditSubtitlesFromStudioBtn');

    this.currentCues = [];
    this.loadedMediaData = null;

    // Load inputs & progress elements
    this.pathInput = document.getElementById('motionPathInput');
    this.loadPathBtn = document.getElementById('motionLoadPathBtn');
    this.loadSpinner = document.getElementById('motionLoadSpinner');
    this.loadBtnText = document.getElementById('motionLoadBtnText');
    this.dropzone = document.getElementById('motionDropzone');
    this.fileInput = document.getElementById('motionFileInput');
    this.srtPathInput = document.getElementById('motionSrtPathInput');
    this.loadProgressCard = document.getElementById('motionLoadProgressCard');
    this.progressTitle = document.getElementById('motionProgressTitle');
    this.progressSubtitle = document.getElementById('motionProgressSubtitle');

    // Header controls
    this.slugText = document.getElementById('motionSlugText');
    this.fpsBadge = document.getElementById('motionFpsBadge');
    this.durationBadge = document.getElementById('motionDurationBadge');
    this.depthModeSelect = document.getElementById('motionDepthModeSelect');
    this.platformSelect = document.getElementById('motionPlatformSelect');
    this.safeZoneToggle = document.getElementById('motionSafeZoneToggle');
    this.showVideoToggle = document.getElementById('motionShowVideoToggle');
    this.audioToggle = document.getElementById('motionAudioToggle');
    this.redraftBtn = document.getElementById('motionRedraftBtn');
    this.renderBtn = document.getElementById('motionRenderBtn');
    this.renderMp4Btn = document.getElementById('motionRenderMp4Btn');
    this.renderModalTitle = document.getElementById('motionRenderModalTitle');
    this.renderModalDesc = document.getElementById('motionRenderModalDesc');
    this.currentRenderFormat = 'mp4';

    // Player controls
    this.playerContainer = document.getElementById('motionPlayerContainer');
    this.playBtn = document.getElementById('motionPlayBtn');
    this.stepBackBtn = document.getElementById('motionStepBackBtn');
    this.stepFwdBtn = document.getElementById('motionStepFwdBtn');
    this.muteToggleBtn = document.getElementById('motionMuteToggleBtn');
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
    this.renderProgressContainer = document.getElementById('motionRenderProgressContainer');
    this.renderProgressBar = document.getElementById('motionRenderProgressBar');
    this.renderPercentText = document.getElementById('motionRenderPercentText');
    this.renderFrameText = document.getElementById('motionRenderFrameText');
    this.renderFpsText = document.getElementById('motionRenderFpsText');
    this.renderEtaText = document.getElementById('motionRenderEtaText');
    this.renderStatsRow1 = document.getElementById('motionRenderStatsRow1');
    this.renderStatsRow2 = document.getElementById('motionRenderStatsRow2');
    this.renderSuccessActions = document.getElementById('motionRenderSuccessActions');
    this.renderDownloadLink = document.getElementById('motionRenderDownloadLink');
    this.renderCloseModalBtn = document.getElementById('motionRenderCloseModalBtn');
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

    if (this.audioToggle) {
      this.audioToggle.addEventListener('change', () => {
        if (!this.currentPlan) return;
        this.currentPlan.preview = this.currentPlan.preview || {};
        this.currentPlan.preview.muteSource = !this.audioToggle.checked;
        this.updateAudioButtonState();
        this.updatePlayer();
      });
    }

    if (this.muteToggleBtn) {
      this.muteToggleBtn.addEventListener('click', () => {
        if (!this.currentPlan) return;
        this.currentPlan.preview = this.currentPlan.preview || {};
        this.currentPlan.preview.muteSource = !this.currentPlan.preview.muteSource;
        if (this.audioToggle) this.audioToggle.checked = !this.currentPlan.preview.muteSource;
        this.updateAudioButtonState();
        this.updatePlayer();
      });
    }

    if (this.redraftBtn) {
      this.redraftBtn.addEventListener('click', () => this.handleRedraftPlan());
    }

    if (this.renderMp4Btn) {
      this.renderMp4Btn.addEventListener('click', () => this.startRender('mp4'));
    }

    if (this.renderBtn) {
      this.renderBtn.addEventListener('click', () => this.startRender('prores'));
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

    if (this.renderCloseModalBtn) {
      this.renderCloseModalBtn.addEventListener('click', () => this.hideRenderModal());
    }

    // Subtitle Review Step events
    if (this.subVideoPlayBtn) {
      this.subVideoPlayBtn.addEventListener('click', () => this.toggleSubVideoPlayback());
    }
    if (this.subtitlesVideo) {
      this.subtitlesVideo.addEventListener('timeupdate', () => this.onSubVideoTimeUpdate());
      this.subtitlesVideo.addEventListener('play', () => {
        if (this.subVideoPlayIcon) this.subVideoPlayIcon.textContent = '⏸';
      });
      this.subtitlesVideo.addEventListener('pause', () => {
        if (this.subVideoPlayIcon) this.subVideoPlayIcon.textContent = '▶';
      });
    }
    if (this.subtitlesBackBtn) {
      this.subtitlesBackBtn.addEventListener('click', () => this.backToLoadStep());
    }
    if (this.subtitlesSkipBtn) {
      this.subtitlesSkipBtn.addEventListener('click', () => this.skipSubtitlesToStudio());
    }
    if (this.subtitlesConfirmBtn) {
      this.subtitlesConfirmBtn.addEventListener('click', () => this.confirmSubtitlesAndProceed());
    }
    if (this.addSubCueBtn) {
      this.addSubCueBtn.addEventListener('click', () => this.addNewSubtitleCue());
    }
    if (this.editSubtitlesFromStudioBtn) {
      this.editSubtitlesFromStudioBtn.addEventListener('click', () => this.openSubtitlesReviewStep());
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

  setLoadProgress(stepIndex, title, subtitle) {
    if (this.loadProgressCard) this.loadProgressCard.style.display = 'block';
    if (this.progressTitle && title) this.progressTitle.textContent = title;
    if (this.progressSubtitle && subtitle) this.progressSubtitle.textContent = subtitle;

    for (let i = 1; i <= 4; i++) {
      const chip = document.getElementById(`mStep${i}`);
      if (!chip) continue;
      if (i < stepIndex) {
        chip.className = 'motion-step-chip completed';
        const icon = chip.querySelector('.step-icon');
        if (icon) icon.textContent = '✓';
      } else if (i === stepIndex) {
        chip.className = 'motion-step-chip active';
        const icon = chip.querySelector('.step-icon');
        if (icon) icon.textContent = String(i);
      } else {
        chip.className = 'motion-step-chip';
        const icon = chip.querySelector('.step-icon');
        if (icon) icon.textContent = String(i);
      }
    }
  }

  resetLoadProgress() {
    if (this.loadProgressCard) this.loadProgressCard.style.display = 'none';
    for (let i = 1; i <= 4; i++) {
      const chip = document.getElementById(`mStep${i}`);
      if (!chip) continue;
      chip.className = i === 1 ? 'motion-step-chip active' : 'motion-step-chip';
      const icon = chip.querySelector('.step-icon');
      if (icon) icon.textContent = String(i);
    }
  }

  async handleLoadPath() {
    const rawPath = (this.pathInput?.value || '').trim();
    if (!rawPath) {
      if (window.showToast) window.showToast('Please enter a video file path on your Mac', 'error');
      return;
    }

    const srtPath = (this.srtPathInput ? this.srtPathInput.value : '').trim();
    const directorStyle = document.getElementById('motionDirectorStyleSelect')?.value || 'story_tuxedo';
    const renderMode = document.getElementById('motionRenderModeSelect')?.value || 'overlays_only_for_davinci';

    let progressTimer = null;

    try {
      if (this.loadPathBtn) {
        this.loadPathBtn.disabled = true;
        if (this.loadSpinner) this.loadSpinner.style.display = 'inline-block';
        if (this.loadBtnText) this.loadBtnText.textContent = 'Analyzing Video & Dialogue...';
      }

      this.setLoadProgress(1, 'Inspecting Media File...', 'Extracting video framerate, duration, and audio stream...');

      let elapsed = 0;
      progressTimer = setInterval(() => {
        elapsed += 1;
        if (elapsed === 2) {
          this.setLoadProgress(2, 'Transcribing Dialogue with Whisper...', 'Detecting speech timestamps and aligning words for kinetic typography...');
        } else if (elapsed === 7) {
          this.setLoadProgress(3, 'Tracking Subject Motion...', 'Calculating subject bounding boxes and 9:16 safe placement zones...');
        } else if (elapsed === 12) {
          this.setLoadProgress(4, 'Directing Comedic Scene Plan...', 'Prompting Gemini Flash to pick punchlines, visual metaphors, and sound effects...');
        }
      }, 1000);

      const res = await fetch('/api/motion/load-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: rawPath,
          srt_path: srtPath || null,
          director_style: directorStyle,
          render_mode: renderMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load video file');
      }

      const data = await res.json();

      // Mark all completed
      this.setLoadProgress(5, 'Ready!', 'Subtitles extracted and ready for verification.');

      this.loadedMediaData = data;
      this.currentPlan = data.plan;
      this.currentCues = (data.cues && data.cues.length > 0) ? data.cues : (data.plan?.cues || []);

      // Transition to Subtitle Review Step first
      this.openSubtitlesReviewStep();

      if (window.showToast) {
        window.showToast(`Transcribed ${data.filename}! Review and edit your subtitles below.`, 'success');
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
      this.resetLoadProgress();
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      if (this.loadPathBtn) {
        this.loadPathBtn.disabled = false;
        if (this.loadSpinner) this.loadSpinner.style.display = 'none';
        if (this.loadBtnText) this.loadBtnText.textContent = 'Load Footage Into Studio';
      }
    }
  }

  async handleFileUpload(file) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    this.setLoadProgress(1, `Uploading ${file.name} (${sizeMb} MB)...`, 'Transferring video file to studio workspace...');
    if (this.loadPathBtn) {
      this.loadPathBtn.disabled = true;
      if (this.loadSpinner) this.loadSpinner.style.display = 'inline-block';
      if (this.loadBtnText) this.loadBtnText.textContent = `Uploading ${file.name}...`;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/magic-mask/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload file');
      const data = await res.json();
      if (this.pathInput) this.pathInput.value = data.media_path;
      this.handleLoadPath();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
      this.resetLoadProgress();
      if (this.loadPathBtn) {
        this.loadPathBtn.disabled = false;
        if (this.loadSpinner) this.loadSpinner.style.display = 'none';
        if (this.loadBtnText) this.loadBtnText.textContent = 'Load Footage Into Studio';
      }
    }
  }

  initWorkspace() {
    if (!this.currentPlan) return;

    // Normalize StoryTuxedo cues into scenes if scenes not pre-populated
    if (this.currentPlan.cues && (!this.currentPlan.scenes || this.currentPlan.scenes.length === 0)) {
      const fps = this.currentPlan.fps || 30;
      this.currentPlan.scenes = this.currentPlan.cues.map((c, idx) => ({
        id: c.id || `cue_${idx + 1}`,
        component: c.component,
        zone: c.layer === 'behind_subject' ? 'T' : (c.position === 'bottom-left' ? 'L' : 'R'),
        from: Math.round(c.startTime * fps),
        durationInFrames: Math.max(15, Math.round((c.endTime - c.startTime) * fps)),
        props: {
          headlineText: c.headlineText,
          subText: c.subText || '',
          emojiOrIcon: c.emojiOrIcon || '🔥',
          accentColor: c.accentColor || '#FACC15',
          position: c.position || 'bottom-right',
        },
        sfx: [{ id: c.sfxFile || 'pop.mp3', at: 0, variant: 1, volume: 0.4 }],
        layer: c.layer,
      }));
    }

    if (this.subtitlesVideo) this.subtitlesVideo.pause();
    if (this.loadStep) this.loadStep.style.display = 'none';
    if (this.subtitlesStep) this.subtitlesStep.style.display = 'none';
    if (this.workspaceStep) this.workspaceStep.style.display = 'grid';

    // Set preview defaults: show source video & enable audio
    this.currentPlan.preview = this.currentPlan.preview || {};
    if (this.currentPlan.preview.showSourceVideo === undefined) {
      this.currentPlan.preview.showSourceVideo = true;
    }
    if (this.currentPlan.preview.muteSource === undefined) {
      this.currentPlan.preview.muteSource = false;
    }
    if (this.showVideoToggle) this.showVideoToggle.checked = this.currentPlan.preview.showSourceVideo;
    if (this.audioToggle) this.audioToggle.checked = !this.currentPlan.preview.muteSource;
    this.updateAudioButtonState();

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
    if (this.currentPlan.scenes && this.currentPlan.scenes.length > 0) {
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

  updateAudioButtonState() {
    if (!this.muteToggleBtn) return;
    const isMuted = Boolean(this.currentPlan?.preview?.muteSource);
    if (isMuted) {
      this.muteToggleBtn.textContent = '🔇 Muted';
      this.muteToggleBtn.classList.add('muted');
    } else {
      this.muteToggleBtn.textContent = '🔊 Audio On';
      this.muteToggleBtn.classList.remove('muted');
    }
  }

  buildPropsEditor(scene) {
    if (!this.activePropsContainer) return;
    this.activePropsContainer.innerHTML = '';

    const props = scene.props || {};

    const labelMap = {
      headlineText: 'Headline text',
      subText: 'Secondary text / subtext',
      emojiOrIcon: 'Emoji or icon',
      accentColor: 'Brand accent color',
      position: 'Screen position',
      sfxFile: 'Sound effect',
      title: 'Title',
      subtitle: 'Subtitle',
      heading: 'Heading',
      text: 'Body text',
      bullets: 'Bullet list items',
      category: 'Category tag',
    };

    const card = document.createElement('div');
    card.className = 'motion-props-card';

    for (const [key, val] of Object.entries(props)) {
      const field = document.createElement('div');
      field.className = 'motion-field-row';
      const labelText = labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

      if (key === 'accentColor') {
        const brandColors = [
          { color: '#FACC15', label: 'Gold' },
          { color: '#38BDF8', label: 'Sky' },
          { color: '#F43F5E', label: 'Rose' },
          { color: '#4ADE80', label: 'Emerald' },
          { color: '#A855F7', label: 'Purple' },
          { color: '#D97757', label: 'Terracotta' },
        ];
        field.innerHTML = `
          <label class="motion-field-label">${labelText}</label>
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <input type="text" class="input-text motion-prop-input" value="${val}" data-prop="${key}" style="max-width: 130px; font-family: var(--font-mono); font-size: 0.85rem;" />
            <div class="motion-color-swatches"></div>
          </div>
        `;
        const swatchesContainer = field.querySelector('.motion-color-swatches');
        const inp = field.querySelector('.motion-prop-input');
        brandColors.forEach((bc) => {
          const chip = document.createElement('div');
          chip.className = `motion-color-chip ${val.toUpperCase() === bc.color.toUpperCase() ? 'active' : ''}`;
          chip.style.backgroundColor = bc.color;
          chip.title = `${bc.label} (${bc.color})`;
          chip.addEventListener('click', () => {
            scene.props[key] = bc.color;
            inp.value = bc.color;
            swatchesContainer.querySelectorAll('.motion-color-chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            this.updatePlayer();
          });
          swatchesContainer.appendChild(chip);
        });
        inp.addEventListener('input', (e) => {
          scene.props[key] = e.target.value;
          swatchesContainer.querySelectorAll('.motion-color-chip').forEach((c) => {
            c.classList.toggle('active', c.style.backgroundColor.toUpperCase() === e.target.value.toUpperCase());
          });
          this.updatePlayer();
        });
        card.appendChild(field);
      } else if (key === 'emojiOrIcon') {
        const popularEmojis = ['🔥', '💀', '👀', '⚡', '😂', '🚨', '🎯', '💡', '✨'];
        field.innerHTML = `
          <label class="motion-field-label">${labelText}</label>
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <input type="text" class="input-text motion-prop-input" value="${val}" data-prop="${key}" style="max-width: 90px; font-size: 1.25rem; text-align: center;" />
            <div class="motion-emoji-swatches"></div>
          </div>
        `;
        const emojiContainer = field.querySelector('.motion-emoji-swatches');
        const inp = field.querySelector('.motion-prop-input');
        popularEmojis.forEach((em) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'motion-emoji-chip';
          chip.textContent = em;
          chip.addEventListener('click', () => {
            scene.props[key] = em;
            inp.value = em;
            this.updatePlayer();
          });
          emojiContainer.appendChild(chip);
        });
        inp.addEventListener('input', (e) => {
          scene.props[key] = e.target.value;
          this.updatePlayer();
        });
        card.appendChild(field);
      } else if (key === 'position') {
        field.innerHTML = `
          <label class="motion-field-label">${labelText}</label>
          <select class="motion-select motion-prop-input" data-prop="${key}">
            <option value="bottom-right" ${val === 'bottom-right' ? 'selected' : ''}>Bottom Right (Subtle corner)</option>
            <option value="bottom-left" ${val === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
            <option value="center" ${val === 'center' ? 'selected' : ''}>Center (Maximum impact)</option>
            <option value="top" ${val === 'top' ? 'selected' : ''}>Top Canopy</option>
          </select>
        `;
        const sel = field.querySelector('.motion-prop-input');
        sel.addEventListener('change', (e) => {
          scene.props[key] = e.target.value;
          this.updatePlayer();
        });
        card.appendChild(field);
      } else if (typeof val === 'string' || typeof val === 'number') {
        field.innerHTML = `
          <label class="motion-field-label">${labelText}</label>
          <input type="${typeof val === 'number' ? 'number' : 'text'}" class="input-text motion-prop-input" value="${val}" data-prop="${key}" />
        `;
        const inp = field.querySelector('.motion-prop-input');
        inp.addEventListener('input', (e) => {
          scene.props[key] = typeof val === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
          this.updatePlayer();
        });
        card.appendChild(field);
      } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        field.innerHTML = `<label class="motion-field-label">${labelText}</label>`;
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
        card.appendChild(field);
      }
    }

    this.activePropsContainer.appendChild(card);
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
      const directorStyle = document.getElementById('motionDirectorStyleSelect')?.value || this.currentPlan.directorStyle || 'story_tuxedo';
      const renderMode = document.getElementById('motionRenderModeSelect')?.value || this.currentPlan.renderMode || 'overlays_only_for_davinci';

      const res = await fetch('/api/motion/draft-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.currentPlan.source?.path,
          platform: this.currentPlan.platform,
          seed: this.currentPlan.seed,
          director_style: directorStyle,
          render_mode: renderMode,
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

  async startRender(format = 'mp4') {
    if (!this.currentPlan) return;

    this.currentRenderFormat = format;

    try {
      if (this.renderBtn) this.renderBtn.disabled = true;
      if (this.renderMp4Btn) this.renderMp4Btn.disabled = true;

      const exportPlan = JSON.parse(JSON.stringify(this.currentPlan));
      const slug = exportPlan.slug || 'story_video';
      let defaultFilename = '';

      if (format === 'mp4') {
        exportPlan.renderMode = 'full_composite';
        exportPlan.previewMode = false;
        exportPlan.showVideo = true;
        if (exportPlan.preview) {
          exportPlan.preview.showSourceVideo = true;
          exportPlan.preview.showSafeZones = false;
          exportPlan.preview.muteSource = false;
        }
        defaultFilename = `${slug}_1080x1920_composite.mp4`;
      } else {
        exportPlan.renderMode = 'overlays_only_for_davinci';
        exportPlan.previewMode = false;
        exportPlan.showVideo = false;
        if (exportPlan.preview) {
          exportPlan.preview.showSourceVideo = false;
          exportPlan.preview.showSafeZones = false;
        }
        defaultFilename = `${slug}_prores4444.mov`;
      }

      this.showRenderModal(format);

      const res = await fetch('/api/motion/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: exportPlan,
          filename: defaultFilename,
          export_format: format,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start render');
      }

      const data = await res.json();
      this.renderTaskId = data.task_id;
      this.startProgressPolling();
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
      this.hideRenderModal();
      if (this.renderBtn) this.renderBtn.disabled = false;
      if (this.renderMp4Btn) this.renderMp4Btn.disabled = false;
    }
  }

  showRenderModal(format = 'mp4') {
    if (this.renderModalTitle) {
      this.renderModalTitle.textContent =
        format === 'mp4' ? '⚡ Rendering 1080x1920 HD MP4 Video' : '🎬 Rendering Apple ProRes 4444 Alpha';
    }
    if (this.renderModalDesc) {
      this.renderModalDesc.textContent =
        format === 'mp4'
          ? 'Rendering original video combined with motion graphics, subtitles, and audio in 1080x1920 HD...'
          : 'Rendering 1080x1920 frames with transparent alpha channel and synced sound effects...';
    }
    if (this.renderProgressContainer) this.renderProgressContainer.style.display = 'block';
    if (this.renderStatsRow1) this.renderStatsRow1.style.display = 'flex';
    if (this.renderStatsRow2) this.renderStatsRow2.style.display = 'flex';
    if (this.renderSuccessActions) this.renderSuccessActions.style.display = 'none';
    if (this.renderCancelBtn) this.renderCancelBtn.style.display = 'inline-block';

    if (this.renderProgressBar) this.renderProgressBar.style.width = '0%';
    if (this.renderPercentText) this.renderPercentText.textContent = '0%';
    if (this.renderFrameText) this.renderFrameText.textContent = 'Starting Remotion engine...';
    if (this.renderFpsText) this.renderFpsText.textContent = '0 FPS';
    if (this.renderEtaText) this.renderEtaText.textContent = 'ETA: --';

    if (this.renderModal) this.renderModal.classList.add('open');
  }

  hideRenderModal() {
    if (this.renderModal) this.renderModal.classList.remove('open');
    if (this.renderBtn) this.renderBtn.disabled = false;
    if (this.renderMp4Btn) this.renderMp4Btn.disabled = false;
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
          const outName = task.result ? task.result.filename : (this.currentRenderFormat === 'mp4' ? 'video.mp4' : 'overlays.mov');

          if (this.renderProgressBar) this.renderProgressBar.style.width = '100%';
          if (this.renderPercentText) this.renderPercentText.textContent = '100%';
          if (this.renderFrameText) this.renderFrameText.textContent = 'Render Complete!';
          if (this.renderFpsText) this.renderFpsText.textContent = '';
          if (this.renderEtaText) this.renderEtaText.textContent = 'Finished';

          if (this.renderModalTitle) {
            this.renderModalTitle.textContent =
              this.currentRenderFormat === 'mp4' ? '🎉 1080x1920 HD MP4 Video Ready!' : '🎉 Apple ProRes 4444 Alpha Ready!';
          }
          if (this.renderModalDesc) {
            this.renderModalDesc.textContent =
              this.currentRenderFormat === 'mp4'
                ? `Saved directly to ~/Downloads/${outName}. Click below to download directly to your browser:`
                : `Saved directly to ~/Downloads/${outName} with 10-bit alpha for DaVinci Resolve.`;
          }

          if (this.renderSuccessActions) this.renderSuccessActions.style.display = 'flex';
          if (this.renderCancelBtn) this.renderCancelBtn.style.display = 'none';

          if (this.renderDownloadLink) {
            this.renderDownloadLink.href = `/api/motion/download/${encodeURIComponent(outName)}`;
            this.renderDownloadLink.download = outName;
            this.renderDownloadLink.textContent =
              this.currentRenderFormat === 'mp4' ? '⬇️ Download MP4 (1080x1920 HD)' : '⬇️ Download ProRes 4444 (.mov)';
          }

          if (this.renderBtn) this.renderBtn.disabled = false;
          if (this.renderMp4Btn) this.renderMp4Btn.disabled = false;

          // Trigger automatic browser download
          try {
            const dlLink = document.createElement('a');
            dlLink.href = `/api/motion/download/${encodeURIComponent(outName)}`;
            dlLink.download = outName;
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
          } catch (dlErr) {
            console.warn('Auto download trigger error:', dlErr);
          }

          if (this.currentRenderFormat === 'mp4') {
            if (window.showToast) {
              window.showToast(`1080x1920 HD MP4 saved to ~/Downloads/${outName}!`, 'success');
            }
          } else {
            if (window.showToast) {
              window.showToast(`ProRes 4444 saved directly to ~/Downloads/${outName}!`, 'success');
            }
            const modal = document.getElementById('davinciModalOverlay');
            if (modal) modal.classList.add('open');
          }
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

  // -------------------------------------------------------------
  // Subtitle Review & Editing Methods
  // -------------------------------------------------------------

  openSubtitlesReviewStep() {
    if (this.loadStep) this.loadStep.style.display = 'none';
    if (this.workspaceStep) this.workspaceStep.style.display = 'none';
    if (this.subtitlesStep) this.subtitlesStep.style.display = 'block';

    // Pause studio Remotion player if playing
    if (this.isPlaying) {
      this.togglePlayback();
    }

    // Set video source in preview player
    const filename = this.loadedMediaData?.filename || this.currentPlan?.videoFileName || '';
    const videoUrl = this.currentPlan?.source?.url || (filename ? `/public/${filename}` : '');
    if (this.subtitlesVideo && videoUrl && (!this.subtitlesVideo.src || !this.subtitlesVideo.src.includes(filename))) {
      this.subtitlesVideo.src = videoUrl;
      this.subtitlesVideo.load();
    }

    const fps = Math.round(this.loadedMediaData?.fps || this.currentPlan?.fps || 30);
    if (this.subVideoFpsBadge) {
      this.subVideoFpsBadge.textContent = `${fps} FPS`;
    }

    // Ensure cues are available
    if (!this.currentCues || this.currentCues.length === 0) {
      if (this.currentPlan?.cues && this.currentPlan.cues.length > 0) {
        this.currentCues = this.currentPlan.cues;
      }
    }

    this.renderSubtitlesList();

    if (this.subtitlesList) this.subtitlesList.scrollTop = 0;
  }

  renderSubtitlesList() {
    if (!this.subtitlesList) return;
    this.subtitlesList.innerHTML = '';

    if (this.subtitlesCountBadge) {
      const count = this.currentCues ? this.currentCues.length : 0;
      this.subtitlesCountBadge.textContent = `${count} ${count === 1 ? 'cue' : 'cues'}`;
    }

    if (!this.currentCues || this.currentCues.length === 0) {
      this.subtitlesList.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
          <p style="margin: 0; font-size: 0.95rem;">No subtitles detected yet.</p>
          <p style="margin: 0.4rem 0 1rem; font-size: 0.82rem;">Click <strong>+ Add Cue</strong> to write subtitles manually.</p>
        </div>
      `;
      return;
    }

    this.currentCues.forEach((cue, idx) => {
      const cueItem = document.createElement('div');
      cueItem.className = 'motion-cue-item';
      cueItem.id = `motionCueItem_${idx}`;

      const cueStart = typeof cue.start === 'number' ? cue.start : 0;
      const cueEnd = typeof cue.end === 'number' ? cue.end : cueStart + 1.5;

      cueItem.innerHTML = `
        <div class="motion-cue-top">
          <span class="motion-cue-num">#${idx + 1}</span>
          <button type="button" class="motion-cue-time-badge" title="Click to listen to this phrase">
            ▶ <span>${this.formatSeconds(cueStart)} ➔ ${this.formatSeconds(cueEnd)}</span>
          </button>
          <div class="motion-cue-time-inputs">
            <span>In:</span>
            <input type="number" step="0.05" min="0" class="motion-cue-time-input in-input" value="${cueStart.toFixed(2)}" title="Start time (seconds)">
            <span>Out:</span>
            <input type="number" step="0.05" min="0" class="motion-cue-time-input out-input" value="${cueEnd.toFixed(2)}" title="End time (seconds)">
          </div>
          <button type="button" class="motion-cue-delete-btn" title="Delete this cue">✕</button>
        </div>
        <textarea class="motion-cue-textarea" placeholder="Enter dialogue text...">${cue.text || ''}</textarea>
      `;

      // Click timecode badge to seek and play audio
      const timeBadge = cueItem.querySelector('.motion-cue-time-badge');
      timeBadge?.addEventListener('click', () => {
        if (this.subtitlesVideo) {
          this.subtitlesVideo.currentTime = Math.max(0, cue.start - 0.05);
          this.subtitlesVideo.play();
        }
      });

      // Text input changes
      const textarea = cueItem.querySelector('.motion-cue-textarea');
      textarea?.addEventListener('input', (e) => {
        cue.text = e.target.value;
        const curTime = this.subtitlesVideo ? this.subtitlesVideo.currentTime : 0;
        if (curTime >= cue.start && curTime <= cue.end && this.subtitlesOverlay) {
          this.subtitlesOverlay.textContent = cue.text;
        }
      });

      // In time input
      const inInput = cueItem.querySelector('.in-input');
      inInput?.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
          cue.start = val;
          const span = timeBadge ? timeBadge.querySelector('span') : null;
          if (span) span.textContent = `${this.formatSeconds(cue.start)} ➔ ${this.formatSeconds(cue.end)}`;
        }
      });

      // Out time input
      const outInput = cueItem.querySelector('.out-input');
      outInput?.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > cue.start) {
          cue.end = val;
          const span = timeBadge ? timeBadge.querySelector('span') : null;
          if (span) span.textContent = `${this.formatSeconds(cue.start)} ➔ ${this.formatSeconds(cue.end)}`;
        }
      });

      // Delete cue
      const delBtn = cueItem.querySelector('.motion-cue-delete-btn');
      delBtn?.addEventListener('click', () => {
        this.currentCues.splice(idx, 1);
        this.renderSubtitlesList();
      });

      this.subtitlesList.appendChild(cueItem);
    });
  }

  onSubVideoTimeUpdate() {
    if (!this.subtitlesVideo) return;
    const cur = this.subtitlesVideo.currentTime;
    const dur = this.subtitlesVideo.duration || this.loadedMediaData?.duration || 0;

    if (this.subVideoTime) {
      this.subVideoTime.textContent = `${this.formatSeconds(cur)} / ${this.formatSeconds(dur)}`;
    }

    // Find active cue
    let activeCue = null;
    let activeIdx = -1;
    if (this.currentCues) {
      for (let i = 0; i < this.currentCues.length; i++) {
        const c = this.currentCues[i];
        if (cur >= c.start && cur <= c.end) {
          activeCue = c;
          activeIdx = i;
          break;
        }
      }
    }

    // Update overlay text
    if (this.subtitlesOverlay) {
      if (activeCue && activeCue.text) {
        this.subtitlesOverlay.textContent = activeCue.text;
        this.subtitlesOverlay.classList.add('visible');
      } else {
        this.subtitlesOverlay.textContent = '';
        this.subtitlesOverlay.classList.remove('visible');
      }
    }

    // Highlight active cue in list
    if (this.subtitlesList) {
      const items = this.subtitlesList.querySelectorAll('.motion-cue-item');
      items.forEach((item, idx) => {
        if (idx === activeIdx) {
          item.classList.add('active');
          if (!item.matches(':hover')) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          item.classList.remove('active');
        }
      });
    }
  }

  toggleSubVideoPlayback() {
    if (!this.subtitlesVideo) return;
    if (this.subtitlesVideo.paused) {
      this.subtitlesVideo.play();
    } else {
      this.subtitlesVideo.pause();
    }
  }

  backToLoadStep() {
    if (this.subtitlesVideo) this.subtitlesVideo.pause();
    if (this.subtitlesStep) this.subtitlesStep.style.display = 'none';
    if (this.loadStep) this.loadStep.style.display = 'block';
  }

  skipSubtitlesToStudio() {
    if (this.subtitlesVideo) this.subtitlesVideo.pause();
    this.initWorkspace();
    if (window.showToast) {
      window.showToast('Opened Studio with current transcript.', 'info');
    }
  }

  async confirmSubtitlesAndProceed() {
    if (this.subtitlesVideo) this.subtitlesVideo.pause();

    const mediaPath = this.loadedMediaData?.media_path || this.currentPlan?.source?.path || (this.pathInput?.value || '').trim();
    if (!mediaPath) {
      if (window.showToast) window.showToast('Media path not found. Please reload video.', 'error');
      return;
    }

    try {
      if (this.subtitlesConfirmBtn) {
        this.subtitlesConfirmBtn.disabled = true;
        if (this.confirmSpinner) this.confirmSpinner.style.display = 'inline-block';
        if (this.confirmBtnText) this.confirmBtnText.textContent = 'Directing Motion with AI...';
      }

      const directorStyle = document.getElementById('motionDirectorStyleSelect')?.value || 'story_tuxedo';
      const renderMode = document.getElementById('motionRenderModeSelect')?.value || 'overlays_only_for_davinci';

      const res = await fetch('/api/motion/draft-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: mediaPath,
          cues: this.currentCues,
          director_style: directorStyle,
          render_mode: renderMode,
          mask_video_filename: this.loadedMediaData?.mask_video_filename || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update motion plan with edited subtitles');
      }

      const data = await res.json();
      if (data.plan) {
        this.currentPlan = data.plan;
      }

      // Transition to Studio workspace
      this.initWorkspace();

      if (window.showToast) {
        window.showToast('✨ Motion graphics generated with your verified subtitles!', 'success');
      }
    } catch (err) {
      if (window.showToast) window.showToast(err.message, 'error');
    } finally {
      if (this.subtitlesConfirmBtn) {
        this.subtitlesConfirmBtn.disabled = false;
        if (this.confirmSpinner) this.confirmSpinner.style.display = 'none';
        if (this.confirmBtnText) this.confirmBtnText.textContent = '✨ Confirm Subtitles & Open Studio ➔';
      }
    }
  }

  addNewSubtitleCue() {
    let newStart = 0;
    let newEnd = 2.0;

    if (this.currentCues && this.currentCues.length > 0) {
      const lastCue = this.currentCues[this.currentCues.length - 1];
      newStart = Math.round(((lastCue.end || 0) + 0.1) * 100) / 100;
      newEnd = Math.round((newStart + 2.0) * 100) / 100;
    } else if (this.subtitlesVideo) {
      newStart = Math.round(this.subtitlesVideo.currentTime * 100) / 100;
      newEnd = Math.round((newStart + 2.0) * 100) / 100;
    }

    const newCue = {
      id: `cue_${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: 'Nueva frase...',
      words: [
        { word: 'Nueva', start: newStart, end: Math.round((newStart + 1.0) * 100) / 100 },
        { word: 'frase...', start: Math.round((newStart + 1.0) * 100) / 100, end: newEnd },
      ],
    };

    if (!this.currentCues) this.currentCues = [];
    this.currentCues.push(newCue);
    this.renderSubtitlesList();

    if (this.subtitlesList) {
      this.subtitlesList.scrollTop = this.subtitlesList.scrollHeight;
    }
  }

  formatSeconds(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }
}

// Attach globally
window.MotionGraphicsStudio = MotionGraphicsStudio;
