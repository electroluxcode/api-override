import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BanIcon, CheckIcon, ListChecks as ListChecksIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { saveSetting } from '@/shared/platform';
import { GROUP_DRAG_START_MOVE_PX, GROUP_LIST_COLLAPSED_THRESHOLD, GROUP_LIST_DEFAULT_WIDTH, GROUP_LIST_ITEM_GAP, GROUP_LIST_MAX_WIDTH, GROUP_LIST_MIN_WIDTH, readStoredGroupListWidth } from './constants';

export function GroupListPane({ groups, activeGroupId, t, onSelect, onAdd, onRename, onToggle, onDelete, onBatchEnable, onBatchDelete, onReorderGroups }) {
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState([]);
  const [renaming, setRenaming] = useState(null);
  const [width, setWidth] = useState(readStoredGroupListWidth);
  // 拖拽排序状态：drag = { id, dy, targetIndex }
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const itemRefs = useRef({});
  const suppressClickRef = useRef(false);
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
  // 落点检测：基于进入拖拽时快照的基准位置（未应用 transform），取与指针纵向距离最近的项下标；
  // 不能用 getBoundingClientRect 实时值——拖拽项自身带 translateY，中心恒离指针最近，会导致永远命中自己
  const hitTestGroup = (clientY) => {
    const baseRects = dragRef.current?.baseRects;
    if (!baseRects) return -1;
    let best = -1;
    let bestDistance = Infinity;
    baseRects.forEach((rect, index) => {
      if (!rect) return;
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };
  // 规则组拖拽排序：按下后移动超过阈值立即进入拖拽（无需长按），移动高亮落点，松手提交 onReorderGroups；
  // 仅响应鼠标/触控笔（触摸留给列表滚动与右键菜单），批量模式下禁用
  const startGroupDrag = (event, id) => {
    if (batch || (event.pointerType !== 'mouse' && event.pointerType !== 'pen') || event.button !== 0) return;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    let active = false;
    const activate = () => {
      active = true;
      dragRef.current = {
        id,
        targetIndex: groups.findIndex((group) => group.id === id),
        // 此刻尚未应用任何 transform，快照各项目的基准位置供落点检测使用
        baseRects: groups.map((group) => {
          const rect = itemRefs.current[group.id]?.getBoundingClientRect();
          return rect ? { top: rect.top, height: rect.height } : null;
        })
      };
      setDrag({ id, dy: 0, targetIndex: dragRef.current.targetIndex });
      document.body.style.userSelect = 'none';
    };
    const finish = (commit) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (active) {
        document.body.style.userSelect = '';
        if (commit) {
          const from = groups.findIndex((group) => group.id === id);
          const to = dragRef.current?.targetIndex ?? from;
          if (from >= 0 && to >= 0 && from !== to) onReorderGroups?.(from, to);
          suppressClickRef.current = true; // 拖拽结束的松手不再触发行点击
        }
      }
      dragRef.current = null;
      setDrag(null);
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!active) {
        // 移动超过阈值立即进入拖拽；更小的位移视为普通点击
        if (Math.abs(moveEvent.clientY - startY) <= GROUP_DRAG_START_MOVE_PX) return;
        activate();
      }
      moveEvent.preventDefault();
      const targetIndex = hitTestGroup(moveEvent.clientY);
      dragRef.current.targetIndex = targetIndex;
      setDrag({ id, dy: moveEvent.clientY - startY, targetIndex });
    };
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      finish(true);
    };
    const onCancel = () => finish(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
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
        {groups.map((group, index) => {
          const dragging = drag?.id === group.id;
          const fromIndex = drag ? groups.findIndex((item) => item.id === drag.id) : -1;
          const dragStep = (itemRefs.current[drag?.id]?.offsetHeight || 36) + GROUP_LIST_ITEM_GAP;
          // 拖拽项跟随指针，其余项按落点让位；transition 让让位动画平滑
          const itemStyle = (itemIndex) => {
            if (!drag) return undefined;
            const target = drag.targetIndex;
            if (itemIndex === fromIndex) return { transform: `translateY(${drag.dy}px)`, transition: 'none', zIndex: 20 };
            if (fromIndex < target && itemIndex > fromIndex && itemIndex <= target) return { transform: `translateY(-${dragStep}px)`, transition: 'transform 150ms ease' };
            if (target < fromIndex && itemIndex >= target && itemIndex < fromIndex) return { transform: `translateY(${dragStep}px)`, transition: 'transform 150ms ease' };
            return { transition: 'transform 150ms ease' };
          };
          return (
          <ContextMenu key={group.id}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                ref={(element) => (itemRefs.current[group.id] = element)}
                style={itemStyle(index)}
                className={cn(
                  'flex h-9 w-full shrink-0 items-center gap-2 rounded-md text-sm transition-colors hover:bg-accent',
                  collapsed ? 'justify-center px-0' : 'px-2 text-left',
                  group.id === activeGroupId && !batch && 'bg-accent text-accent-foreground',
                  collapsed && batch && selected.includes(group.id) && 'ring-1 ring-primary',
                  group.enabled ? '' : 'opacity-60',
                  dragging && 'relative cursor-grabbing bg-accent opacity-90 ring-1 ring-primary'
                )}
                onPointerDown={(event) => startGroupDrag(event, group.id)}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (batch) toggleSelected(group.id);
                  else onSelect(group.id);
                }}
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
              <ContextMenuItem onSelect={() => onReorderGroups?.(groups.findIndex((item) => item.id === group.id), 0)}>{t.moveToTop}</ContextMenuItem>
              <ContextMenuItem onSelect={() => onReorderGroups?.(groups.findIndex((item) => item.id === group.id), groups.length - 1)}>{t.moveToBottom}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => onDelete(group.id)}>
                {t.delete}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          );
        })}
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
