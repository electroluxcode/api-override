// content script：注入页面脚本 + 事件中继。UI 只存在于面板；本脚本只做桥。
// registerContentScripts 与 handleContentSend 的 executeScript 兜底可能重复注入本文件，
// 去重哨兵由构建脚本注入 banner（__apiOverrideContentInjected），见 apps/extension/scripts/build-extension-scripts.mjs。
import { PAGE_SCRIPT_EVENT, RUNTIME_MSG_TYPE, isMatchLogEvent, sendRuntimeEvent } from '@api-override/core/messaging';

// 经典脚本按插入顺序执行：先注入 vendor/mock.js（挂 window.Mock，供覆盖模板与内部 mockResponseText 使用），
// 再注入 main.js（core/runtime.ts 的构建产物）
const injectScript = (name: string) => {
  const script = document.createElement('script');
  // 加版本号+随机参数做缓存击穿：Chrome 会缓存 web_accessible_resources，
  // 版本号平时不变，重新构建后扩展重载页面仍可能执行旧版脚本，
  // 因此用每次注入时的随机数保证拿到最新文件
  script.src = `${chrome.runtime.getURL(name)}?v=${chrome.runtime.getManifest().version}&t=${Math.random().toString(36).slice(2)}`;
  document.documentElement.appendChild(script);
  return script;
};
injectScript('pageScripts/vendor/mock.js');
const mainScript = injectScript('pageScripts/main.js');

mainScript.addEventListener('load', () => {
  // 设置推给页面脚本（页面内事件，非扩展存储）
  const pushToPage = (switchOn: boolean, rules: unknown[]) => {
    window.postMessage({ type: RUNTIME_MSG_TYPE, to: 'pageScript', key: 'ajaxInterceptor_switchOn', value: switchOn }, '/');
    window.postMessage({ type: RUNTIME_MSG_TYPE, to: 'pageScript', key: 'ajaxInterceptor_rules', value: rules }, '/');
  };
  // 上报配置来源与初始状态：面板据此展示"页面脚本此刻的配置"（桌面服务在线时其配置优先于面板）
  const reportConfigStatus = (configSource: 'service' | 'storage', switchOn: boolean, rules: { switchOn?: boolean }[]) => {
    sendRuntimeEvent({
      type: RUNTIME_MSG_TYPE,
      to: 'iframe',
      logType: 'status',
      configSource,
      switchOn: !!switchOn,
      ruleCount: (rules || []).length,
      enabledCount: (rules || []).filter((item) => item && item.switchOn !== false).length
    });
  };
  // The desktop service is authoritative when reachable (rules + switch state
  // come from the desktop app UI via its SQLite store); fall back to whatever
  // was configured in the extension panel when the service is offline.
  chrome.runtime.sendMessage({ type: 'getServiceConfig' }, (response: any) => {
    if (response && response.ok) {
      reportConfigStatus('service', response.enabled, response.rules || []);
      pushToPage(response.enabled, response.rules || []);
      return;
    }
    chrome.storage.local.get(['ajaxInterceptor_switchOn', 'ajaxInterceptor_rules'], (result: any) => {
      const switchOn = Object.prototype.hasOwnProperty.call(result, 'ajaxInterceptor_switchOn') ? result.ajaxInterceptor_switchOn : false;
      const rules = result.ajaxInterceptor_rules || [];
      reportConfigStatus('storage', switchOn, rules);
      pushToPage(switchOn, rules);
    });
  });
});

let contentScriptReady = false;

const notifyContentScriptLoaded = () => {
  if (contentScriptReady) return;
  contentScriptReady = true;
  sendRuntimeEvent({ type: RUNTIME_MSG_TYPE, to: 'background', contentScriptLoaded: true });
};

notifyContentScriptLoaded();

// Receive updates from the background and forward them to the page interceptor.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== RUNTIME_MSG_TYPE || msg.to !== 'content') return;
  window.postMessage({ ...msg, to: 'pageScript' }, '/');
});

// Forward page events back to the extension contexts.
// 匹配判定事件转给 SW 落盘（存储平面，面板未打开也不丢）；其余事件广播给所有扩展上下文。
window.addEventListener(PAGE_SCRIPT_EVENT, (event) => {
  const detail = (event as CustomEvent).detail;
  try {
    if (isMatchLogEvent(detail)) {
      sendRuntimeEvent({ type: RUNTIME_MSG_TYPE, to: 'background', matchLog: detail });
      return;
    }
    sendRuntimeEvent({ type: RUNTIME_MSG_TYPE, to: 'iframe', ...(detail || {}) });
  } catch {}
});
