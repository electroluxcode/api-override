let contentLoadedIds = []

chrome.scripting.getRegisteredContentScripts({ ids: ["testing-scripts-gen"] },
  async (scripts) => {
    if (scripts && scripts.length) {
      await chrome.scripting.unregisterContentScripts({
        ids: ["testing-scripts-gen"]
      })
    }
    chrome.scripting
      .registerContentScripts([{
        id: "testing-scripts-gen",
        js: ['./content.js'],
        matches: ['<all_urls>'],
        runAt: "document_start",
        allFrames: true
      }])
  }
)

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
} else if (chrome.sidePanel?.open && chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async tab => {
    if (!tab?.windowId) return
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch {}
  })
}

// 页面关闭，移除id
chrome.tabs.onRemoved.addListener(function (tabId) {
  contentLoadedIds = contentLoadedIds.filter(id => id !== tabId)
})

function handleContentSend(tabId, params = null) {
  if (contentLoadedIds.includes(tabId)) {
    chrome.tabs.sendMessage(tabId, params)
  } else {
    chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content.js']
    }).then(() => {
      chrome.tabs.sendMessage(tabId, params)
    })
  }
}

// Open settings from the Side Panel or DevTools panel in a real extension tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'openOptionsPage') return false
  const fallback = () => {
    try {
      const target = new URL(chrome.runtime.getURL('index.html'))
      const query = new URLSearchParams(typeof msg.query === 'string' ? msg.query.replace(/^\?/, '') : '')
      query.set('mode', 'options')
      target.search = query.toString()
      chrome.tabs.create({ url: target.toString() }, () => {
        sendResponse({ ok: !chrome.runtime.lastError })
      })
    } catch {
      sendResponse({ ok: false })
    }
  }
  try {
    if (msg.query) {
      fallback()
    } else if (typeof chrome.runtime.openOptionsPage !== 'function') {
      fallback()
    } else {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime.lastError) fallback()
        else sendResponse({ ok: true })
      })
    }
  } catch {
    fallback()
  }
  return true
})

// The desktop companion service is the single source of truth for rules
// (managed by the desktop app UI + SQLite). The background fetches it because
// content-script fetches would be blocked by mixed-content rules on https pages.
const CONTROL_API = 'http://127.0.0.1:17880'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'getServiceConfig') return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  fetch(`${CONTROL_API}/config`, { cache: 'no-store', signal: controller.signal })
    .then(response => response.json())
    .then(config => {
      clearTimeout(timer)
      sendResponse({ ok: true, enabled: config.enabled === true, rules: Array.isArray(config.rules) ? config.rules : [] })
    })
    .catch(() => {
      clearTimeout(timer)
      sendResponse({ ok: false })
    })
  return true
})

// 接收iframe传来的信息，转发给content.js
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'ajaxInterceptor' && msg.to === 'background') {
    if (msg.hasOwnProperty('contentScriptLoaded')) {
      msg.contentScriptLoaded && chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        tabs && tabs.length && !contentLoadedIds.includes(tabs[0].id) && contentLoadedIds.push(tabs[0].id)
      })
      // The content bridge is ready for the active tab.
    }
    if (msg.key === 'ajaxInterceptor_switchOn') {
      if (msg.value === true) {
        chrome.action.setIcon({
          path: {
            16: '/images/16.png',
            32: '/images/32.png',
            48: '/images/48.png',
            128: '/images/128.png',
          }
        })
      } else {
        chrome.action.setIcon({
          path: {
            16: '/images/16_gray.png',
            32: '/images/32_gray.png',
            48: '/images/48_gray.png',
            128: '/images/128_gray.png',
          }
        })
      }
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length) {
        handleContentSend(tabs[0].id, { ...msg, to: 'content' })
      } else if (msg.hasOwnProperty('iframeScriptLoaded')) {
        // 收到的传送信息是iframeScriptLoaded，说明是suspend刷新状态，提示需要在页面上刷新（只有在suspend时才会有此类情况）
        console.warn("[Ajax Modifier] To make the Ajax Modifier work, please do not refresh on devtools.")
      } else if (msg.key === "ajaxInterceptor_rules" || msg.key === 'ajaxInterceptor_switchOn') {
        // 收到的传送信息是修改rules且拿不到tab，说明内容也更新不到page script上，提示需要刷新（只有在分离的devtools时才会有此类情况）
        chrome.runtime.sendMessage(chrome.runtime.id, {type: 'ajaxInterceptor', to: 'iframe', showFreshTip: true})
      }
    })
  }
})

chrome.storage.local.get(['ajaxInterceptor_switchOn', 'ajaxInterceptor_rules'], (result) => {
  if (result.hasOwnProperty('ajaxInterceptor_switchOn')) {
    if (result.ajaxInterceptor_switchOn) {
      chrome.action.setIcon({ path: "/images/16.png" })
    } else {
      chrome.action.setIcon({ path: "/images/16_gray.png" })
    }
  }
})

