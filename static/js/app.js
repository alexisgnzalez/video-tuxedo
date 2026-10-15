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
  const silenceToolView = document.getElementById('silenceToolView');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
  const breadcrumbHome = document.getElementById('breadcrumbHome');
  const brandHomeBtn = document.getElementById('brandHomeBtn');

  // Launch buttons
  const launchSubtitlesBtn = document.getElementById('launchSubtitlesBtn');
  const toolCardSubtitles = document.getElementById('toolCardSubtitles');
  const backToLauncherBtn = document.getElementById('backToLauncherBtn');

  const launchSilenceBtn = document.getElementById('launchSilenceBtn');
  const toolCardSilence = document.getElementById('toolCardSilence');
  const backFromSilenceToLauncherBtn = document.getElementById('backFromSilenceToLauncherBtn');

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

  // Initialize Silence Cutter Studio instance
  let silenceStudio = null;
  if (window.SilenceCutterStudio) {
    silenceStudio = new window.SilenceCutterStudio();
  }

  // Navigation functions
  function navigateToView(viewName) {
    if (viewName === 'subtitles') {
      toolsLauncherView.classList.remove('active');
      silenceToolView.classList.remove('active');
      subtitleToolView.classList.add('active');
      breadcrumbCurrent.textContent = 'Auto Subtitles Studio';
      window.history.replaceState(null, '', '#subtitles');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'silence') {
      toolsLauncherView.classList.remove('active');
      subtitleToolView.classList.remove('active');
      silenceToolView.classList.add('active');
      breadcrumbCurrent.textContent = 'Silence Cutter & Jump Cuts';
      window.history.replaceState(null, '', '#silence');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      subtitleToolView.classList.remove('active');
      silenceToolView.classList.remove('active');
      toolsLauncherView.classList.add('active');
      breadcrumbCurrent.textContent = 'App Launcher';
      window.history.replaceState(null, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Deep linking on load
  const urlParams = new URLSearchParams(window.location.search);
  const toolParam = urlParams.get('tool');
  const hash = (window.location.hash || '').toLowerCase();
  if (toolParam === 'silence' || hash === '#silence') {
    navigateToView('silence');
  } else if (toolParam === 'subtitles' || hash === '#subtitles') {
    navigateToView('subtitles');
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

  if (launchSilenceBtn) {
    launchSilenceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateToView('silence');
    });
  }

  if (toolCardSilence) {
    toolCardSilence.addEventListener('click', () => {
      navigateToView('silence');
    });
  }

  if (backToLauncherBtn) {
    backToLauncherBtn.addEventListener('click', () => navigateToView('launcher'));
  }

  if (backFromSilenceToLauncherBtn) {
    backFromSilenceToLauncherBtn.addEventListener('click', () => navigateToView('launcher'));
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

  // Subtitle Modal handlers
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

  // Timeline Guide Modal handlers
  const timelineModalOverlay = document.getElementById('davinciTimelineModalOverlay');
  const openTimelineGuideBtn = document.getElementById('openDavinciTimelineGuideBtn');
  const closeTimelineGuideBtn = document.getElementById('closeDavinciTimelineModalBtn');
  const timelineGuideGotItBtn = document.getElementById('timelineGuideGotItBtn');

  function openTimelineModal() {
    if (timelineModalOverlay) timelineModalOverlay.classList.add('open');
  }

  function closeTimelineModal() {
    if (timelineModalOverlay) timelineModalOverlay.classList.remove('open');
  }

  if (openTimelineGuideBtn) openTimelineGuideBtn.addEventListener('click', openTimelineModal);
  if (closeTimelineGuideBtn) closeTimelineGuideBtn.addEventListener('click', closeTimelineModal);
  if (timelineGuideGotItBtn) timelineGuideGotItBtn.addEventListener('click', closeTimelineModal);

  if (timelineModalOverlay) {
    timelineModalOverlay.addEventListener('click', (e) => {
      if (e.target === timelineModalOverlay) closeTimelineModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalOverlay && modalOverlay.classList.contains('open')) closeModal();
      if (timelineModalOverlay && timelineModalOverlay.classList.contains('open')) closeTimelineModal();
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
