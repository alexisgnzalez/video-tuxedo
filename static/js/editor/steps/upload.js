/**
 * Tuxedo Editor Step 1: Upload & Media Probing
 */

import { store } from '../store.js?v=0.7.2';
import { showToast } from '../ui.js';

export function renderStepUpload(container) {
  const proj = store.getProject();
  const hasProj = Boolean(proj && proj.source);
  const src = proj?.source || {};

  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 1 of 6</div>
        <h2 class="step-title">${hasProj ? 'Source Media' : 'Upload Video'}</h2>
        <p class="step-desc">${hasProj ? 'Hardware-probed video specifications and short-GOP editing proxy.' : 'Select an MP4, MOV, or WebM video file to start a new project in ~/Movies/VideoTuxedo/.'}</p>
      </div>

      ${hasProj ? `
        <!-- Project Source Media Card -->
        <div class="project-specs-card" style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--vt-text-muted);">File Name:</span>
            <span style="font-weight: 600;">${src.file || 'source.mp4'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--vt-text-muted);">Resolution:</span>
            <span style="font-weight: 600;">${src.width || 1080} &times; ${src.height || 1920} (${(src.width || 1080) < (src.height || 1920) ? '9:16 Vertical' : 'Horizontal'})</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--vt-text-muted);">Frame Rate:</span>
            <span style="font-weight: 600;">${src.fps || 30} FPS</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--vt-text-muted);">Duration:</span>
            <span style="font-weight: 600;">${(src.duration || 0).toFixed(2)}s</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--vt-text-muted);">Project Folder:</span>
            <span style="font-family: var(--vt-font-mono); font-size: 11px;">~/Movies/VideoTuxedo/${proj.slug}</span>
          </div>
        </div>

        <button class="vt-btn-secondary" id="btnShowUploadNew" style="font-size: 12px; margin-top: 2px;">
          + Upload / Replace Video File
        </button>
      ` : ''}

      <!-- Upload Dropzone (shown if no project or toggled) -->
      <div id="uploadFormArea" style="${hasProj ? 'display: none;' : 'display: block;'}">
        <div class="upload-dropzone" id="editorDropzone" style="border: 2px dashed var(--vt-border); border-radius: 8px; padding: 32px 16px; text-align: center; cursor: pointer; background: var(--vt-bg-subtle); transition: border-color 0.15s ease;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--vt-accent-coral)" stroke-width="2" style="margin-bottom: 10px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Drag & Drop Video File</div>
          <div style="font-size: 12px; color: var(--vt-text-muted);">or click to browse from Finder (MP4, MOV, WebM)</div>
          <input type="file" id="editorFileInput" accept="video/mp4,video/quicktime,video/webm" style="display: none;" />
        </div>

        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 11px; color: var(--vt-text-muted);">Or import from local Mac path (instant copy):</span>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="editorLocalPathInput" class="editor-input" placeholder="/Users/name/Movies/video.mp4" style="flex: 1; font-size: 11px; padding: 7px 10px;" />
            <button class="vt-btn-secondary" id="btnImportLocalPath" style="width: auto; padding: 7px 14px; font-size: 11px;">Import</button>
          </div>
        </div>

        <div id="uploadProgressContainer" style="display: none; margin-top: 12px; padding: 10px 12px; background: var(--vt-bg-subtle); border-radius: 6px; border: 1px solid var(--vt-border);"></div>
      </div>

      <!-- Existing Projects Section -->
      <div style="margin-top: 16px;">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Existing Projects</h3>
        <div id="editorExistingProjectsList" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          <span style="color: var(--vt-text-muted);">Loading projects...</span>
        </div>
      </div>
    </div>

    <!-- Always Visible Sticky Footer Navigation -->
    <div class="step-panel-footer">
      <button class="vt-btn-primary" id="btnGoToStep2" ${hasProj ? '' : 'disabled'} style="width: 100%; ${hasProj ? '' : 'opacity: 0.5; cursor: not-allowed;'}">
        Next: Cut Silences & Jump Cuts &rarr;
      </button>
    </div>
  `;

  bindUploadEvents(container);
  loadExistingProjects(container);
}

function bindUploadEvents(container) {
  const dropzone = container.querySelector('#editorDropzone');
  const fileInput = container.querySelector('#editorFileInput');
  const toggleBtn = container.querySelector('#btnShowUploadNew');
  const uploadFormArea = container.querySelector('#uploadFormArea');

  toggleBtn?.addEventListener('click', () => {
    if (uploadFormArea) {
      const isHidden = uploadFormArea.style.display === 'none';
      uploadFormArea.style.display = isHidden ? 'block' : 'none';
      toggleBtn.textContent = isHidden ? '− Hide Upload Form' : '+ Upload / Replace Video File';
    }
  });

  dropzone?.addEventListener('click', () => fileInput?.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--vt-accent-coral)';
    dropzone.style.background = '#F8F1EE';
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--vt-border)';
    dropzone.style.background = 'var(--vt-bg-subtle)';
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--vt-border)';
    dropzone.style.background = 'var(--vt-bg-subtle)';
    if (e.dataTransfer.files?.length > 0) {
      uploadFile(e.dataTransfer.files[0], container);
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.length > 0) {
      uploadFile(fileInput.files[0], container);
    }
  });

  const importBtn = container.querySelector('#btnImportLocalPath');
  const pathInput = container.querySelector('#editorLocalPathInput');
  const doImport = () => {
    const val = pathInput?.value?.trim();
    if (!val) {
      showToast('Please enter a local file path', 'warning');
      return;
    }
    importLocalPath(val, container);
  };

  importBtn?.addEventListener('click', doImport);
  pathInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doImport();
  });

  const nextBtn = container.querySelector('#btnGoToStep2');
  nextBtn?.addEventListener('click', () => {
    if (store.getProject()) {
      store.setStep(2);
    } else {
      showToast('Please upload or select a video first', 'warning');
    }
  });
}

async function importLocalPath(filePath, container) {
  const progContainer = container.querySelector('#uploadProgressContainer');
  const nextBtn = container.querySelector('#btnGoToStep2');
  if (progContainer) {
    progContainer.style.display = 'block';
    progContainer.innerHTML = `
      <div style="font-size: 12px; font-weight: 500; color: var(--vt-accent-coral); margin-bottom: 4px;">Importing video & creating proxy...</div>
      <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; overflow: hidden;">
        <div style="width: 100%; height: 100%; background: var(--vt-accent-coral); animation: pulseSave 0.8s infinite alternate;"></div>
      </div>
    `;
  }

  const formData = new FormData();
  formData.append('file_path', filePath);

  try {
    const res = await fetch('/api/editor/projects', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Import failed');
    }
    const proj = await res.json();
    store.setProject(proj);

    const nameInput = document.getElementById('editorProjectName');
    if (nameInput) nameInput.value = proj.name || proj.slug;
    window.location.hash = `#editor/${proj.slug}`;

    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }

    showToast('Project initialized successfully!', 'success');
    store.setStep(2);
  } catch (err) {
    console.error(err);
    showToast(`Import error: ${err.message}`, 'error');
    if (progContainer) progContainer.style.display = 'none';
  }
}

async function uploadFile(file, container) {
  const progContainer = container.querySelector('#uploadProgressContainer');
  const nextBtn = container.querySelector('#btnGoToStep2');
  if (progContainer) {
    progContainer.style.display = 'block';
    progContainer.innerHTML = `
      <div style="font-size: 12px; font-weight: 500; color: var(--vt-accent-coral); margin-bottom: 4px;">Uploading video & creating editing proxy...</div>
      <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; overflow: hidden;">
        <div style="width: 100%; height: 100%; background: var(--vt-accent-coral); animation: pulseSave 0.8s infinite alternate;"></div>
      </div>
    `;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

  try {
    const res = await fetch('/api/editor/projects', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    const proj = await res.json();
    store.setProject(proj);

    const nameInput = document.getElementById('editorProjectName');
    if (nameInput) nameInput.value = proj.name || proj.slug;
    window.location.hash = `#editor/${proj.slug}`;

    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }

    showToast('Project initialized successfully!', 'success');
    store.setStep(2);
  } catch (err) {
    console.error(err);
    showToast(`Upload error: ${err.message}`, 'error');
    if (progContainer) progContainer.style.display = 'none';
  }
}

async function loadExistingProjects(container) {
  const listEl = container.querySelector('#editorExistingProjectsList');
  if (!listEl) return;

  try {
    const res = await fetch('/api/editor/projects');
    if (!res.ok) throw new Error('Failed to load projects');
    const projects = await res.json();

    if (projects.length === 0) {
      listEl.innerHTML = '<span style="color: var(--vt-text-muted);">No existing projects found.</span>';
      return;
    }

    listEl.innerHTML = '';
    projects.forEach(p => {
      const item = document.createElement('div');
      item.style.padding = '8px 10px';
      item.style.background = 'var(--vt-bg-subtle)';
      item.style.border = '1px solid var(--vt-border)';
      item.style.borderRadius = '6px';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.gap = '8px';

      item.innerHTML = `
        <div style="flex: 1; min-width: 0; cursor: pointer;">
          <div style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name || p.slug}</div>
          <div style="color: var(--vt-text-muted); font-size: 11px;">${p.clipsCount || p.clips?.length || 1} clips &bull; ${new Date(p.updatedAt).toLocaleDateString()}</div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
          <button class="vt-btn-secondary btn-open-project" style="width: auto; padding: 4px 10px; font-size: 11px;">Open</button>
          <button class="vt-btn-secondary btn-delete-project" title="Erase project" style="width: auto; padding: 4px 8px; font-size: 11px; color: #DC2626; border-color: rgba(220, 38, 38, 0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-right: 2px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Erase
          </button>
        </div>
      `;

      const openAction = async () => {
        try {
          const detailRes = await fetch(`/api/editor/projects/${encodeURIComponent(p.slug)}`);
          if (!detailRes.ok) throw new Error('Could not open project');
          const fullProj = await detailRes.json();
          store.setProject(fullProj);

          const nameInput = document.getElementById('editorProjectName');
          if (nameInput) nameInput.value = fullProj.name || fullProj.slug;
          window.location.hash = `#editor/${fullProj.slug}`;

          showToast(`Opened "${fullProj.name || fullProj.slug}"`, 'success');
          store.setStep(2);
        } catch (e) {
          showToast(`Error opening project: ${e.message}`, 'error');
        }
      };

      const titleEl = item.querySelector('div:first-child');
      const openBtn = item.querySelector('.btn-open-project');
      const deleteBtn = item.querySelector('.btn-delete-project');

      titleEl?.addEventListener('click', openAction);
      openBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openAction();
      });

      deleteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = confirm(`Are you sure you want to erase "${p.name || p.slug}"? This permanently removes the project folder from your Mac.`);
        if (!ok) return;

        try {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Erasing...';
          const delRes = await fetch(`/api/editor/projects/${encodeURIComponent(p.slug)}`, {
            method: 'DELETE',
          });
          if (!delRes.ok) throw new Error('Failed to erase project');

          showToast(`Project "${p.name || p.slug}" erased`, 'info');

          // If this was the open project, clear it
          const cur = store.getProject();
          if (cur && cur.slug === p.slug) {
            store.setProject(null);
            window.location.hash = '#editor';
            renderStepUpload(container);
          } else {
            loadExistingProjects(container);
          }
        } catch (err) {
          showToast(`Error erasing project: ${err.message}`, 'error');
          deleteBtn.disabled = false;
        }
      });

      listEl.appendChild(item);
    });
  } catch (err) {
    listEl.innerHTML = `<span style="color: #EF4444;">${err.message}</span>`;
  }
}
