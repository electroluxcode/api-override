import type { AppSettings, ExportData, ResponseHeaders, Rule, RuleGroup, RuleInput, TranslationLabels } from './types';
import { stringifyBody } from './interceptor';
import { FILTER_TYPE, OVERRIDE_MODE, RESPONSE_TYPE } from './constants';

export type { AppSettings, ExportData, ProxyMapping, ResponseHeaders, ResponseType, Rule, RuleGroup, RuleInput } from './types';

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const MOCK_RESPONSE = '{\n  "ok": true,\n  "source": "api-override"\n}';

export const defaultSettings: AppSettings = {
  ajaxInterceptor_switchOn: false,
  ajaxInterceptor_rules: [],
  ajaxInterceptor_groups: [],
  customFunction: { panelPosition: 0 },
  ui_language: 'zh-CN',
  ui_theme: 'dark',
  ui_sidebar_collapsed: false,
  proxyEnabled: false,
  proxyControlUrl: 'http://127.0.0.1:17880',
  proxyMappings: []
};

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

export const createRule = (overrides: RuleInput = {}): Rule =>
  ({
    key: uid(),
    label: 'mock data',
    match: '/api/test',
    switchOn: true,
    filterType: FILTER_TYPE.NORMAL,
    limitMethod: 'ALL',
    responseType: RESPONSE_TYPE.JSON,
    overrideMode: OVERRIDE_MODE.FULL,
    responseFileName: '',
    responseFileType: '',
    responseFileData: '',
    ...overrides,
    // overrideTxt 允许直接写 JSON 对象/数组，导入时统一序列化为字符串
    overrideTxt: stringifyBody(overrides.overrideTxt ?? MOCK_RESPONSE),
    responseHeaders: parseHeaders(overrides.responseHeaders || overrides.overrideHeaders)
  }) as Rule;

export const createGroup = (name = 'test', rules: Rule[] = [createRule({ key: 'test-mock' })]): RuleGroup => ({
  id: uid(),
  name,
  enabled: true,
  rules
});

export const normalizeGroups = ({
  ajaxInterceptor_groups: groups,
  ajaxInterceptor_rules: rules
}: {
  ajaxInterceptor_groups?: unknown;
  ajaxInterceptor_rules?: unknown;
} = {}): RuleGroup[] => {
  if (Array.isArray(groups) && groups.length) {
    return groups.map((group) => {
      const source = group as Partial<RuleGroup> & { rules?: unknown };
      return {
        id: source.id || uid(),
        name: String(source.name || 'group'),
        enabled: source.enabled !== false,
        rules: Array.isArray(source.rules)
          ? source.rules.map((rule) =>
              createRule({
                ...(rule as RuleInput),
                responseType: (rule as RuleInput).responseType || ((rule as RuleInput).responseFileData ? RESPONSE_TYPE.FILE : RESPONSE_TYPE.JSON),
                overrideMode: (rule as RuleInput).overrideMode || OVERRIDE_MODE.FULL,
                responseHeaders: parseHeaders((rule as RuleInput).responseHeaders || (rule as RuleInput).overrideHeaders)
              })
            )
          : []
      };
    });
  }
  if (Array.isArray(rules) && rules.length)
    return [
      createGroup(
        'default',
        rules.map((rule) => createRule(rule as RuleInput))
      )
    ];
  return [createGroup()];
};

export const flattenRules = (groups: RuleGroup[]): Rule[] =>
  groups.flatMap((group) =>
    group.rules.map((rule) => ({
      ...rule,
      switchOn: group.enabled && rule.switchOn !== false
    }))
  );

export const responseLabel = (rule: Rule, t: TranslationLabels): string => {
  if (rule.responseType === RESPONSE_TYPE.FILE) return `${t.file}${rule.responseFileName ? ` · ${rule.responseFileName}` : ''}`;
  return rule.responseType === RESPONSE_TYPE.TEXT ? t.text : t.json;
};

export const exportData = (groups: RuleGroup[]): ExportData => ({ version: 1, groups });
export const templateData = (): ExportData => ({ version: 1, groups: [createGroup('test', [createRule({ key: 'example-rule' })])] });

/**
 * 按名称合并导入的规则组：与现有规则组同名的整体覆盖（保留原 id，激活态不失效），其余追加到末尾。
 */
export const mergeGroupsByName = (existing: RuleGroup[], imported: RuleGroup[]): RuleGroup[] => {
  const importedByName = new Map(imported.map((group) => [group.name, group]));
  const merged = existing.map((group) => {
    const incoming = importedByName.get(group.name);
    return incoming ? { ...incoming, id: group.id } : group;
  });
  const overwrittenNames = new Set(existing.filter((group) => importedByName.has(group.name)).map((group) => group.name));
  const appended = imported.filter((group) => !overwrittenNames.has(group.name));
  return [...merged, ...appended];
};

/**
 * 宽容解析导入数据，支持从精简到完整的多种形态：
 * - 完整导出格式 {version, groups}
 * - {groups: [...]} / {rules: [...]} / {ajaxInterceptor_groups, ajaxInterceptor_rules}
 * - 分组数组 [{name, rules}] 或纯规则数组 [{label, match}]
 * - 单个规则对象 {label, match, overrideTxt}
 * 缺省字段一律由 createRule/createGroup 补默认值（json、full、ALL 等）。
 */
export const parseImport = (parsed: unknown): RuleGroup[] => {
  if (Array.isArray(parsed)) {
    const isRuleList = parsed.every((item) => item === null || typeof item !== 'object' || !('rules' in item));
    return normalizeGroups(isRuleList ? { ajaxInterceptor_rules: parsed } : { ajaxInterceptor_groups: parsed });
  }
  if (!parsed || typeof parsed !== 'object') return normalizeGroups();
  const source = parsed as Record<string, unknown>;
  if ('match' in source || 'overrideTxt' in source) return normalizeGroups({ ajaxInterceptor_rules: [source] });
  if (Array.isArray(source.rules)) return normalizeGroups({ ajaxInterceptor_rules: source.rules });
  return normalizeGroups({
    ajaxInterceptor_groups: source.groups ?? source.ajaxInterceptor_groups,
    ajaxInterceptor_rules: source.ajaxInterceptor_rules
  });
};
