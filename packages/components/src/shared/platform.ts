export const saveSetting = (key, value) => {
  try {
    // Persist to the extension storage so the service worker can restore the
    // toolbar icon on startup and content.js has a fallback when the desktop
    // companion service is offline.
    globalThis.chrome?.storage?.local?.set?.({ [key]: value });
    const current = JSON.parse(localStorage.getItem('api_override_settings') || '{}');
    const next = { ...current, [key]: value };
    localStorage.setItem('api_override_settings', JSON.stringify(next));
    globalThis.dispatchEvent?.(new CustomEvent('api-override:settings', { detail: { key, value } }));
    globalThis.postMessage?.({ type: 'ajaxInterceptor', to: 'pageScript', key, value }, '*');
    // The service worker listens for this to flip the toolbar icon when the
    // master switch changes.
    globalThis.chrome?.runtime?.sendMessage?.({ type: 'ajaxInterceptor', to: 'background', key, value });
  } catch {}
};

export const downloadJson = (name, data) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// Restores the pre-2.1 behavior: opening options from the side panel / popup
// must jump to the full options page in a new tab, not reload in place.
export const openOptionsPage = ({ fallback, query = '' }: { fallback?: () => void; query?: string } = {}) => {
  const runtime = chrome?.runtime;
  if (!runtime) return fallback?.();
  if (query && typeof runtime.sendMessage === 'function') {
    try {
      runtime.sendMessage({ type: 'openOptionsPage', query }, (response) => {
        if (runtime.lastError || response?.ok === false) fallback?.();
      });
      return;
    } catch {}
  }
  if (typeof runtime.openOptionsPage === 'function') {
    try {
      runtime.openOptionsPage(() => {
        if (runtime.lastError) fallback?.();
      });
      return;
    } catch {}
  }
  fallback?.();
};
