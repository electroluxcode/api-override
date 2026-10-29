import { FILTER_TYPE, HTTP_METHODS, OVERRIDE_MODE, RESPONSE_TYPE } from '@api-override/core/constants';
import { responseLabel } from '@api-override/core/model';
import { ArrowLeftIcon, BanIcon, CheckIcon, CopyIcon, ListChecks as ListChecksIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import JsonEditor from '../components/JsonEditor';
import { saveSetting } from '../shared/platform';

// 字段外壳：小号 Label + 控件
function Field({ label, children, className = '' }) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// 规则组列表宽度可拖拽调节并持久化；低于阈值进入收起（图标）态
const GROUP_LIST_MIN_WIDTH = 48;
const GROUP_LIST_MAX_WIDTH = 480;
const GROUP_LIST_DEFAULT_WIDTH = 320;
const GROUP_LIST_COLLAPSED_THRESHOLD = 96;

const readStoredGroupListWidth = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('api_override_settings') || '{}').ui_group_list_width;
    const width = Number(stored);
    if (Number.isFinite(width)) return Math.min(GROUP_LIST_MAX_WIDTH, Math.max(GROUP_LIST_MIN_WIDTH, width));
  } catch {}
  return GROUP_LIST_DEFAULT_WIDTH;
};

export function GroupListPane({ groups, activeGroupId, t, onSelect, onAdd, onRename, onToggle, onDelete, onBatchEnable, onBatchDelete }) {
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState([]);
  const [renaming, setRenaming] = useState(null);
  const [width, setWidth] = useState(readStoredGroupListWidth);
  const widthRef = useRef(width);
  widthRef.current = width;
  const collapsed = width < GROUP_LIST_COLLAPSED_THRESHOLD;
  const toggleSelected = (id) => setSelected((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
  const exitBatch = () => {
    setBatch(false);
    setSelected([]);
  };
  const allSelected = selected.length > 0 && selected.length === groups.length;
  const commitRename = () => {
    const name = renaming?.name.trim();
    if (name) onRename(renaming.id, name);
    setRenaming(null);
  };
  const persistWidth = (value) => saveSetting('ui_group_list_width', value);
  // 拖拽调宽：按住右缘手柄横向拖动，松开时持久化；双击恢复默认宽度
  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const onMove = (moveEvent) => {
      setWidth(Math.min(GROUP_LIST_MAX_WIDTH, Math.max(GROUP_LIST_MIN_WIDTH, startWidth + (moveEvent.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistWidth(widthRef.current);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const resetWidth = () => {
    setWidth(GROUP_LIST_DEFAULT_WIDTH);
    persistWidth(GROUP_LIST_DEFAULT_WIDTH);
  };
  return (
    <aside className="relative flex min-h-0 shrink-0 flex-col border-r" style={{ width }}>
      <div className={cn('flex items-center gap-2 border-b py-2.5', collapsed ? 'justify-center px-1' : 'justify-between px-3')}>
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={batch ? 'bg-accent text-accent-foreground' : ''}
            onClick={() => (batch ? exitBatch() : setBatch(true))}
            title={batch ? t.cancel : t.batch}
            aria-label={batch ? t.cancel : t.batch}
          >
            <ListChecksIcon />
          </Button>
          {!collapsed && <strong className="text-sm">{t.groups}</strong>}
        </div>
        {!collapsed && <Badge variant="secondary">{groups.length}</Badge>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
        {groups.map((group) => (
          <ContextMenu key={group.id}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-9 w-full shrink-0 items-center gap-2 rounded-md text-sm transition-colors hover:bg-accent',
                  collapsed ? 'justify-center px-0' : 'px-2 text-left',
                  group.id === activeGroupId && !batch && 'bg-accent text-accent-foreground',
                  collapsed && batch && selected.includes(group.id) && 'ring-1 ring-primary',
                  group.enabled ? '' : 'opacity-60'
                )}
                onClick={() => (batch ? toggleSelected(group.id) : onSelect(group.id))}
                title={group.name}
              >
                {batch && !collapsed && (
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded border',
                      selected.includes(group.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    )}
                  >
                    {selected.includes(group.id) && <CheckIcon className="size-3" />}
                  </span>
                )}
                <span className={cn('size-2 shrink-0 rounded-full', group.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                {!collapsed && <span className="min-w-0 flex-1 truncate font-medium">{group.name || 'group'}</span>}
                {!collapsed && <span className="text-xs text-muted-foreground">{group.rules.length}</span>}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => setRenaming({ id: group.id, name: group.name || '' })}>{t.rename}</ContextMenuItem>
              <ContextMenuItem onSelect={() => onToggle(group.id)}>{group.enabled ? t.disable : t.enable}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => onDelete(group.id)}>
                {t.delete}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      {batch && (
        <div className={cn('flex items-center border-t', collapsed ? 'flex-col gap-1 p-1' : 'gap-2 p-2')}>
          {collapsed ? (
            <>
              <Badge variant="secondary">{selected.length}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelected(allSelected ? [] : groups.map((group) => group.id))}
                title={allSelected ? t.cancel : t.selectAll}
                aria-label={allSelected ? t.cancel : t.selectAll}
              >
                <ListChecksIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!selected.length}
                onClick={() => onBatchEnable(selected, true)}
                title={t.enable}
                aria-label={t.enable}
              >
                <CheckIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!selected.length}
                onClick={() => onBatchEnable(selected, false)}
                title={t.disable}
                aria-label={t.disable}
              >
                <BanIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                disabled={!selected.length}
                onClick={() => {
                  onBatchDelete(selected);
                  setSelected([]);
                }}
                title={t.delete}
                aria-label={t.delete}
              >
                <Trash2Icon />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelected(allSelected ? [] : groups.map((group) => group.id))}
              >
                {allSelected ? t.cancel : t.selectAll}
              </Button>
              <Badge variant="secondary">{selected.length}</Badge>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!selected.length}
                  onClick={() => onBatchEnable(selected, true)}
                >
                  {t.enable}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!selected.length}
                  onClick={() => onBatchEnable(selected, false)}
                >
                  {t.disable}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={!selected.length}
                  onClick={() => {
                    onBatchDelete(selected);
                    setSelected([]);
                  }}
                >
                  {t.delete}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <div className={cn('flex items-center border-t', collapsed ? 'justify-center py-2' : 'justify-between px-3 py-2')}>
        {!collapsed && <span className="text-xs text-muted-foreground">{t.customGroups}</span>}
        <Button type="button" variant="ghost" size="icon-sm" onClick={onAdd} title={t.addGroup} aria-label={t.addGroup}>
          <PlusIcon />
        </Button>
      </div>
      {/* 拖拽调宽手柄 */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-primary/40"
        onMouseDown={startResize}
        onDoubleClick={resetWidth}
      />
      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.groupName}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.name || ''}
            onChange={(event) => setRenaming((state) => ({ ...state, name: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') setRenaming(null);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              {t.cancel}
            </Button>
            <Button type="button" onClick={commitRename}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export function RulesPage({
  groups,
  group,
  activeGroupId,
  detailRule,
  t,
  theme,
  intercepted,
  addRule,
  updateRule,
  removeRule,
  duplicateRule,
  setDetailRuleKey,
  onSelectGroup,
  onAddGroup,
  onRenameGroup,
  onToggleGroup,
  onDeleteGroup,
  onBatchEnable,
  onBatchDelete
}) {
  if (!group)
    return (
      <main className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t.noRules}</p>
          <Button type="button" onClick={onAddGroup}>
            <PlusIcon />
            {t.addGroup}
          </Button>
        </div>
      </main>
    );
  return (
    <main className="flex h-full min-h-0">
      <GroupListPane
        groups={groups}
        activeGroupId={activeGroupId}
        t={t}
        onSelect={onSelectGroup}
        onAdd={onAddGroup}
        onRename={onRenameGroup}
        onToggle={onToggleGroup}
        onDelete={onDeleteGroup}
        onBatchEnable={onBatchEnable}
        onBatchDelete={onBatchDelete}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {detailRule ? (
          <RuleEditor
            rule={detailRule}
            t={t}
            theme={theme}
            intercepted={intercepted[detailRule.match]}
            onChange={(patch) => updateRule(detailRule.key, patch)}
            onDelete={() => removeRule(group.id, detailRule.key)}
            onBack={() => setDetailRuleKey(null)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{group.name}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {t.groupDescription} · {group.rules.length} {t.rules.toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{group.enabled ? t.enabled : t.disabled}</span>
                  <Switch checked={group.enabled} onCheckedChange={() => onToggleGroup(group.id)} aria-label={t.groupOn} />
                </label>
                <Button type="button" size="sm" onClick={addRule}>
                  <PlusIcon />
                  {t.addRule}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <RuleTable
                rules={group.rules}
                t={t}
                onOpen={setDetailRuleKey}
                onToggle={(key) => {
                  const rule = group.rules.find((item) => item.key === key);
                  updateRule(key, { switchOn: rule?.switchOn === false });
                }}
                onDelete={(key) => removeRule(group.id, key)}
                onRename={(key, label) => updateRule(key, { label })}
                onDuplicate={(key) => duplicateRule(group.id, key)}
                emptyAction={addRule}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export function PreferencesPage({ t, theme, setTheme }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.settings}</div>
        <h2 className="mt-1 text-xl font-semibold">{t.settings}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.settingsDescription}</p>
      </div>
      <section className="overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">{t.settings}</div>
          <div className="text-xs text-muted-foreground">{t.settingsDescription}</div>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">{t.theme}</span>
            <small className="text-xs text-muted-foreground">{t.themeDescription}</small>
          </div>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t.themeLight}</SelectItem>
              <SelectItem value="dark">{t.themeDark}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </main>
  );
}

function UsageDoc({ doc, copyLabel, onCopy }: { doc: string; copyLabel?: string; onCopy?: (text: string) => void }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let code: string[] | null = null;
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">
          {list.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const flushCode = () => {
    if (!code) return;
    const text = code.join('\n');
    blocks.push(
      <div key={blocks.length} className="relative overflow-hidden rounded-lg border bg-muted/40">
        {copyLabel && onCopy && (
          <Button type="button" variant="ghost" size="sm" className="absolute top-1.5 right-1.5 h-7 gap-1 px-2 text-xs" onClick={() => onCopy(text)}>
            <CopyIcon />
            {copyLabel}
          </Button>
        )}
        <pre className="overflow-x-auto p-3 pr-16 font-mono text-xs">
          <code>{text}</code>
        </pre>
      </div>
    );
    code = null;
  };
  for (const line of doc.split('\n')) {
    if (line.startsWith('```')) {
      if (code) flushCode();
      else {
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="mt-2 text-sm font-semibold">
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith('- ')) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.trim()) blocks.push(<p key={blocks.length}>{line}</p>);
  }
  flushCode();
  flushList();
  return <div className="grid gap-3 text-sm leading-relaxed">{blocks}</div>;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function UsagePage({ t, onImportJson, onClearAll, onExport, onTemplate }) {
  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return undefined;
    const timer = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);
  const copyWithNotice = async (text) => setStatus((await copyText(text)) ? t.usageCopied : t.usageCopyFailed);
  const handleImport = () => {
    if (!importText.trim() || !onImportJson) return;
    if (onImportJson(importText)?.ok) {
      setImportText('');
      setImportOpen(false);
      setStatus(t.importSuccess);
    }
  };
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-6">
        <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.usage}</div>
        <h2 className="mt-1 text-xl font-semibold">{t.usage}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.usageDescription}</p>
      </div>
      <section className="rounded-xl border p-4">
        <div className="mb-4">
          <div className="text-sm font-medium">{t.usageDocTitle}</div>
          <div className="text-xs text-muted-foreground">{t.usageDocHint}</div>
        </div>
        <div className="mb-4 rounded-lg bg-muted/40 p-3">
          <div className="text-sm font-medium">{t.usageQuickTitle}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.usageQuickDescription}</p>
          <div className="mt-2.5 flex gap-2">
            <Button type="button" size="sm" onClick={() => copyWithNotice(t.usageDoc)}>
              {t.usageCopyDoc}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onClearAll}>
              {t.usageClearAll}
            </Button>
          </div>
        </div>
        <div className="mb-4 rounded-lg bg-muted/40 p-3">
          <div className="text-sm font-medium">{t.dataManagement}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.usageDataHint}</p>
          <div className="mt-2.5 flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onExport}>
              {t.export}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              {t.import}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onTemplate}>
              {t.template}
            </Button>
          </div>
        </div>
        {status && <p className="mb-3 text-xs text-muted-foreground">{status}</p>}
        <UsageDoc doc={t.usageDoc} copyLabel={t.copy} onCopy={copyWithNotice} />
      </section>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.usageImportTitle}</DialogTitle>
            <DialogDescription>{t.usageImportHint}</DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-40 max-h-64 font-mono text-xs"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t.usageImportPlaceholder}
            spellCheck="false"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportText('');
                setImportOpen(false);
              }}
            >
              {t.cancel}
            </Button>
            <Button type="button" onClick={handleImport}>
              {t.import}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export function RuleTable({ rules, t, onOpen, onToggle, onDelete, onRename, onDuplicate, emptyAction }) {
  const [renaming, setRenaming] = useState(null);
  const commitRename = () => {
    const label = renaming?.label.trim();
    if (label) onRename(renaming.key, label);
    setRenaming(null);
  };
  if (!rules.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">{t.emptyGroup}</p>
        <Button type="button" size="sm" onClick={emptyAction}>
          <PlusIcon />
          {t.addRule}
        </Button>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-14">{t.active}</TableHead>
            <TableHead>{t.ruleName}</TableHead>
            <TableHead>{t.match}</TableHead>
            <TableHead>{t.method}</TableHead>
            <TableHead>{t.responseType}</TableHead>
            <TableHead>{t.headers}</TableHead>
            <TableHead className="text-right">{t.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <ContextMenu key={rule.key}>
              <ContextMenuTrigger asChild>
                <TableRow className={cn('cursor-pointer', rule.switchOn === false && 'opacity-60')} onClick={() => onOpen(rule.key)}>
                  <TableCell>
                    <span className={cn('block size-2 rounded-full', rule.switchOn !== false ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-medium" title={rule.label}>
                    {rule.label}
                  </TableCell>
                  <TableCell className="max-w-56 truncate font-mono text-xs text-muted-foreground" title={rule.match || '—'}>
                    {rule.match || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.limitMethod || 'ALL'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="whitespace-nowrap">{responseLabel(rule, t)}</span>
                      {rule.overrideMode === OVERRIDE_MODE.INCREMENTAL && <Badge variant="secondary">{t.incremental}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{Object.keys(rule.responseHeaders || {}).length}</TableCell>
                  {/* 操作按钮有自己的语义，阻止冒泡避免误触发行点击进入详情 */}
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpen(rule.key)}>
                        {t.detail}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onToggle(rule.key)}>
                        {rule.switchOn === false ? t.enable : t.disable}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onDuplicate(rule.key)}>
                        {t.copy}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => onDelete(rule.key)}
                      >
                        {t.delete}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setRenaming({ key: rule.key, label: rule.label || '' })}>{t.rename}</ContextMenuItem>
                <ContextMenuItem onSelect={() => onDuplicate(rule.key)}>{t.copy}</ContextMenuItem>
                <ContextMenuItem onSelect={() => onToggle(rule.key)}>{rule.switchOn === false ? t.enable : t.disable}</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onSelect={() => onDelete(rule.key)}>
                  {t.delete}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </TableBody>
      </Table>
      <Dialog open={Boolean(renaming)} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.rename}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.label || ''}
            onChange={(event) => setRenaming((state) => ({ ...state, label: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') setRenaming(null);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              {t.cancel}
            </Button>
            <Button type="button" onClick={commitRename}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RuleEditor({ rule, t, theme = 'light', intercepted = [], onChange, onDelete, onBack }) {
  const [headersValue, setHeadersValue] = useState(JSON.stringify(rule.responseHeaders || {}, null, 2));
  useEffect(() => setHeadersValue(JSON.stringify(rule.responseHeaders || {}, null, 2)), [rule.key, rule.responseHeaders]);
  const saveHeaders = () => {
    try {
      const headers = JSON.parse(headersValue);
      if (!headers || Array.isArray(headers) || typeof headers !== 'object') return;
      onChange({ responseHeaders: headers });
      setHeadersValue(JSON.stringify(headers, null, 2));
    } catch {}
  };
  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onChange({
        responseType: RESPONSE_TYPE.FILE,
        overrideMode: OVERRIDE_MODE.FULL,
        responseFileName: file.name,
        responseFileType: file.type || 'application/octet-stream',
        responseFileData: reader.result
      });
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeftIcon />
            {t.back}
          </Button>
          <h2 className="truncate text-base font-semibold" title={rule.label}>
            {rule.label}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ switchOn: rule.switchOn === false })}>
            {rule.switchOn === false ? t.enable : t.disable}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            <Trash2Icon />
            {t.delete}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4 lg:grid-cols-2">
        <Field label={t.ruleName}>
          <Input value={rule.label} onChange={(event) => onChange({ label: event.target.value })} />
        </Field>
        <Field label={t.match}>
          <Input value={rule.match} onChange={(event) => onChange({ match: event.target.value })} />
        </Field>
        <Field label={t.filter}>
          <Select value={rule.filterType || FILTER_TYPE.NORMAL} onValueChange={(value) => onChange({ filterType: value })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_TYPE.NORMAL}>{t.normal}</SelectItem>
              <SelectItem value={FILTER_TYPE.REGEX}>{t.regex}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.method}>
          <Select value={rule.limitMethod || 'ALL'} onValueChange={(value) => onChange({ limitMethod: value })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method === 'ALL' ? t.all : method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.responseType}>
          <Select
            value={rule.responseType || RESPONSE_TYPE.JSON}
            onValueChange={(value) => onChange({ responseType: value, ...(value === RESPONSE_TYPE.FILE ? { overrideMode: OVERRIDE_MODE.FULL } : {}) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RESPONSE_TYPE.JSON}>{t.json}</SelectItem>
              <SelectItem value={RESPONSE_TYPE.TEXT}>{t.text}</SelectItem>
              <SelectItem value={RESPONSE_TYPE.FILE}>{t.file}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.incremental}>
          <Select value={rule.overrideMode || OVERRIDE_MODE.FULL} onValueChange={(value) => onChange({ overrideMode: value })} disabled={rule.responseType === RESPONSE_TYPE.FILE}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OVERRIDE_MODE.FULL}>{t.full}</SelectItem>
              <SelectItem value={OVERRIDE_MODE.INCREMENTAL}>{t.incremental}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {rule.overrideMode === OVERRIDE_MODE.INCREMENTAL && <p className="col-span-full text-xs text-muted-foreground">{t.incrementalHint}</p>}
        {rule.responseType === RESPONSE_TYPE.FILE ? (
          <div className="col-span-full grid content-start gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.file}</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  {t.chooseFile}
                  <input type="file" className="hidden" onChange={chooseFile} />
                </label>
              </Button>
              <span className="text-sm">{rule.responseFileName || t.noFile}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.fileHint}</p>
          </div>
        ) : rule.responseType === RESPONSE_TYPE.JSON ? (
          <div className="col-span-full grid content-start gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.response}</Label>
            <JsonEditor
              value={rule.overrideTxt || ''}
              onChange={(next) => onChange({ overrideTxt: next })}
              mode="body"
              theme={theme}
              height={280}
              placeholder={'{\n  "code": 0,\n  "msg": "ok"\n}'}
              t={t}
            />
          </div>
        ) : (
          <div className="col-span-full grid content-start gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.response}</Label>
            <Textarea
              className="min-h-40 font-mono text-xs"
              value={rule.overrideTxt || ''}
              onChange={(event) => onChange({ overrideTxt: event.target.value })}
              spellCheck="false"
            />
          </div>
        )}
        <div className="col-span-full grid content-start gap-1.5" onBlur={saveHeaders}>
          <Label className="text-xs text-muted-foreground">{t.headers}</Label>
          <JsonEditor
            value={headersValue}
            onChange={setHeadersValue}
            mode="headers"
            theme={theme}
            height={160}
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
            t={t}
          />
          <small className="text-xs text-muted-foreground">{t.headersHint}</small>
        </div>
        {intercepted.length > 0 && (
          <div className="col-span-full rounded-lg border p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t.intercepted}</div>
            <div className="grid gap-1">
              {intercepted.map((item) => (
                <div key={item.url} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
                  <Badge variant="secondary">{item.num}</Badge>
                  <span className="min-w-0 flex-1 truncate" title={item.url}>
                    {item.url}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// lucide 没有与原 ListChecksIcon 完全一致的语义图标，这里保留一个本地实现
