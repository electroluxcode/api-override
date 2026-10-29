import type { AppSettings, ProxyMapping, Rule, RuleGroup } from '@api-override/core/types';

declare global {
  interface Window {
    setting?: AppSettings;
    apiOverridePopup?: boolean;
    apiOverrideOptionsPage?: boolean;
    apiOverrideSidePanel?: boolean;
  }
}

export type ComponentRule = Rule;
export type ComponentRuleGroup = RuleGroup;
export type ComponentProxyMapping = ProxyMapping;
