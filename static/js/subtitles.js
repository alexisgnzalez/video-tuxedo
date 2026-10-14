/**
 * Video Tuxedo - Subtitle Studio Controller
 * Manages media loading, transcription, cue editing, and DaVinci Resolve Free exports.
 */

class SubtitleStudio {
  constructor() {
    this.currentFile = null;
    this.currentFilePath = null;
    this.mediaBlobUrl = null;
    this.segments = [];
    this.detectedLanguage = 'Auto';
    this.visualizer = null;

    this.initDOMElements();
    this.bindEvents();
    this.setupVisualizer();
  }

  initDOMElements() {
    // Mode tabs
    this.tabUploadBtn = document.getElementById('tabUploadBtn');
    this.tabPathBtn = document.getElementById('tabPathBtn');
    this.tabDemoBtn = document.getElementById('tabDemoBtn');

    this.uploadInputSection = document.getElementById('uploadInputSection');
    this.pathInputSection = document.getElementById('pathInputSection');
    this.localPathInput = document.getElementById('localPathInput');

    // Drop zone & inputs
    this.dropZone = document.getElementById('mediaDropZone');
    this.fileInput = document.getElementById('mediaFileInput');
    this.browseBtn = document.getElementById('browseMediaBtn');
    this.dropTitle = document.getElementById('dropTitleText');
    this.dropSubtitle = document.getElementById('dropSubtitleText');

    // Controls
    this.modelSelect = document.getElementById('whisperModelSelect');
    this.langSelect = document.getElementById('languageSelect');
    this.taskSelect = document.getElementById('taskSelect');
    this.startBtn = document.getElementById('startTranscribeBtn');
    this.progressCard = document.getElementById('transcribeProgressCard');
    this.progressTitle = document.getElementById('progressStatusTitle');
    this.progressSubtext = document.getElementById('progressStatusSubtext');

    // Workspace & Media
    this.workspaceContainer = document.getElementById('workspaceContainer');
    this.mediaElement = document.getElementById('mainMediaElement');
    this.subtitleOverlay = document.getElementById('videoSubtitleOverlay');
    this.playerTimeDisplay = document.getElementById('playerTimeDisplay');

    // Metadata pills
    this.metaFilename = document.getElementById('metaFilename');
    this.metaDuration = document.getElementById('metaDuration');
    this.metaLang = document.getElementById('metaLang');
    this.metaSegments = document.getElementById('metaSegments');

    // Cues list
    this.cuesCountBadge = document.getElementById('cuesCountBadge');
    this.segmentsScrollList = document.getElementById('segmentsScrollList');
    this.addNewSegmentBtn = document.getElementById('addNewSegmentBtn');

    // Export buttons
    this.exportSrtBtn = document.getElementById('exportSrtBtn');
    this.exportVttBtn = document.getElementById('exportVttBtn');
    this.copyClipboardBtn = document.getElementById('copyClipboardBtn');
    this.openGuideModalBtn = document.getElementById('openDavinciGuideModalBtn');
  }

  setupVisualizer() {
    if (window.AudioWaveformVisualizer) {
      this.visualizer = new AudioWaveformVisualizer('waveformCanvas', 'mainMediaElement');
    }
  }

  bindEvents() {
    // Tab switching
    this.tabUploadBtn.addEventListener('click', () => this.switchTab('upload'));
    this.tabPathBtn.addEventListener('click', () => this.switchTab('path'));
    this.tabDemoBtn.addEventListener('click', () => this.loadDemoSample());

    // File selection
    this.browseBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileSelected(e.target.files[0]);
      }
    });

    // Drag and drop
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('dragover');
    });
    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('dragover');
    });
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    // Start transcription
    this.startBtn.addEventListener('click', () => this.runTranscription());

    // Media player events
    this.mediaElement.addEventListener('timeupdate', () => this.onMediaTimeUpdate());
    this.mediaElement.addEventListener('play', () => {
      if (this.visualizer) this.visualizer.start();
    });
    this.mediaElement.addEventListener('pause', () => {
      if (this.visualizer) this.visualizer.stop();
    });

    // Cue list events
    this.addNewSegmentBtn.addEventListener('click', () => this.addNewCue());

    // Exports
    this.exportSrtBtn.addEventListener('click', () => this.exportFile('srt'));
    this.exportVttBtn.addEventListener('click', () => this.exportFile('vtt'));
    this.copyClipboardBtn.addEventListener('click', () => this.copyToClipboard());
  }

  switchTab(mode) {
    this.mode = mode;
    this.tabUploadBtn.classList.toggle('active', mode === 'upload');
    this.tabPathBtn.classList.toggle('active', mode === 'path');
    this.tabDemoBtn.classList.toggle('active', mode === 'demo');

    this.uploadInputSection.style.display = mode === 'upload' ? 'block' : 'none';
    this.pathInputSection.style.display = mode === 'path' ? 'block' : 'none';
  }

  handleFileSelected(file) {
    this.currentFile = file;
    this.currentFilePath = null;
    this.switchTab('upload');

    if (this.mediaBlobUrl) {
      URL.revokeObjectURL(this.mediaBlobUrl);
    }
    this.mediaBlobUrl = URL.createObjectURL(file);
    this.mediaElement.src = this.mediaBlobUrl;

    this.dropTitle.textContent = `Selected: ${file.name}`;
    this.dropSubtitle.textContent = `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI transcription`;
    
    this.metaFilename.textContent = file.name;
    this.workspaceContainer.style.display = 'grid';

    showToast(`Loaded ${file.name}. Click "Generate Subtitles" to transcribe!`, 'success');
  }

  async loadDemoSample() {
    this.switchTab('demo');

    // Create a demo sample with built-in synthesized voice or demo cues
    this.currentFile = null;
    this.currentFilePath = "demo_creator_sample.mp4";
    this.metaFilename.textContent = "demo_creator_sample.mp4";

    // Set demo segments formatted for DaVinci Resolve
    this.segments = [
      {
        id: 1,
        start: 0.500,
        end: 3.200,
        text: "Welcome to Video Tuxedo, your ultimate video editing assistant."
      },
      {
        id: 2,
        start: 3.600,
        end: 7.100,
        text: "This subtitle file was generated using local Whisper AI for DaVinci Resolve Free."
      },
      {
        id: 3,
        start: 7.500,
        end: 11.400,
        text: "Import this .SRT directly into your DaVinci timeline to start editing immediately."
      },
      {
        id: 4,
        start: 11.800,
        end: 15.000,
        text: "No studio version required, completely free and 100% private."
      }
    ];

    this.detectedLanguage = "English (en)";
    this.metaLang.textContent = "Language: en";
    this.metaDuration.textContent = "Duration: 00:15.00";
    this.renderSegmentsList();
    this.workspaceContainer.style.display = 'grid';

    showToast("Loaded demo sample cues. You can edit or export .SRT right now!", "success");
  }

  async runTranscription() {
    // Determine whether we have an uploaded file or a local directory path
    const hasSelectedFile = Boolean(this.currentFile);
    const hasPathInput = Boolean(this.localPathInput && this.localPathInput.value.trim());

    if (!hasSelectedFile && !hasPathInput) {
      if (this.mode === 'demo') {
        showToast("Demo cues are already loaded! To transcribe your own video, browse or drop a file above.", "success");
        return;
      }
      showToast("Please choose or drop a video/audio file first.", "error");
      return;
    }

    // Show progress card with live timer
    this.startBtn.disabled = true;
    this.progressCard.classList.add('active');
    this.progressTitle.textContent = "Transcribing with Whisper AI...";
    this.progressSubtext.textContent = "Analyzing audio waveforms with local Whisper AI. (First run may take a moment to initialize model weights)...";

    let elapsedSeconds = 0;
    const progressTimer = setInterval(() => {
      elapsedSeconds++;
      this.progressTitle.textContent = `Transcribing with Whisper AI... (${elapsedSeconds}s)`;
    }, 1000);

    try {
      let data;

      if (hasSelectedFile) {
        const formData = new FormData();
        formData.append("file", this.currentFile);
        formData.append("model_size", this.modelSelect.value);
        if (this.langSelect.value !== "auto") {
          formData.append("language", this.langSelect.value);
        }
        formData.append("task", this.taskSelect.value);

        const response = await fetch("/api/subtitles/transcribe-upload", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || "Transcription failed");
        }
        data = await response.json();

        if (data.media_url && !this.mediaBlobUrl) {
          this.mediaElement.src = data.media_url;
        }

      } else {
        const payload = {
          file_path: this.localPathInput.value.trim(),
          model_size: this.modelSelect.value,
          language: this.langSelect.value !== "auto" ? this.langSelect.value : null,
          task: this.taskSelect.value
        };

        const response = await fetch("/api/subtitles/transcribe-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || "Transcription failed");
        }
        data = await response.json();
      }

      // Populate results
      this.segments = data.segments || [];
      this.detectedLanguage = data.language ? `${data.language.toUpperCase()} (${Math.round((data.language_probability || 1) * 100)}% prob)` : "Auto";
      
      this.metaLang.textContent = `Lang: ${this.detectedLanguage}`;
      if (data.duration) {
        this.metaDuration.textContent = `Duration: ${this.formatSeconds(data.duration)}`;
      }
      this.metaFilename.textContent = data.filename || "media_file";

      this.renderSegmentsList();
      this.workspaceContainer.style.display = 'grid';

      showToast(`Transcription complete! Found ${this.segments.length} subtitle cues in ${data.processing_time}s.`, "success");

    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, "error");
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      this.startBtn.disabled = false;
      this.progressCard.classList.remove('active');
    }
  }

  renderSegmentsList() {
    this.segmentsScrollList.innerHTML = "";
    this.cuesCountBadge.textContent = `${this.segments.length} cues`;
    this.metaSegments.textContent = `${this.segments.length} Cues`;

    if (this.segments.length === 0) {
      this.segmentsScrollList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No speech detected or empty cues. Click "+ Add Cue" to manually add subtitles.
        </div>
      `;
      return;
    }

    this.segments.forEach((seg, idx) => {
      const item = document.createElement("div");
      item.className = "segment-item";
      item.id = `cueItem-${seg.id || idx}`;
      item.dataset.start = seg.start;
      item.dataset.end = seg.end;

      const startTc = this.secondsToSrtTimecode(seg.start);
      const endTc = this.secondsToSrtTimecode(seg.end);

      item.innerHTML = `
        <div class="segment-meta">
          <div class="timecode-pill" title="Click to seek player" data-seek="${seg.start}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>${startTc} ➔ ${endTc}</span>
          </div>
          <div class="segment-actions">
            <button class="icon-btn-tiny danger" title="Delete cue" data-action="delete" data-index="${idx}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <textarea class="segment-textarea" data-index="${idx}" placeholder="Subtitle text...">${seg.text || ""}</textarea>
      `;

      // Event: Seek to time
      const timecodePill = item.querySelector('.timecode-pill');
      timecodePill.addEventListener('click', () => {
        this.mediaElement.currentTime = seg.start;
        this.mediaElement.play();
      });

      // Event: Edit text
      const textarea = item.querySelector('.segment-textarea');
      textarea.addEventListener('input', (e) => {
        this.segments[idx].text = e.target.value;
      });

      // Event: Delete cue
      const deleteBtn = item.querySelector('[data-action="delete"]');
      deleteBtn.addEventListener('click', () => {
        this.segments.splice(idx, 1);
        this.renderSegmentsList();
        showToast("Cue deleted", "success");
      });

      this.segmentsScrollList.appendChild(item);
    });
  }

  addNewCue() {
    const currentTime = this.mediaElement.currentTime || 0;
    const newCue = {
      id: this.segments.length + 1,
      start: Math.round(currentTime * 10) / 10,
      end: Math.round((currentTime + 3.0) * 10) / 10,
      text: "New subtitle line"
    };

    this.segments.push(newCue);
    this.segments.sort((a, b) => a.start - b.start);
    this.renderSegmentsList();
    showToast("Added new subtitle cue", "success");
  }

  onMediaTimeUpdate() {
    const currentTime = this.mediaElement.currentTime || 0;
    const duration = this.mediaElement.duration || 0;

    this.playerTimeDisplay.textContent = `${this.formatSeconds(currentTime)} / ${this.formatSeconds(duration)}`;

    // Find active subtitle
    let activeText = "";
    let activeItem = null;

    for (const seg of this.segments) {
      if (currentTime >= seg.start && currentTime <= seg.end) {
        activeText = seg.text;
        activeItem = document.getElementById(`cueItem-${seg.id}`);
        break;
      }
    }

    // Video overlay text
    if (activeText) {
      this.subtitleOverlay.textContent = activeText;
      this.subtitleOverlay.style.display = "block";
    } else {
      this.subtitleOverlay.style.display = "none";
    }

    // Highlight active cue card
    document.querySelectorAll('.segment-item.active-playing').forEach(el => {
      el.classList.remove('active-playing');
    });

    if (activeItem) {
      activeItem.classList.add('active-playing');
    }
  }

  async exportFile(format = 'srt') {
    if (!this.segments || this.segments.length === 0) {
      showToast("No subtitle segments to export.", "error");
      return;
    }

    const endpoint = format === 'vtt' ? '/api/subtitles/export-vtt' : '/api/subtitles/export-srt';
    const filename = this.metaFilename.textContent.replace(/\.[^/.]+$/, "") || "video_tuxedo_subtitles";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: this.segments,
          filename: filename
        })
      });

      if (!response.ok) throw new Error("Failed to export subtitles file");

      const data = await response.json();
      const content = data.content || "";
      const outFilename = data.filename || `${filename}.${format}`;

      // Trigger reliable browser download via UTF-8 Data URI
      const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
      const a = document.createElement("a");
      a.href = dataUri;
      a.download = outFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 250);

      const locationMsg = data.saved_downloads 
        ? `Saved directly to ~/Downloads/${outFilename}`
        : `Downloaded ${outFilename}`;

      showToast(`✅ ${locationMsg} (DaVinci Resolve Ready!)`, "success");

    } catch (err) {
      console.error(err);
      showToast(`Export failed: ${err.message}`, "error");
    }
  }

  copyToClipboard() {
    if (!this.segments || this.segments.length === 0) {
      showToast("No subtitles to copy.", "error");
      return;
    }

    const plainText = this.segments.map(s => s.text).join("\n");
    navigator.clipboard.writeText(plainText).then(() => {
      showToast("Copied subtitle text to clipboard!", "success");
    }).catch(err => {
      showToast("Failed to copy to clipboard", "error");
    });
  }

  secondsToSrtTimecode(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const totalMs = Math.round(seconds * 1000);
    const hrs = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  formatSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00.00";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(5, '0')}`;
  }
}

window.SubtitleStudio = SubtitleStudio;
