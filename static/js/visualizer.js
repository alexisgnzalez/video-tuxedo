/**
 * Video Tuxedo - Audio Waveform & Visualizer Engine
 */

class AudioWaveformVisualizer {
  constructor(canvasId, mediaElementId) {
    this.canvas = document.getElementById(canvasId);
    this.mediaElement = document.getElementById(mediaElementId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.isInitialized = false;

    if (this.canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.drawIdleWaveform();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    if (this.ctx) {
      this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
  }

  initAudioContext() {
    if (this.isInitialized || !this.mediaElement) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      try {
        this.source = this.audioContext.createMediaElementSource(this.mediaElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } catch (e) {
        console.warn("MediaElement already connected or restricted cross-origin. Using synthetic visualizer fallback.", e);
      }

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API initialization failed:", e);
    }
  }

  start() {
    this.initAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.drawIdleWaveform();
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;

    this.ctx.clearRect(0, 0, width, height);

    // If real analyser data available and playing
    if (this.analyser && this.dataArray && !this.mediaElement.paused) {
      this.analyser.getByteFrequencyData(this.dataArray);
      const barCount = 48;
      const barWidth = (width / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * this.dataArray.length);
        const value = this.dataArray[dataIndex] || 0;
        const percent = value / 255;
        const barHeight = Math.max(3, percent * (height - 8));
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#818cf8');
        gradient.addColorStop(0.5, '#6366f1');
        gradient.addColorStop(1, '#a855f7');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, barWidth, barHeight, 2);
        this.ctx.fill();
      }
    } else if (!this.mediaElement.paused) {
      // Dynamic synthetic waveform based on playback time
      this.drawSyntheticWaveform(width, height, true);
    } else {
      this.drawIdleWaveform();
    }
  }

  drawSyntheticWaveform(width, height, isPlaying) {
    const barCount = 48;
    const barWidth = (width / barCount) - 2;
    const time = Date.now() * 0.005;

    for (let i = 0; i < barCount; i++) {
      const sinVal = Math.sin(time + i * 0.25);
      const cosVal = Math.cos(time * 0.8 + i * 0.15);
      const heightMultiplier = isPlaying ? (Math.abs(sinVal * cosVal) * 0.7 + 0.15) : 0.08;
      const barHeight = Math.max(3, heightMultiplier * (height - 8));
      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      const gradient = this.ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#06b6d4');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, 2);
      this.ctx.fill();
    }
  }

  drawIdleWaveform() {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;

    this.ctx.clearRect(0, 0, width, height);
    const barCount = 48;
    const barWidth = (width / barCount) - 2;

    for (let i = 0; i < barCount; i++) {
      const staticPattern = Math.sin(i * 0.4) * 0.5 + 0.5;
      const barHeight = Math.max(3, staticPattern * (height * 0.35) + 3);
      const x = i * (barWidth + 2);
      const y = (height - barHeight) / 2;

      this.ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, 2);
      this.ctx.fill();
    }
  }
}

window.AudioWaveformVisualizer = AudioWaveformVisualizer;
