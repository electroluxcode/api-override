// 事件平面协议：所有跨上下文的瞬时消息统一在这里定义（页面事件、运行状态上报、清空命令、设置推送中继）。
// 事件只传达"发生了什么"，一律不落盘——持久化统一走 matchLogStore（存储平面），写入者只有 background。
// wire 格式沿用既有 { type: 'ajaxInterceptor', to, ... } 结构，保持与旧版静态脚本的兼容。

/** 页面内 CustomEvent 事件名：page script → content.js */
export const PAGE_SCRIPT_EVENT = 'pageScript';

/** runtime 消息通道类型：content.js / background / 面板共用 */
export const RUNTIME_MSG_TYPE = 'ajaxInterceptor';

/**
 * localStorage 键：content.js 每次下发设置时写入的缓存，页面脚本启动时同步读取。
 * 页面脚本由 content.js 在 document_start 注入（textContent 同步内联为主、src 注入为 CSP 回退），
 * 设置无法随脚本带下去；有了这份缓存（同源各 tab 共享，sessionStorage 做不到），
 * hook 在页面脚本发起早期请求之前就装好。首次使用时缓存为空，由 content.js 的异步下发兜底。
 */
export const PAGE_SETTINGS_CACHE_KEY = '__apiOverridePageSettings';

/** runtime 消息的路由目标：background=SW 处理；iframe=广播给面板；content=中继给页面；pageScript=页面脚本 */
export type RuntimeEventTarget = 'background' | 'iframe' | 'content' | 'pageScript';

/** 页面上报的一次匹配判定（命中或未命中）。经 content.js 转发给 SW 落盘（存储平面）。 */
export interface MatchLogEvent {
  logType: 'match';
  url: string;
  method: string;
  body: string;
  matched: boolean;
  ruleKey: string;
  label: string;
  ruleMatchBody?: string;
  ruleCount?: number;
  enabledCount?: number;
}

/** 页面上报的运行状态（总开关/规则数/配置来源），广播给面板展示"脚本此刻看到的配置"。 */
export interface StatusEvent {
  logType: 'status';
  switchOn: boolean;
  ruleCount: number;
  enabledCount: number;
  configSource?: 'service' | 'storage';
}

export type PageScriptEventDetail = MatchLogEvent | StatusEvent;

export const isMatchLogEvent = (detail: unknown): detail is MatchLogEvent =>
  !!detail && typeof detail === 'object' && (detail as MatchLogEvent).logType === 'match';

export const isStatusEvent = (detail: unknown): detail is StatusEvent =>
  !!detail && typeof detail === 'object' && (detail as StatusEvent).logType === 'status';

/** 发送 runtime 事件：无接收方（如面板没开）时 Chrome 会置 lastError，统一在此吞掉。 */
export const sendRuntimeEvent = (message: { type?: string; to?: RuntimeEventTarget } & Record<string, unknown>): void => {
  try {
    chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
  } catch {}
};
