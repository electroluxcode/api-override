import type { AppSettings } from '@api-override/core/types';
import { THEME, VIEW } from '@api-override/core/constants';
import { DownloadIcon, EllipsisIcon, LanguagesIcon, MoonIcon, PanelLeftIcon, ScrollTextIcon, SettingsIcon, SunIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import '../styles/index.css';
import Sidebar from '@/components/Sidebar';
import { ApiMark } from '@/components/ApiMark';
import { Button } from '@/components/ui/button';
import { ConfirmProvider } from '@/components/ui/confirm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MatchLogPane } from '@/pages/rules/MatchLogPane';
import { PreferencesPage, QuickImportDialog, RulesPage, UsagePage } from '@/pages/Pages';
import useAppState, { loadInitialSettings } from './useAppState';

export { defaultSettings, normalizeGroups } from '@api-override/core/model';

const pageMeta = (view, t) => {
  if (view === VIEW.SETTINGS || view === VIEW.ADMIN) return { title: t.settings, subtitle: t.settingsDescription };
  if (view === VIEW.USAGE) return { title: t.usage, subtitle: t.usageDescription };
  return { title: t.groupManagement };
};

// 全局开关：顶栏常驻入口之一
function GlobalSwitch({ on, onCheckedChange, t }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground" title={t.on}>
      <span>{t.on}</span>
      <Switch checked={on} onCheckedChange={onCheckedChange} aria-label={t.on} />
    </label>
  );
}

// 顶栏只保留三个入口：全局开关 / 语言切换 / 更多菜单。
// 低频操作（导入、导出、匹配日志、主题、设置）收纳进"更多"菜单，窄宽度下不再互相挤压；
// 挂载在顶栏的菜单让 Side Panel / Popup 等窄形态也能触达全部功能。
function HeaderActions({ state, onOpenLog }) {
  const { t, globalOn, setGlobalOn, language, setLanguage, theme, setTheme } = state;
  const [importOpen, setImportOpen] = React.useState(false);
  return (
    <div className="flex items-center gap-2.5">
      <GlobalSwitch on={globalOn} onCheckedChange={() => setGlobalOn((value) => !value)} t={t} />
      {/* 语言切换：常驻顶栏，菜单里不再重复 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" title={t.language} aria-label={t.language}>
            <LanguagesIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-28">
          <DropdownMenuItem className={language === 'zh-CN' ? 'bg-accent text-accent-foreground' : ''} onSelect={() => setLanguage('zh-CN')}>
            中文
          </DropdownMenuItem>
          <DropdownMenuItem className={language === 'en-US' ? 'bg-accent text-accent-foreground' : ''} onSelect={() => setLanguage('en-US')}>
            English
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" title={t.more} aria-label={t.more}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            <UploadIcon />
            {t.import}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={state.exportGroups}>
            <DownloadIcon />
            {t.export}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenLog}>
            <ScrollTextIcon />
            {t.matchLog}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme((value) => (value === THEME.DARK ? THEME.LIGHT : THEME.DARK))}>
            {theme === THEME.DARK ? <SunIcon /> : <MoonIcon />}
            {theme === THEME.DARK ? t.themeLight : t.themeDark}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={state.openOptionsWithSidebar}>
            <SettingsIcon />
            {t.settings}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* 快速导入弹窗：由"更多"菜单的导入项触发 */}
      <QuickImportDialog
        t={t}
        onImportJson={state.importGroupsText}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => toast(t.importSuccess)}
      />
    </div>
  );
}

// 侧栏折叠按钮（内容区顶栏内，仅宽视口显示；窄视口由抽屉按钮替代）
function SidebarCollapseButton({ collapsed, onToggle, t, className }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={onToggle}
      title={collapsed ? t.expand : t.collapse}
      aria-label={collapsed ? t.expand : t.collapse}
    >
      <PanelLeftIcon />
    </Button>
  );
}

function RulesSlot({ state }) {
  return (
    <RulesPage
      groups={state.groups}
      activeGroupId={state.activeGroup?.id}
      group={state.activeGroup}
      detailRule={state.detailRule}
      t={state.t}
      theme={state.theme}
      autoSave={state.autoSave}
      intercepted={state.intercepted}
      onSelectGroup={state.selectGroup}
      onAddGroup={state.addGroup}
      onRenameGroup={state.renameGroup}
      onReorderGroups={state.reorderGroups}
      onToggleGroup={state.toggleGroup}
      onDeleteGroup={state.removeGroup}
      onBatchEnable={state.setGroupsEnabled}
      onBatchDelete={state.removeGroups}
      addRule={() => state.addRuleToGroup(state.activeGroup?.id)}
      updateRule={state.updateRule}
      removeRule={state.removeRule}
      duplicateRule={state.duplicateRule}
      setDetailRuleKey={state.setDetailRuleKey}
    />
  );
}

export default function App({ initialSettings }: { initialSettings: AppSettings }) {
  return (
    <ConfirmProvider>
      <AppInner initialSettings={initialSettings} />
    </ConfirmProvider>
  );
}

function AppInner({ initialSettings }: { initialSettings: AppSettings }) {
  const state = useAppState(initialSettings);
  const { sidebarCollapsed, view, t, notice } = state;
  const popup = Boolean(globalThis.apiOverridePopup || document.documentElement.classList.contains('popup-panel'));
  // Side Panel（Chrome 侧边面板）：单栏布局，应用侧栏与抽屉按钮均不出现
  const sidePanel = Boolean(
    new URLSearchParams(window.location.search).get('mode') === 'sidepanel' ||
      globalThis.apiOverrideSidePanel ||
      document.documentElement.classList.contains('side-panel')
  );
  const meta = pageMeta(view, t);
  const toggleSidebar = () => state.setSidebarCollapsed((value) => !value);
  // 匹配日志弹窗挂在应用层（不止规则页可开：顶栏"更多"菜单在任意视图都能打开它）
  const [logOpen, setLogOpen] = React.useState(false);
  const openLog = React.useCallback(() => setLogOpen(true), []);
  const matchLogPane = (
    <MatchLogPane open={logOpen} onOpenChange={setLogOpen} entries={state.matchLog} t={state.t} status={state.pageStatus} onClear={state.clearMatchLog} />
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // 常驻侧栏与抽屉共用同一份内容；抽屉关闭动作挂在导航回调上
  const renderSidebar = () => (
    <Sidebar
      {...state.sidebarProps}
      view={view}
      onOpenRules={() => {
        setDrawerOpen(false);
        state.openPage(VIEW.RULES);
      }}
      onOpenSettings={() => {
        setDrawerOpen(false);
        state.openSettings();
      }}
      onOpenUsage={() => {
        setDrawerOpen(false);
        state.openPage(VIEW.USAGE);
      }}
    />
  );

  // notice 状态统一走 sonner Toast
  React.useEffect(() => {
    if (notice) toast(notice);
  }, [notice]);

  const content =
    view === VIEW.SETTINGS || view === VIEW.ADMIN ? (
      <PreferencesPage t={t} theme={state.theme} setTheme={state.setTheme} autoSave={state.autoSave} setAutoSave={state.setAutoSave} />
    ) : view === VIEW.USAGE ? (
      <UsagePage
        t={t}
        onImportJson={state.importGroupsText}
        onClearAll={state.clearGroups}
        onExport={state.exportGroups}
        onTemplate={state.downloadTemplate}
      />
    ) : (
      <RulesSlot state={state} />
    );

  if (popup)
    return (
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{t.groupManagement}</div>
          </div>
          <HeaderActions state={state} onOpenLog={openLog} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        {matchLogPane}
        <Toaster theme={state.theme as 'dark' | 'light'} position="bottom-center" />
      </div>
    );

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      {/* <860px（旧版同款断点）单栏：常驻侧栏移出文档流，改由顶栏抽屉唤起 */}
      <div
        className={cn(
          'mx-auto grid h-full w-full max-w-(--content-max-width) gap-2 px-3 py-3 transition-[grid-template-columns] duration-200',
          sidePanel
            ? 'grid-cols-[minmax(0,1fr)] p-0'
            : cn(
                'max-[860px]:grid-cols-[minmax(0,1fr)] max-[860px]:gap-0 max-[860px]:p-0',
                sidebarCollapsed ? 'grid-cols-[var(--sidebar-collapsed-width)_minmax(0,1fr)]' : 'grid-cols-[var(--sidebar-width)_minmax(0,1fr)]'
              )
        )}
      >
        {!sidePanel && <div className="flex min-h-0 max-[860px]:hidden">{renderSidebar()}</div>}
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {!sidePanel && (
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  {/* 抽屉按钮：仅窄视口出现，此时折叠按钮隐藏，避免双按钮 */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="hidden max-[860px]:inline-flex"
                    onClick={() => setDrawerOpen(true)}
                    title={t.expand}
                    aria-label={t.expand}
                  >
                    <PanelLeftIcon />
                  </Button>
                  <SheetContent side="left" className="w-(--sidebar-width) max-w-[84vw] gap-0 p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>{t.title}</SheetTitle>
                    </SheetHeader>
                    {renderSidebar()}
                  </SheetContent>
                </Sheet>
              )}
              {!sidePanel && (
                <SidebarCollapseButton
                  collapsed={sidebarCollapsed}
                  onToggle={toggleSidebar}
                  t={t}
                  className="max-[860px]:pointer-events-none max-[860px]:opacity-40"
                />
              )}
              {!sidePanel && <Separator orientation="vertical" className="h-5 max-[860px]:hidden" />}
              {/* Side Panel 没有侧栏，标题前放品牌 logo（同侧栏）标识来源 */}
              <div className="flex min-w-0 items-center gap-2.5">
                {sidePanel && <ApiMark size={20} />}
                <div className="truncate text-base font-semibold">{meta.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <HeaderActions state={state} onOpenLog={openLog} />
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </main>
      </div>
      {matchLogPane}
      <Toaster theme={state.theme as 'dark' | 'light'} position="bottom-center" />
    </div>
  );
}

export { loadInitialSettings };
