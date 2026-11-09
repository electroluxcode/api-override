// 页面脚本的唯一源码（TS）：由 apps/extension/scripts/build-extension-scripts.mjs 打包为 dist/pageScripts/main.js，
// content.js 先注入 vendor/mock.js 再注入 main.js。修改页面 hook 行为只改这里，不再手工维护静态脚本。
import { FILTER_TYPE, OVERRIDE_MODE, RESPONSE_TYPE } from './constants';
import { PAGE_SCRIPT_EVENT, PAGE_SETTINGS_CACHE_KEY } from './messaging';
// 内置 Mock.js 已由 content.js 预先注入的 vendor/mock.js 挂到 window.Mock，页面与规则（覆盖内容、专家函数）可直接调用；
// 内部模板处理统一使用这里的引用，避免页面后续加载自己的 Mock 影响行为
const vendoredMock = (globalThis as any).Mock;
const hasResponseOverride = (rule) =>
  Boolean(
    rule &&
      (rule.overrideTxt ||
        rule.overrideResponseFunc ||
        (rule.responseType === RESPONSE_TYPE.FILE && rule.responseFileData) ||
        Object.keys(rule.responseHeaders || {}).length)
  );
const parseResponseHeaders = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const decodeDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return new Uint8Array();
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return new TextEncoder().encode(dataUrl);
  const meta = dataUrl.slice(0, comma);
  const value = dataUrl.slice(comma + 1);
  if (meta.includes(';base64')) {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(value));
};
const responseBytes = (rule) =>
  rule?.responseType === RESPONSE_TYPE.FILE ? decodeDataUrl(rule.responseFileData) : new TextEncoder().encode(String(rule?.overrideTxt ?? ''));
const responseText = (rule) => mockResponseText(new TextDecoder().decode(responseBytes(rule)), rule?.responseType);
// Mock.js 模板支持：json/text 响应应用 Mock.mock()（@占位符 与 'name|rule' 数据模板），其余类型（file/js/html/css）按字面返回；
// 含 @ 或 "|规则键" 才处理，普通内容原样返回（页面脚本以本文件为唯一源码，构建产物 dist/pageScripts/main.js）
const mockResponseText = (text, responseType) => {
  const Mock = vendoredMock || globalThis.Mock;
  if (!Mock) {
    console.warn('[Ajax Modifier] Mock.js 未加载，@模板跳过处理（内置 Mock 初始化失败，请重载扩展后刷新页面）');
    return text;
  }
  if (!text || (responseType !== RESPONSE_TYPE.JSON && responseType !== RESPONSE_TYPE.TEXT)) return text;
  const looksLikeTemplate = text.includes('@') || /"[^"]*\|"/.test(text);
  if (!looksLikeTemplate) return text;
  if (responseType !== RESPONSE_TYPE.TEXT) {
    try {
      return JSON.stringify(Mock.mock(JSON.parse(text)));
    } catch {
      /* JSON 解析失败时退化为字符串模板 */
    }
    // 裸写占位符（"test": @integer(1,100)）先补引号再按数据模板处理，让 "|" 规则依然生效
    try {
      return JSON.stringify(Mock.mock(JSON.parse(text.replace(/(:\s*)@([\w.$-]+(?:\s*\([^)]*\))?)/g, '$1"@$2"'))));
    } catch {}
  }
  try {
    return String(Mock.mock(text));
  } catch {
    return text;
  }
};
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const mergeJsonValue = (original, patch) => {
  if (!isPlainObject(original) || !isPlainObject(patch)) return patch;
  return Object.keys({ ...original, ...patch }).reduce((result, key) => {
    result[key] = key in patch ? mergeJsonValue(original[key], patch[key]) : original[key];
    return result;
  }, {});
};
const mergeJsonResponse = (originalText, patchText) => {
  try {
    const original = JSON.parse(originalText);
    const patch = JSON.parse(patchText);
    return JSON.stringify(mergeJsonValue(original, patch));
  } catch {
    return patchText;
  }
};
const applyResponseHeaders = (headers, rule) => {
  const next = new Headers(headers || {});
  Object.entries(parseResponseHeaders(rule?.responseHeaders || rule?.overrideHeaders)).forEach(([key, value]) => next.set(key, String(value)));
  const responseType = rule?.responseType ?? RESPONSE_TYPE.JSON; // 缺省按 json 处理，与导入默认值一致
  if (responseType === RESPONSE_TYPE.FILE && rule.responseFileType && !next.has('Content-Type')) next.set('Content-Type', rule.responseFileType);
  if (responseType === RESPONSE_TYPE.JSON && !next.has('Content-Type')) next.set('Content-Type', 'application/json');
  if (responseType === RESPONSE_TYPE.JS && !next.has('Content-Type')) next.set('Content-Type', 'application/javascript');
  if (responseType === RESPONSE_TYPE.HTML && !next.has('Content-Type')) next.set('Content-Type', 'text/html');
  if (responseType === RESPONSE_TYPE.CSS && !next.has('Content-Type')) next.set('Content-Type', 'text/css');
  if (responseType === RESPONSE_TYPE.TEXT && !next.has('Content-Type')) next.set('Content-Type', 'text/plain');
  return next;
};

// 命名空间
const isPlainJsonObject = (value: unknown): boolean => value !== null && typeof value === 'object' && !Array.isArray(value);
const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
// 规则 JSON 是否为请求体 JSON 的「子集」：对象递归包含，数组/原始值要求完全相等（忽略键序与空白）
const jsonSubset = (a: unknown, b: unknown): boolean => {
  if (isPlainJsonObject(a) && isPlainJsonObject(b)) {
    return Object.keys(a as Record<string, unknown>).every(
      (key) => key in (b as Record<string, unknown>) && jsonSubset((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    );
  }
  return JSON.stringify(a) === JSON.stringify(b);
};
// 包含语义的请求体匹配：两边都能解析为 JSON 时优先按结构比较（格式化/紧凑写法均可），否则退回原样文本包含
const bodyMatchContains = (pattern: string, body: unknown): boolean => {
  if (typeof body !== 'string' || !body) return false;
  const ruleJson = tryParseJson(pattern);
  const bodyJson = tryParseJson(body);
  if (ruleJson !== undefined && bodyJson !== undefined) {
    return jsonSubset(ruleJson, bodyJson) || JSON.stringify(bodyJson).indexOf(JSON.stringify(ruleJson)) > -1;
  }
  return body.indexOf(pattern) > -1;
};
// 规则是否配置了 Body 匹配（空串视为未配置，只作兜底）
const hasBodyCondition = (item: any): boolean => typeof item?.matchBody === 'string' && !!item.matchBody.trim();

// 上报匹配判定日志：经页面事件中继到面板的"匹配日志"展示（url/body 截断，避免刷爆消息通道）
// 附带匹配时刻脚本实际持有的规则数——排查"面板有规则但未命中"（脚本拿到的规则与面板不一致）的关键线索
const reportMatchLog = (url: string, method: string, body: unknown, matched: any) => {
  try {
    const rules = (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules || []) as any[];
    window.dispatchEvent(new CustomEvent(PAGE_SCRIPT_EVENT, {
      detail: {
        logType: 'match',
        url: String(url || '').slice(0, 300),
        method: method || 'GET',
        body: typeof body === 'string' ? body.slice(0, 200) : '',
        matched: !!matched,
        ruleKey: matched && matched.key ? matched.key : '',
        label: (matched && (matched.label || matched.match)) || '',
        // 命中规则的 Body 匹配内容：直接看"命中的是它，因为它的 Body 匹配是这个"
        ruleMatchBody: matched && typeof matched.matchBody === 'string' ? matched.matchBody.slice(0, 100) : '',
        ruleCount: rules.length,
        enabledCount: rules.filter((item) => item && item.switchOn !== false).length
      }
    }));
  } catch {}
};

// 上报脚本运行状态（总开关 / 规则数）：面板展示"页面脚本此刻看到的配置"，
// 总开关关闭时请求完全绕过不留痕迹，状态行能让这种"静默不生效"可见
const reportStatus = () => {
  try {
    const rules = (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules || []) as any[];
    window.dispatchEvent(new CustomEvent(PAGE_SCRIPT_EVENT, {
      detail: {
        logType: 'status',
        switchOn: !!ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn,
        ruleCount: rules.length,
        enabledCount: rules.filter((item) => item && item.switchOn !== false).length
      }
    }));
  } catch {}
};

const ajax_interceptor_qoweifjqon = {
  settings: {
    ajaxInterceptor_switchOn: false,
    ajaxInterceptor_always200On: true, // 默认开启，后期可以扩展成设置项
    ajaxInterceptor_rules: []
  },
  // 请求体统一转字符串：用于请求体匹配（string 原样，URLSearchParams/FormData/二进制/对象各自动转换）
  stringifyRequestBody: (body) => {
    if (body === undefined || body === null) return '';
    if (typeof body === 'string') return body;
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return String(body);
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return [...body.entries()].map(([key, value]) => `${key}=${value}`).join('&');
    }
    if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
      return new TextDecoder().decode(body);
    }
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  },
  // 是否存在配置了请求体匹配的规则（决定是否需要在 send / fetch 阶段提取请求体）
  hasBodyMatchRules: () => {
    return (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules || []).some(
      (item) => item && typeof (item as any).matchBody === 'string' && (item as any).matchBody
    );
  },
  // 获取匹配到的规则项：用请求 URL 遍历规则，配置了 Body 匹配且命中的优先改写，
  // 未配置 Body 匹配的规则只作兜底（避免兜底规则挡住后面的精确规则）
  getMatchedInterface: ({ thisRequestUrl = '', thisMethod = '', thisRequestBody = '' }) => {
    const matches = (item: any) => {
      const { filterType = FILTER_TYPE.NORMAL, limitMethod = 'ALL', switchOn = true, match, matchBody } = item;
      const matchedMethod = thisMethod === limitMethod || limitMethod === 'ALL';
      let matchedRequest = false;
      if (filterType === FILTER_TYPE.NORMAL) {
        // 含 * 时按通配符匹配（如 "/v1/*"），否则按包含匹配
        if (typeof match === 'string' && match.includes('*')) {
          try {
            matchedRequest = new RegExp(match.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), 'i').test(thisRequestUrl);
          } catch {
            matchedRequest = false;
          }
        } else {
          matchedRequest = typeof match === 'string' && thisRequestUrl.indexOf(match) > -1;
        }
      } else if (filterType === FILTER_TYPE.REGEX) {
        try {
          matchedRequest = typeof match === 'string' && new RegExp(match, 'i').test(thisRequestUrl);
        } catch {
          matchedRequest = false;
        }
      }
      // 请求体匹配：仅在规则配置了 matchBody 时校验（与 hasBodyCondition 一致按 trim 判空，空白串不算配置）
      let matchedBody = true;
      if (typeof matchBody === 'string' && matchBody.trim()) {
        if (filterType === FILTER_TYPE.REGEX) {
          try {
            matchedBody = new RegExp(matchBody, 'i').test(thisRequestBody);
          } catch {
            matchedBody = false;
          }
        } else if (matchBody.includes('*')) {
          try {
            matchedBody = new RegExp(matchBody.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'), 'i').test(thisRequestBody);
          } catch {
            matchedBody = false;
          }
        } else {
          matchedBody = bodyMatchContains(matchBody.trim(), thisRequestBody);
        }
      }
      return switchOn && matchedMethod && matchedRequest && matchedBody;
    };
    const rules = (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules || []) as any[];
    return rules.find((item) => hasBodyCondition(item) && matches(item)) || rules.find((item) => matches(item));
  },
  // 执行用户输入的函数，如果有错误会抛出到控制台
  executeStringFunction: (stringFunction, args, funcName = '') => {
    try {
      stringFunction = new Function('...args', stringFunction)(args);
    } catch (e) {
      console.error(`[Ajax Modifier] ExecuteFunctionError: Please check the ${funcName} function.\n`, e);
    }
    return stringFunction;
  },
  getRequestParams: (requestUrl) => {
    if (!requestUrl) {
      return null;
    }
    const paramStr = requestUrl.split('?').pop();
    const keyValueArr = paramStr.split('&');
    let keyValueObj = {};
    keyValueArr.forEach((item) => {
      // 保证中间不会把=给忽略掉
      const itemArr = item.replace('=', '〓').split('〓');
      const itemObj = {
        [itemArr[0]]: itemArr[1]
      };
      keyValueObj = Object.assign(keyValueObj, itemObj);
    });
    return keyValueObj;
  },
  getCompleteUrl: (inputUrl) => {
    let url = inputUrl.trim();
    const protocol = window.location.protocol;
    const host = window.location.host;
    const currentUrl = window.location.href;
    try {
      // 如果解析成功，表示输入是完整的URL，不需要处理
      new URL(url);
    } catch (e) {
      if (url.startsWith('./') || url.startsWith('../')) {
        // 相对路由
        url = new URL(url, currentUrl).href;
      } else if (url.startsWith('//')) {
        // 只缺少协议，补全协议
        url = protocol + url;
      } else {
        // 既没有协议也没有域名，补全域名和协议
        url = protocol + '//' + host + (url.startsWith('/') ? '' : '/') + url;
      }
    }
    return url;
  },
  originalXHR: window.XMLHttpRequest,
  myXHR: function () {
    let pageScriptEventDispatched = false;
    const modifyResponse = () => {
      const [method, requestUrl] = this._openArgs;
      const queryParams = ajax_interceptor_qoweifjqon.getRequestParams(requestUrl);
      const [requestPayload] = this._sendArgs;
      const matchedInterface = this._matchedInterface;
      if (matchedInterface && hasResponseOverride(matchedInterface)) {
        const {
          overrideTxt,
          overrideResponseFunc,
          responseType = RESPONSE_TYPE.JSON, // 缺省按 json 处理
          responseFileData,
          responseFileType,
          responseHeaders,
          overrideMode,
          match,
          isExpert = false
        } = matchedInterface;
        let overrideResponse;
        let overrideStatus;
        let overrideStatusText;
        if (responseType === RESPONSE_TYPE.FILE && responseFileData) {
          const bytes = responseBytes(matchedInterface);
          if (xhr.responseType === 'arraybuffer') overrideResponse = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          else if (xhr.responseType === 'blob') overrideResponse = new Blob([bytes], { type: responseFileType || 'application/octet-stream' });
          else overrideResponse = responseText(matchedInterface);
        } else if (overrideTxt && !isExpert) {
          // 普通模式支持全量或 JSON 增量覆盖；覆盖内容先经过 Mock.js 模板处理
          const mockedTxt = mockResponseText(overrideTxt, responseType);
          overrideResponse = overrideMode === OVERRIDE_MODE.INCREMENTAL && responseType === RESPONSE_TYPE.JSON ? mergeJsonResponse(this.responseText, mockedTxt) : mockedTxt;
          // 状态用200覆盖
          if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_always200On && this.status !== 200) {
            overrideStatus = 200;
            overrideStatusText = 'OK';
          }
        } else if (overrideResponseFunc && isExpert) {
          // 专业模式，用函数替换
          const funcArgs = {
            method,
            payload: {
              queryParams,
              requestPayload
            },
            orgResponse: this.response,
            orgStatus: this.status,
            orgStatusText: this.statusText
          };
          const res = ajax_interceptor_qoweifjqon.executeStringFunction(overrideResponseFunc, funcArgs, 'response');
          // 返回是对象才处理
          if (typeof res === 'object' && res !== null) {
            const { response: newResponse = undefined, status: newStatus = undefined, statusText: newStatusText = undefined } = res;
            overrideResponse = newResponse;
            overrideStatus = newStatus;
            overrideStatusText = newStatusText;
          } else {
            console.error(`[Ajax Modifier] ExecuteFunctionError: Please check your return in the response function. See more details in the examples. \n`);
          }
        }
        // 没有返回不替换
        this.responseText = overrideResponse !== undefined ? overrideResponse : this.responseText;
        this.response = overrideResponse !== undefined ? overrideResponse : this.response;
        this.status = overrideStatus !== undefined ? overrideStatus : this.status;
        this.statusText = overrideStatusText !== undefined ? overrideStatusText : this.statusText;
        this._responseHeaders = parseResponseHeaders(responseHeaders || matchedInterface.overrideHeaders);
        const noContentType = !Object.keys(this._responseHeaders).some((key) => key.toLowerCase() === 'content-type');
        if (responseType === RESPONSE_TYPE.FILE && responseFileType && noContentType) this._responseHeaders['Content-Type'] = responseFileType;
        // 缺省（json/js/html/css）或显式 text 时补对应 Content-Type，避免沿用原请求的响应头
        else if (responseType === RESPONSE_TYPE.JSON && noContentType) this._responseHeaders['Content-Type'] = 'application/json';
        else if (responseType === RESPONSE_TYPE.JS && noContentType) this._responseHeaders['Content-Type'] = 'application/javascript';
        else if (responseType === RESPONSE_TYPE.HTML && noContentType) this._responseHeaders['Content-Type'] = 'text/html';
        else if (responseType === RESPONSE_TYPE.CSS && noContentType) this._responseHeaders['Content-Type'] = 'text/css';
        else if (responseType === RESPONSE_TYPE.TEXT && noContentType) this._responseHeaders['Content-Type'] = 'text/plain';
        if (!pageScriptEventDispatched) {
          window.dispatchEvent(
            new CustomEvent(PAGE_SCRIPT_EVENT, {
              detail: {
                url: this.responseURL,
                match
              }
            })
          );
          pageScriptEventDispatched = true;
        }
      }
    };

    const xhr = new ajax_interceptor_qoweifjqon.originalXHR();
    for (const attr in xhr) {
      if (attr === 'onreadystatechange') {
        xhr.onreadystatechange = (...args) => {
          if (this.readyState === 4) {
            // 请求成功
            modifyResponse();
          }
          this.onreadystatechange && this.onreadystatechange.apply(this, args);
        };
        this.onreadystatechange = null;
        continue;
      } else if (attr === 'onload') {
        xhr.onload = (...args) => {
          // 请求成功
          modifyResponse();
          this.onload && this.onload.apply(this, args);
        };
        this.onload = null;
        continue;
      } else if (attr === 'open') {
        this.open = (...args) => {
          this._openArgs = args;
          const [method, requestUrl] = args;
          this._matchedInterface = ajax_interceptor_qoweifjqon.getMatchedInterface({
            thisRequestUrl: ajax_interceptor_qoweifjqon.getCompleteUrl(requestUrl),
            thisMethod: method
          });
          const matchedInterface = this._matchedInterface;
          // modify request
          if (matchedInterface) {
            const { overridePayloadFunc, isExpert = false } = matchedInterface;
            if (overridePayloadFunc && isExpert && args[0] && args[1] && args[0].toUpperCase() === 'GET') {
              const queryParams = ajax_interceptor_qoweifjqon.getRequestParams(args[1]);
              const data = {
                requestUrl: args[1],
                queryParams
              };
              args[1] = ajax_interceptor_qoweifjqon.executeStringFunction(overridePayloadFunc, data, 'payload');
            }
          }
          xhr.open && xhr.open.apply(xhr, args);
        };
        continue;
      } else if (attr === 'setRequestHeader') {
        this.setRequestHeader = (...args) => {
          // get headers
          this._headerArgs = this._headerArgs
            ? Object.assign(this._headerArgs, {
                [args[0]]: args[1]
              })
            : {
                [args[0]]: args[1]
              };
          const matchedInterface = this._matchedInterface;
          if (!(matchedInterface && matchedInterface.overrideHeadersFunc && matchedInterface.isExpert)) {
            // 没有要拦截修改或添加的header
            xhr.setRequestHeader && xhr.setRequestHeader.apply(xhr, args);
          }
        };
        continue;
      } else if (attr === 'getResponseHeader') {
        this.getResponseHeader = (name) => {
          const key = Object.keys(this._responseHeaders || {}).find((item) => item.toLowerCase() === String(name).toLowerCase());
          return key ? String(this._responseHeaders[key]) : xhr.getResponseHeader(name);
        };
        continue;
      } else if (attr === 'getAllResponseHeaders') {
        this.getAllResponseHeaders = () => {
          const base = xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : '';
          const extra = Object.entries(this._responseHeaders || {})
            .map(([key, value]) => key + ': ' + value)
            .join('\r\n');
          return [base, extra].filter(Boolean).join('\r\n');
        };
        continue;
      } else if (attr === 'send') {
        this.send = (...args) => {
          // 请求体匹配：open 阶段拿不到请求体，存在 matchBody 规则时在 send 阶段按请求体重新匹配
          if (ajax_interceptor_qoweifjqon.hasBodyMatchRules()) {
            const [method, requestUrl] = this._openArgs;
            this._matchedInterface = ajax_interceptor_qoweifjqon.getMatchedInterface({
              thisRequestUrl: ajax_interceptor_qoweifjqon.getCompleteUrl(requestUrl),
              thisMethod: method,
              thisRequestBody: ajax_interceptor_qoweifjqon.stringifyRequestBody(args[0])
            });
          }
          // 匹配判定上报到面板"匹配日志"（命中与未命中都记录，便于排查）
          reportMatchLog(this._openArgs[1], this._openArgs[0], ajax_interceptor_qoweifjqon.stringifyRequestBody(args[0]), this._matchedInterface);
          const matchedInterface = this._matchedInterface;
          if (matchedInterface) {
            // modify headers
            const { overrideHeadersFunc, overridePayloadFunc, overridePayload, isExpert = false } = matchedInterface;
            if (overrideHeadersFunc && isExpert) {
              const headers = ajax_interceptor_qoweifjqon.executeStringFunction(overrideHeadersFunc, this._headerArgs, 'headers');
              Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader && xhr.setRequestHeader.apply(xhr, [key, headers[key]]);
              });
            }
            // modify not GET payload
            const [method] = this._openArgs;
            if (overridePayloadFunc && isExpert && method !== 'GET') {
              args[0] = ajax_interceptor_qoweifjqon.executeStringFunction(overridePayloadFunc, args[0], 'payload');
            } else if (overridePayload && method !== 'GET') {
              // 普通模式请求体覆盖：用 overridePayload 替换请求体（支持 Mock.js 模板），专家函数优先
              args[0] = mockResponseText(String(overridePayload), 'json');
            }
          }
          this._sendArgs = args;
          xhr.send && xhr.send.apply(xhr, args);
        };
        continue;
      }

      if (typeof xhr[attr] === 'function') {
        this[attr] = xhr[attr].bind(xhr);
      } else {
        // responseText和response不是writeable的，但拦截时需要修改它，所以修改就存储在this[`_${attr}`]上
        if (['responseText', 'response', 'status', 'statusText'].includes(attr)) {
          Object.defineProperty(this, attr, {
            get: () => (this[`_${attr}`] == undefined ? xhr[attr] : this[`_${attr}`]),
            set: (val) => (this[`_${attr}`] = val),
            enumerable: true
          });
        } else {
          Object.defineProperty(this, attr, {
            get: () => xhr[attr],
            set: (val) => (xhr[attr] = val),
            enumerable: true
          });
        }
      }
    }

    // These methods are not enumerable in some browsers, so define them explicitly.
    this.getResponseHeader = (name) => {
      const key = Object.keys(this._responseHeaders || {}).find((item) => item.toLowerCase() === String(name).toLowerCase());
      return key ? String(this._responseHeaders[key]) : xhr.getResponseHeader(name);
    };
    this.getAllResponseHeaders = () => {
      const base = xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : '';
      const extra = Object.entries(this._responseHeaders || {})
        .map(([key, value]) => key + ': ' + value)
        .join('\r\n');
      return [base, extra].filter(Boolean).join('\r\n');
    };
  },
  originalFetch: window.fetch.bind(window),
  myFetch: async function (...args) {
    const getOriginalResponse = async (stream) => {
      let text = '';
      const decoder = new TextDecoder('utf-8');
      const reader = stream.getReader();
      const processData = (result) => {
        if (result.done) {
          return text;
        }
        const value = result.value; // Uint8Array
        text += decoder.decode(value, {
          stream: true
        });
        // 读取下一个文件片段，重复处理步骤
        return reader.read().then(processData);
      };
      return await reader.read().then(processData);
    };

    async function readReadableStream(readableStream) {
      const reader = readableStream.getReader();
      const chunks = [];
      let done, value;

      while ((({ done, value } = await reader.read()), !done)) {
        chunks.push(value);
      }

      // 将所有块合并到一个单独的 Uint8Array 中
      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // 使用 TextDecoder 将 Uint8Array 转换为字符串
      const decoder = new TextDecoder();
      return decoder.decode(combined);
    }

    function createReadableStream(text) {
      const encoder = new TextEncoder();
      const encodedText = encoder.encode(text);

      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encodedText);
          controller.close();
        }
      });

      return readableStream;
    }

    const isReadableStream = (obj) => {
      return obj instanceof ReadableStream;
    };

    let [requestUrl, data] = args;

    let inputUrl = '';

    if (typeof requestUrl === 'string') {
      inputUrl = requestUrl;
    } else if (typeof requestUrl === 'object') {
      inputUrl = requestUrl.url || '';
      // readbleStream 的时候，data(args[1]存在空的情况)
      if (!data) {
        data = requestUrl;
      }
    }

    let bodyData = data?.body;

    // 请求体匹配：有规则配置了 matchBody 时，先拿到请求体文本再匹配。
    // fetch 的 body 只能消费一次，因此绝不读取原始 body：Request 对象用 clone() 读副本，
    // 流式 body 用 tee() 分出一路读取、另一路照常发送；读取失败降级为"不校验请求体"继续匹配，hook 不抛错
    if (ajax_interceptor_qoweifjqon.hasBodyMatchRules()) {
      try {
        if (data instanceof Request) {
          bodyData = await data.clone().text();
        } else if (isReadableStream(bodyData)) {
          const [forMatch, forSend] = bodyData.tee();
          bodyData = await readReadableStream(forMatch);
          if (data) data.body = forSend;
        } else {
          bodyData = ajax_interceptor_qoweifjqon.stringifyRequestBody(bodyData);
        }
      } catch {
        bodyData = '';
      }
    }

    const matchedInterface = ajax_interceptor_qoweifjqon.getMatchedInterface({
      thisRequestUrl: ajax_interceptor_qoweifjqon.getCompleteUrl(inputUrl),
      thisMethod: data && data.method,
      thisRequestBody: typeof bodyData === 'string' ? bodyData : ''
    });
    // 匹配判定上报到面板"匹配日志"（命中与未命中都记录，便于排查）
    reportMatchLog(inputUrl, data && data.method, typeof bodyData === 'string' ? bodyData : '', matchedInterface);
    if (matchedInterface && args) {
      if (bodyData && typeof bodyData !== 'string' && isReadableStream(data.body)) {
        bodyData = await readReadableStream(bodyData);
      }
      const { overrideHeadersFunc, overridePayloadFunc, overridePayload, isExpert = false } = matchedInterface;
      if (overrideHeadersFunc && isExpert && data) {
        const headers = ajax_interceptor_qoweifjqon.executeStringFunction(overrideHeadersFunc, this._headerArgs, 'headers');
        args[1].headers = headers;
      }
      if (overridePayloadFunc && isExpert && requestUrl && data) {
        const { method } = data;
        if (['GET', 'HEAD'].includes(method.toUpperCase())) {
          const queryParams = ajax_interceptor_qoweifjqon.getRequestParams(inputUrl);
          const data = {
            requestUrl: inputUrl,
            queryParams
          };
          args[0] = ajax_interceptor_qoweifjqon.executeStringFunction(overridePayloadFunc, data, 'payload');
        } else {
          const dataer = await ajax_interceptor_qoweifjqon.executeStringFunction(overridePayloadFunc, bodyData, 'payload');
          if (isReadableStream(data.body)) {
            const body = createReadableStream(dataer);
            // const [body1] = dataer.tee()
            args[0] = new Request(args[0], {
              body,
              duplex: 'half'
            } as RequestInit);
          } else {
            data.body = dataer;
          }
        }
      } else if (overridePayload && requestUrl) {
        // 普通模式请求体覆盖：非 GET/HEAD 请求用 overridePayload 替换请求体（支持 Mock.js 模板），专家函数优先
        const method = String(data?.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD'].includes(method)) {
          const payloadText = mockResponseText(String(overridePayload), 'json');
          if (isReadableStream(data?.body)) {
            args[0] = new Request(args[0], { body: createReadableStream(payloadText), duplex: 'half' } as RequestInit);
          } else if (data instanceof Request) {
            // Request 的 body 只读，需用 init 重建；method/headers 等其余字段沿用原请求
            args[0] = new Request(args[0], { body: payloadText });
          } else if (data) {
            data.body = payloadText;
          } else {
            args[1] = { body: payloadText };
          }
        }
      }
    }
    const processResponse = async (response) => {
      if (matchedInterface && hasResponseOverride(matchedInterface)) {
        window.dispatchEvent(
          new CustomEvent(PAGE_SCRIPT_EVENT, {
            detail: {
              url: response.url,
              match: matchedInterface.match
            }
          })
        );
        const { overrideTxt, overrideResponseFunc, responseType = RESPONSE_TYPE.JSON, responseFileData, responseHeaders, overrideMode, isExpert = false } = matchedInterface;
        let overrideResponse;
        let overrideStatus;
        let overrideStatusText;

        if (responseType === RESPONSE_TYPE.FILE && responseFileData) {
          overrideResponse = responseText(matchedInterface);
        } else if (overrideTxt && !isExpert) {
          // 普通模式支持全量或 JSON 增量覆盖；覆盖内容先经过 Mock.js 模板处理
          const mockedTxt = mockResponseText(overrideTxt, responseType);
          const originalText = responseType === RESPONSE_TYPE.JSON ? await response.clone().text() : '';
          overrideResponse = overrideMode === OVERRIDE_MODE.INCREMENTAL && responseType === RESPONSE_TYPE.JSON ? mergeJsonResponse(originalText, mockedTxt) : mockedTxt;
          // 状态用200覆盖
          if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_always200On && response.status !== 200) {
            overrideStatus = 200;
            overrideStatusText = 'OK';
          }
        } else if (overrideResponseFunc && isExpert) {
          // 专业模式，用函数替换
          const queryParams = ajax_interceptor_qoweifjqon.getRequestParams(requestUrl);
          const orgResponse = await getOriginalResponse(response.body);
          const funcArgs = {
            method: data?.method,
            payload: {
              queryParams,
              requestPayload: data?.body
            },
            orgResponse,
            orgStatus: response.status,
            orgStatusText: response.statusText
          };
          const res = ajax_interceptor_qoweifjqon.executeStringFunction(overrideResponseFunc, funcArgs, 'response');
          if (typeof res === 'object' && res !== null) {
            const { response: newResponse = undefined, status: newStatus = undefined, statusText: newStatusText = undefined } = res;
            overrideResponse = newResponse;
            overrideStatus = newStatus;
            overrideStatusText = newStatusText;
          } else {
            console.error(`[Ajax Modifier] ExecuteFunctionError: Please check your return in the response function. See more details in the examples. \n`);
          }
        }
        const body =
          overrideResponse !== undefined
            ? responseType === RESPONSE_TYPE.FILE
              ? responseBytes(matchedInterface)
              : new TextEncoder().encode(String(overrideResponse))
            : new Uint8Array(await response.clone().arrayBuffer());
        const stream = new ReadableStream({
          start(controller) {
            // const bufView = new Uint8Array(new ArrayBuffer(txt.length))
            // for (var i = 0 i < txt.length i++) {
            //   bufView[i] = txt.charCodeAt(i)
            // }
            controller.enqueue(body);
            controller.close();
          }
        });
        const params = {
          status: overrideStatus !== undefined ? overrideStatus : response.status,
          statusText: overrideStatusText !== undefined ? overrideStatusText : response.statusText
        };
        const newResponse = new Response(stream, {
          headers: applyResponseHeaders(response.headers, { ...matchedInterface, responseHeaders }),
          ...params
        });
        const proxy = new Proxy(newResponse, {
          get: (target, name) => {
            switch (name) {
              case 'redirected':
              case 'type':
              case 'url':
              case 'useFinalURL':
              case 'body':
              case 'bodyUsed':
                return response[name];
            }
            return target[name];
          }
        });
        for (const key in proxy) {
          if (typeof proxy[key] === 'function') {
            proxy[key] = proxy[key].bind(newResponse);
          }
        }
        return proxy;
      } else {
        return response;
      }
    };
    return ajax_interceptor_qoweifjqon.originalFetch(...args).then(processResponse);
  }
};

const applyRuntimeSetting = (data: any = {}) => {
  const setSetting = (key, value) => {
    // overrideTxt 允许直接传 JSON 对象，下发前统一序列化为字符串
    ajax_interceptor_qoweifjqon.settings[key] =
      key === 'ajaxInterceptor_rules' && Array.isArray(value)
        ? value.map((rule) => ({ ...rule, overrideTxt: typeof rule?.overrideTxt === 'string' ? rule.overrideTxt : JSON.stringify(rule?.overrideTxt ?? '') }))
        : value;
  };
  if (data.type === 'ajaxInterceptor' && data.to === 'pageScript') {
    // 面板挂载时会请求一次当前状态，用于展示"脚本此刻看到的配置"
    if (data.key === 'ajaxInterceptor_requestStatus') {
      reportStatus();
      return;
    }
    setSetting(data.key, data.value);
  } else if (data.key && data.value !== undefined) {
    setSetting(data.key, data.value);
  }

  if (ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn) {
    // https://github.com/YGYOOO/ajax-interceptor/issues/78
    // https://github.com/YGYOOO/ajax-interceptor/issues/93
    for (const k in ajax_interceptor_qoweifjqon.originalXHR) {
      ajax_interceptor_qoweifjqon.myXHR[k] = ajax_interceptor_qoweifjqon.originalXHR[k];
    }
    window.XMLHttpRequest = ajax_interceptor_qoweifjqon.myXHR as unknown as typeof XMLHttpRequest;
    window.fetch = ajax_interceptor_qoweifjqon.myFetch;
  } else {
    window.XMLHttpRequest = ajax_interceptor_qoweifjqon.originalXHR;
    window.fetch = ajax_interceptor_qoweifjqon.originalFetch;
  }
  // 设置变化后同步一次脚本状态到面板
  reportStatus();
};

window.addEventListener('message', (event) => applyRuntimeSetting(event.data), false);
window.addEventListener('api-override:settings', (event) => applyRuntimeSetting((event as CustomEvent).detail), false);

// Public, host-agnostic control surface for the web app and Playwright agents.
globalThis.apiOverride = {
  setSetting(key, value) {
    applyRuntimeSetting({ key, value });
  },
  setSettings(settings = {}) {
    Object.entries(settings).forEach(([key, value]) => applyRuntimeSetting({ key, value }));
  },
  getSettings() {
    return { ...ajax_interceptor_qoweifjqon.settings };
  },
  restore() {
    ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_switchOn = false;
    applyRuntimeSetting();
  }
};

// 启动时同步应用 localStorage 缓存的上一次设置（content.js 下发时写入，键见 messaging.ts）：
// 本脚本一执行就装好 hook，抢在页面脚本的早期请求之前；刷新 / 二次导航乃至新 tab 首屏都能命中
// （localStorage 同源各 tab 共享）。首次使用（缓存为空或解析失败）时退回 content.js 的异步下发。
try {
  const cachedSettings = JSON.parse(localStorage.getItem(PAGE_SETTINGS_CACHE_KEY) || 'null');
  if (cachedSettings && typeof cachedSettings === 'object') {
    if ('ajaxInterceptor_rules' in cachedSettings) applyRuntimeSetting({ key: 'ajaxInterceptor_rules', value: cachedSettings.ajaxInterceptor_rules });
    if ('ajaxInterceptor_switchOn' in cachedSettings) applyRuntimeSetting({ key: 'ajaxInterceptor_switchOn', value: cachedSettings.ajaxInterceptor_switchOn });
  } else {
    applyRuntimeSetting();
  }
} catch {
  applyRuntimeSetting();
}
