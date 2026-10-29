export type RuleFilterType = 'normal' | 'regex';
export type RequestMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
export type ResponseType = 'json' | 'text' | 'file';
export type OverrideMode = 'full' | 'incremental';
export type ProxyProtocol = 'http' | 'https';
export type UiLanguage = 'zh-CN' | 'en-US' | string;
export type UiTheme = 'light' | 'dark' | string;

export type ResponseHeaders = Record<string, string | number | boolean>;

export interface Rule {
  key: string;
  label: string;
  match: string;
  switchOn: boolean;
  filterType: RuleFilterType;
  limitMethod: RequestMethod;
  responseType: ResponseType;
  overrideMode: OverrideMode;
  overrideTxt: string;
  responseHeaders: ResponseHeaders;
  overrideHeaders?: ResponseHeaders | string;
  responseFileName: string;
  responseFileType: string;
  responseFileData: string;
  overrideStatus?: number;
  overrideStatusText?: string;
  always200?: boolean;
  overrideResponseFunc?: string;
}

/** A tolerant shape for data imported from older extension settings. */
export type RuleLike = Partial<Rule> & Record<string, unknown>;

export type RuleInput = Partial<Rule> & {
  responseHeaders?: ResponseHeaders | string;
  overrideHeaders?: ResponseHeaders | string;
};

export interface RuleGroup {
  id: string;
  name: string;
  enabled: boolean;
  rules: Rule[];
}

export interface ProxyMapping {
  id?: string;
  groupName?: string;
  host: string;
  upstream: string;
  protocol: ProxyProtocol;
  enabled: boolean;
}

export interface CustomFunctionSettings {
  panelPosition: number;
  [key: string]: unknown;
}

export interface AppSettings {
  ajaxInterceptor_switchOn: boolean;
  ajaxInterceptor_rules: Rule[];
  ajaxInterceptor_groups: RuleGroup[];
  customFunction: CustomFunctionSettings;
  ui_language: UiLanguage;
  ui_theme: UiTheme;
  ui_sidebar_collapsed: boolean;
  proxyEnabled: boolean;
  proxyMode?: string;
  proxyControlUrl: string;
  proxyMappings: ProxyMapping[];
}

export interface ProxyConfig {
  enabled: boolean;
  mappings: ProxyMapping[];
  groups: RuleGroup[];
  rules: Rule[];
  updatedAt: string | null;
}

export interface TranslationLabels {
  file: string;
  text: string;
  json: string;
}

export interface ExportData {
  version: 1;
  groups: RuleGroup[];
}
