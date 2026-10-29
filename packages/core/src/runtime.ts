import { FILTER_TYPE, OVERRIDE_MODE, RESPONSE_TYPE } from './constants';
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
const responseText = (rule) => new TextDecoder().decode(responseBytes(rule));
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
  if (responseType === RESPONSE_TYPE.TEXT && !next.has('Content-Type')) next.set('Content-Type', 'text/plain');
  return next;
};

// 命名空间
const ajax_interceptor_qoweifjqon = {
  settings: {
    ajaxInterceptor_switchOn: false,
    ajaxInterceptor_always200On: true, // 默认开启，后期可以扩展成设置项
    ajaxInterceptor_rules: []
  },
  // 获取匹配到的规则项
  getMatchedInterface: ({ thisRequestUrl = '', thisMethod = '' }) => {
    return ajax_interceptor_qoweifjqon.settings.ajaxInterceptor_rules.find((item) => {
      const { filterType = FILTER_TYPE.NORMAL, limitMethod = 'ALL', switchOn = true, match } = item as any;
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
      return switchOn && matchedMethod && matchedRequest;
    });
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
          // 普通模式支持全量或 JSON 增量覆盖
          overrideResponse = overrideMode === OVERRIDE_MODE.INCREMENTAL && responseType === RESPONSE_TYPE.JSON ? mergeJsonResponse(this.responseText, overrideTxt) : overrideTxt;
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
        // 缺省（json）或显式 text 时补对应 Content-Type，避免沿用原请求的响应头
        else if (responseType === RESPONSE_TYPE.JSON && noContentType) this._responseHeaders['Content-Type'] = 'application/json';
        else if (responseType === RESPONSE_TYPE.TEXT && noContentType) this._responseHeaders['Content-Type'] = 'text/plain';
        if (!pageScriptEventDispatched) {
          window.dispatchEvent(
            new CustomEvent('pageScript', {
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
          const matchedInterface = this._matchedInterface;
          if (matchedInterface) {
            // modify headers
            const { overrideHeadersFunc, overridePayloadFunc, isExpert = false } = matchedInterface;
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

    const matchedInterface = ajax_interceptor_qoweifjqon.getMatchedInterface({
      thisRequestUrl: ajax_interceptor_qoweifjqon.getCompleteUrl(inputUrl),
      thisMethod: data && data.method
    });
    if (matchedInterface && args) {
      if (bodyData && isReadableStream(data.body)) {
        bodyData = await readReadableStream(bodyData);
      }
      const { overrideHeadersFunc, overridePayloadFunc, isExpert = false } = matchedInterface;
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
      }
    }
    return ajax_interceptor_qoweifjqon.originalFetch(...args).then(async (response) => {
      if (matchedInterface && hasResponseOverride(matchedInterface)) {
        window.dispatchEvent(
          new CustomEvent('pageScript', {
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
          // 普通模式支持全量或 JSON 增量覆盖
          const originalText = responseType === RESPONSE_TYPE.JSON ? await response.clone().text() : '';
          overrideResponse = overrideMode === OVERRIDE_MODE.INCREMENTAL && responseType === RESPONSE_TYPE.JSON ? mergeJsonResponse(originalText, overrideTxt) : overrideTxt;
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
    });
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
applyRuntimeSetting();
