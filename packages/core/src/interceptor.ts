import type { ResponseHeaders, RuleLike } from './types';
import { FILTER_TYPE, RESPONSE_TYPE } from './constants';

/**
 * Framework-free rule utilities shared by the extension, web runtime, and
 * agent/browser integrations. Keeping matching here prevents each host from
 * inventing subtly different URL and method semantics.
 */
export const parseHeaders = (value: unknown): ResponseHeaders => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as ResponseHeaders;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ResponseHeaders) : {};
  } catch {
    return {};
  }
};

/**
 * normal 匹配默认为「包含匹配」；当 match 含有 * 时按通配符处理：
 * 其余字符按字面量转义，* 匹配任意字符（大小写不敏感、不对 URL 锚定首尾）。
 * 例如 "/v1/*" 可命中 "https://api.example.com/v1/users/1"。
 */
export const matchPattern = (match: string, url: string): boolean => {
  if (!match) return false;
  if (!match.includes('*')) return url.includes(match);
  const source = match
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  try {
    return new RegExp(source, 'i').test(url);
  } catch {
    return false;
  }
};

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

/**
 * 请求体匹配：规则配置了 matchBody 时才校验，语义与 match 一致（normal=包含/通配，regex=正则）。
 * normal 且两边都能解析为 JSON 时优先按结构比较（格式化/紧凑写法、键序不同均可），再退回文本包含。
 * bodyText 由调用方先用 stringifyRequestBody 转成字符串。
 */
export const matchBodyPattern = (rule: RuleLike, bodyText: string): boolean => {
  const pattern = String(rule.matchBody || '').trim();
  if (!pattern) return true;
  if (rule.filterType === FILTER_TYPE.REGEX) {
    try {
      return new RegExp(pattern, 'i').test(bodyText);
    } catch {
      return false;
    }
  }
  if (pattern.includes('*')) return matchPattern(pattern, bodyText);
  const ruleJson = tryParseJson(pattern);
  const bodyJson = typeof bodyText === 'string' ? tryParseJson(bodyText) : undefined;
  if (ruleJson !== undefined && bodyJson !== undefined) {
    return jsonSubset(ruleJson, bodyJson) || JSON.stringify(bodyJson).indexOf(JSON.stringify(ruleJson)) > -1;
  }
  return typeof bodyText === 'string' && bodyText.indexOf(pattern) > -1;
};

/** 请求体统一转字符串：字符串/URLSearchParams 原样，FormData 拼成 k=v，二进制解码，对象 JSON 序列化。 */
export const stringifyRequestBody = (body: unknown): string => {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return String(body);
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return [...body.entries()].map(([key, value]) => `${key}=${value}`).join('&');
  }
  if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
    return new TextDecoder().decode(body as ArrayBuffer);
  }
  return stringifyBody(body);
};

export const matchesRule = (rule: RuleLike | null | undefined, url: string, method = 'GET', bodyText = ''): boolean => {
  if (!rule || rule.switchOn === false || !url) return false;
  const limitMethod = String(rule.limitMethod || 'ALL').toUpperCase();
  if (limitMethod !== 'ALL' && limitMethod !== String(method).toUpperCase()) return false;
  if (rule.filterType === FILTER_TYPE.REGEX) {
    try {
      return new RegExp(String(rule.match || ''), 'i').test(url) && matchBodyPattern(rule, bodyText);
    } catch {
      return false;
    }
  }
  return typeof rule.match === 'string' && matchPattern(rule.match, url) && matchBodyPattern(rule, bodyText);
};

/** 规则是否配置了 Body 匹配（空串视为未配置，只作兜底）。 */
export const hasBodyCondition = (rule: RuleLike): boolean => typeof rule?.matchBody === 'string' && rule.matchBody.trim() !== '';

/**
 * 遍历规则找第一条命中的：用请求 URL（与 method/bodyText）逐条判断，
 * 配置了 Body 匹配且命中的规则优先，未配置 Body 匹配的规则只作兜底——
 * 避免前面的兜底规则挡住后面的按请求体区分的精确规则。
 */
export const findMatchedRule = (rules: RuleLike[] = [], url: string, method = 'GET', bodyText = ''): RuleLike | undefined =>
  rules.find((rule) => hasBodyCondition(rule) && matchesRule(rule, url, method, bodyText)) ??
  rules.find((rule) => matchesRule(rule, url, method, bodyText));

export const decodeDataUrl = (dataUrl: unknown): Uint8Array => {
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

/** 响应体统一转字符串：字符串原样返回，对象/数组等其他 JSON 值自动序列化（导入与运行时共用）。 */
export const stringifyBody = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const responseBytes = (rule?: RuleLike): Uint8Array =>
  rule?.responseType === RESPONSE_TYPE.FILE ? decodeDataUrl(rule.responseFileData) : new TextEncoder().encode(stringifyBody(rule?.overrideTxt));

export const applyResponseHeaders = (headers: HeadersInit | undefined, rule?: RuleLike): Headers => {
  const next = new Headers(headers || {});
  for (const [key, value] of Object.entries(parseHeaders(rule?.responseHeaders || rule?.overrideHeaders))) next.set(key, String(value));
  const responseType = rule?.responseType ?? RESPONSE_TYPE.JSON; // 缺省按 json 处理，与导入默认值一致
  if (responseType === RESPONSE_TYPE.FILE && rule?.responseFileType && !next.has('Content-Type')) next.set('Content-Type', rule.responseFileType);
  if (responseType === RESPONSE_TYPE.JSON && !next.has('Content-Type')) next.set('Content-Type', 'application/json');
  if (responseType === RESPONSE_TYPE.TEXT && !next.has('Content-Type')) next.set('Content-Type', 'text/plain');
  return next;
};

export const createFetchResponse = (response: Response, rule?: RuleLike, body?: BodyInit | null): Response =>
  new Response(body, {
    status: Number(rule?.overrideStatus ?? (rule?.always200 ? 200 : response.status)),
    statusText: String(rule?.overrideStatusText ?? (rule?.always200 ? 'OK' : response.statusText)),
    headers: applyResponseHeaders(response.headers, rule)
  });
