import App, { defaultSettings, loadInitialSettings, normalizeGroups } from '@api-override/components/app';
import { createRoot } from 'react-dom/client';

const embeddedPanel = window.self !== window.top;
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');
const sidePanel = Boolean(mode === 'sidepanel' || globalThis.apiOverrideSidePanel || params.get('sidepanel') === '1');
const optionsPage = Boolean(mode === 'options' || globalThis.apiOverrideOptionsPage || document.documentElement.classList.contains('options-page'));
const optionsSidebar = optionsPage && params.get('sidebar') === '1';
const extensionPanel = !optionsPage && !sidePanel && ['chrome-extension:', 'moz-extension:'].includes(window.location.protocol);
const popup = Boolean(globalThis.apiOverridePopup || params.get('popup') === '1');
document.documentElement.classList.toggle('embedded-panel', embeddedPanel);
document.documentElement.classList.toggle('extension-panel', extensionPanel);
document.documentElement.classList.toggle('options-page', optionsPage);
document.documentElement.classList.toggle('options-sidebar', optionsSidebar);
document.documentElement.classList.toggle('side-panel', sidePanel);
document.documentElement.classList.toggle('popup-panel', popup);

loadInitialSettings((settings) => {
  window.setting = settings;
  createRoot(document.getElementById('main')).render(<App initialSettings={settings} />);
});

export { defaultSettings, normalizeGroups };
