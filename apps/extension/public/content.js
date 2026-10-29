// Inject the page-level interceptor into every frame. The UI now lives exclusively
// in the Chrome Side Panel; this content script only bridges page events.
// registerContentScripts 与 handleContentSend 的 executeScript 兜底可能重复注入本文件，
// 顶层 const/let 重复声明会抛 SyntaxError，因此整体包进 IIFE 并用全局标记去重。
;(() => {
if (globalThis.__apiOverrideContentInjected) return
globalThis.__apiOverrideContentInjected = true

const script = document.createElement('script')
// 加版本号查询参数做缓存击穿：Chrome 会缓存 web_accessible_resources，
// 不加的话扩展更新后页面仍可能执行旧版 main.js
script.src = `${chrome.runtime.getURL('pageScripts/main.js')}?v=${chrome.runtime.getManifest().version}`
document.documentElement.appendChild(script)

script.addEventListener('load', () => {
  const pushToPage = (switchOn, rules) => {
    postMessage({ type: 'ajaxInterceptor', to: 'pageScript', key: 'ajaxInterceptor_switchOn', value: switchOn })
    postMessage({ type: 'ajaxInterceptor', to: 'pageScript', key: 'ajaxInterceptor_rules', value: rules })
  }
  // The desktop service is authoritative when reachable (rules + switch state
  // come from the desktop app UI via its SQLite store); fall back to whatever
  // was configured in the extension panel when the service is offline.
  chrome.runtime.sendMessage({ type: 'getServiceConfig' }, response => {
    if (response && response.ok) {
      pushToPage(response.enabled, response.rules || [])
      return
    }
    chrome.storage.local.get(['ajaxInterceptor_switchOn', 'ajaxInterceptor_rules'], result => {
      pushToPage(
        Object.prototype.hasOwnProperty.call(result, 'ajaxInterceptor_switchOn') ? result.ajaxInterceptor_switchOn : false,
        result.ajaxInterceptor_rules || []
      )
    })
  })
})

let panelReady = false
let contentScriptReady = false

const notifyContentScriptLoaded = () => {
  if (contentScriptReady) return
  contentScriptReady = true
  chrome.runtime.sendMessage(chrome.runtime.id, {
    type: 'ajaxInterceptor',
    to: 'background',
    contentScriptLoaded: true
  })
}

notifyContentScriptLoaded()

// Receive updates from the background and forward them to the page interceptor.
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type !== 'ajaxInterceptor' || msg.to !== 'content') return
  if (msg.iframeScriptLoaded) {
    panelReady = true
    return
  }
  postMessage({ ...msg, to: 'pageScript' })
})

// Forward intercepted requests back to the Side Panel or DevTools panel.
window.addEventListener('pageScript', event => {
  if (panelReady) {
    chrome.runtime.sendMessage({ type: 'ajaxInterceptor', to: 'iframe', ...event.detail })
    return
  }

  let count = 0
  const timer = setInterval(() => {
    if (panelReady) {
      clearInterval(timer)
      chrome.runtime.sendMessage({ type: 'ajaxInterceptor', to: 'iframe', ...event.detail })
    }
    if (count++ > 500) clearInterval(timer)
  }, 10)
})

})()