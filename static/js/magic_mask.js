/**
 * Video Tuxedo - Magic Mask & Rotoscoping Studio (Tool 3)
 * Interactive SAM 2.1 canvas rotoscoper with live DaVinci Resolve Magic Mask preview
 * and Apple ProRes 4444 10-bit Alpha export.
 */

class MagicMaskStudio {
  constructor() {
    this.mediaPath = null;
    this.videoMeta = null;
    this.currentTime = 0.0;
    this.currentFrame = 0;
    this.rangeIn = 0.0;
    this.rangeOut = null;

    // Interaction Tools: 'brush' | 'box' | 'lasso'
    this.currentTool = 'brush';
    this.currentBbox = null; // [xmin, ymin, xmax, ymax]
    this.isInverted = false;

    // Stroke data
    this.strokes = []; // Array of { label: 1 | 0, size: number, points: [{x, y}], isLasso: bool }
    this.currentStroke = null;
    this.activeBrushLabel = 1; // 1 = Keep, 0 = Exclude
    this.brushSize = 20;
    this.previewMode = 'magenta'; // 'magenta' | 'cutout' | 'matte'
    this.feather = 3;
    this.expand = 0;

    // Image buffers
    this.baseFrameImg = null;
    this.maskImg = null;
    this.cutoutImg = null;
    this.isSegmenting = false;
    this.segmentDebounceTimer = null;
    this.activeTaskId = null;
    this.pollInterval = null;

    // UI Elements
    this.initDOMElements();
    this.bindEvents();
  }

  initDOMElements() {
    // Tabs & Inputs
    this.tabUploadBtn = document.getElementById('tabMmUploadBtn');
    this.tabPathBtn = document.getElementById('tabMmPathBtn');
    this.tabDemoBtn = document.getElementById('tabMmDemoBtn');

    this.uploadSection = document.getElementById('mmUploadSection');
    this.pathSection = document.getElementById('mmPathSection');
    this.demoSection = document.getElementById('mmDemoSection');

    this.dropZone = document.getElementById('mmDropZone');
    this.fileInput = document.getElementById('mmFileInput');
    this.browseBtn = document.getElementById('mmBrowseBtn');
    this.localPathInput = document.getElementById('mmLocalPathInput');
    this.loadPathBtn = document.getElementById('mmLoadPathBtn');
    this.loadSampleBtn = document.getElementById('mmLoadSampleBtn');

    // Workspace & Controls
    this.workspace = document.getElementById('mmWorkspace');
    this.videoName = document.getElementById('mmVideoName');
    this.videoMetaLabel = document.getElementById('mmVideoMeta');
    this.timecodeDisplay = document.getElementById('mmTimecodeDisplay');
    this.frameNumLabel = document.getElementById('mmFrameNum');
    this.totalFramesLabel = document.getElementById('mmTotalFrames');

    // Scrubber & Transport
    this.playBtn = document.getElementById('mmPlayBtn');
    this.prevFrameBtn = document.getElementById('mmPrevFrameBtn');
    this.nextFrameBtn = document.getElementById('mmNextFrameBtn');
    this.scrubber = document.getElementById('mmScrubber');
    this.setInBtn = document.getElementById('mmSetInBtn');
    this.setOutBtn = document.getElementById('mmSetOutBtn');
    this.clearRangeBtn = document.getElementById('mmClearRangeBtn');
    this.inLabel = document.getElementById('mmInLabel');
    this.outLabel = document.getElementById('mmOutLabel');
    this.rangeDurationLabel = document.getElementById('mmRangeDurationLabel');
    this.range5sBtn = document.getElementById('mmRange5sBtn');

    // Canvas
    this.canvasContainer = document.getElementById('mmCanvasContainer');
    this.canvas = document.getElementById('mmCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = document.getElementById('mmVideo');
    this.segmentLoading = document.getElementById('mmSegmentLoading');
    this.firstTimeHint = document.getElementById('mmFirstTimeHint');

    // Tools
    this.toolBrushBtn = document.getElementById('mmToolBrushBtn');
    this.toolBoxBtn = document.getElementById('mmToolBoxBtn');
    this.toolLassoBtn = document.getElementById('mmToolLassoBtn');
    this.brushSizeContainer = document.getElementById('mmBrushSizeContainer');

    // Brush Controls
    this.brushKeepBtn = document.getElementById('mmBrushKeepBtn');
    this.brushExcludeBtn = document.getElementById('mmBrushExcludeBtn');
    this.undoBtn = document.getElementById('mmUndoBtn');
    this.clearStrokesBtn = document.getElementById('mmClearStrokesBtn');
    this.sizeBtns = [
      document.getElementById('mmSizeSmallBtn'),
      document.getElementById('mmSizeMedBtn'),
      document.getElementById('mmSizeLargeBtn')
    ];

    // Preview Modes
    this.modeMagentaBtn = document.getElementById('mmModeMagentaBtn');
    this.modeCutoutBtn = document.getElementById('mmModeCutoutBtn');
    this.modeMatteBtn = document.getElementById('mmModeMatteBtn');

    // Edge Refinements & Invert
    this.featherSlider = document.getElementById('mmFeatherSlider');
    this.featherVal = document.getElementById('mmFeatherVal');
    this.expandSlider = document.getElementById('mmExpandSlider');
    this.expandVal = document.getElementById('mmExpandVal');
    this.statsBadge = document.getElementById('mmStatsBadge');
    this.invertMaskBtn = document.getElementById('mmInvertMaskBtn');
    this.invertStatus = document.getElementById('mmInvertStatus');

    // Export & Progress
    this.exportCard = document.getElementById('mmExportCard');
    this.trackAndExportBtn = document.getElementById('mmTrackAndExportBtn');
    this.progressCard = document.getElementById('mmProgressCard');
    this.progressBar = document.getElementById('mmProgressBar');
    this.progressPercent = document.getElementById('mmProgressPercent');
    this.cancelTrackBtn = document.getElementById('mmCancelTrackBtn');
    this.progFrame = document.getElementById('mmProgFrame');
    this.progTotal = document.getElementById('mmProgTotal');
    this.progFps = document.getElementById('mmProgFps');
    this.progElapsed = document.getElementById('mmProgElapsed');
    this.progEta = document.getElementById('mmProgEta');

    // Success Card & Modal
    this.successCard = document.getElementById('mmSuccessCard');
    this.successDetails = document.getElementById('mmSuccessDetails');
    this.successFilename = document.getElementById('mmSuccessFilename');
    this.successMeta = document.getElementById('mmSuccessMeta');
    this.openDavinciMmGuideBtn = document.getElementById('openDavinciMmGuideBtn');
    this.davinciMmModalOverlay = document.getElementById('davinciMmModalOverlay');
    this.closeDavinciMmModalBtn = document.getElementById('closeDavinciMmModalBtn');
    this.davinciMmGuideGotItBtn = document.getElementById('davinciMmGuideGotItBtn');
  }

  bindEvents() {
    // Mode Switcher Tabs
    this.tabUploadBtn.addEventListener('click', () => this.switchTab('upload'));
    this.tabPathBtn.addEventListener('click', () => this.switchTab('path'));
    this.tabDemoBtn.addEventListener('click', () => this.switchTab('demo'));

    // Upload & Browse
    this.browseBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.uploadFile(e.target.files[0]);
      }
    });

    // Drag and Drop
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-active');
    });
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-active'));
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.uploadFile(e.dataTransfer.files[0]);
      }
    });

    // Local Path & Demo
    this.loadPathBtn.addEventListener('click', () => {
      const p = this.localPathInput.value.trim();
      if (p) this.loadFromPath(p);
      else showToast('Please enter an absolute file path', 'warning');
    });
    this.loadSampleBtn.addEventListener('click', () => {
      this.loadFromPath('temp_media/1791945136_20260927_165604.mp4');
    });

    // Transport & Scrubber
    this.scrubber.addEventListener('input', (e) => {
      const t = (parseFloat(e.target.value) / 100.0) * (this.videoMeta?.duration || 1.0);
      this.seekToTimestamp(t);
    });

    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.prevFrameBtn.addEventListener('click', () => this.stepFrame(-1));
    this.nextFrameBtn.addEventListener('click', () => this.stepFrame(1));

    // Range Selection
    this.setInBtn.addEventListener('click', () => {
      this.rangeIn = this.currentTime;
      this.updateRangeLabels();
      showToast(`In Point set to ${this.formatTimecode(this.rangeIn)}`);
    });
    this.setOutBtn.addEventListener('click', () => {
      this.rangeOut = this.currentTime;
      this.updateRangeLabels();
      showToast(`Out Point set to ${this.formatTimecode(this.rangeOut)}`);
    });
    this.clearRangeBtn.addEventListener('click', () => {
      this.rangeIn = 0.0;
      this.rangeOut = null;
      this.updateRangeLabels();
      showToast('Range reset to Full Video');
    });

    if (this.range5sBtn) {
      this.range5sBtn.addEventListener('click', () => {
        this.rangeIn = 0.0;
        this.rangeOut = Math.min(5.0, this.videoMeta?.duration || 5.0);
        this.updateRangeLabels();
        showToast(`Range set to First 5 Seconds (${this.rangeOut.toFixed(1)}s)`);
      });
    }

    if (this.cancelTrackBtn) {
      this.cancelTrackBtn.addEventListener('click', () => this.cancelTracking());
    }

    // Interaction Tool Selector (Brush / Box / Lasso)
    if (this.toolBrushBtn) {
      this.toolBrushBtn.addEventListener('click', () => this.setTool('brush'));
    }
    if (this.toolBoxBtn) {
      this.toolBoxBtn.addEventListener('click', () => this.setTool('box'));
    }
    if (this.toolLassoBtn) {
      this.toolLassoBtn.addEventListener('click', () => this.setTool('lasso'));
    }

    // Brush Tool Buttons (Keep / Exclude)
    this.brushKeepBtn.addEventListener('click', () => {
      this.activeBrushLabel = 1;
      this.brushKeepBtn.classList.add('active');
      this.brushExcludeBtn.classList.remove('active');
    });
    this.brushExcludeBtn.addEventListener('click', () => {
      this.activeBrushLabel = 0;
      this.brushExcludeBtn.classList.add('active');
      this.brushKeepBtn.classList.remove('active');
    });

    // Brush Sizes
    this.sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushSize = parseInt(btn.dataset.size, 10);
      });
    });

    // Stroke Actions
    this.undoBtn.addEventListener('click', () => this.undoStroke());
    this.clearStrokesBtn.addEventListener('click', () => this.clearAllStrokes());

    // Preview Modes
    this.modeMagentaBtn.addEventListener('click', () => this.setPreviewMode('magenta'));
    this.modeCutoutBtn.addEventListener('click', () => this.setPreviewMode('cutout'));
    this.modeMatteBtn.addEventListener('click', () => this.setPreviewMode('matte'));

    // Refinement Sliders
    this.featherSlider.addEventListener('input', (e) => {
      this.feather = parseInt(e.target.value, 10);
      this.featherVal.textContent = `${this.feather}px`;
      this.debouncedSegmentRequest();
    });
    this.expandSlider.addEventListener('input', (e) => {
      this.expand = parseInt(e.target.value, 10);
      this.expandVal.textContent = `${this.expand}px`;
      this.debouncedSegmentRequest();
    });

    // Invert Mask Toggle
    if (this.invertMaskBtn) {
      this.invertMaskBtn.addEventListener('click', () => {
        this.isInverted = !this.isInverted;
        if (this.isInverted) {
          this.invertMaskBtn.style.background = 'var(--accent-coral)';
          this.invertMaskBtn.style.color = '#fff';
          this.invertMaskBtn.style.borderColor = 'var(--accent-coral)';
          this.invertStatus.textContent = 'Inverted (ON)';
          showToast('Mask inverted: subject is now transparent, background is kept');
        } else {
          this.invertMaskBtn.style.background = '';
          this.invertMaskBtn.style.color = '';
          this.invertMaskBtn.style.borderColor = '';
          this.invertStatus.textContent = 'Invert';
          showToast('Mask normalized: subject is kept');
        }
        this.debouncedSegmentRequest();
      });
    }

    // Export Format Selector Cards
    document.querySelectorAll('input[name="mmExportFormat"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
        radio.closest('.format-card').classList.add('selected');
        
        const mode = radio.value;
        const btnText = mode === 'prores_alpha' ? '⚡ Track & Export ProRes 4444' :
                        mode === 'matte' ? '⚡ Track & Export B&W Matte' :
                        mode === 'green_screen' ? '⚡ Track & Export Green Screen' :
                        '⚡ Track & Export Blur Video';
        this.trackAndExportBtn.innerHTML = `<span>${btnText}</span>`;
      });
    });

    // Track & Export Button
    this.trackAndExportBtn.addEventListener('click', () => this.startTracking());

    // DaVinci Resolve Modal Guide
    if (this.openDavinciMmGuideBtn) {
      this.openDavinciMmGuideBtn.addEventListener('click', () => this.openGuideModal());
    }
    if (this.closeDavinciMmModalBtn) {
      this.closeDavinciMmModalBtn.addEventListener('click', () => this.closeGuideModal());
    }
    if (this.davinciMmGuideGotItBtn) {
      this.davinciMmGuideGotItBtn.addEventListener('click', () => this.closeGuideModal());
    }

    // Canvas drawing initialization
    this.initCanvasDrawing();
  }

  setTool(tool) {
    this.currentTool = tool;
    if (this.toolBrushBtn) this.toolBrushBtn.classList.toggle('active', tool === 'brush');
    if (this.toolBoxBtn) this.toolBoxBtn.classList.toggle('active', tool === 'box');
    if (this.toolLassoBtn) this.toolLassoBtn.classList.toggle('active', tool === 'lasso');

    if (this.brushSizeContainer) {
      this.brushSizeContainer.style.display = (tool === 'brush') ? 'flex' : 'none';
    }

    if (tool === 'box') {
      showToast('Box Tool: Click and drag a rectangle over your subject');
    } else if (tool === 'lasso') {
      showToast('Lasso Tool: Trace a loop around your subject');
    } else {
      showToast('Brush Tool: Paint a stroke down the center of your subject');
    }
  }

  switchTab(tab) {
    this.tabUploadBtn.classList.toggle('active', tab === 'upload');
    this.tabPathBtn.classList.toggle('active', tab === 'path');
    this.tabDemoBtn.classList.toggle('active', tab === 'demo');

    this.uploadSection.style.display = tab === 'upload' ? 'block' : 'none';
    this.pathSection.style.display = tab === 'path' ? 'block' : 'none';
    this.demoSection.style.display = tab === 'demo' ? 'block' : 'none';
  }

  async uploadFile(file) {
    showToast(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/magic-mask/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.onMediaLoaded(data);
    } catch (err) {
      console.error(err);
      showToast(`Upload failed: ${err.message}`, 'error');
    }
  }

  async loadFromPath(filePath) {
    showToast(`Loading media from ${filePath}...`);
    try {
      const res = await fetch('/api/magic-mask/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_path: filePath }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.onMediaLoaded(data);
    } catch (err) {
      console.error(err);
      showToast(`Failed to load video: ${err.message}`, 'error');
    }
  }

  onMediaLoaded(data) {
    this.mediaPath = data.media_path;
    this.videoMeta = {
      width: data.width,
      height: data.height,
      fps: data.fps || 30.0,
      duration: data.duration || 0.0,
      total_frames: data.total_frames || Math.round(data.duration * (data.fps || 30)),
    };

    // Update labels
    this.videoName.textContent = data.filename || 'video.mp4';
    this.videoMetaLabel.textContent = `${this.videoMeta.width}x${this.videoMeta.height} • ${this.videoMeta.fps} FPS • ${this.formatDuration(this.videoMeta.duration)}`;
    this.totalFramesLabel.textContent = this.videoMeta.total_frames;
    this.rangeIn = 0.0;
    this.rangeOut = null;
    this.updateRangeLabels();

    // Reset strokes and masks
    this.strokes = [];
    this.currentBbox = null;
    this.maskImg = null;
    this.cutoutImg = null;
    this.statsBadge.textContent = '0 points';

    // Show workspace
    this.workspace.style.display = 'block';
    this.workspace.scrollIntoView({ behavior: 'smooth' });

    // Set canvas dimensions and dynamic container aspect ratio
    this.canvas.width = this.videoMeta.width;
    this.canvas.height = this.videoMeta.height;
    if (this.canvasContainer && this.videoMeta.width && this.videoMeta.height) {
      this.canvasContainer.style.aspectRatio = `${this.videoMeta.width} / ${this.videoMeta.height}`;
    }

    // Load initial frame at 0.0s
    this.seekToTimestamp(0.0);
    showToast('Video ready! Draw a stroke down the center of your subject.');
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTimecode(seconds) {
    if (seconds < 0) seconds = 0;
    const fps = this.videoMeta?.fps || 30.0;
    const totalFrames = Math.round(seconds * fps);
    const hrs = Math.floor(totalFrames / (3600 * fps));
    const mins = Math.floor((totalFrames % (3600 * fps)) / (60 * fps));
    const secs = Math.floor((totalFrames % (60 * fps)) / fps);
    const frames = Math.floor(totalFrames % fps);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }

  updateRangeLabels() {
    this.inLabel.textContent = this.formatTimecode(this.rangeIn);
    this.outLabel.textContent = this.rangeOut !== null ? this.formatTimecode(this.rangeOut) : 'End';
    const dur = (this.rangeOut !== null ? this.rangeOut : this.videoMeta?.duration || 0) - this.rangeIn;
    this.rangeDurationLabel.textContent = `Range: ${dur > 0 ? dur.toFixed(1) + 's' : 'Full Video'}`;
  }

  async seekToTimestamp(timestampS) {
    this.currentTime = Math.max(0.0, Math.min(timestampS, this.videoMeta?.duration || 0.0));
    const fps = this.videoMeta?.fps || 30.0;
    this.currentFrame = Math.round(this.currentTime * fps);

    // Update scrubber UI
    this.timecodeDisplay.textContent = this.formatTimecode(this.currentTime);
    this.frameNumLabel.textContent = this.currentFrame;
    if (this.videoMeta?.duration > 0) {
      this.scrubber.value = ((this.currentTime / this.videoMeta.duration) * 100).toFixed(2);
    }

    // Fetch frame from server
    try {
      const res = await fetch('/api/magic-mask/extract-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.mediaPath,
          timestamp_s: this.currentTime,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      
      const img = new Image();
      img.onload = () => {
        this.baseFrameImg = img;
        this.renderCanvas();
      };
      img.src = data.image_data_uri;
    } catch (e) {
      console.warn('Frame seek error:', e);
    }
  }

  stepFrame(delta) {
    const fps = this.videoMeta?.fps || 30.0;
    const target = this.currentTime + (delta / fps);
    this.seekToTimestamp(target);
  }

  togglePlay() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
      this.playBtn.textContent = '▶';
    } else {
      this.playBtn.textContent = '⏸';
      const fps = this.videoMeta?.fps || 30.0;
      this.playInterval = setInterval(() => {
        if (this.currentTime >= (this.videoMeta?.duration || 0)) {
          this.togglePlay();
          return;
        }
        this.stepFrame(1);
      }, 1000 / fps);
    }
  }

  setPreviewMode(mode) {
    this.previewMode = mode;
    this.modeMagentaBtn.classList.toggle('active', mode === 'magenta');
    this.modeCutoutBtn.classList.toggle('active', mode === 'cutout');
    this.modeMatteBtn.classList.toggle('active', mode === 'matte');
    this.renderCanvas();
  }

  initCanvasDrawing() {
    let isDrawing = false;
    let startPos = null;
    let lastPoint = null;
    let tempBox = null;

    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
      };
    };

    const startAction = (pos) => {
      if (!this.baseFrameImg) return;
      isDrawing = true;
      startPos = pos;
      lastPoint = pos;
      if (this.firstTimeHint) this.firstTimeHint.style.display = 'none';

      if (this.currentTool === 'box') {
        tempBox = [pos.x, pos.y, pos.x, pos.y];
        this.currentBbox = tempBox;
      } else {
        const color = this.activeBrushLabel === 1 ? '#10b981' : '#ef4444';
        this.currentStroke = {
          label: this.activeBrushLabel,
          size: this.brushSize,
          color: color,
          points: [pos],
          isLasso: this.currentTool === 'lasso',
        };
        this.strokes.push(this.currentStroke);
      }
      this.renderCanvas();
    };

    const moveAction = (pos) => {
      if (!isDrawing) return;

      if (this.currentTool === 'box') {
        const xmin = Math.min(startPos.x, pos.x);
        const ymin = Math.min(startPos.y, pos.y);
        const xmax = Math.max(startPos.x, pos.x);
        const ymax = Math.max(startPos.y, pos.y);
        tempBox = [xmin, ymin, xmax, ymax];
        this.currentBbox = tempBox;
        this.renderCanvas();
        return;
      }

      if (!this.currentStroke) return;

      // Smart point distance check: prevent point explosion
      // Brush samples every 32px; Lasso samples every 20px
      const minDistance = this.currentTool === 'lasso' ? 20 : 32;
      const dx = pos.x - lastPoint.x;
      const dy = pos.y - lastPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Cap points per stroke to prevent SAM 2 degradation
      const maxPts = this.currentTool === 'lasso' ? 36 : 12;

      if (dist >= minDistance && this.currentStroke.points.length < maxPts) {
        this.currentStroke.points.push(pos);
        lastPoint = pos;
        this.renderCanvas();
      }
    };

    const endAction = () => {
      if (!isDrawing) return;
      isDrawing = false;

      if (this.currentTool === 'box') {
        if (tempBox && (tempBox[2] - tempBox[0] > 20) && (tempBox[3] - tempBox[1] > 20)) {
          this.currentBbox = tempBox;
        } else {
          this.currentBbox = null;
        }
      }

      this.renderCanvas();
      this.debouncedSegmentRequest();
    };

    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => startAction(getCanvasPos(e)));
    window.addEventListener('mousemove', (e) => {
      if (isDrawing) moveAction(getCanvasPos(e));
    });
    window.addEventListener('mouseup', endAction);

    // Touch Events for trackpad/iPad
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches && e.touches[0]) startAction(getCanvasPos(e.touches[0]));
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (isDrawing && e.touches && e.touches[0]) {
        moveAction(getCanvasPos(e.touches[0]));
      }
    });
    window.addEventListener('touchend', endAction);
  }

  undoStroke() {
    if (this.currentBbox) {
      this.currentBbox = null;
    } else if (this.strokes.length > 0) {
      this.strokes.pop();
    }
    this.renderCanvas();
    this.debouncedSegmentRequest();
  }

  clearAllStrokes() {
    this.strokes = [];
    this.currentBbox = null;
    this.maskImg = null;
    this.cutoutImg = null;
    this.statsBadge.textContent = '0 points';
    this.renderCanvas();
    showToast('Strokes cleared');
  }

  debouncedSegmentRequest() {
    clearTimeout(this.segmentDebounceTimer);
    this.segmentDebounceTimer = setTimeout(() => {
      this.requestSegmentPreview();
    }, 160);
  }

  async requestSegmentPreview() {
    if (!this.mediaPath || (!this.currentBbox && this.strokes.length === 0)) {
      this.maskImg = null;
      this.cutoutImg = null;
      this.renderCanvas();
      return;
    }

    // Flatten sampled points and labels
    const points = [];
    const labels = [];
    let count = 0;

    for (const stroke of this.strokes) {
      for (const p of stroke.points) {
        points.push([p.x, p.y]);
        labels.push(stroke.label);
        count++;
      }
    }

    if (!this.currentBbox && points.length === 0) return;

    this.statsBadge.textContent = this.currentBbox ? 'Box Selected' : `${count} points`;
    if (this.segmentLoading) this.segmentLoading.style.display = 'flex';
    this.isSegmenting = true;

    try {
      const res = await fetch('/api/magic-mask/segment-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.mediaPath,
          timestamp_s: this.currentTime,
          points: points.length > 0 ? points : null,
          labels: labels.length > 0 ? labels : null,
          bbox: this.currentBbox,
          feather: this.feather,
          expand: this.expand,
          invert: this.isInverted,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const mask = new Image();
      const cutout = new Image();
      let loaded = 0;
      const onLoaded = () => {
        loaded++;
        if (loaded >= 2) {
          this.maskImg = mask;
          this.cutoutImg = cutout;
          this.renderCanvas();
          if (this.segmentLoading) this.segmentLoading.style.display = 'none';
          this.isSegmenting = false;
          const statusText = this.currentBbox ? 'Box' : `${count} pts`;
          this.statsBadge.textContent = `${statusText} • ${data.coverage_pct}% cov • ${data.inference_time_ms}ms`;

          if (data.coverage_pct === 0) {
            showToast('No subject detected. Draw a stroke across the center of your subject.', 'warning');
          }
        }
      };
      mask.onload = onLoaded;
      cutout.onload = onLoaded;
      mask.onerror = onLoaded;
      cutout.onerror = onLoaded;
      mask.src = data.mask_data_uri;
      cutout.src = data.cutout_data_uri;
    } catch (err) {
      console.error('Segment error:', err);
      if (this.segmentLoading) this.segmentLoading.style.display = 'none';
      this.isSegmenting = false;
    }
  }

  renderCanvas() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h || !this.baseFrameImg) return;

    this.ctx.clearRect(0, 0, w, h);

    if (this.previewMode === 'cutout' && this.cutoutImg) {
      // 1. Draw transparency checkerboard pattern
      this.drawCheckerboard(w, h);
      // 2. Draw 32-bit RGBA cutout with transparent alpha
      this.ctx.drawImage(this.cutoutImg, 0, 0, w, h);

    } else if (this.previewMode === 'matte' && this.maskImg) {
      // Solid black background + white mask
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.drawImage(this.maskImg, 0, 0, w, h);

    } else {
      // Default: Magenta DaVinci Resolve Magic Mask Glow
      this.ctx.drawImage(this.baseFrameImg, 0, 0, w, h);

      if (this.maskImg) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w;
        offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d');

        // Draw magenta tint (#E91E63)
        offCtx.fillStyle = '#e91e63';
        offCtx.fillRect(0, 0, w, h);

        // Clip to mask
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.drawImage(this.maskImg, 0, 0, w, h);

        // Blend over base frame with glowing alpha
        this.ctx.save();
        this.ctx.globalAlpha = 0.50;
        this.ctx.drawImage(offCanvas, 0, 0);
        this.ctx.restore();
      }
    }

    // Draw bounding box if active
    if (this.currentBbox) {
      const [bx1, by1, bx2, by2] = this.currentBbox;
      this.ctx.save();
      this.ctx.strokeStyle = '#d97757';
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([8, 6]);
      this.ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
      this.ctx.fillStyle = 'rgba(217, 119, 87, 0.12)';
      this.ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1);
      this.ctx.restore();
    }

    // Draw user strokes overlay on top
    this.drawStrokes();
  }

  drawCheckerboard(w, h) {
    const size = Math.max(16, Math.round(w / 60));
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        this.ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#262626' : '#1a1a1a';
        this.ctx.fillRect(x, y, size, size);
      }
    }
  }

  drawStrokes() {
    if (this.strokes.length === 0) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (const stroke of this.strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.size || 20;

      if (stroke.points.length === 1) {
        this.ctx.fillStyle = stroke.color;
        this.ctx.beginPath();
        this.ctx.arc(stroke.points[0].x, stroke.points[0].y, (stroke.size || 20) / 2, 0, Math.PI * 2);
        this.ctx.fill();
        continue;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        this.ctx.lineTo(pt.x, pt.y);
      }
      this.ctx.stroke();

      // Highlight point vertices
      this.ctx.fillStyle = '#ffffff';
      for (const pt of stroke.points) {
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  async startTracking() {
    if (!this.mediaPath) {
      showToast('No video loaded!', 'warning');
      return;
    }
    if (!this.currentBbox && this.strokes.length === 0) {
      showToast('Please draw a stroke or drag a box over your subject first!', 'warning');
      return;
    }

    const points = [];
    const labels = [];
    for (const s of this.strokes) {
      for (const p of s.points) {
        points.push([p.x, p.y]);
        labels.push(s.label);
      }
    }

    const selectedFormat = document.querySelector('input[name="mmExportFormat"]:checked')?.value || 'prores_alpha';

    // Show Progress Card
    this.progressCard.style.display = 'block';
    this.successCard.style.display = 'none';
    this.trackAndExportBtn.disabled = true;
    this.progressBar.style.width = '0%';
    this.progressPercent.textContent = '0%';
    this.progEta.textContent = 'initializing...';

    showToast('Starting SAM 2.1 video tracking on Apple Silicon...');

    try {
      const res = await fetch('/api/magic-mask/track-and-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_path: this.mediaPath,
          points: points.length > 0 ? points : null,
          labels: labels.length > 0 ? labels : null,
          bbox: this.currentBbox,
          export_mode: selectedFormat,
          feather: this.feather,
          expand: this.expand,
          invert: this.isInverted,
          start_time: this.rangeIn,
          end_time: this.rangeOut,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.activeTaskId = data.task_id;

      // Start polling task progress
      this.pollProgress(this.activeTaskId);

    } catch (err) {
      console.error(err);
      showToast(`Tracking error: ${err.message}`, 'error');
      this.trackAndExportBtn.disabled = false;
      this.progressCard.style.display = 'none';
    }
  }

  pollProgress(taskId) {
    clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/magic-mask/progress/${taskId}`);
        if (!res.ok) return;
        const task = await res.json();

        if (task.status === 'tracking' || task.status === 'starting') {
          const pct = Math.round(task.percent || 0);
          this.progressBar.style.width = `${pct}%`;
          this.progressPercent.textContent = `${pct}%`;
          this.progFrame.textContent = task.frame || 0;
          this.progTotal.textContent = task.total_frames || 0;
          this.progFps.textContent = (task.fps || 0.0).toFixed(1);
          this.progElapsed.textContent = `${Math.round(task.elapsed_s || 0)}s`;
          this.progEta.textContent = task.eta_s ? `${Math.round(task.eta_s)}s` : 'calculating...';

        } else if (task.status === 'completed') {
          clearInterval(this.pollInterval);
          this.onTrackingComplete(task.result);

        } else if (task.status === 'error') {
          clearInterval(this.pollInterval);
          this.trackAndExportBtn.disabled = false;
          this.progressCard.style.display = 'none';
          showToast(`Tracking error: ${task.error}`, 'error');
        }
      } catch (err) {
        console.warn('Progress poll error:', err);
      }
    }, 600);
  }

  async cancelTracking() {
    if (!this.activeTaskId) return;
    try {
      await fetch(`/api/magic-mask/cancel/${this.activeTaskId}`, { method: 'POST' });
      clearInterval(this.pollInterval);
      showToast('Tracking cancelled');
      this.trackAndExportBtn.disabled = false;
      this.progressCard.style.display = 'none';
    } catch (e) {
      console.error(e);
    }
  }

  onTrackingComplete(result) {
    this.trackAndExportBtn.disabled = false;
    this.progressCard.style.display = 'none';
    this.successCard.style.display = 'block';
    this.successCard.scrollIntoView({ behavior: 'smooth' });

    this.successFilename.textContent = result.filename;
    this.successMeta.textContent = `${result.frames_rendered} frames • ${result.file_size_mb} MB • Rendered in ${result.render_time_s}s`;

    showToast('🎉 Rotoscope complete! Saved to Downloads', 'success');
  }

  openGuideModal() {
    if (this.davinciMmModalOverlay) {
      this.davinciMmModalOverlay.style.display = 'flex';
    }
  }

  closeGuideModal() {
    if (this.davinciMmModalOverlay) {
      this.davinciMmModalOverlay.style.display = 'none';
    }
  }
}

// Global initialization
window.MagicMaskStudio = MagicMaskStudio;
