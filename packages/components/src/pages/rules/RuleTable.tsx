import { responseLabel } from '@api-override/core/model';
import { OVERRIDE_MODE } from '@api-override/core/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { METHOD_TRIGGER_COLORS, METHOD_TRIGGER_FALLBACK, RULE_TABLE_COL_DEFAULTS, RULE_TABLE_COL_MIN_WIDTH, readStoredRuleTableColWidths } from './constants';
import { cn } from '@/lib/utils';
import { saveSetting } from '@/shared/platform';
import { CopyIcon, PlusIcon, PowerIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';

// 列键与表头顺序一一对应；actions 列同样可拖宽，w-full 下剩余空间仍会按比例分摊
const COL_KEYS = ['active', 'label', 'match', 'method', 'responseType', 'headers', 'actions'];

export function RuleTable({ rules, t, onOpen, onToggle, onDelete, onRename, onDuplicate, emptyAction }) {
  const [renaming, setRenaming] = useState(null);
  // 列宽可拖拽调节并持久化：表头右缘手柄拖动，双击恢复该列默认宽度
  const [colWidths, setColWidths] = useState(readStoredRuleTableColWidths);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const persistColWidths = (widths) => saveSetting('ui_rule_table_col_widths', widths);
  const startColResize = (colKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = colWidthsRef.current[colKey] ?? RULE_TABLE_COL_DEFAULTS[colKey];
    const onMove = (moveEvent) => {
      const width = Math.max(RULE_TABLE_COL_MIN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setColWidths((widths) => {
        const next = { ...widths, [colKey]: width };
        colWidthsRef.current = next;
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistColWidths(colWidthsRef.current);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const resetColWidth = (colKey) => {
    setColWidths((widths) => {
      const next = { ...widths };
      delete next[colKey];
      colWidthsRef.current = next;
      persistColWidths(next);
      return next;
    });
  };
  const colLabel = (colKey) => ({ active: t.active, label: t.ruleName, match: t.match, method: t.method, responseType: t.responseType, headers: t.headers, actions: t.actions })[colKey];
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
      {/* table-layout fixed + colgroup：列宽由拖拽手柄控制，w-full 下未满的宽度按比例分摊，超出则横向滚动 */}
      <Table style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {COL_KEYS.map((colKey) => (
            <col key={colKey} style={{ width: colWidths[colKey] ?? RULE_TABLE_COL_DEFAULTS[colKey] }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {COL_KEYS.map((colKey) => (
              <TableHead key={colKey} className={cn('relative select-none', colKey === 'actions' && 'text-right')}>
                {colLabel(colKey)}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-primary/40"
                  onMouseDown={(event) => startColResize(colKey, event)}
                  onDoubleClick={() => resetColWidth(colKey)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <ContextMenu key={rule.key}>
              <ContextMenuTrigger asChild>
                <TableRow className={cn('cursor-pointer', rule.switchOn === false && 'opacity-60')} onClick={() => onOpen(rule.key)}>
                  <TableCell>
                    <span className={cn('block size-2 rounded-full', rule.switchOn !== false ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-muted-foreground/40')} />
                  </TableCell>
                  <TableCell className="truncate font-medium" title={rule.label}>
                    {rule.label}
                  </TableCell>
                  <TableCell className="truncate font-mono text-xs text-muted-foreground" title={rule.match || '—'}>
                    {rule.match || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('border-transparent', METHOD_TRIGGER_COLORS[rule.limitMethod || 'ALL'] || METHOD_TRIGGER_FALLBACK)}>
                      {rule.limitMethod || 'ALL'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="whitespace-nowrap">{responseLabel(rule)}</span>
                      {rule.overrideMode === OVERRIDE_MODE.INCREMENTAL && <Badge variant="secondary">{t.incremental}</Badge>}
                    </div>
                  </TableCell>
                  {/* 响应头为空时展示 -，而不是 0 */}
                  <TableCell>{Object.keys(rule.responseHeaders || {}).length || '-'}</TableCell>
                  {/* 操作按钮有自己的语义，阻止冒泡避免误触发行点击进入详情 */}
                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" title={t.detail} aria-label={t.detail} onClick={() => onOpen(rule.key)}>
                        <SquarePenIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground"
                        title={rule.switchOn === false ? t.enable : t.disable}
                        aria-label={rule.switchOn === false ? t.enable : t.disable}
                        onClick={() => onToggle(rule.key)}
                      >
                        <PowerIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" title={t.copy} aria-label={t.copy} onClick={() => onDuplicate(rule.key)}>
                        <CopyIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-destructive hover:text-destructive"
                        title={t.delete}
                        aria-label={t.delete}
                        onClick={() => onDelete(rule.key)}
                      >
                        <Trash2Icon />
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
