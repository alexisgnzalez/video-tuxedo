/**
 * Video Tuxedo - Application Core & View Router
 */

// Toast notifications helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
  // Views
  const toolsLauncherView = document.getElementById('toolsLauncherView');
  const subtitleToolView = document.getElementById('subtitleToolView');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  const breadcrumbHome = document.getElementById('breadcrumbHome');
  const brandHomeBtn = document.getElementById('brandHomeBtn');

  // Launch buttons
  const launchSubtitlesBtn = document.getElementById('launchSubtitlesBtn');
  const toolCardSubtitles = document.getElementById('toolCardSubtitles');
  const backToLauncherBtn = document.getElementById('backToLauncherBtn');

  // Modal elements
  const openGuideBtn = document.getElementById('openDavinciGuideBtn');
  const openModalFromExportBtn = document.getElementById('openDavinciGuideModalBtn');
  const closeGuideBtn = document.getElementById('closeDavinciModalBtn');
  const guideGotItBtn = document.getElementById('guideGotItBtn');
  const modalOverlay = document.getElementById('davinciModalOverlay');

  // Initialize Subtitle Studio instance
  let subtitleStudio = null;
  if (window.SubtitleStudio) {
    subtitleStudio = new window.SubtitleStudio();
  }

  // Navigation functions
  function navigateToView(viewName) {
    if (viewName === 'subtitles') {
      toolsLauncherView.classList.remove('active');
      subtitleToolView.classList.add('active');
      breadcrumbCurrent.textContent = 'Auto Subtitles Studio';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      subtitleToolView.classList.remove('active');
      toolsLauncherView.classList.add('active');
      breadcrumbCurrent.textContent = 'App Launcher';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Bind navigation
  if (launchSubtitlesBtn) {
    launchSubtitlesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateToView('subtitles');
    });
  }

  if (toolCardSubtitles) {
    toolCardSubtitles.addEventListener('click', () => {
      navigateToView('subtitles');
    });
  }

  if (backToLauncherBtn) {
    backToLauncherBtn.addEventListener('click', () => navigateToView('launcher'));
  }

  if (breadcrumbHome) {
    breadcrumbHome.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToView('launcher');
    });
  }

  if (brandHomeBtn) {
    brandHomeBtn.addEventListener('click', () => navigateToView('launcher'));
  }

  // Modal handlers
  function openModal() {
    modalOverlay.classList.add('open');
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
  }

  if (openGuideBtn) openGuideBtn.addEventListener('click', openModal);
  if (openModalFromExportBtn) openModalFromExportBtn.addEventListener('click', openModal);
  if (closeGuideBtn) closeGuideBtn.addEventListener('click', closeModal);
  if (guideGotItBtn) guideGotItBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  // Health check
  fetch('/api/health')
    .then(res => res.json())
    .then(data => {
      const statusText = document.getElementById('engineStatusText');
      if (statusText && data.status === 'healthy') {
        statusText.textContent = 'Local AI Engine Ready';
      }
    })
    .catch(err => {
      console.warn("Backend health check warning:", err);
    });
});
