/**
 * Video Tuxedo — DaVinci Resolve SFX Library Client Helper
 * Fetches, caches, and provides audition playback for 290+ local motion sound effects.
 */

let cachedCatalog = null;
let auditionAudio = null;

export async function fetchSfxCatalog() {
  if (cachedCatalog) return cachedCatalog;
  try {
    const res = await fetch('/api/editor/sfx/library');
    if (res.ok) {
      cachedCatalog = await res.json();
      return cachedCatalog;
    }
  } catch (e) {
    console.warn('Error fetching DaVinci SFX library:', e);
  }
  return null;
}

export function playSfxAudition(urlOrId, catalog = null) {
  if (auditionAudio) {
    try {
      auditionAudio.pause();
      auditionAudio.currentTime = 0;
    } catch {}
  }
  if (!urlOrId || urlOrId === 'none') return;

  let streamUrl = urlOrId;
  if (!streamUrl.startsWith('http') && !streamUrl.startsWith('/')) {
    // Resolve URL from catalog or default /sfx/
    if (catalog && catalog.categories) {
      for (const cat of catalog.categories) {
        const found = cat.items.find(i => i.id === urlOrId || i.filename === urlOrId);
        if (found) {
          streamUrl = found.url;
          break;
        }
      }
    }
    if (!streamUrl.startsWith('/')) {
      streamUrl = `/sfx/${streamUrl}`;
    }
  }

  auditionAudio = new Audio(streamUrl);
  auditionAudio.volume = 0.85;
  auditionAudio.play().catch(e => {
    console.warn('SFX audition playback failed:', e);
  });
}

export function buildSfxSelectOptions(catalog, currentSfx) {
  let html = `<option value="none" ${(!currentSfx || currentSfx === 'none') ? 'selected' : ''}>🔇 None (Silent)</option>`;

  if (!catalog || !catalog.categories) {
    html += `
      <optgroup label="Default SFX">
        <option value="davinci/WHOOSHES/Whoosh 17 (fast).wav" ${currentSfx?.includes('17') ? 'selected' : ''}>Whoosh 17 (Fast)</option>
        <option value="davinci/2. Transition Noises/2. Impacts/Impact 4 (good bite).wav" ${currentSfx?.includes('Impact') ? 'selected' : ''}>Impact 4 (Good Bite)</option>
        <option value="davinci/5. Miscellaneous/Ding Sound Effect.mp3" ${currentSfx?.includes('Ding') ? 'selected' : ''}>Ding Sound Effect</option>
        <option value="whoosh.mp3" ${currentSfx === 'whoosh.mp3' ? 'selected' : ''}>Whoosh (Classic)</option>
        <option value="pop.mp3" ${currentSfx === 'pop.mp3' ? 'selected' : ''}>Pop (Classic)</option>
      </optgroup>
    `;
    return html;
  }

  // Recommended / Featured first if matched to a component
  const recCategories = [
    "Whooshes & Swishes",
    "Impacts & Hits",
    "Punches & Thuds",
    "Twirls & Movement",
    "UI, Dings & Alerts",
    "Camera & Optics",
    "Keyboard & Typing",
    "Miscellaneous",
  ];

  recCategories.forEach(catName => {
    const cat = catalog.categories.find(c => c.name === catName);
    if (!cat || !cat.items.length) return;

    let icon = "⚡";
    if (catName.includes("Impact")) icon = "💥";
    if (catName.includes("Punch")) icon = "🥊";
    if (catName.includes("Twirl")) icon = "🌪️";
    if (catName.includes("Ding")) icon = "🔔";
    if (catName.includes("Camera")) icon = "📷";
    if (catName.includes("Keyboard")) icon = "⌨️";
    if (catName.includes("Misc")) icon = "🎭";

    html += `<optgroup label="${icon} ${cat.name} (${cat.count})">`;
    cat.items.forEach(item => {
      const isSel = (currentSfx === item.id || currentSfx === item.filename || currentSfx === item.relative_path);
      html += `<option value="${item.id}" data-url="${item.url}" ${isSel ? 'selected' : ''}>${item.name}</option>`;
    });
    html += `</optgroup>`;
  });

  return html;
}
