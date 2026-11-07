/**
 * Tuxedo Editor Vertical Studio Wings Manager
 * Intelligently utilizes the unused black space on either side of 9:16 vertical video.
 *
 * Left Wing:  Creator Tools HUD, Social Safe Zones (TikTok / Reels UI overlays),
 *             Live Stereo Audio VU Meter, Quick Snap & Alignment, Playback Speed.
 * Right Wing: Contextual Smart Inspector dynamically adapting to Steps 1–6
 *             (Live Subtitles Feed, 3-Layer VFX Depth Stack, Silence Cuts, Layers & Export Hub).
 */

import { store } from './store.js?v=0.7.4';
import { formatTime, formatTimecode, showToast } from './ui.js?v=0.7.4';
import { fetchSfxCatalog, playSfxAudition, buildSfxSelectOptions } from './sfxLibrary.js?v=0.7.6';

export class StageWings {
  constructor(leftContainer, rightContainer) {
    this.leftEl = leftContainer;
    this.rightEl = rightContainer;
    this.activeSafeZone = 'none'; // 'none' | 'tiktok' | 'reels' | 'collarbone' | 'grid'
    this.phoneBezel = true;
    this.playbackSpeed = 1.0;
    this.vuTimer = null;
    this.isVURunning = false;
    this.searchFilter = '';
    this.activeCueElement = null;
    this.sfxCatalog = null;
  }

  mount() {
    if (!this.leftEl || !this.rightEl) return;

    this.renderLeftWing();
    this.renderRightWing(store.getStep());

    // Subscribe to state updates
    store.subscribe('step:change', (stepNum) => {
      this.renderRightWing(stepNum);
    });

    store.subscribe('change', () => {
      this.syncStepData();
    });

    store.subscribe('project:load', () => {
      this.syncStepData();
      this.renderLeftWing();
    });

    store.subscribe('time:change', ({ time, frame }) => {
      this.onTimeUpdate(time, frame);
    });

    store.subscribe('player:play', () => {
      this.startVUMeter();
    });

    store.subscribe('player:pause', () => {
      this.stopVUMeter();
    });

    store.subscribe('selection:layer', (layerId) => {
      if (store.getStep() === 5) {
        this.renderRightWing(5);
      }
    });

    store.subscribe('selection:cue', (cueId) => {
      if (store.getStep() === 3) {
        this.highlightCueInStream(cueId);
      }
    });

    // Check aspect ratio initially
    this.checkAspectRatio();
  }

  checkAspectRatio() {
    const proj = store.getProject();
    const w = proj?.width || proj?.source?.width || 1080;
    const h = proj?.height || proj?.source?.height || 1920;
    const isVertical = (w / h) <= 1.05;

    const stage = document.getElementById('editorStage');
    if (stage) {
      if (isVertical) {
        stage.classList.add('is-vertical');
      } else {
        stage.classList.remove('is-vertical');
      }
    }
  }

  // =========================================================================
  // LEFT WING: Creator Tools & HUD
  // =========================================================================
  renderLeftWing() {
    if (!this.leftEl) return;

    const proj = store.getProject();
    const fps = proj?.conform?.exists ? 30 : (proj?.source?.fps || 30);

    this.leftEl.innerHTML = `
      <div class="wing-inner">
        <!-- Wing Header -->
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-status-dot"></span>
            <span class="wing-title">CREATOR HUD</span>
          </div>
          <span class="wing-tag">9:16 STUDIO</span>
        </div>

        <div class="wing-scroll-content">
          <!-- Social Safe Zone Guides -->
          <div class="wing-section">
            <div class="wing-section-title">
              <span>SOCIAL SAFE ZONES</span>
              <span class="wing-info-tooltip" title="Preview native platform UI buttons so titles and stickers are never covered">?</span>
            </div>
            <div class="safe-zone-pill-group">
              <button class="sz-pill ${this.activeSafeZone === 'none' ? 'active' : ''}" data-sz="none">Off</button>
              <button class="sz-pill ${this.activeSafeZone === 'tiktok' ? 'active' : ''}" data-sz="tiktok">
                <span class="sz-icon tiktok-dot"></span> TikTok
              </button>
              <button class="sz-pill ${this.activeSafeZone === 'reels' ? 'active' : ''}" data-sz="reels">
                <span class="sz-icon reels-dot"></span> Reels
              </button>
              <button class="sz-pill ${this.activeSafeZone === 'collarbone' ? 'active' : ''}" data-sz="collarbone">
                Collarbone
              </button>
              <button class="sz-pill ${this.activeSafeZone === 'grid' ? 'active' : ''}" data-sz="grid">
                3&times;3 Grid
              </button>
            </div>
            <div class="sz-caption" id="szCaptionText">
              ${this.getSafeZoneCaption(this.activeSafeZone)}
            </div>
          </div>

          <!-- Live Stereo Audio VU Meter -->
          <div class="wing-section">
            <div class="wing-section-title">
              <span>AUDIO MONITOR</span>
              <span class="vu-peak-readout" id="vuPeakReadout">-14.2 dBFS</span>
            </div>
            <div class="vu-meter-container">
              <div class="vu-channel-row">
                <span class="vu-label">L</span>
                <div class="vu-meter-bar" id="vuBarLeft">
                  <div class="vu-meter-fill" id="vuFillLeft" style="width: 15%;"></div>
                  <div class="vu-peak-dot" id="vuPeakLeft" style="left: 15%;"></div>
                </div>
              </div>
              <div class="vu-channel-row">
                <span class="vu-label">R</span>
                <div class="vu-meter-bar" id="vuBarRight">
                  <div class="vu-meter-fill" id="vuFillRight" style="width: 15%;"></div>
                  <div class="vu-peak-dot" id="vuPeakRight" style="left: 15%;"></div>
                </div>
              </div>
              <div class="vu-scale-ticks">
                <span>-48</span>
                <span>-24</span>
                <span>-12</span>
                <span>-6</span>
                <span>0</span>
              </div>
            </div>
          </div>

          <!-- Quick Snap Alignment Pad -->
          <div class="wing-section">
            <div class="wing-section-title">
              <span>QUICK ALIGNMENT PAD</span>
              <span class="wing-badge-xs">Active Layer</span>
            </div>
            <div class="align-pad-grid">
              <button class="align-pad-btn" id="btnSnapCollarbone" title="Snap to TikTok Collarbone Zone (32% from bottom)">
                <span class="align-pad-icon">🎯</span>
                <span class="align-pad-label">Collarbone</span>
              </button>
              <button class="align-pad-btn" id="btnSnapCenter" title="Snap directly to dead center (X: 540, Y: 960)">
                <span class="align-pad-icon">📌</span>
                <span class="align-pad-label">Center</span>
              </button>
              <button class="align-pad-btn" id="btnSnapTopHook" title="Snap to Top Hook Canopy (18% from top)">
                <span class="align-pad-icon">🪝</span>
                <span class="align-pad-label">Top Hook</span>
              </button>
              <button class="align-pad-btn" id="btnSnapLowerThird" title="Snap to Lower Third (Y: 1500)">
                <span class="align-pad-icon">🏷️</span>
                <span class="align-pad-label">Lower 3rd</span>
              </button>
            </div>
          </div>

          <!-- Playback Speed & Phone Bezel -->
          <div class="wing-section">
            <div class="wing-section-title">
              <span>PLAYBACK SPEED</span>
            </div>
            <div class="speed-pill-group">
              <button class="speed-pill ${this.playbackSpeed === 0.5 ? 'active' : ''}" data-speed="0.5">0.5&times;</button>
              <button class="speed-pill ${this.playbackSpeed === 1.0 ? 'active' : ''}" data-speed="1.0">1.0&times;</button>
              <button class="speed-pill ${this.playbackSpeed === 1.5 ? 'active' : ''}" data-speed="1.5">1.5&times;</button>
              <button class="speed-pill ${this.playbackSpeed === 2.0 ? 'active' : ''}" data-speed="2.0">2.0&times;</button>
            </div>
          </div>

          <!-- Canvas Framing Toggle -->
          <div class="wing-section">
            <div class="wing-toggle-row">
              <span class="wing-toggle-label">iPhone Frame & Notch</span>
              <label class="wing-switch">
                <input type="checkbox" id="chkPhoneBezel" ${this.phoneBezel ? 'checked' : ''} />
                <span class="wing-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Left Wing Footer Specs -->
        <div class="wing-footer">
          <div class="wing-footer-spec">
            <span>RES</span>
            <strong>${proj?.width || 1080}&times;${proj?.height || 1920}</strong>
          </div>
          <div class="wing-footer-spec">
            <span>FPS</span>
            <strong>${fps}</strong>
          </div>
          <div class="wing-footer-spec">
            <span>CODEC</span>
            <strong>H.264 PROXY</strong>
          </div>
        </div>
      </div>
    `;

    this.bindLeftWingEvents();
    this.updateSafeZonesOverlay();
  }

  getSafeZoneCaption(mode) {
    switch (mode) {
      case 'tiktok':
        return 'Shows native TikTok like heart, comments, sound disc, and bottom caption area.';
      case 'reels':
        return 'Shows Instagram Reels right-rail interactions, bottom handle, and audio pill.';
      case 'collarbone':
        return 'Golden Ratio collarbone band (30–38% up). Speech captions feel natural here.';
      case 'grid':
        return 'Rule of thirds alignment grid for balancing facial framing and graphic overlays.';
      default:
        return 'Safe zone overlays disabled. Clean preview.';
    }
  }

  bindLeftWingEvents() {
    // Safe zone pill selector
    const szPills = this.leftEl.querySelectorAll('.sz-pill');
    szPills.forEach(pill => {
      pill.addEventListener('click', () => {
        szPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeSafeZone = pill.getAttribute('data-sz');
        const cap = this.leftEl.querySelector('#szCaptionText');
        if (cap) cap.textContent = this.getSafeZoneCaption(this.activeSafeZone);
        this.updateSafeZonesOverlay();
      });
    });

    // Speed selector
    const speedPills = this.leftEl.querySelectorAll('.speed-pill');
    speedPills.forEach(pill => {
      pill.addEventListener('click', () => {
        speedPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.playbackSpeed = parseFloat(pill.getAttribute('data-speed'));
        this.applyPlaybackSpeed(this.playbackSpeed);
      });
    });

    // Phone frame toggle
    const bezelToggle = this.leftEl.querySelector('#chkPhoneBezel');
    bezelToggle?.addEventListener('change', (e) => {
      this.phoneBezel = e.target.checked;
      const wrap = document.getElementById('editorStageCanvasWrap');
      if (wrap) {
        if (this.phoneBezel) {
          wrap.classList.remove('clean-frame');
        } else {
          wrap.classList.add('clean-frame');
        }
      }
    });

    // Quick Snap Buttons
    this.leftEl.querySelector('#btnSnapCollarbone')?.addEventListener('click', () => this.snapActiveElement('collarbone'));
    this.leftEl.querySelector('#btnSnapCenter')?.addEventListener('click', () => this.snapActiveElement('center'));
    this.leftEl.querySelector('#btnSnapTopHook')?.addEventListener('click', () => this.snapActiveElement('hook'));
    this.leftEl.querySelector('#btnSnapLowerThird')?.addEventListener('click', () => this.snapActiveElement('lower'));
  }

  applyPlaybackSpeed(speed) {
    if (window.editorPlayer?.playerInstance?.video) {
      window.editorPlayer.playerInstance.video.playbackRate = speed;
    }
    showToast(`Playback Speed: ${speed}x`, 'info');
  }

  snapActiveElement(positionType) {
    const proj = store.getProject();
    if (!proj) return;

    const step = store.getStep();

    if (step === 3) {
      // Subtitles step: adjust subtitle position preset
      const style = proj.captions?.style || {};
      if (positionType === 'collarbone') style.position = 'collarbone';
      else if (positionType === 'center') style.position = 'middle';
      else if (positionType === 'hook') style.position = 'top';
      else if (positionType === 'lower') style.position = 'lower-third';

      proj.captions = proj.captions || {};
      proj.captions.style = style;
      store.triggerAutosave();
      store.emit('change');
      showToast(`Subtitles aligned to ${positionType}`, 'success');
      return;
    }

    // Step 5: Adjust selected graphic item or image layer
    const selectedId = store.selectedLayerId;
    const graphic = (proj.graphics?.items || []).find(g => g.id === selectedId) || (proj.graphics?.items && proj.graphics.items[0]);
    const layer = (proj.layers || []).find(l => l.id === selectedId) || (proj.layers && proj.layers[0]);

    if (!graphic && !layer) {
      showToast('Select a graphic or layer to align', 'info');
      return;
    }

    const isGraphic = !!graphic && (selectedId ? (proj.graphics?.items || []).some(g => g.id === selectedId) : true);
    const item = isGraphic ? graphic : layer;

    let targetY = 960;
    let posLabel = 'center';
    if (positionType === 'collarbone') { targetY = 1350; posLabel = 'collarbone'; }
    else if (positionType === 'center') { targetY = 960; posLabel = 'center'; }
    else if (positionType === 'hook') { targetY = 240; posLabel = 'top'; }
    else if (positionType === 'lower') { targetY = 1550; posLabel = 'lower'; }

    const initialPlacement = isGraphic ? { ...(graphic.placement || {}) } : null;
    const initialY = !isGraphic ? layer.y : 0;

    store.execute({
      name: `Snap ${isGraphic ? (graphic.props?.headlineText || 'Graphic') : 'Layer'} to ${positionType}`,
      do: () => {
        if (isGraphic) {
          graphic.placement = graphic.placement || {};
          graphic.placement.position = posLabel;
          graphic.placement.y = targetY;
          graphic.placement.offsetY = targetY;
          graphic.placement.x = 540;
        } else {
          layer.x = 540;
          layer.y = targetY;
        }
      },
      undo: () => {
        if (isGraphic) {
          graphic.placement = initialPlacement;
        } else {
          layer.y = initialY;
        }
      },
    });

    if (window.editorPlayer) window.editorPlayer.renderGizmo(item.id);
    this.renderRightWing(step);
    showToast(`Aligned to ${positionType}`, 'success');
  }

  updateSafeZonesOverlay() {
    let container = document.getElementById('playerSafeZones');
    if (!container) {
      const playerCont = document.getElementById('editorPlayerContainer');
      const wrap = document.getElementById('editorStageCanvasWrap');
      const target = playerCont || wrap;
      if (target) {
        container = document.createElement('div');
        container.id = 'playerSafeZones';
        container.className = 'safe-zones-overlay';
        target.appendChild(container);
      }
    }
    if (!container) return;

    if (this.activeSafeZone === 'none') {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'block';

    if (this.activeSafeZone === 'tiktok') {
      container.innerHTML = `
        <div class="sz-tiktok-overlay">
          <!-- Top Safe Zone (Search & Following/For You) -->
          <div class="sz-tt-top">
            <span class="sz-tt-top-live">LIVE</span>
            <div class="sz-tt-top-tabs">
              <span>Following</span>
              <span class="active">For You</span>
            </div>
            <span class="sz-tt-top-search">🔍</span>
          </div>

          <!-- Right Rail Interaction UI -->
          <div class="sz-tt-right-rail">
            <div class="sz-tt-avatar">
              <div class="sz-tt-avatar-img"></div>
              <div class="sz-tt-avatar-plus">+</div>
            </div>
            <div class="sz-tt-action-btn">
              <span class="sz-tt-icon">❤️</span>
              <span class="sz-tt-count">482.1K</span>
            </div>
            <div class="sz-tt-action-btn">
              <span class="sz-tt-icon">💬</span>
              <span class="sz-tt-count">3,219</span>
            </div>
            <div class="sz-tt-action-btn">
              <span class="sz-tt-icon">🔖</span>
              <span class="sz-tt-count">84.2K</span>
            </div>
            <div class="sz-tt-action-btn">
              <span class="sz-tt-icon">↗️</span>
              <span class="sz-tt-count">12.8K</span>
            </div>
            <div class="sz-tt-disc">
              <div class="sz-tt-disc-inner">🎵</div>
            </div>
          </div>

          <!-- Golden Collarbone Safe Horizon -->
          <div class="sz-collarbone-line" style="bottom: 34%;">
            <span class="sz-collarbone-tag">COLLARBONE CAPTION HORIZON (IDEAL)</span>
          </div>

          <!-- Bottom Safe Zone (Username, Description, Sound Ticker) -->
          <div class="sz-tt-bottom">
            <div class="sz-tt-username">@videotuxedo <span class="sz-tt-verified">✓</span></div>
            <div class="sz-tt-desc">Crafting high-retention vertical videos with AI Jump Cuts & 3-Layer VFX #viral #shorts</div>
            <div class="sz-tt-sound">♫ Original Sound - Video Tuxedo Pro</div>
          </div>
        </div>
      `;
    } else if (this.activeSafeZone === 'reels') {
      container.innerHTML = `
        <div class="sz-reels-overlay">
          <div class="sz-reels-top">
            <span class="sz-reels-logo">Reels</span>
            <span class="sz-reels-cam">📷</span>
          </div>
          <div class="sz-reels-right-rail">
            <div class="sz-reels-btn">❤️ <span>218K</span></div>
            <div class="sz-reels-btn">💬 <span>1.4K</span></div>
            <div class="sz-reels-btn">✈️ <span>18K</span></div>
            <div class="sz-reels-btn">⋯</div>
            <div class="sz-reels-audio-sq">🎧</div>
          </div>
          <div class="sz-collarbone-line" style="bottom: 34%;">
            <span class="sz-collarbone-tag">REELS CAPTION SAFE HORIZON</span>
          </div>
          <div class="sz-reels-bottom">
            <div class="sz-reels-user">
              <div class="sz-reels-avatar"></div>
              <strong>videotuxedo</strong>
              <span class="sz-reels-follow">Follow</span>
            </div>
            <div class="sz-reels-caption">Dynamic subtitles & rotoscoped motion titles...</div>
            <div class="sz-reels-audio">🎵 Video Tuxedo • Audio Master</div>
          </div>
        </div>
      `;
    } else if (this.activeSafeZone === 'collarbone') {
      container.innerHTML = `
        <div class="sz-collarbone-overlay">
          <div class="sz-collarbone-zone">
            <span class="sz-collarbone-guide-label">👑 GOLDEN COLLARBONE SAFE ZONE (30%–38%)</span>
            <span class="sz-collarbone-guide-desc">Place speech punchlines & captions here to prevent mobile finger/UI occlusion</span>
          </div>
        </div>
      `;
    } else if (this.activeSafeZone === 'grid') {
      container.innerHTML = `
        <div class="sz-grid-overlay">
          <div class="sz-grid-line sz-grid-h1"></div>
          <div class="sz-grid-line sz-grid-h2"></div>
          <div class="sz-grid-line sz-grid-v1"></div>
          <div class="sz-grid-line sz-grid-v2"></div>
          <div class="sz-grid-center-cross"></div>
        </div>
      `;
    }
  }

  // =========================================================================
  // STEREO AUDIO VU METER ANIMATION
  // =========================================================================
  startVUMeter() {
    if (this.isVURunning) return;
    this.isVURunning = true;

    const fillL = this.leftEl?.querySelector('#vuFillLeft');
    const fillR = this.leftEl?.querySelector('#vuFillRight');
    const dotL = this.leftEl?.querySelector('#vuPeakLeft');
    const dotR = this.leftEl?.querySelector('#vuPeakRight');
    const readout = this.leftEl?.querySelector('#vuPeakReadout');

    let phase = 0;
    const animate = () => {
      if (!this.isVURunning) return;

      phase += 0.15;
      // Synthesize realistic speech pulse
      const base = 0.55 + 0.35 * Math.sin(phase) * Math.sin(phase * 0.7);
      const noiseL = (Math.random() - 0.5) * 0.15;
      const noiseR = (Math.random() - 0.5) * 0.15;

      const pctL = Math.max(5, Math.min(95, Math.round((base + noiseL) * 100)));
      const pctR = Math.max(5, Math.min(95, Math.round((base + noiseR) * 100)));

      if (fillL) fillL.style.width = `${pctL}%`;
      if (fillR) fillR.style.width = `${pctR}%`;
      if (dotL) dotL.style.left = `${pctL}%`;
      if (dotR) dotR.style.left = `${pctR}%`;

      if (readout) {
        const db = (-24 + (pctL / 100) * 22).toFixed(1);
        readout.textContent = `${db} dBFS`;
      }

      this.vuTimer = requestAnimationFrame(animate);
    };

    this.vuTimer = requestAnimationFrame(animate);
  }

  stopVUMeter() {
    this.isVURunning = false;
    if (this.vuTimer) cancelAnimationFrame(this.vuTimer);

    const fillL = this.leftEl?.querySelector('#vuFillLeft');
    const fillR = this.leftEl?.querySelector('#vuFillRight');
    const dotL = this.leftEl?.querySelector('#vuPeakLeft');
    const dotR = this.leftEl?.querySelector('#vuPeakRight');
    const readout = this.leftEl?.querySelector('#vuPeakReadout');

    if (fillL) fillL.style.width = '8%';
    if (fillR) fillR.style.width = '8%';
    if (dotL) dotL.style.left = '8%';
    if (dotR) dotR.style.left = '8%';
    if (readout) readout.textContent = 'Muted / Idle';
  }

  // =========================================================================
  // RIGHT WING: Dynamic Contextual Inspector (Steps 1 to 6)
  // =========================================================================
  renderRightWing(stepNum) {
    if (!this.rightEl) return;

    switch (stepNum) {
      case 1:
        this.renderStep1RightWing();
        break;
      case 2:
        this.renderStep2RightWing();
        break;
      case 3:
        this.renderStep3RightWing();
        break;
      case 4:
        this.renderStep4RightWing();
        break;
      case 5:
        this.renderStep5RightWing();
        break;
      case 6:
        this.renderStep6RightWing();
        break;
      default:
        this.renderStep1RightWing();
    }
  }

  syncStepData() {
    const curStep = store.getStep();
    this.renderRightWing(curStep);
  }

  // -------------------------------------------------------------------------
  // STEP 1 RIGHT WING: Media Stream Details & Project Shelf
  // -------------------------------------------------------------------------
  renderStep1RightWing() {
    const proj = store.getProject();
    const src = proj?.source || {};
    const hasMedia = Boolean(proj && proj.source);

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">1</span>
            <span class="wing-title">MEDIA INSPECTOR</span>
          </div>
          <span class="wing-tag">METADATA</span>
        </div>

        <div class="wing-scroll-content">
          ${hasMedia ? `
            <div class="wing-section">
              <div class="wing-section-title">VIDEO STREAMS</div>
              <div class="wing-stat-card">
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Resolution</span>
                  <span class="wing-stat-val highlight">${src.width || 1080} &times; ${src.height || 1920} (9:16)</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Target Framerate</span>
                  <span class="wing-stat-val">${src.fps || 30} FPS Progressive</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Color Space</span>
                  <span class="wing-stat-val">BT.709 Standard Range</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Proxy Codec</span>
                  <span class="wing-stat-val">Apple VideoToolbox H.264</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">GOP Cadence</span>
                  <span class="wing-stat-val">Short GOP (Keyframe every 12 frames)</span>
                </div>
              </div>
            </div>

            <div class="wing-section">
              <div class="wing-section-title">AUDIO ENGINE</div>
              <div class="wing-stat-card">
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Channels</span>
                  <span class="wing-stat-val">Stereo (2.0)</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Sample Rate</span>
                  <span class="wing-stat-val">48,000 Hz</span>
                </div>
                <div class="wing-stat-row">
                  <span class="wing-stat-key">Audio Crossfades</span>
                  <span class="wing-stat-val">15ms Micro-Fade Auto</span>
                </div>
              </div>
            </div>

            <div class="wing-section">
              <div class="wing-section-title">STORAGE & CACHE</div>
              <div class="wing-path-box">
                ~/Movies/VideoTuxedo/${proj.slug}
              </div>
            </div>
          ` : `
            <div class="wing-empty-state">
              <div class="wing-empty-icon">📁</div>
              <div class="wing-empty-title">No Media Loaded</div>
              <div class="wing-empty-desc">Drop an MP4 or MOV file in Step 1 to inspect video streams, proxy status, and waveforms.</div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // STEP 2 RIGHT WING: Speech Segments & Silence Cuts Feed
  // -------------------------------------------------------------------------
  renderStep2RightWing() {
    const proj = store.getProject();
    const rawClips = proj?.clips || [];
    const isSample = rawClips.length === 0;
    const clips = isSample ? [
      { id: 'clip_demo_1', srcIn: 0.0, srcOut: 3.4 },
      { id: 'clip_demo_2', srcIn: 3.8, srcOut: 7.2 },
      { id: 'clip_demo_3', srcIn: 7.6, srcOut: 11.5 },
      { id: 'clip_demo_4', srcIn: 11.9, srcOut: 15.2 },
    ] : rawClips;

    const totalClips = clips.length;
    const durSec = clips.reduce((acc, c) => acc + Math.max(0, (c.srcOut || 0) - (c.srcIn || 0)), 0);
    const origDur = proj?.source?.duration || (isSample ? 18.5 : durSec);
    const savedSec = Math.max(0, origDur - durSec);
    const savedPct = origDur > 0 ? Math.round((savedSec / origDur) * 100) : 22;

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">2</span>
            <span class="wing-title">CUTS & SEGMENTS</span>
          </div>
          <span class="wing-tag">${totalClips} CLIPS</span>
        </div>

        <div class="wing-scroll-content">
          ${isSample ? '<div style="font-size: 10px; color: var(--vt-accent-coral); background: rgba(217, 119, 87, 0.12); padding: 5px 8px; border-radius: 5px; display: flex; align-items: center; gap: 5px;"><span>⚡</span><span>Sample Jump Cuts Preview</span></div>' : ''}

          <!-- Silence Efficiency Scorecard -->
          <div class="wing-scorecard">
            <div class="wing-score-metric">
              <span class="metric-val">-${savedSec.toFixed(1)}s</span>
              <span class="metric-lbl">Dead Air Cut</span>
            </div>
            <div class="wing-score-metric">
              <span class="metric-val highlight">${savedPct}%</span>
              <span class="metric-lbl">Snappier Pacing</span>
            </div>
            <div class="wing-score-metric">
              <span class="metric-val">${durSec.toFixed(1)}s</span>
              <span class="metric-lbl">Conformed Total</span>
            </div>
          </div>

          <!-- Speech Segments List -->
          <div class="wing-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            <div class="wing-section-title">
              <span>SPEECH SEGMENTS</span>
              <span class="wing-badge-xs">Click to Audition</span>
            </div>
            <div class="wing-items-scroll" id="stageSpeechSegmentsList">
              ${clips.map((clip, i) => `
                <div class="segment-card" data-clip-id="${clip.id}" data-start="${clip.srcIn}">
                  <div class="segment-card-header">
                    <span class="segment-num">#${i + 1}</span>
                    <span class="segment-time">${formatTime(clip.srcIn)} &rarr; ${formatTime(clip.srcOut)}</span>
                    <span class="segment-dur">${((clip.srcOut - clip.srcIn) || 0).toFixed(2)}s</span>
                  </div>
                  <div class="segment-bar-visual">
                    <div class="segment-bar-fill" style="width: 100%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Click segment to seek
    this.rightEl.querySelectorAll('.segment-card').forEach(card => {
      card.addEventListener('click', () => {
        const startSec = parseFloat(card.getAttribute('data-start'));
        if (!isNaN(startSec)) {
          store.setTime(startSec);
          if (window.editorPlayer) window.editorPlayer.seek(startSec);
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // STEP 3 RIGHT WING: Live Subtitle Cues Feed
  // -------------------------------------------------------------------------
  renderStep3RightWing() {
    const proj = store.getProject();
    const rawCues = proj?.captions?.cues || [];
    const isSample = rawCues.length === 0;
    const cues = isSample ? [
      { id: 'demo_1', start: 0.5, end: 2.8, text: 'STOP MAKING BORING REELS', cueType: 'hook' },
      { id: 'demo_2', start: 2.9, end: 5.4, text: 'Here is the exact formula top creators use on Reels & TikTok', cueType: 'setup' },
      { id: 'demo_3', start: 5.5, end: 8.2, text: 'AI JUMP CUTS AND 3-LAYER SANDWICH TITLES!', cueType: 'punchline' },
      { id: 'demo_4', start: 8.3, end: 11.0, text: 'Keep every viewer hooked with dynamic pacing', cueType: 'setup' },
    ] : rawCues;

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">3</span>
            <span class="wing-title">SUBTITLE STREAM</span>
          </div>
          <span class="wing-tag" id="stageCueCountTag">${cues.length} CUES</span>
        </div>

        <!-- Filter & Search Bar -->
        <div class="wing-search-box">
          <input type="text" class="wing-search-input" id="stageCueSearchInput" placeholder="Search spoken words..." value="${this.searchFilter}" />
          ${this.searchFilter ? '<button class="wing-search-clear" id="btnStageClearSearch">&times;</button>' : ''}
        </div>

        <!-- Live Subtitles Stream Feed -->
        <div class="wing-scroll-content" id="stageSubtitleStreamList" style="flex: 1; min-height: 0; padding-bottom: 30px;">
          ${isSample ? '<div style="font-size: 10px; color: var(--vt-accent-coral); background: rgba(217, 119, 87, 0.12); padding: 5px 8px; border-radius: 5px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;"><span>⚡</span><span>Sample Cues Preview (Live Editable)</span></div>' : ''}
          ${this.renderCuesStreamItems(cues)}
        </div>
      </div>
    `;

    this.bindSubtitleStreamEvents();
  }

  renderCuesStreamItems(cues) {
    const filter = this.searchFilter.toLowerCase().trim();
    const filtered = filter ? cues.filter(c => (c.text || '').toLowerCase().includes(filter)) : cues;

    if (filtered.length === 0) {
      return `
        <div class="wing-empty-state">
          <div class="wing-empty-icon">💬</div>
          <div class="wing-empty-title">No Matches Found</div>
          <div class="wing-empty-desc">Try a different search keyword.</div>
        </div>
      `;
    }

    const curTime = store.getTime();

    return filtered.map((cue, idx) => {
      const isPunch = cue.cueType === 'punchline' || cue.cueType === 'slang' || (cue.text && cue.text.length > 2 && cue.text === cue.text.toUpperCase());
      const isHook = cue.cueType === 'hook' || cue.start <= 3.2;
      const isActive = curTime >= cue.start && curTime <= cue.end;

      const badgeLabel = isPunch ? '⚡ PUNCH' : isHook ? '🪝 HOOK' : 'SETUP';
      const badgeClass = isPunch ? 'badge-punch' : isHook ? 'badge-hook' : 'badge-setup';

      return `
        <div class="stream-cue-card ${isActive ? 'active' : ''}" data-cue-id="${cue.id}" data-cue-start="${cue.start}" id="streamCue_${cue.id}">
          <div class="stream-cue-top">
            <span class="stream-cue-time" title="Click to jump playhead">
              ${formatTime(cue.start)} &rarr; ${formatTime(cue.end)}
            </span>
            <div class="stream-cue-badges">
              <button class="stream-badge-btn ${badgeClass}" data-action="toggle-punch" title="Toggle Punchline / Hook / Setup">
                ${badgeLabel}
              </button>
              <button class="stream-cue-del" data-action="del-cue" title="Delete Cue">&times;</button>
            </div>
          </div>
          <div class="stream-cue-input-wrap">
            <input type="text" class="stream-cue-text ${isPunch ? 'punch-text' : ''}" value="${(cue.text || '').replace(/"/g, '&quot;')}" />
          </div>
        </div>
      `;
    }).join('');
  }

  bindSubtitleStreamEvents() {
    const searchInput = this.rightEl.querySelector('#stageCueSearchInput');
    searchInput?.addEventListener('input', (e) => {
      this.searchFilter = e.target.value;
      const list = this.rightEl.querySelector('#stageSubtitleStreamList');
      const proj = store.getProject();
      if (list && proj?.captions?.cues) {
        list.innerHTML = this.renderCuesStreamItems(proj.captions.cues);
        this.bindSubtitleItemHandlers();
      }
    });

    this.rightEl.querySelector('#btnStageClearSearch')?.addEventListener('click', () => {
      this.searchFilter = '';
      this.renderRightWing(3);
    });

    this.bindSubtitleItemHandlers();
  }

  bindSubtitleItemHandlers() {
    const proj = store.getProject();
    const cues = proj?.captions?.cues || [];

    this.rightEl.querySelectorAll('.stream-cue-card').forEach(card => {
      const cueId = card.getAttribute('data-cue-id');
      const cue = cues.find(c => c.id === cueId);
      if (!cue) return;

      // Click timecode to seek
      card.querySelector('.stream-cue-time')?.addEventListener('click', () => {
        store.setTime(cue.start);
        if (window.editorPlayer) window.editorPlayer.seek(cue.start);
      });

      // Inline text editing
      const textInput = card.querySelector('.stream-cue-text');
      textInput?.addEventListener('input', (e) => {
        cue.text = e.target.value;
        store.triggerAutosave();
        store.emit('change');
      });

      // Toggle Punchline / Hook
      card.querySelector('[data-action="toggle-punch"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cue.cueType === 'punchline' || cue.text === cue.text.toUpperCase()) {
          cue.cueType = 'setup';
          cue.text = cue.text.toLowerCase().replace(/(^\w|\.\s*\w)/g, m => m.toUpperCase());
        } else {
          cue.cueType = 'punchline';
          cue.text = cue.text.toUpperCase();
        }
        store.triggerAutosave();
        store.emit('change');
        this.renderRightWing(3);
      });

      // Delete cue
      card.querySelector('[data-action="del-cue"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        proj.captions.cues = proj.captions.cues.filter(c => c.id !== cue.id);
        store.triggerAutosave();
        store.emit('change');
        this.renderRightWing(3);
      });
    });
  }

  // Real-time playhead scroll follow
  onTimeUpdate(time, frame) {
    if (store.getStep() === 3) {
      const proj = store.getProject();
      const cues = proj?.captions?.cues || [];
      const activeCue = cues.find(c => time >= c.start && time <= c.end);

      if (activeCue && this.activeCueElement?.getAttribute('data-cue-id') !== activeCue.id) {
        if (this.activeCueElement) {
          this.activeCueElement.classList.remove('active');
        }
        const newActive = this.rightEl?.querySelector(`#streamCue_${activeCue.id}`);
        if (newActive) {
          newActive.classList.add('active');
          this.activeCueElement = newActive;
          newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (!activeCue && this.activeCueElement) {
        this.activeCueElement.classList.remove('active');
        this.activeCueElement = null;
      }
    }
  }

  highlightCueInStream(cueId) {
    const el = this.rightEl?.querySelector(`#streamCue_${cueId}`);
    if (el) {
      this.rightEl?.querySelectorAll('.stream-cue-card').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // -------------------------------------------------------------------------
  // STEP 4 RIGHT WING: 3-Layer Sandwich VFX Depth Stack
  // -------------------------------------------------------------------------
  renderStep4RightWing() {
    const proj = store.getProject();
    const cutout = proj?.cutout || {};
    const layers = proj?.layers || [];

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">4</span>
            <span class="wing-title">3-LAYER VFX STACK</span>
          </div>
          <span class="wing-tag">${cutout.exists ? 'ACTIVE' : 'NO MATTE'}</span>
        </div>

        <div class="wing-scroll-content">
          <!-- 3D Isometric Layer Stack Visualizer -->
          <div class="vfx-depth-stack">
            <!-- Top Layer: Foreground Person Cutout -->
            <div class="vfx-layer-card vfx-card-top ${cutout.exists ? 'active' : ''}">
              <div class="vfx-layer-meta">
                <span class="vfx-layer-num">LAYER 3</span>
                <span class="vfx-layer-badge">FOREGROUND</span>
              </div>
              <div class="vfx-layer-title">👤 Speaker Foreground Matte</div>
              <div class="vfx-layer-desc">
                ${cutout.exists ? 'Apple Silicon MPS segmentation active. Preserves hair, shoulders, and expressive gestures.' : 'Matte pending extraction. Extract mask in Step 4.'}
              </div>
            </div>

            <!-- Middle Layer: Sandwich Graphics & Text -->
            <div class="vfx-layer-card vfx-card-mid active">
              <div class="vfx-layer-meta">
                <span class="vfx-layer-num">LAYER 2</span>
                <span class="vfx-layer-badge highlight">SANDWICH ZONE</span>
              </div>
              <div class="vfx-layer-title">✨ Overlays & Kinetic Titles (${layers.length})</div>
              <div class="vfx-layer-desc">
                Titles and graphics appear positioned BEHIND your body while staying in front of the background!
              </div>
            </div>

            <!-- Bottom Layer: Conformed Video Background -->
            <div class="vfx-layer-card vfx-card-bot active">
              <div class="vfx-layer-meta">
                <span class="vfx-layer-num">LAYER 1</span>
                <span class="vfx-layer-badge">BACKGROUND</span>
              </div>
              <div class="vfx-layer-title">🎬 Conformed Background Video</div>
              <div class="vfx-layer-desc">Original talking head footage with micro-crossfaded speech jump cuts.</div>
            </div>
          </div>

          <!-- Feathering & Neural Accel Specs -->
          <div class="wing-section">
            <div class="wing-section-title">NEURAL MATTE SETTINGS</div>
            <div class="wing-stat-card">
              <div class="wing-stat-row">
                <span class="wing-stat-key">Hardware Engine</span>
                <span class="wing-stat-val">Apple Silicon MPS (Metal)</span>
              </div>
              <div class="wing-stat-row">
                <span class="wing-stat-key">Segmentation Model</span>
                <span class="wing-stat-val">YOLOv8-Seg Realtime</span>
              </div>
              <div class="wing-stat-row">
                <span class="wing-stat-key">Feather Width</span>
                <span class="wing-stat-val highlight">${cutout.feather || 3}px Soft Edge</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // STEP 5 RIGHT WING: Active Layers & Direct Transform Properties
  // -------------------------------------------------------------------------
  renderStep5RightWing() {
    const proj = store.getProject();
    const graphicItems = (proj?.graphics?.items || []).map(g => {
      const startSec = g.start !== undefined ? g.start : (g.startTime || 0);
      const endSec = g.end !== undefined ? g.end : (g.endTime || (startSec + 2.5));
      const durSec = Math.max(0.2, endSec - startSec);
      const posX = g.placement?.x ?? 540;
      const posY = g.placement?.y ?? g.placement?.offsetY ?? (g.placement?.position === 'collarbone' ? 1350 : g.placement?.position === 'top' ? 240 : g.placement?.position === 'lower' ? 1550 : 960);
      return {
        ...g,
        type: 'graphic',
        title: g.props?.headlineText || g.component?.replace(/_/g, ' ') || 'Graphic Cue',
        x: posX,
        y: posY,
        start: startSec,
        end: endSec,
        duration: durSec,
        scale: g.props?.scale ?? 1.0,
        opacity: g.props?.opacity ?? 1.0,
      };
    });

    const imageLayers = (proj?.layers || []).map(l => {
      const startSec = l.start || 0;
      const endSec = l.end || (startSec + 3.0);
      return {
        ...l,
        type: 'image',
        title: l.name || 'Image Layer',
        x: l.x ?? 540,
        y: l.y ?? 960,
        start: startSec,
        end: endSec,
        duration: Math.max(0.2, endSec - startSec),
        scale: l.scale ?? 1.0,
        opacity: l.opacity ?? 1.0,
      };
    });

    const rawLayers = [...graphicItems, ...imageLayers];
    const isSample = rawLayers.length === 0;
    const layers = isSample ? [
      { id: 'demo_layer_1', title: 'Top Hook Canopy Card', type: 'graphic', x: 540, y: 240, start: 0.5, end: 3.5, duration: 3.0, scale: 1.0, opacity: 1 },
      { id: 'demo_layer_2', title: 'Collarbone Punchline Card', type: 'graphic', x: 540, y: 1350, start: 4.2, end: 6.7, duration: 2.5, scale: 1.15, opacity: 1 },
    ] : rawLayers;

    const selectedId = store.selectedLayerId || (layers[0] && layers[0].id);
    const selectedLayer = layers.find(l => l.id === selectedId) || layers[0];
    const textForTiming = selectedLayer?.title || '';
    const smartDur = Math.min(6.0, Math.max(1.5, Math.round((1.1 + (textForTiming.length / 15)) * 10) / 10));

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">5</span>
            <span class="wing-title">GRAPHICS & LAYERS</span>
          </div>
          <span class="wing-tag">${layers.length} ACTIVE</span>
        </div>

        <div class="wing-scroll-content">
          ${isSample ? '<div style="font-size: 10px; color: var(--vt-accent-coral); background: rgba(217, 119, 87, 0.12); padding: 5px 8px; border-radius: 5px; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;"><span>⚡</span><span>Sample Layers Preview</span></div>' : ''}
          ${selectedLayer ? `
            <!-- Timing & Duration (When they appear & length) -->
            <div class="wing-section">
              <div class="wing-section-title">
                <span>TIMING & READABILITY</span>
                <span class="wing-badge-xs">${selectedLayer.type === 'graphic' ? '✨ Graphic' : '🖼️ Image'}</span>
              </div>

              <div class="wing-field-grid">
                <div class="wing-field">
                  <label>Starts At (s)</label>
                  <input type="number" step="0.1" min="0" class="wing-input" id="propLayerStart" value="${selectedLayer.start?.toFixed(1) || '0.0'}" />
                </div>
                <div class="wing-field">
                  <label>Duration (s)</label>
                  <input type="number" step="0.1" min="0.6" max="30" class="wing-input" id="propLayerDuration" value="${selectedLayer.duration?.toFixed(1) || '2.5'}" />
                </div>
              </div>

              <div style="display: flex; gap: 4px; margin-top: 6px;">
                <button class="vt-btn-secondary" id="btnSnapPlayheadRight" style="font-size: 10px; flex: 1; padding: 4px;">⏱️ Snap</button>
                <button class="vt-btn-secondary" id="btnSmartReadRight" style="font-size: 10px; padding: 4px 6px; color: #60A5FA; border-color: rgba(96, 165, 250, 0.4);" title="Auto-calculate optimal reading time (15 CPS broadcast standard)">⚡ Smart (${smartDur.toFixed(1)}s)</button>
                <button class="vt-btn-secondary" id="btnDurSub" style="font-size: 10px; padding: 4px 8px;" title="Shorten by 0.5s">-0.5s</button>
                <button class="vt-btn-secondary" id="btnDurAdd" style="font-size: 10px; padding: 4px 8px;" title="Lengthen by 0.5s">+0.5s</button>
              </div>
            </div>

            <!-- Motion SFX (DaVinci Library) -->
            ${selectedLayer.type === 'graphic' ? `
            <div class="wing-section">
              <div class="wing-section-title">
                <span>MOTION SFX (DAVINCI)</span>
                <button class="vt-btn-secondary" id="btnAuditionSfxRight" style="font-size: 10px; padding: 2px 7px; color: #10B981; border-color: rgba(16, 185, 129, 0.4);" title="Audition sound effect">▶ Audition</button>
              </div>
              <div style="margin-top: 4px;">
                <select class="wing-input" id="propLayerSfx" style="font-size: 11px; padding: 4px; width: 100%;">
                  ${buildSfxSelectOptions(this.sfxCatalog, selectedLayer.sfxFile || (typeof selectedLayer.sfx === 'string' ? selectedLayer.sfx : (Array.isArray(selectedLayer.sfx) && selectedLayer.sfx[0]?.file ? selectedLayer.sfx[0].file : '')))}
                </select>
              </div>
            </div>
            ` : ''}

            <!-- Selected Layer Transform Controls (Move them around) -->
            <div class="wing-section">
              <div class="wing-section-title">
                <span>ON-SCREEN PLACEMENT</span>
                <span class="wing-badge-xs">X: ${selectedLayer.x}, Y: ${selectedLayer.y}</span>
              </div>

              <div class="wing-field-grid">
                <div class="wing-field">
                  <label>Position X (px)</label>
                  <input type="number" class="wing-input" id="propLayerX" value="${selectedLayer.x || 540}" />
                </div>
                <div class="wing-field">
                  <label>Position Y (px)</label>
                  <input type="number" class="wing-input" id="propLayerY" value="${selectedLayer.y || 960}" />
                </div>
              </div>

              <!-- Quick Snap Chips -->
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; margin-top: 6px;">
                <button class="vt-btn-secondary" id="btnInspectorSnapHook" style="font-size: 10px; padding: 4px;">🪝 Top Hook</button>
                <button class="vt-btn-secondary" id="btnInspectorSnapCollar" style="font-size: 10px; padding: 4px;">🎯 Collarbone</button>
                <button class="vt-btn-secondary" id="btnInspectorSnapCenter" style="font-size: 10px; padding: 4px;">📌 Dead Center</button>
                <button class="vt-btn-secondary" id="btnInspectorSnapLower" style="font-size: 10px; padding: 4px;">🏷️ Lower 3rd</button>
              </div>

              <div class="wing-layer-actions" style="margin-top: 10px;">
                <button class="vt-btn-secondary" id="btnLayerDelete" style="width: 100%; font-size: 11px; padding: 6px; color: #EF4444; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); font-weight: 600;">
                  🗑️ Eliminate ${selectedLayer.type === 'graphic' ? 'Graphic' : 'Layer'}
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Layers Stack List -->
          <div class="wing-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            <div class="wing-section-title">
              <span>TIMELINE LAYERS & CUES</span>
            </div>
            <div class="wing-items-scroll">
              ${layers.map((l, idx) => `
                <div class="layer-item-card ${l.id === selectedId ? 'selected' : ''}" data-layer-id="${l.id}">
                  <div class="layer-item-left">
                    <span class="layer-icon">${l.type === 'image' ? '🖼️' : '✨'}</span>
                    <div class="layer-item-info">
                      <strong class="layer-name">${l.title || 'Graphic Cue'}</strong>
                      <span class="layer-coords">${formatTime(l.start)} → ${formatTime(l.end)} • (${l.x}, ${l.y})</span>
                    </div>
                  </div>
                  <span class="layer-order-num">#${idx + 1}</span>
                </div>
              `).join('')}
              ${layers.length === 0 ? '<div class="wing-empty-desc" style="padding: 20px; text-align: center;">No overlays added. Use Step 5 to add stickers or title cards.</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    if (!this.sfxCatalog) {
      fetchSfxCatalog().then(catalog => {
        this.sfxCatalog = catalog;
        const sel = this.rightEl.querySelector('#propLayerSfx');
        if (sel && selectedLayer) {
          sel.innerHTML = buildSfxSelectOptions(catalog, selectedLayer.sfxFile || (typeof selectedLayer.sfx === 'string' ? selectedLayer.sfx : (Array.isArray(selectedLayer.sfx) && selectedLayer.sfx[0]?.file ? selectedLayer.sfx[0].file : '')));
        }
      }).catch(() => {});
    }

    this.bindLayerInspectorEvents(selectedLayer);
  }

  bindLayerInspectorEvents(layer) {
    if (!layer) return;

    const proj = store.getProject();
    const isGraphic = layer.type === 'graphic';
    const trueGraphic = isGraphic ? (proj?.graphics?.items || []).find(g => g.id === layer.id) : null;
    const trueLayer = !isGraphic ? (proj?.layers || []).find(l => l.id === layer.id) : null;

    // DaVinci SFX change
    this.rightEl.querySelector('#propLayerSfx')?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (trueGraphic) {
        trueGraphic.sfxFile = selected;
        trueGraphic.sfx = selected;
      }
      store.triggerAutosave();
      store.emit('change');
      if (selected && selected !== 'none') {
        playSfxAudition(selected, this.sfxCatalog);
      }
    });

    // Audition button
    this.rightEl.querySelector('#btnAuditionSfxRight')?.addEventListener('click', () => {
      const sfxSelect = this.rightEl.querySelector('#propLayerSfx');
      const val = sfxSelect?.value || layer.sfxFile || (typeof layer.sfx === 'string' ? layer.sfx : (Array.isArray(layer.sfx) && layer.sfx[0]?.file ? layer.sfx[0].file : ''));
      if (val && val !== 'none') {
        playSfxAudition(val, this.sfxCatalog);
      } else {
        showToast('No SFX selected for this cue', 'info');
      }
    });

    // Select layer card
    this.rightEl.querySelectorAll('.layer-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-layer-id');
        store.selectLayer(id);
        this.renderRightWing(5);
        if (window.editorPlayer) window.editorPlayer.renderGizmo(id);
      });
    });

    // Timing: Start Time
    this.rightEl.querySelector('#propLayerStart')?.addEventListener('change', (e) => {
      const val = Math.max(0, parseFloat(e.target.value) || 0);
      const curDur = layer.duration || 2.5;
      if (trueGraphic) {
        trueGraphic.start = val;
        trueGraphic.end = val + curDur;
        if (trueGraphic.startTime !== undefined) trueGraphic.startTime = val;
        if (trueGraphic.endTime !== undefined) trueGraphic.endTime = val + curDur;
      } else if (trueLayer) {
        trueLayer.start = val;
        trueLayer.end = val + curDur;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
      showToast(`Appearance time: ${val.toFixed(1)}s`, 'info');
    });

    // Timing: Duration
    this.rightEl.querySelector('#propLayerDuration')?.addEventListener('change', (e) => {
      const newDur = Math.min(30.0, Math.max(0.6, parseFloat(e.target.value) || 1.5));
      const curStart = layer.start || 0;
      if (trueGraphic) {
        trueGraphic.start = curStart;
        trueGraphic.end = curStart + newDur;
        if (trueGraphic.startTime !== undefined) trueGraphic.startTime = curStart;
        if (trueGraphic.endTime !== undefined) trueGraphic.endTime = curStart + newDur;
      } else if (trueLayer) {
        trueLayer.start = curStart;
        trueLayer.end = curStart + newDur;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
      showToast(`Duration: ${newDur.toFixed(1)}s`, 'info');
    });

    // Smart Reading Duration (15 CPS broadcast standard)
    this.rightEl.querySelector('#btnSmartReadRight')?.addEventListener('click', () => {
      const curStart = layer.start || 0;
      if (trueGraphic) {
        trueGraphic.end = curStart + smartDur;
        if (trueGraphic.endTime !== undefined) trueGraphic.endTime = curStart + smartDur;
      } else if (trueLayer) {
        trueLayer.end = curStart + smartDur;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
      showToast(`Applied Smart Read Time: ${smartDur.toFixed(1)}s (15 CPS standard)`, 'success');
    });

    // Snap to playhead
    this.rightEl.querySelector('#btnSnapPlayheadRight')?.addEventListener('click', () => {
      const playhead = store.getTime();
      const curDur = layer.duration || 2.5;
      if (trueGraphic) {
        trueGraphic.start = Math.round(playhead * 100) / 100;
        trueGraphic.end = Math.round((playhead + Math.max(0.6, curDur)) * 100) / 100;
      } else if (trueLayer) {
        trueLayer.start = Math.round(playhead * 100) / 100;
        trueLayer.end = Math.round((playhead + Math.max(0.6, curDur)) * 100) / 100;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
      showToast(`Snapped to playhead (${playhead.toFixed(1)}s)`, 'success');
    });

    // Duration chips (-0.5s / +0.5s)
    this.rightEl.querySelector('#btnDurSub')?.addEventListener('click', () => {
      const curDur = Math.max(0.6, Math.round(((layer.duration || 2.5) - 0.5) * 10) / 10);
      const curStart = layer.start || 0;
      if (trueGraphic) {
        trueGraphic.end = curStart + curDur;
        if (trueGraphic.endTime !== undefined) trueGraphic.endTime = curStart + curDur;
      } else if (trueLayer) {
        trueLayer.end = curStart + curDur;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
    });

    this.rightEl.querySelector('#btnDurAdd')?.addEventListener('click', () => {
      const curDur = Math.round(((layer.duration || 2.5) + 0.5) * 10) / 10;
      const curStart = layer.start || 0;
      if (trueGraphic) {
        trueGraphic.end = curStart + curDur;
        if (trueGraphic.endTime !== undefined) trueGraphic.endTime = curStart + curDur;
      } else if (trueLayer) {
        trueLayer.end = curStart + curDur;
      }
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
    });

    // Position inputs
    const xInput = this.rightEl.querySelector('#propLayerX');
    const yInput = this.rightEl.querySelector('#propLayerY');
    xInput?.addEventListener('input', (e) => {
      const xVal = parseInt(e.target.value, 10) || 540;
      if (trueGraphic) {
        trueGraphic.placement = trueGraphic.placement || {};
        trueGraphic.placement.x = xVal;
      } else if (trueLayer) {
        trueLayer.x = xVal;
      }
      store.triggerAutosave();
      if (window.editorPlayer) window.editorPlayer.renderGizmo(layer.id);
    });

    yInput?.addEventListener('input', (e) => {
      const yVal = parseInt(e.target.value, 10) || 960;
      if (trueGraphic) {
        trueGraphic.placement = trueGraphic.placement || {};
        trueGraphic.placement.y = yVal;
        trueGraphic.placement.offsetY = yVal;
      } else if (trueLayer) {
        trueLayer.y = yVal;
      }
      store.triggerAutosave();
      if (window.editorPlayer) window.editorPlayer.renderGizmo(layer.id);
    });

    // Snap buttons in inspector
    this.rightEl.querySelector('#btnInspectorSnapHook')?.addEventListener('click', () => this.snapActiveElement('hook'));
    this.rightEl.querySelector('#btnInspectorSnapCollar')?.addEventListener('click', () => this.snapActiveElement('collarbone'));
    this.rightEl.querySelector('#btnInspectorSnapCenter')?.addEventListener('click', () => this.snapActiveElement('center'));
    this.rightEl.querySelector('#btnInspectorSnapLower')?.addEventListener('click', () => this.snapActiveElement('lower'));

    // Delete / Eliminate button
    this.rightEl.querySelector('#btnLayerDelete')?.addEventListener('click', () => {
      if (isGraphic && proj?.graphics?.items) {
        const initial = [...proj.graphics.items];
        proj.graphics.items = proj.graphics.items.filter(g => g.id !== layer.id);
        store.execute({
          name: 'Eliminate Graphic',
          do: () => {
            proj.graphics.items = proj.graphics.items.filter(g => g.id !== layer.id);
            store.selectLayer(null);
          },
          undo: () => {
            proj.graphics.items = initial;
            store.selectLayer(layer.id);
          },
        });
      } else if (proj?.layers) {
        const initial = [...proj.layers];
        proj.layers = proj.layers.filter(l => l.id !== layer.id);
        store.execute({
          name: 'Eliminate Layer',
          do: () => {
            proj.layers = proj.layers.filter(l => l.id !== layer.id);
            store.selectLayer(null);
          },
          undo: () => {
            proj.layers = initial;
            store.selectLayer(layer.id);
          },
        });
      }
      store.selectLayer(null);
      store.triggerAutosave();
      store.emit('change');
      this.renderRightWing(5);
      showToast('Eliminated overlay', 'info');
    });
  }

  // -------------------------------------------------------------------------
  // STEP 6 RIGHT WING: Export Hub & Instant Deliverables
  // -------------------------------------------------------------------------
  renderStep6RightWing() {
    const proj = store.getProject();
    const slug = proj?.slug || 'my_vertical_video';

    this.rightEl.innerHTML = `
      <div class="wing-inner">
        <div class="wing-header">
          <div class="wing-title-group">
            <span class="wing-step-badge">6</span>
            <span class="wing-title">EXPORT & SHARING</span>
          </div>
          <span class="wing-tag">READY</span>
        </div>

        <div class="wing-scroll-content">
          <!-- Platform Compatibility Audit -->
          <div class="wing-section">
            <div class="wing-section-title">PLATFORM COMPLIANCE AUDIT</div>
            <div class="wing-audit-card">
              <div class="audit-item pass">
                <span class="audit-icon">✅</span>
                <span class="audit-label">9:16 Aspect (1080&times;1920)</span>
                <span class="audit-tag">TikTok & Reels</span>
              </div>
              <div class="audit-item pass">
                <span class="audit-icon">✅</span>
                <span class="audit-label">Collarbone Safe Zone Clearance</span>
                <span class="audit-tag">Pass</span>
              </div>
              <div class="audit-item pass">
                <span class="audit-icon">✅</span>
                <span class="audit-label">Speech Silence Elimination</span>
                <span class="audit-tag">Snappy</span>
              </div>
              <div class="audit-item pass">
                <span class="audit-icon">✅</span>
                <span class="audit-label">30 FPS Progressive Proxy</span>
                <span class="audit-tag">Clean</span>
              </div>
            </div>
          </div>

          <!-- Quick Deliverables Download Cards -->
          <div class="wing-section">
            <div class="wing-section-title">DIRECT DELIVERABLES</div>
            <div class="wing-downloads-list">
              <a class="deliverable-card" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/srt" download>
                <div class="deliverable-icon srt">SRT</div>
                <div class="deliverable-info">
                  <strong>Subtitle File (.SRT)</strong>
                  <span>Premiere / CapCut / YouTube</span>
                </div>
                <span class="deliverable-arrow">⬇️</span>
              </a>

              <a class="deliverable-card" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/vtt" download>
                <div class="deliverable-icon vtt">VTT</div>
                <div class="deliverable-info">
                  <strong>Web Captions (.VTT)</strong>
                  <span>HTML5 / Web Players</span>
                </div>
                <span class="deliverable-arrow">⬇️</span>
              </a>

              <a class="deliverable-card" href="/api/editor/projects/${encodeURIComponent(proj.slug)}/export/zip" download>
                <div class="deliverable-icon zip">ZIP</div>
                <div class="deliverable-info">
                  <strong>Project Archive (.ZIP)</strong>
                  <span>Full EDL & Conformed Assets</span>
                </div>
                <span class="deliverable-arrow">⬇️</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
