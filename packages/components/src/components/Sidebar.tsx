import { BookOpenIcon, FileTextIcon, PanelLeftIcon, SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ApiMark } from '@/components/ApiMark';
import { VIEW } from '@api-override/core/constants';

interface SidebarProps {
  collapsed?: boolean;
  onExpand?: () => void;
  onOpenSettings?: () => void;
  onOpenRules?: () => void;
  onOpenUsage?: () => void;
  view?: string;
  t: Record<string, string>;
}

export default function Sidebar({ collapsed, onExpand, onOpenSettings, onOpenRules, onOpenUsage, view, t }: SidebarProps) {
  const isActive = (page) =>
    (page === VIEW.SETTINGS && (view === VIEW.SETTINGS || view === VIEW.ADMIN)) ||
    (page === VIEW.USAGE && view === VIEW.USAGE) ||
    (page === VIEW.RULES && view !== VIEW.SETTINGS && view !== VIEW.ADMIN && view !== VIEW.USAGE);

  const navItemClass = (active?: boolean) =>
    cn('w-full font-normal', collapsed ? 'justify-center px-0' : 'justify-start gap-2.5 px-2.5', active && 'bg-accent text-accent-foreground');

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card py-2 shadow-sm',
        collapsed ? 'w-(--sidebar-collapsed-width) px-1' : 'w-(--sidebar-width) px-2'
      )}
    >
      <div className={cn('flex h-11 items-center gap-2.5 overflow-hidden whitespace-nowrap', collapsed ? 'justify-center px-0' : 'px-1.5')} title={t.title}>
        <ApiMark size={26} />
        {!collapsed && (
          <div className="grid min-w-0 gap-0.5">
            <strong className="truncate text-[15px] font-semibold tracking-tight">{t.title}</strong>
            <small className="text-xs text-muted-foreground">Response rules</small>
          </div>
        )}
      </div>
      <nav className="mt-3 grid min-w-0 gap-1" aria-label={t.title}>
        {/* 折叠态下分组标题与分隔线一并隐藏，仅保留图标 */}
        {!collapsed && <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{t.groups}</div>}
        <Button type="button" variant="ghost" size="sm" className={navItemClass(isActive('rules'))} onClick={onOpenRules} title={t.groupManagement}>
          <FileTextIcon className="size-4 shrink-0" />
          {!collapsed && <span>{t.groupManagement}</span>}
        </Button>
        {!collapsed && (
          <div className="mt-3 border-t px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{t.manage}</div>
        )}
        <Button type="button" variant="ghost" size="sm" className={navItemClass(isActive('settings'))} onClick={onOpenSettings} title={t.settings}>
          <SettingsIcon className="size-4 shrink-0" />
          {!collapsed && <span>{t.settings}</span>}
        </Button>
        <Button type="button" variant="ghost" size="sm" className={navItemClass(isActive('usage'))} onClick={onOpenUsage} title={t.usage}>
          <BookOpenIcon className="size-4 shrink-0" />
          {!collapsed && <span>{t.usage}</span>}
        </Button>
      </nav>
      <div className="flex-1" />
      {!collapsed && <div className="border-t px-2.5 pt-3 text-[10px] text-muted-foreground">API Override</div>}
      {collapsed && (
        <Button type="button" variant="ghost" size="icon-sm" className="mx-auto" onClick={onExpand} title={t.expand} aria-label={t.expand}>
          <PanelLeftIcon />
        </Button>
      )}
    </aside>
  );
}
