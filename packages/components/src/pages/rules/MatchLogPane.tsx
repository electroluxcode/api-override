import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilterIcon, ScrollTextIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { MatchLogEntry, PageStatus } from '@/app/useAppState';

// 匹配日志弹窗：展示页面脚本上报的每次规则判定（命中哪条 / 未命中），便于排查规则为何不生效。
// 顶部状态行展示"页面脚本此刻看到的配置"（总开关/规则数/来源）——总开关关闭时请求被
// 原生 fetch/XHR 直接绕过、不留任何判定日志，这个状态行让"静默不生效"可见。
// 日志经 SW 落盘（session storage），面板未打开时的判定也能回看。
// 用 modal 承载：日志条目可长可短，弹窗不挤压规则表布局。
export function MatchLogPane({
  open,
  onOpenChange,
  entries,
  t,
  status,
  onClear
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: MatchLogEntry[];
  t: Record<string, string>;
  status?: PageStatus | null;
  onClear: () => void;
}) {
  // 只看命中：排查"该命中的没命中"时过滤掉噪音（页面自身的埋点请求等）
  const [onlyHit, setOnlyHit] = useState(false);
  const shown = onlyHit ? entries.filter((item) => item.matched) : entries;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[70vh] flex-col gap-0 overflow-hidden sm:max-w-2xl" showCloseButton={false}>
        {/* 第一行：标题 + 关闭；第二行：筛选 + 清除日志 */}
        <DialogHeader className="gap-3 space-y-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-1.5 text-sm font-medium">
              <ScrollTextIcon className="size-3.5 text-muted-foreground" />
              {t.matchLog}
              {entries.length > 0 && (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  ({shown.length}
                  {onlyHit && entries.length !== shown.length ? `/${entries.length}` : ''})
                </span>
              )}
            </DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="size-7" aria-label="Close">
                <XIcon />
              </Button>
            </DialogClose>
          </div>
          {entries.length > 0 && (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant={onlyHit ? 'secondary' : 'ghost'}
                size="icon-sm"
                className="size-7"
                onClick={() => setOnlyHit((value) => !value)}
                aria-pressed={onlyHit}
                title={t.matchLogOnlyHit}
                aria-label={t.matchLogOnlyHit}
              >
                <FilterIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7"
                onClick={onClear}
                title={t.matchLogClear}
                aria-label={t.matchLogClear}
              >
                <Trash2Icon />
              </Button>
            </div>
          )}
        </DialogHeader>
        {status && (
          <div className="rounded-md bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            {t.scriptStatus}：{status.switchOn ? t.statusOn : t.statusOff} · {t.rules} {status.ruleCount}（{t.enabled} {status.enabledCount}）
            {status.configSource && <> · {t.configSource}：{status.configSource === 'service' ? t.sourceService : t.sourceStorage}</>}
            <span className="ml-1 font-mono">· {new Date(status.time).toLocaleTimeString()}</span>
          </div>
        )}
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t.matchLogEmpty}</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown.map((item, index) => (
              <div key={`${item.time}-${index}`} className="flex items-start gap-2 border-b px-1 py-1.5 text-xs last:border-b-0">
                <span className="shrink-0 font-mono text-muted-foreground">{new Date(item.time).toLocaleTimeString()}</span>
                <Badge variant="outline" className="shrink-0 font-mono">
                  {item.method}
                </Badge>
                {item.matched ? (
                  <Badge className="shrink-0 border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" title={t.matchHit}>
                    {item.label || t.matchHit}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground" title={t.matchRulesHint}>
                    {t.matchMiss}
                  </Badge>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono" title={item.url}>
                    {item.url}
                  </div>
                  {item.body && (
                    <div className="truncate font-mono text-muted-foreground" title={item.body}>
                      {item.body}
                    </div>
                  )}
                  {item.matched && item.ruleMatchBody && (
                    <div className="truncate text-muted-foreground/70" title={`${t.matchBody}: ${item.ruleMatchBody}`}>
                      {t.matchBody}: {item.ruleMatchBody}
                    </div>
                  )}
                  {!item.matched && typeof item.ruleCount === 'number' && (
                    <div className="text-muted-foreground/70">
                      {t.rules} {item.ruleCount}（{t.enabled} {item.enabledCount}）
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
