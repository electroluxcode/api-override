import type { OverrideMode, ResponseType, RuleFilterType, UiTheme } from './types';

/** Rule.responseType 的合法取值 */
export const RESPONSE_TYPE = {
  JSON: 'json',
  TEXT: 'text',
  FILE: 'file'
} as const satisfies Record<string, ResponseType>;

/** Rule.overrideMode 的合法取值 */
export const OVERRIDE_MODE = {
  FULL: 'full',
  INCREMENTAL: 'incremental'
} as const satisfies Record<string, OverrideMode>;

/** Rule.filterType 的合法取值 */
export const FILTER_TYPE = {
  NORMAL: 'normal',
  REGEX: 'regex'
} as const satisfies Record<string, RuleFilterType>;

/** UI 主题取值 */
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark'
} as const satisfies Record<string, UiTheme>;

/** 界面视图标识：侧栏导航与内容区路由共用 */
export const VIEW = {
  RULES: 'rules',
  SETTINGS: 'settings',
  ADMIN: 'admin',
  USAGE: 'usage'
} as const;

/** Rule.limitMethod 可选的 HTTP 方法（含 ALL 通配） */
export const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * chrome.storage / 设置对象的键名。
 * 与 apps/extension/public 下的 service_worker.js、pageScripts/main.js、content.js
 * 中的字符串字面量保持一致，改动前必须同步所有运行时文件。
 */
export const STORAGE_KEY = {
  SWITCH_ON: 'ajaxInterceptor_switchOn',
  GROUPS: 'ajaxInterceptor_groups',
  RULES: 'ajaxInterceptor_rules'
} as const;
