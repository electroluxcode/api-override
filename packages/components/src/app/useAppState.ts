import {
  createGroup,
  createRule,
  defaultSettings,
  exportData,
  flattenRules,
  mergeGroupsByName,
  normalizeGroups,
  parseImport,
  templateData
} from '@api-override/core/model';
import type { AppSettings, ProxyMapping, RuleGroup } from '@api-override/core/types';
import { STORAGE_KEY, THEME, VIEW } from '@api-override/core/constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm';
import { I18N } from '../shared/i18n';
import { downloadJson, openOptionsPage, saveSetting } from '../shared/platform';

const readLocalSettings = () => {
  try {
    return JSON.parse(localStorage.getItem('api_override_settings') || '{}');
  } catch {
    return {};
  }
};

const buildSyncPayload = ({ enabled, mode, mappings, groups }: { enabled: boolean; mode: string; mappings: ProxyMapping[]; groups: RuleGroup[] }) => ({
  enabled,
  mode,
  mappings,
  groups,
  rules: flattenRules(groups)
});
const serializeSyncPayload = (payload: unknown): string => JSON.stringify(payload);

export function loadInitialSettings(done: (settings: AppSettings) => void): void {
  const fallback = { ...defaultSettings };
  const local = readLocalSettings();
  done({ ...fallback, ...local, groups: normalizeGroups({ ...fallback, ...local }) });
}

export default function useAppState(initialSettings: AppSettings) {
  const initialGroups = useMemo(() => normalizeGroups(initialSettings), [initialSettings]);
  const [groups, setGroups] = useState(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(initialGroups[0]?.id);
  const [detailRuleKey, setDetailRuleKey] = useState(null);
  const [globalOn, setGlobalOn] = useState(Boolean(initialSettings.ajaxInterceptor_switchOn));
  const [language, setLanguage] = useState(initialSettings.ui_language || 'zh-CN');
  const [theme, setTheme] = useState(initialSettings.ui_theme || THEME.DARK);
  const [customFunction, setCustomFunction] = useState(initialSettings.customFunction || { panelPosition: 0 });
  const localProxyAvailable = true;
  const [proxyEnabled, setProxyEnabled] = useState(Boolean(initialSettings.proxyEnabled));
  const [proxyMode, setProxyMode] = useState(initialSettings.proxyMode === 'hosts' ? 'hosts' : 'pac');
  const [proxyControlUrl, setProxyControlUrl] = useState(initialSettings.proxyControlUrl || 'http://127.0.0.1:17880');
  const [proxyMappings, setProxyMappings] = useState(Array.isArray(initialSettings.proxyMappings) ? initialSettings.proxyMappings : []);
  const [proxyStatus, setProxyStatus] = useState('checking');
  const initialSyncPayload = useMemo(
    () =>
      buildSyncPayload({
        enabled: Boolean(initialSettings.proxyEnabled && initialSettings.ajaxInterceptor_switchOn),
        mode: initialSettings.proxyMode === 'hosts' ? 'hosts' : 'pac',
        mappings: Array.isArray(initialSettings.proxyMappings) ? initialSettings.proxyMappings : [],
        groups: initialGroups
      }),
    [initialGroups, initialSettings.ajaxInterceptor_switchOn, initialSettings.proxyEnabled, initialSettings.proxyMode, initialSettings.proxyMappings]
  );
  const [lastSyncedSnapshot, setLastSyncedSnapshot] = useState(() => serializeSyncPayload(initialSyncPayload));
  const routeParams = new URLSearchParams(window.location.search);
  const mode = routeParams.get('mode');
  const optionsPage = Boolean(mode === 'options' || globalThis.apiOverrideOptionsPage || document.documentElement.classList.contains('options-page'));
  const sidePanel = Boolean(mode === 'sidepanel' || document.documentElement.classList.contains('side-panel'));
  const showSidebar = routeParams.get('sidebar') === '1';
  const routeView = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') || (optionsPage && params.get('sidebar') === '1' ? VIEW.SETTINGS : VIEW.RULES);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(showSidebar ? false : sidePanel || Boolean(initialSettings.ui_sidebar_collapsed));
  const [intercepted, _setIntercepted] = useState({});
  const [notice, setNotice] = useState('');
  const [view, setView] = useState(routeView);
  const t = I18N[language] || I18N['zh-CN'];
  const confirm = useConfirm();
  // 统一的确认弹窗参数：AlertDialog 替代 window.confirm
  const confirmOptions = (description: string) => ({ description, confirmLabel: t.confirm, cancelLabel: t.cancel, destructive: true });
  const syncPayload = useMemo(
    () => buildSyncPayload({ enabled: proxyEnabled && globalOn, mode: proxyMode, mappings: proxyMappings, groups }),
    [globalOn, groups, proxyEnabled, proxyMode, proxyMappings]
  );
  const syncSnapshot = useMemo(() => serializeSyncPayload(syncPayload), [syncPayload]);
  const hasPendingChanges = localProxyAvailable && syncSnapshot !== lastSyncedSnapshot;
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
  const detailRule = activeGroup?.rules.find((rule) => rule.key === detailRuleKey);

  const noticeTimer = useRef<number | undefined>(undefined);
  const changeNotice = (message) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 1800);
  };
  const openPage = (page, { showSidebar: revealSidebar = false } = {}) => {
    const params = new URLSearchParams(window.location.search);
    if (page === VIEW.RULES) params.delete('page');
    else params.set('page', page);
    if (revealSidebar) {
      params.set('sidebar', '1');
      setSidebarCollapsed(false);
    }
    if (optionsPage) document.documentElement.classList.toggle('options-sidebar', params.get('sidebar') === '1');
    const query = params.toString();
    window.history.pushState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    setView(page);
    setDetailRuleKey(null);
  };
  // The header action is the escape hatch from Side Panel/DevTools to the full
  // Options page. Keep the rule-management view selected when the sidebar opens.
  const openOptionsWithSidebar = () => {
    if (optionsPage) {
      openPage(VIEW.RULES, { showSidebar: true });
      return;
    }
    const openOptionsFallback = () => {
      const params = new URLSearchParams(window.location.search);
      params.set('mode', 'options');
      params.set('sidebar', '1');
      params.set('page', VIEW.RULES);
      params.delete('sidepanel');
      params.delete('popup');
      window.location.assign(`${window.location.pathname}?${params.toString()}`);
    };
    openOptionsPage({ query: 'sidebar=1&page=rules', fallback: openOptionsFallback });
  };

  // The Settings item belongs to the current page and must not create a tab.
  const openSettings = () => openPage(VIEW.SETTINGS, { showSidebar: true });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveSetting('ui_theme', theme);
  }, [theme]);
  useEffect(() => saveSetting('ui_language', language), [language]);
  useEffect(() => saveSetting('ui_sidebar_collapsed', sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => saveSetting('customFunction', customFunction), [customFunction]);
  useEffect(() => saveSetting('proxyEnabled', proxyEnabled), [proxyEnabled]);
  useEffect(() => saveSetting('proxyMode', proxyMode), [proxyMode]);
  useEffect(() => saveSetting('proxyControlUrl', proxyControlUrl), [proxyControlUrl]);
  useEffect(() => saveSetting('proxyMappings', proxyMappings), [proxyMappings]);
  const proxyUrl = () => String(proxyControlUrl || '').replace(/\/$/, '');
  const refreshProxyService = async () => {
    if (!localProxyAvailable || !proxyUrl()) return false;
    setProxyStatus('checking');
    try {
      const response = await fetch(`${proxyUrl()}/health`, { cache: 'no-store' });
      if (!response.ok) throw new Error('service unavailable');
      setProxyStatus('online');
      return true;
    } catch {
      setProxyStatus('offline');
      return false;
    }
  };
  const syncProxyService = async ({ silent = false } = {}) => {
    if (!localProxyAvailable || !proxyUrl()) return false;
    try {
      const response = await fetch(`${proxyUrl()}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncPayload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'service unavailable');
      setProxyStatus('online');
      setLastSyncedSnapshot(syncSnapshot);
      saveSetting('proxyEnabled', proxyEnabled);
      saveSetting('proxyControlUrl', proxyControlUrl);
      saveSetting('proxyMappings', proxyMappings);
      saveSetting(STORAGE_KEY.SWITCH_ON, globalOn);
      saveSetting(STORAGE_KEY.GROUPS, groups);
      saveSetting(STORAGE_KEY.RULES, syncPayload.rules);
      if (!silent) changeNotice(t.mappingSaved);
      return true;
    } catch (error) {
      setProxyStatus('offline');
      if (!silent) changeNotice(error.message || t.serviceUnavailable);
      return false;
    }
  };
  useEffect(() => {
    refreshProxyService();
  }, [proxyControlUrl]);
  useEffect(() => {
    saveSetting(STORAGE_KEY.SWITCH_ON, globalOn);
    window.setting = { ...(window.setting || {}), [STORAGE_KEY.SWITCH_ON]: globalOn } as AppSettings;
  }, [globalOn]);
  useEffect(() => {
    const nextRules = flattenRules(groups);
    window.setting = { ...(window.setting || {}), [STORAGE_KEY.GROUPS]: groups, [STORAGE_KEY.RULES]: nextRules } as AppSettings;
    const timer = window.setTimeout(() => {
      saveSetting(STORAGE_KEY.GROUPS, groups);
      saveSetting('ajaxInterceptor_rules', nextRules);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [groups]);
  useEffect(() => {
    const onPopState = () => setView(routeView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const updateGroup = (id, patch) => setGroups((items) => items.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  const selectGroup = (id) => {
    setActiveGroupId(id);
    setDetailRuleKey(null);
    openPage(VIEW.RULES);
  };
  const renameGroup = (id, name) => updateGroup(id, { name });
  const toggleGroup = (id) => updateGroup(id, { enabled: !groups.find((group) => group.id === id)?.enabled });
  const updateRule = (key, patch) =>
    setGroups((items) => items.map((group) => ({ ...group, rules: group.rules.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)) })));
  const addGroup = () => {
    const group = createGroup(`${t.groups} ${groups.length + 1}`, []);
    setGroups((items) => [...items, group]);
    setActiveGroupId(group.id);
    openPage(VIEW.RULES);
  };
  const addRuleToGroup = (groupId) => {
    const group = groups.find((item) => item.id === groupId);
    const rule = createRule({ label: `${t.rules} ${(group?.rules.length || 0) + 1}` });
    setGroups((items) => items.map((item) => (item.id === groupId ? { ...item, rules: [...item.rules, rule] } : item)));
    setActiveGroupId(groupId);
    setDetailRuleKey(rule.key);
    openPage(VIEW.RULES);
  };
  // 在组内复制一条规则：整条深拷贝、生成新 key，名称加「复制」后缀
  const duplicateRule = (groupId, key) => {
    const group = groups.find((item) => item.id === groupId);
    const source = group?.rules.find((rule) => rule.key === key);
    if (!group || !source) return;
    // 必须剥掉旧 key，否则会覆盖 createRule 里新生成的 uid，副本与原规则共享 key
    const { key: sourceKey, ...rest } = source;
    const rule = createRule({ ...rest, label: `${source.label || ''} ${t.copy}`.trim() });
    setGroups((items) => items.map((item) => (item.id === groupId ? { ...item, rules: [...item.rules, rule] } : item)));
    setActiveGroupId(groupId);
  };
  const removeGroup = async (id) => {
    if (!(await confirm(confirmOptions(t.confirmDelete)))) return;
    setGroups((items) => {
      const next = items.filter((group) => group.id !== id);
      if (!next.length) {
        setActiveGroupId(undefined);
        return next;
      }
      if (id === activeGroupId || !next.some((group) => group.id === activeGroupId)) setActiveGroupId(next[0].id);
      return next;
    });
    setDetailRuleKey(null);
  };
  const setGroupsEnabled = (ids, enabled) => setGroups((items) => items.map((group) => (ids.includes(group.id) ? { ...group, enabled } : group)));
  const removeGroups = async (ids) => {
    if (!ids.length || !(await confirm(confirmOptions(t.confirmBatchDelete)))) return;
    setGroups((items) => {
      const next = items.filter((group) => !ids.includes(group.id));
      if (!next.length) {
        setActiveGroupId(undefined);
        return next;
      }
      if (ids.includes(activeGroupId) || !next.some((group) => group.id === activeGroupId)) setActiveGroupId(next[0].id);
      return next;
    });
    setDetailRuleKey(null);
  };
  const removeRule = async (groupId, key) => {
    if (!(await confirm(confirmOptions(t.confirmDeleteRule)))) return;
    setGroups((items) => items.map((group) => (group.id === groupId ? { ...group, rules: group.rules.filter((rule) => rule.key !== key) } : group)));
    setDetailRuleKey(null);
  };
  // 导入（文件/快速导入）统一走这里：与现有规则组按 name 合并，同名覆盖、其余追加
  const applyImportedGroups = (imported: RuleGroup[]) => {
    const merged = mergeGroupsByName(groups, imported);
    setGroups(merged);
    const target = merged.find((group) => group.name === imported[0]?.name);
    setActiveGroupId(target?.id || merged[0]?.id);
    setDetailRuleKey(null);
  };
  const importGroupsText = (text) => {
    try {
      const parsed = JSON.parse(text);
      applyImportedGroups(parseImport(parsed));
      changeNotice(t.importSuccess);
      return { ok: true };
    } catch {
      changeNotice(t.invalidFile);
      return { ok: false };
    }
  };
  const clearGroups = async () => {
    if (!(await confirm(confirmOptions(t.usageClearConfirm)))) return;
    const fresh = createGroup();
    setGroups([fresh]);
    setActiveGroupId(fresh.id);
    setDetailRuleKey(null);
  };
  const sidebarProps = useMemo(
    () => ({
      collapsed: sidebarCollapsed,
      onExpand: () => setSidebarCollapsed(false),
      t
    }),
    [sidebarCollapsed, t]
  );
  const exportGroups = () => downloadJson('api-override.json', exportData(groups));
  const downloadTemplate = () => downloadJson('api-override-template.json', templateData());

  const localProxy = localProxyAvailable
    ? {
        enabled: proxyEnabled,
        mode: proxyMode,
        controlUrl: proxyControlUrl,
        mappings: proxyMappings,
        status: proxyStatus,
        pendingSync: hasPendingChanges,
        onEnabledChange: setProxyEnabled,
        onModeChange: setProxyMode,
        onControlUrlChange: setProxyControlUrl,
        onMappingsChange: setProxyMappings,
        onSync: () => syncProxyService(),
        onClear: async () => {
          try {
            const response = await fetch(`${proxyUrl()}/hosts/clear`, { method: 'POST' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || t.serviceUnavailable);
            changeNotice(t.mappingSaved);
            setProxyStatus('online');
          } catch (error) {
            setProxyStatus('offline');
            changeNotice(error.message || t.serviceUnavailable);
          }
        },
        onRefresh: refreshProxyService
      }
    : null;
  return {
    groups,
    activeGroup,
    activeGroupId,
    detailRule,
    detailRuleKey,
    setDetailRuleKey,
    globalOn,
    setGlobalOn,
    language,
    setLanguage,
    theme,
    setTheme,
    customFunction,
    setCustomFunction,
    sidebarCollapsed,
    setSidebarCollapsed,
    intercepted,
    notice,
    view,
    t,
    localProxy,
    openPage,
    openOptionsWithSidebar,
    openSettings,
    addGroup,
    selectGroup,
    renameGroup,
    toggleGroup,
    addRuleToGroup,
    duplicateRule,
    updateRule,
    removeGroup,
    removeRule,
    setGroupsEnabled,
    removeGroups,
    importGroupsText,
    clearGroups,
    exportGroups,
    downloadTemplate,
    sidebarProps
  };
}
