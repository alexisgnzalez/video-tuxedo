/**
 * Video Tuxedo — Silence Cutter & Jump Cut Studio
 * - Silero VAD local detection
 * - Proportional visual cut timeline
 * - In-browser Jump-Cut Preview (skips silences live in playback)
 * - Single MP4, Multipart ZIP, DaVinci FCPXML/EDL, and Synced Subtitle exports
 */

class SilenceCutterStudio {
  constructor() {
    this.selectedFile = null;
    this.selectedPath = '';
    this.serverMediaPath = '';
    this.detectionData = null;
    this.skipSilencePlayback = true;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Mode tabs
    this.tabUploadBtn = document.getElementById('tabSilenceUploadBtn');
    this.tabPathBtn = document.getElementById('tabSilencePathBtn');
    this.tabDemoBtn = document.getElementById('tabSilenceDemoBtn');
    this.uploadSection = document.getElementById('silenceUploadSection');
    this.pathSection = document.getElementById('silencePathSection');

    // Inputs
    this.dropZone = document.getElementById('silenceDropZone');
    this.fileInput = document.getElementById('silenceFileInput');
    this.browseBtn = document.getElementById('browseSilenceBtn');
    this.pathInput = document.getElementById('silenceLocalPathInput');
    this.dropTitle = document.getElementById('silenceDropTitle');
    this.dropSubtitle = document.getElementById('silenceDropSubtitle');

    // Sliders & settings
    this.minSilenceSlider = document.getElementById('minSilenceSlider');
    this.minSilenceVal = document.getElementById('minSilenceVal');
    this.paddingSlider = document.getElementById('paddingSlider');
    this.paddingVal = document.getElementById('paddingVal');
    this.vadThresholdSlider = document.getElementById('vadThresholdSlider');
    this.vadThresholdVal = document.getElementById('vadThresholdVal');

    // Action button
    this.detectBtn = document.getElementById('detectSilencesBtn');
    this.btnSpinner = document.getElementById('silenceBtnSpinner');
    this.btnText = document.getElementById('silenceBtnText');

    // Results container
    this.resultsPanel = document.getElementById('silenceResultsPanel');
    this.metricOriginal = document.getElementById('metricOriginalDur');
    this.metricSpeech = document.getElementById('metricSpeechDur');
    this.metricSaved = document.getElementById('metricSavedDur');
    this.metricCuts = document.getElementById('metricCutsCount');

    // Timeline & Player
    this.cutTimelineBar = document.getElementById('cutTimelineBar');
    this.timelineTooltip = document.getElementById('timelineTooltip');
    this.silenceVideoPlayer = document.getElementById('silenceVideoPlayer');
    this.playCutsToggle = document.getElementById('playCutsOnlyToggle');
    this.playOriginalToggle = document.getElementById('playOriginalToggle');
    this.segmentsListContainer = document.getElementById('silenceSegmentsList');

    // Export Buttons
    this.exportSingleMp4Btn = document.getElementById('exportSingleMp4Btn');
    this.exportMultipartZipBtn = document.getElementById('exportMultipartZipBtn');
    this.exportFcpxmlBtn = document.getElementById('exportFcpxmlBtn');
    this.exportEdlBtn = document.getElementById('exportEdlBtn');
    this.exportCutSubtitlesBtn = document.getElementById('exportCutSubtitlesBtn');
    this.exportFeedbackBanner = document.getElementById('exportFeedbackBanner');
  }

  bindEvents() {
    // Tab switching
    if (this.tabUploadBtn) {
      this.tabUploadBtn.addEventListener('click', () => this.switchTab('upload'));
    }
    if (this.tabPathBtn) {
      this.tabPathBtn.addEventListener('click', () => this.switchTab('path'));
    }
    if (this.tabDemoBtn) {
      this.tabDemoBtn.addEventListener('click', () => this.loadDemoSample());
    }

    // Drag and drop
    if (this.browseBtn) {
      this.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.fileInput.click();
      });
    }

    if (this.dropZone) {
      this.dropZone.addEventListener('click', () => this.fileInput.click());
      this.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropZone.classList.add('dragover');
      });
      this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
      this.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileSelected(e.target.files[0]);
        }
      });
    }

    // Slider value synchronization
    if (this.minSilenceSlider) {
      this.minSilenceSlider.addEventListener('input', (e) => {
        this.minSilenceVal.textContent = `${parseFloat(e.target.value).toFixed(2)}s`;
      });
    }
    if (this.paddingSlider) {
      this.paddingSlider.addEventListener('input', (e) => {
        this.paddingVal.textContent = `${parseFloat(e.target.value).toFixed(2)}s`;
      });
    }
    if (this.vadThresholdSlider) {
      this.vadThresholdSlider.addEventListener('input', (e) => {
        this.vadThresholdVal.textContent = parseFloat(e.target.value).toFixed(2);
      });
    }

    // Detect Silences Button
    if (this.detectBtn) {
      this.detectBtn.addEventListener('click', () => this.runSilenceDetection());
    }

    // Playback modes
    if (this.playCutsToggle) {
      this.playCutsToggle.addEventListener('click', () => {
        this.skipSilencePlayback = true;
        this.playCutsToggle.classList.add('active');
        this.playOriginalToggle.classList.remove('active');
      });
    }
    if (this.playOriginalToggle) {
      this.playOriginalToggle.addEventListener('click', () => {
        this.skipSilencePlayback = false;
        this.playOriginalToggle.classList.add('active');
        this.playCutsToggle.classList.remove('active');
      });
    }

    // Real-time jump-cut video player sync
    if (this.silenceVideoPlayer) {
      this.silenceVideoPlayer.addEventListener('timeupdate', () => this.handlePlayerTimeUpdate());
    }

    // Export button actions
    if (this.exportSingleMp4Btn) {
      this.exportSingleMp4Btn.addEventListener('click', () => this.exportSingleVideo());
    }
    if (this.exportMultipartZipBtn) {
      this.exportMultipartZipBtn.addEventListener('click', () => this.exportMultipartTakes());
    }
    if (this.exportFcpxmlBtn) {
      this.exportFcpxmlBtn.addEventListener('click', () => this.exportDaVinciTimeline('fcpxml'));
    }
    if (this.exportEdlBtn) {
      this.exportEdlBtn.addEventListener('click', () => this.exportDaVinciTimeline('edl'));
    }
    if (this.exportCutSubtitlesBtn) {
      this.exportCutSubtitlesBtn.addEventListener('click', () => this.exportCutSubtitles());
    }
  }

  switchTab(tab) {
    if (tab === 'upload') {
      this.tabUploadBtn.classList.add('active');
      this.tabPathBtn.classList.remove('active');
      this.tabDemoBtn.classList.remove('active');
      this.uploadSection.style.display = 'block';
      this.pathSection.style.display = 'none';
    } else if (tab === 'path') {
      this.tabPathBtn.classList.add('active');
      this.tabUploadBtn.classList.remove('active');
      this.tabDemoBtn.classList.remove('active');
      this.uploadSection.style.display = 'none';
      this.pathSection.style.display = 'block';
    }
  }

  handleFileSelected(file) {
    this.selectedFile = file;
    this.selectedPath = '';
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    this.dropTitle.textContent = `Selected: ${file.name}`;
    this.dropSubtitle.textContent = `Size: ${sizeMb} MB • Ready for Silero VAD analysis`;
    this.dropZone.style.borderColor = 'var(--accent-coral)';

    // Attach to video preview
    const objectUrl = URL.createObjectURL(file);
    if (this.silenceVideoPlayer) {
      this.silenceVideoPlayer.src = objectUrl;
      this.silenceVideoPlayer.style.display = 'block';
    }
    window.showToast(`Selected file: ${file.name}`, 'success');
  }

  loadDemoSample() {
    this.switchTab('path');
    this.pathInput.value = 'temp_media/1791945136_20260927_165604.mp4';
    window.showToast('Loaded demo video path! Click "Detect Silences & Preview Cuts".', 'success');
  }

  async runSilenceDetection() {
    const isUpload = this.tabUploadBtn.classList.contains('active');
    const minSilence = parseFloat(this.minSilenceSlider.value);
    const padding = parseFloat(this.paddingSlider.value);
    const vadThreshold = parseFloat(this.vadThresholdSlider.value);

    let apiUrl = '';
    let body = null;
    let headers = {};

    if (isUpload) {
      if (!this.selectedFile) {
        window.showToast('Please select or drop a video file first.', 'error');
        return;
      }
      apiUrl = '/api/silence/detect-upload';
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      formData.append('min_silence_duration', minSilence);
      formData.append('speech_padding', padding);
      formData.append('vad_threshold', vadThreshold);
      body = formData;
    } else {
      const pathVal = (this.pathInput.value || '').trim();
      if (!pathVal) {
        window.showToast('Please enter a local file path on your Mac.', 'error');
        return;
      }
      apiUrl = '/api/silence/detect-path';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        file_path: pathVal,
        min_silence_duration: minSilence,
        speech_padding: padding,
        vad_threshold: vadThreshold
      });
    }

    this.setLoading(true, 'Analyzing audio with local Silero VAD...');

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: body
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Silence detection failed');
      }

      this.detectionData = await res.json();
      this.serverMediaPath = this.detectionData.server_media_path || this.detectionData.media_path;

      if (this.detectionData.media_url && this.silenceVideoPlayer) {
        this.silenceVideoPlayer.src = this.detectionData.media_url;
        this.silenceVideoPlayer.style.display = 'block';
      }

      this.displayResults(this.detectionData);
      window.showToast(`Analyzed! Found ${this.detectionData.speech_segments_count} speech takes (${this.detectionData.silence_percentage}% silence cut)`, 'success');
    } catch (err) {
      console.error('Detection error:', err);
      window.showToast(err.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading, text = 'Processing...') {
    if (isLoading) {
      this.detectBtn.disabled = true;
      this.btnSpinner.style.display = 'inline-block';
      this.btnText.textContent = text;
    } else {
      this.detectBtn.disabled = false;
      this.btnSpinner.style.display = 'none';
      this.btnText.textContent = 'Detect Silences & Preview Cuts';
    }
  }

  displayResults(data) {
    if (!this.resultsPanel) return;
    this.resultsPanel.style.display = 'block';
    this.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Format metrics
    this.metricOriginal.textContent = this.formatTime(data.total_duration);
    this.metricSpeech.textContent = this.formatTime(data.total_speech_duration);
    this.metricSaved.textContent = `${this.formatTime(data.total_silence_duration)} (${data.silence_percentage}%)`;
    this.metricCuts.textContent = `${data.speech_segments_count} takes`;

    // Render Proportional Timeline
    this.renderTimeline(data);

    // Render Segments List
    this.renderSegmentsList(data);
  }

  renderTimeline(data) {
    if (!this.cutTimelineBar) return;
    this.cutTimelineBar.innerHTML = '';

    const total = data.total_duration || 1;
    const timeline = data.timeline || [];

    if (!timeline.length) {
      this.cutTimelineBar.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: var(--text-muted);">No cuts detected</div>';
      return;
    }

    timeline.forEach(item => {
      const segEl = document.createElement('div');
      const widthPct = Math.max(0.25, (item.duration / total) * 100);
      segEl.style.width = `${widthPct}%`;
      segEl.style.flex = `0 0 ${widthPct}%`;
      segEl.style.height = '42px';
      segEl.style.minHeight = '42px';
      segEl.style.display = 'block';
      segEl.style.boxSizing = 'border-box';
      segEl.style.cursor = 'pointer';
      segEl.style.position = 'relative';

      if (item.type === 'speech') {
        segEl.className = 'timeline-segment speech-segment';
        segEl.style.backgroundColor = '#15803D';
        segEl.style.borderRight = '1px solid rgba(255, 255, 255, 0.4)';
        segEl.title = `Take ${item.index}: ${this.formatTime(item.start)} - ${this.formatTime(item.end)} (${item.duration}s)`;
        segEl.addEventListener('click', () => {
          if (this.silenceVideoPlayer) {
            this.silenceVideoPlayer.currentTime = item.start;
            this.silenceVideoPlayer.play();
          }
        });
      } else {
        segEl.className = 'timeline-segment silence-segment';
        segEl.style.backgroundColor = '#DC2626';
        segEl.style.backgroundImage = 'repeating-linear-gradient(45deg, #DC2626, #DC2626 5px, #B91C1C 5px, #B91C1C 10px)';
        segEl.style.borderRight = '1px solid rgba(0, 0, 0, 0.25)';
        segEl.title = `Silence Cut: ${this.formatTime(item.start)} - ${this.formatTime(item.end)} (${item.duration}s)`;
      }

      this.cutTimelineBar.appendChild(segEl);
    });
  }

  renderSegmentsList(data) {
    if (!this.segmentsListContainer) return;
    this.segmentsListContainer.innerHTML = '';

    const takes = data.speech_segments || [];
    takes.forEach(take => {
      const card = document.createElement('div');
      card.className = 'take-card';
      card.innerHTML = `
        <div class="take-header">
          <span class="take-badge">Take ${take.index}</span>
          <span class="take-time">${take.start.toFixed(2)}s → ${take.end.toFixed(2)}s</span>
        </div>
        <div class="take-meta">
          <span>Duration: <strong>${take.duration.toFixed(2)}s</strong></span>
          <span>Timeline Offset: <strong>${take.rec_start.toFixed(2)}s</strong></span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (this.silenceVideoPlayer) {
          this.silenceVideoPlayer.currentTime = take.start;
          this.silenceVideoPlayer.play();
        }
      });
      this.segmentsListContainer.appendChild(card);
    });
  }

  handlePlayerTimeUpdate() {
    if (!this.skipSilencePlayback || !this.detectionData) return;
    const current = this.silenceVideoPlayer.currentTime;
    const silences = this.detectionData.silence_segments || [];

    for (const sil of silences) {
      if (current >= sil.start && current < sil.end - 0.05) {
        // Skip over silence straight to the next speech start!
        this.silenceVideoPlayer.currentTime = sil.end;
        break;
      }
    }
  }

  async exportSingleVideo() {
    if (!this.serverMediaPath || !this.detectionData) {
      window.showToast('Please analyze a video first.', 'error');
      return;
    }

    const originalBtnText = this.exportSingleMp4Btn.innerHTML;
    this.exportSingleMp4Btn.disabled = true;
    this.exportSingleMp4Btn.innerHTML = 'Rendering Hardware MP4...';

    try {
      const res = await fetch('/api/silence/render-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.serverMediaPath,
          speech_segments: this.detectionData.speech_segments,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Export single video failed');
      }

      const result = await res.json();
      this.showExportSuccess(
        'Single Jump-Cut Video Created!',
        `Rendered ${result.segments_joined} cuts in ${result.render_time_s}s using Apple Silicon ${result.encoder}.`,
        result.output_path,
        result.filename
      );
      window.showToast(`Saved to ~/Downloads/${result.filename}!`, 'success');
    } catch (err) {
      console.error(err);
      window.showToast(err.message, 'error');
    } finally {
      this.exportSingleMp4Btn.disabled = false;
      this.exportSingleMp4Btn.innerHTML = originalBtnText;
    }
  }

  async exportMultipartTakes() {
    if (!this.serverMediaPath || !this.detectionData) {
      window.showToast('Please analyze a video first.', 'error');
      return;
    }

    const originalBtnText = this.exportMultipartZipBtn.innerHTML;
    this.exportMultipartZipBtn.disabled = true;
    this.exportMultipartZipBtn.innerHTML = 'Packaging Takes ZIP...';

    try {
      const res = await fetch('/api/silence/render-multipart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.serverMediaPath,
          speech_segments: this.detectionData.speech_segments,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Multipart export failed');
      }

      const result = await res.json();
      this.showExportSuccess(
        'Multipart Takes Package Created!',
        `Exported ${result.takes_count} individual clips to folder and packaged into ZIP (${result.zip_size_mb} MB).`,
        result.zip_path,
        result.zip_filename
      );
      window.showToast(`Saved ZIP to ~/Downloads/${result.zip_filename}!`, 'success');
    } catch (err) {
      console.error(err);
      window.showToast(err.message, 'error');
    } finally {
      this.exportMultipartZipBtn.disabled = false;
      this.exportMultipartZipBtn.innerHTML = originalBtnText;
    }
  }

  async exportDaVinciTimeline(type) {
    if (!this.serverMediaPath || !this.detectionData) {
      window.showToast('Please analyze a video first.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/silence/export-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.serverMediaPath,
          speech_segments: this.detectionData.speech_segments,
          export_type: type
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Timeline export failed');
      }

      const result = await res.json();
      const target = type === 'fcpxml' ? result.fcpxml : result.edl;

      this.showExportSuccess(
        `DaVinci Resolve ${type.toUpperCase()} Timeline Ready!`,
        `100% Lossless, 0-Reencode Timeline with ${result.cuts_count} cuts referencing your original media.`,
        target.output_path,
        target.filename
      );
      window.showToast(`Saved ${target.filename} to ~/Downloads/!`, 'success');
    } catch (err) {
      console.error(err);
      window.showToast(err.message, 'error');
    }
  }

  async exportCutSubtitles() {
    if (!this.serverMediaPath || !this.detectionData) {
      window.showToast('Please analyze a video first.', 'error');
      return;
    }

    const origBtnText = this.exportCutSubtitlesBtn.innerHTML;
    this.exportCutSubtitlesBtn.disabled = true;
    this.exportCutSubtitlesBtn.innerHTML = 'Aligning Subtitles...';

    try {
      const res = await fetch('/api/silence/sync-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.serverMediaPath,
          speech_segments: this.detectionData.speech_segments,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Subtitle synchronization failed');
      }

      const result = await res.json();
      this.showExportSuccess(
        'Synchronized Subtitles Created!',
        `Shifted ${result.cues_count} subtitle cues to perfectly align with your cut timeline.`,
        result.output_path,
        result.filename
      );
      window.showToast(`Saved ${result.filename} to ~/Downloads/!`, 'success');
    } catch (err) {
      console.error(err);
      window.showToast(err.message, 'error');
    } finally {
      this.exportCutSubtitlesBtn.disabled = false;
      this.exportCutSubtitlesBtn.innerHTML = origBtnText;
    }
  }

  showExportSuccess(title, description, fullPath, filename) {
    if (!this.exportFeedbackBanner) return;
    this.exportFeedbackBanner.style.display = 'block';
    this.exportFeedbackBanner.innerHTML = `
      <div class="feedback-card">
        <div class="feedback-icon">🎉</div>
        <div class="feedback-content">
          <h4>${title}</h4>
          <p>${description}</p>
          <div class="path-badge">
            <span class="path-label">Saved to macOS Downloads:</span>
            <code>${fullPath}</code>
          </div>
        </div>
      </div>
    `;
    this.exportFeedbackBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}

window.SilenceCutterStudio = SilenceCutterStudio;
