import { BookOpenIcon, FileTextIcon, PanelLeftIcon, SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VIEW } from '@api-override/core/constants';

// 品牌 logo（与扩展图标 api-override-icon.svg 同款：深色底 + 链接剪影）
function ApiMark({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden" style={{ width: size, height: size }}>
      <svg className="block h-full w-full" viewBox="0 0 128 128" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="apibrand-ink" x1="16" y1="112" x2="112" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#A3E635" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="29" fill="#101014" />
        <g transform="translate(3.5 3.5) scale(0.117)" fill="url(#apibrand-ink)">
          <path d="M917.703111 148.792889l-42.410667-42.382222a8.248889 8.248889 0 0 0-11.377777 0l-76.117334 76.088889a199.281778 199.281778 0 0 0-112.099555-34.304c-51.2 0-102.4 19.512889-141.511111 58.595555l-101.888 101.916445a8.049778 8.049778 0 0 0 0 11.292444l271.701333 271.701333c1.592889 1.592889 3.584 2.275556 5.688889 2.275556 1.991111 0 4.096-0.768 5.688889-2.275556l101.916444-101.916444a200.220444 200.220444 0 0 0 24.291556-253.496889l76.117333-76.088889a8.163556 8.163556 0 0 0 0-11.377778zM578.901333 546.702222a8.021333 8.021333 0 0 0-11.320889 0l-66.56 66.588445-90.339555-90.282667 66.702222-66.702222a8.021333 8.021333 0 0 0 0-11.320889l-36.408889-36.408889a8.049778 8.049778 0 0 0-11.292444 0l-66.702222 66.730667-42.979556-43.008a7.907556 7.907556 0 0 0-5.688889-2.275556 8.448 8.448 0 0 0-5.717333 2.275556L206.791111 534.186667a200.192 200.192 0 0 0-24.291555 253.496889L106.382222 863.800889a8.021333 8.021333 0 0 0 0 11.292444l42.410667 42.382223c1.592889 1.621333 3.612444 2.332444 5.688889 2.332444a8.277333 8.277333 0 0 0 5.688889-2.304l76.117333-76.117333a199.253333 199.253333 0 0 0 112.099556 34.304c51.2 0 102.4-19.484444 141.511111-58.595556l101.888-101.888a8.021333 8.021333 0 0 0 0-11.320889l-42.979556-42.979555 66.673778-66.702223a8.021333 8.021333 0 0 0 0-11.320888l-36.579556-36.181334z" />
        </g>
      </svg>
    </span>
  );
}

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
