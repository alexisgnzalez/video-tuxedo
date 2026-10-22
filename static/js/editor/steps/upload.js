/**
 * Tuxedo Editor Step 1: Upload & Media Probing
 */

import { store } from '../store.js';
import { showToast } from '../ui.js';

export function renderStepUpload(container) {
  const proj = store.getProject();
  if (!proj) {
    container.innerHTML = `
      <div class="step-panel-inner">
        <div class="step-header">
          <div class="step-eyebrow">Step 1 of 6</div>
          <h2 class="step-title">Upload Video</h2>
          <p class="step-desc">Select an MP4, MOV, or WebM video file to start a new project in ~/Movies/VideoTuxedo/.</p>
        </div>

        <div class="upload-dropzone" id="editorDropzone" style="border: 2px dashed var(--vt-border); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; background: var(--vt-bg-subtle); transition: border-color 0.15s ease;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--vt-accent-coral)" stroke-width="2" style="margin-bottom: 12px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Drag & Drop Video File</div>
          <div style="font-size: 12px; color: var(--vt-text-muted);">or click to browse from Finder</div>
          <input type="file" id="editorFileInput" accept="video/mp4,video/quicktime,video/webm" style="display: none;" />
        </div>

        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 11px; color: var(--vt-text-muted);">Or import from local Mac path (instant copy):</span>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="editorLocalPathInput" class="editor-input" placeholder="/Users/name/Movies/video.mp4" style="flex: 1; font-size: 11px; padding: 6px 8px;" />
            <button class="vt-btn-secondary" id="btnImportLocalPath" style="width: auto; padding: 6px 12px; font-size: 11px;">Import</button>
          </div>
        </div>

        <div id="uploadProgressContainer" style="display: none; margin-top: 12px;"></div>

        <div style="margin-top: 24px;">
          <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">Existing Projects</h3>
          <div id="editorExistingProjectsList" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <span style="color: var(--vt-text-muted);">Loading projects...</span>
          </div>
        </div>
      </div>
    `;

    bindUploadEvents(container);
    loadExistingProjects(container);
    return;
  }

  // Already loaded project specs
  const src = proj.source || {};
  container.innerHTML = `
    <div class="step-panel-inner">
      <div class="step-header">
        <div class="step-eyebrow">Step 1 of 6</div>
        <h2 class="step-title">Source Media</h2>
        <p class="step-desc">Hardware-probed video specifications and short-GOP editing proxy.</p>
      </div>

      <div class="project-specs-card" style="background: var(--vt-bg-subtle); border: 1px solid var(--vt-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">File Name:</span>
          <span style="font-weight: 600;">${src.file || 'source.mp4'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">Resolution:</span>
          <span style="font-weight: 600;">${src.width || 1080} &times; ${src.height || 1920} (${src.width < src.height ? '9:16 Vertical' : 'Horizontal'})</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">Frame Rate:</span>
          <span style="font-weight: 600;">${src.fps || 30} FPS</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">Duration:</span>
          <span style="font-weight: 600;">${(src.duration || 0).toFixed(2)} seconds</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">Video Codec:</span>
          <span style="font-weight: 600;">${src.codec || 'H.264'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--vt-text-muted);">Project Folder:</span>
          <span style="font-family: var(--vt-font-mono); font-size: 11px;">~/Movies/VideoTuxedo/${proj.slug}</span>
        </div>
      </div>

      <button class="vt-btn-primary" id="btnGoToStep2" style="margin-top: 8px;">
        Next: Cut Silences & Jump Cuts &rarr;
      </button>
    </div>
  `;

  container.querySelector('#btnGoToStep2')?.addEventListener('click', () => {
    store.setStep(2);
  });
}

function bindUploadEvents(container) {
  const dropzone = container.querySelector('#editorDropzone');
  const fileInput = container.querySelector('#editorFileInput');

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
}

async function importLocalPath(filePath, container) {
  const progContainer = container.querySelector('#uploadProgressContainer');
  if (progContainer) {
    progContainer.style.display = 'block';
    progContainer.innerHTML = '<span style="font-size: 12px; color: var(--vt-accent-coral);">Importing video & creating editing proxy...</span>';
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
    store.setStep(2);
    showToast('Project initialized successfully!', 'success');
  } catch (err) {
    console.error(err);
    showToast(`Import error: ${err.message}`, 'error');
    if (progContainer) progContainer.style.display = 'none';
  }
}

async function uploadFile(file, container) {
  const progContainer = container.querySelector('#uploadProgressContainer');
  if (progContainer) {
    progContainer.style.display = 'block';
    progContainer.innerHTML = '<span style="font-size: 12px; color: var(--vt-accent-coral);">Uploading video & creating editing proxy...</span>';
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
    store.setStep(2);
    showToast('Project initialized successfully!', 'success');
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
      item.style.cursor = 'pointer';

      item.innerHTML = `
        <div>
          <div style="font-weight: 600;">${p.name || p.slug}</div>
          <div style="color: var(--vt-text-muted); font-size: 11px;">${p.clips?.length || 1} clips &bull; ${new Date(p.updatedAt).toLocaleDateString()}</div>
        </div>
        <button class="vt-btn-secondary" style="width: auto; padding: 4px 10px; font-size: 11px;">Open</button>
      `;

      item.addEventListener('click', async () => {
        try {
          const detailRes = await fetch(`/api/editor/projects/${encodeURIComponent(p.slug)}`);
          const fullProj = await detailRes.json();
          store.setProject(fullProj);
          store.setStep(2);
        } catch (e) {
          showToast(`Error opening project: ${e.message}`, 'error');
        }
      });

      listEl.appendChild(item);
    });
  } catch (err) {
    listEl.innerHTML = `<span style="color: #EF4444;">${err.message}</span>`;
  }
}
