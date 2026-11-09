// content script：事件中继 + 设置下发。UI 只存在于面板；本脚本只做桥。
// 页面 hook（pageScripts/main.js）已由 background 注册为 MAIN world content script（document_start
// 同步执行，抢在页面脚本之前装好 hook），本文件不再负责注入它；MV3 下 content script 注入的内联
// 脚本受扩展自身 CSP 约束必被拦截，src 注入又是异步的，都会漏页面加载初期的请求。
// registerContentScripts 与 handleContentSend 的 executeScript 兜底可能重复注入本文件，
// 去重哨兵由构建脚本注入 banner（__apiOverrideContentInjected），见 apps/extension/scripts/build-extension-scripts.mjs。
import { PAGE_SCRIPT_EVENT, PAGE_SETTINGS_CACHE_KEY, RUNTIME_MSG_TYPE, isMatchLogEvent, sendRuntimeEvent } from '@api-override/core/messaging';

// 下发设置时同步写 localStorage 缓存（键与格式见 messaging.ts / runtime.ts）：
// 页面脚本（MAIN world）启动时同步读取，刷新 / 二次导航乃至新 tab 的首屏早期请求也能被拦截。
// localStorage 同源各 tab 共享（sessionStorage 按 tab 隔离，覆盖不到新 tab）。
const cachePageSettings = (patch: Record<string, unknown>) => {
  try {
    const prev = JSON.parse(localStorage.getItem(PAGE_SETTINGS_CACHE_KEY) || '{}');
    localStorage.setItem(PAGE_SETTINGS_CACHE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
};

// 注入 vendor/mock.js（挂 window.Mock，供覆盖模板与内部 mockResponseText 使用；仅请求阶段用到，
// 晚于页面脚本几毫秒无碍）
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

const setupPageBridge = () => {
  // 设置推给页面脚本（页面内事件，非扩展存储）
  const pushToPage = (switchOn: boolean, rules: unknown[]) => {
    window.postMessage({ type: RUNTIME_MSG_TYPE, to: 'pageScript', key: 'ajaxInterceptor_switchOn', value: switchOn }, '/');
    window.postMessage({ type: RUNTIME_MSG_TYPE, to: 'pageScript', key: 'ajaxInterceptor_rules', value: rules }, '/');
  };
  // 下发前先写 localStorage 缓存，让本页面之后的刷新 / 导航（含新 tab）同步拿到这份设置
  const applyAndCache = (switchOn: boolean, rules: unknown[]) => {
    cachePageSettings({ ajaxInterceptor_switchOn: switchOn, ajaxInterceptor_rules: rules });
    pushToPage(switchOn, rules);
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
  // 先用扩展存储的配置直接下发（content script 直读 storage，不经 SW 中继，也不等桌面服务
  // 的 3s 探测超时），让 hook 尽早装好；桌面服务可达时以其配置为准再次下发覆盖。
  chrome.storage.local.get(['ajaxInterceptor_switchOn', 'ajaxInterceptor_rules'], (result: any) => {
    const switchOn = Object.prototype.hasOwnProperty.call(result, 'ajaxInterceptor_switchOn') ? result.ajaxInterceptor_switchOn : false;
    const rules = result.ajaxInterceptor_rules || [];
    reportConfigStatus('storage', switchOn, rules);
    applyAndCache(switchOn, rules);
    chrome.runtime.sendMessage({ type: 'getServiceConfig' }, (response: any) => {
      if (response && response.ok) {
        reportConfigStatus('service', response.enabled, response.rules || []);
        applyAndCache(response.enabled, response.rules || []);
      }
    });
  });
};
// 页面脚本（MAIN world）在 document_start 已同步执行并挂好 message 监听，直接下发；
// 即便它晚于本文件执行，storage 回调（异步）到达时监听必然已就绪，初始推送不会丢
setupPageBridge();

let contentScriptReady = false;

const notifyContentScriptLoaded = () => {
  if (contentScriptReady) return;
  contentScriptReady = true;
  sendRuntimeEvent({ type: RUNTIME_MSG_TYPE, to: 'background', contentScriptLoaded: true });
};

notifyContentScriptLoaded();

// Receive updates from the background and forward them to the page interceptor.
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg?.type !== RUNTIME_MSG_TYPE || msg.to !== 'content') return;
  // 面板改动（开关 / 规则）先刷新缓存再转发，页面下次刷新时新设置同步生效
  if ((msg.key === 'ajaxInterceptor_switchOn' || msg.key === 'ajaxInterceptor_rules') && 'value' in msg) {
    cachePageSettings({ [msg.key]: msg.value });
  }
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
