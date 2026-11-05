// 存储平面：匹配日志的持久化（chrome.storage.session 环形缓冲，最近 100 条）。
// 唯一写入者是 background：页面判定事件 → queueMatchLog（攒批落盘）；清空命令 → clearMatchLogStore。
// 面板等其他上下文只读（readMatchLog / subscribeMatchLog），不直接写 session。
import type { MatchLogEvent } from './messaging';

export interface MatchLogEntry extends MatchLogEvent {
  time: number;
}

export const MATCH_LOG_KEY = 'matchLog';
export const MATCH_LOG_CAP = 100;

// 攒批：每条都"读-改-写"的话，连续判定（页面加载动辄几十个请求）的异步读会交错互相覆盖丢日志；
// 150ms 内的事件合并成一次读取合并写入，读到的始终是最新落盘结果；时间戳在入队时取，顺序不受批处理影响
let pending: MatchLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  flushTimer = null;
  if (!pending.length) return;
  // 新条目在前：同一批里后入队的时间更晚，反转后置于列表头部
  const batch = pending.splice(0).reverse();
  try {
    chrome.storage.session.get(MATCH_LOG_KEY, (result) => {
      const list: MatchLogEntry[] = Array.isArray(result?.[MATCH_LOG_KEY]) ? result[MATCH_LOG_KEY] : [];
      chrome.storage.session.set({ [MATCH_LOG_KEY]: [...batch, ...list].slice(0, MATCH_LOG_CAP) });
    });
  } catch {}
};

/** background 专用：入队一条判定日志，攒批落盘。 */
export const queueMatchLog = (event: MatchLogEvent): void => {
  pending.push({ time: Date.now(), ...event });
  if (!flushTimer) flushTimer = setTimeout(flush, 150);
};

/** 只读：拉取当前落盘的日志（面板挂载时回看历史）。 */
export const readMatchLog = (done: (entries: MatchLogEntry[]) => void): void => {
  try {
    chrome.storage.session.get(MATCH_LOG_KEY, (result) => {
      const list: MatchLogEntry[] = Array.isArray(result?.[MATCH_LOG_KEY]) ? result[MATCH_LOG_KEY] : [];
      done(list);
    });
  } catch {
    done([]);
  }
};

/** background 专用：清空缓冲（面板通过清空事件触发）。 */
export const clearMatchLogStore = (): void => {
  try {
    chrome.storage.session.set({ [MATCH_LOG_KEY]: [] });
  } catch {}
};

/** 订阅落盘变化（面板实时同步）；返回退订函数。 */
export const subscribeMatchLog = (listener: (entries: MatchLogEntry[]) => void): (() => void) => {
  const onChanged = chrome.storage?.onChanged;
  if (!onChanged?.addListener) return () => {};
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'session' && MATCH_LOG_KEY in changes) {
      const next = changes[MATCH_LOG_KEY].newValue;
      listener(Array.isArray(next) ? (next as MatchLogEntry[]) : []);
    }
  };
  onChanged.addListener(handler);
  return () => onChanged.removeListener(handler);
};
