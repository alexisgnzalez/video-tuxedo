/**
 * Tuxedo Editor UI Utilities
 * Reusable components: Toast, Time formatters, Progress indicators, SVG Icons.
 */

export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function formatTimecode(frame, fps = 30) {
  const totalSeconds = frame / fps;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const f = Math.floor(frame % fps);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function showToast(message, type = 'info', duration = 3000) {
  let toast = document.querySelector('.editor-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'editor-toast';
    document.body.appendChild(toast);
  }

  const iconSvg = type === 'error'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  toast.innerHTML = `${iconSvg} <span>${message}</span>`;
  toast.style.display = 'flex';
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.style.opacity === '0') {
        toast.style.display = 'none';
      }
    }, 200);
  }, duration);
}

export function createProgressLine(container) {
  container.innerHTML = `
    <div class="editor-progress-wrap" style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--vt-text-muted);">
        <span class="progress-msg">Processing...</span>
        <span class="progress-pct">0%</span>
      </div>
      <div class="editor-progress-bar">
        <div class="editor-progress-fill"></div>
      </div>
    </div>
  `;

  const msgEl = container.querySelector('.progress-msg');
  const pctEl = container.querySelector('.progress-pct');
  const fillEl = container.querySelector('.editor-progress-fill');

  return {
    update: (percent, msg) => {
      const p = Math.min(100, Math.max(0, Math.round(percent)));
      fillEl.style.width = `${p}%`;
      pctEl.textContent = `${p}%`;
      if (msg) msgEl.textContent = msg;
    },
    done: (msg = 'Complete') => {
      fillEl.style.width = '100%';
      pctEl.textContent = '100%';
      msgEl.textContent = msg;
    },
    error: (err = 'Failed') => {
      fillEl.style.backgroundColor = '#EF4444';
      msgEl.textContent = err;
      msgEl.style.color = '#EF4444';
    }
  };
}
