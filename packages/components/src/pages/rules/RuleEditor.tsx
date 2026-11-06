import { FILTER_TYPE, HTTP_METHODS, OVERRIDE_MODE, RESPONSE_TYPE } from '@api-override/core/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import JsonEditor from '@/components/JsonEditor';
import { ArrowLeftIcon, CheckIcon, InfoIcon, ListPlusIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { METHOD_TRIGGER_COLORS, METHOD_TRIGGER_FALLBACK, RULE_REQ_MIN_HEIGHT, RULE_RESP_MAX_HEIGHT } from './constants';
import { useParamRows, useReqHeight, useResponseFile, useRuleDraft } from './useRuleEditor';

export function RuleEditor({ rule, t, theme = 'light', intercepted = [], onChange, onDelete, onBack, autoSave = false }) {
  const { draft, patch, dirty, save, reset, headersValue, setHeadersValue } = useRuleDraft(rule, autoSave, onChange);
  const { reqHeight, reqHeightMode, cardRef, startVerticalResize, resetReqHeight } = useReqHeight();
  const { displayParamRows, updateParam, addParam, removeParam, batchOpen, setBatchOpen, batchText, setBatchText, enterBatch, applyBatch } = useParamRows(
    draft.match,
    patch
  );
  const chooseFile = useResponseFile(patch);
  const [reqTab, setReqTab] = useState('params'); // 请求拦截分页：Param / Body
  const [respTab, setRespTab] = useState('body'); // 响应拦截分页：Body / Headers
  // 单击标题重命名：标题变为输入框，输入框旁确认 / 取消
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const startRename = () => {
    setRenameValue(draft.label || '');
    setRenaming(true);
  };
  const commitRename = () => {
    const name = renameValue.trim();
    if (name) patch({ label: name });
    setRenaming(false);
  };
  // 返回不保存：有未保存修改时不弹窗，底部按钮组切换为"退出"形态并抖动提示（放弃/保存并返回），直接放行无修改的返回
  const [shakeCount, setShakeCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  const shakeTimer = useRef<number | undefined>(undefined);
  const handleBack = () => {
    if (!dirty) {
      onBack();
      return;
    }
    setExiting(true);
    // 重设 key 重播抖动动画（快速连点也只重放，不叠加）
    setShakeCount((value) => value + 1);
    window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShakeCount(0), 600);
  };
  const discardAndBack = () => {
    reset();
    onBack();
  };
  const saveAndBack = () => {
    save();
    onBack();
  };
  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeftIcon />
            {t.back}
          </Button>
          {renaming ? (
            <div className="flex min-w-0 items-center gap-1">
              <Input
                autoFocus
                className="h-8 w-56"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') setRenaming(false);
                }}
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={commitRename} title={t.confirm}>
                <CheckIcon />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setRenaming(false)} title={t.cancel}>
                <XIcon />
              </Button>
            </div>
          ) : (
            <h2 className="cursor-pointer truncate text-base font-semibold hover:text-foreground/80" title={draft.label} onClick={startRename}>
              {draft.label}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => patch({ switchOn: draft.switchOn === false })}>
            {draft.switchOn === false ? t.enable : t.disable}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            <Trash2Icon />
            {t.delete}
          </Button>
        </div>
      </div>
      {/* 上半部分为请求拦截（名称 / 匹配方式 / Query 参数 / 请求体），下半部分为响应拦截，中间分隔线可拖拽调节高度 */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 请求拦截：请求行（方法 + 匹配方式 + 匹配地址）独立成卡，下拉底色内缩圆角 */}
          <div className="mb-3 flex shrink-0 items-center overflow-hidden rounded-lg border border-foreground/10 dark:border-foreground/15">
            {/* 请求方法在最左，底色整体铺在触发器上以区分下拉与输入框 */}
            <Select value={draft.limitMethod || 'ALL'} onValueChange={(value) => patch({ limitMethod: value })}>
              <SelectTrigger
                className={cn(
                  'w-auto rounded-l-md rounded-r-none border-0 gap-1.5 px-2.5 font-bold shadow-none data-[size=default]:h-8 [&>[data-slot=select-value]]:gap-1.5',
                  METHOD_TRIGGER_COLORS[draft.limitMethod] || METHOD_TRIGGER_FALLBACK
                )}
                title={t.method}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {/* 方法名为通用名，不做国际化（与 GET / POST 一致） */}
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={draft.filterType || FILTER_TYPE.NORMAL} onValueChange={(value) => patch({ filterType: value })}>
              <SelectTrigger
                className="w-auto rounded-none rounded-r-md border-0 gap-1.5 bg-sky-500/20! px-2.5 font-bold text-sky-600 shadow-none hover:bg-sky-500/30! dark:text-sky-400 data-[size=default]:h-8 [&>[data-slot=select-value]]:gap-1.5"
                title={`${t.filter}（Contains / Regex）`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* 匹配方式为通用名，不做国际化（与 Param / Body 一致） */}
                <SelectItem value={FILTER_TYPE.NORMAL}>Contains</SelectItem>
                <SelectItem value={FILTER_TYPE.REGEX}>Regex</SelectItem>
              </SelectContent>
            </Select>
            <Input className="min-w-48 flex-1 rounded-none border-0 font-mono shadow-none" value={draft.match} onChange={(event) => patch({ match: event.target.value })} placeholder="*/api/user/list" />
          </div>
          <Tabs
            ref={cardRef}
            value={reqTab}
            onValueChange={setReqTab}
            className="flex min-h-0 shrink-0 flex-col gap-0 overflow-hidden rounded-lg border border-foreground/10 dark:border-foreground/15"
            style={reqHeightMode === 'fixed' ? { height: reqHeight } : { minHeight: RULE_REQ_MIN_HEIGHT, maxHeight: reqHeight }}
          >
            <TabsList variant="line">
              {/* 卡片标识：ⓘ 悬停查看上方是请求拦截还是响应拦截 */}
              {/* 卡片标识：ⓘ 悬停查看上方是请求拦截还是响应拦截；-mr 收紧与右侧页签的间距 */}
              <Tooltip content={t.requestCard}>
                <span className="-mr-1.5 inline-flex cursor-help text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                </span>
              </Tooltip>
              <TabsTrigger variant="line" value="params">
                {/* 页签名为通用名，不做国际化 */}
                Param
              </TabsTrigger>
              <TabsTrigger variant="line" value="payload">{t.tabBody}</TabsTrigger>
            </TabsList>
            <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Query</Label>
                  {draft.filterType !== FILTER_TYPE.REGEX && (
                    <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={enterBatch} title={t.batchEdit} aria-label={t.batchEdit}>
                      <ListPlusIcon />
                    </Button>
                  )}
                </div>
                {draft.filterType === FILTER_TYPE.REGEX ? (
                  <p className="text-xs text-muted-foreground">{t.paramRegexHint}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-1 text-xs text-muted-foreground">
                      <span>Key</span>
                      <span>Value</span>
                      <span />
                    </div>
                    {displayParamRows.map((row, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                        <Input className="h-8 font-mono text-xs" value={row.key} onChange={(event) => updateParam(index, 'key', event.target.value)} placeholder="key" />
                        <Input className="h-8 font-mono text-xs" value={row.value} onChange={(event) => updateParam(index, 'value', event.target.value)} placeholder="value" />
                        <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => removeParam(index)}>
                          <XIcon />
                        </Button>
                      </div>
                    ))}
                    <div>
                      <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={addParam}>
                        <PlusIcon />
                        {t.addParam}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="payload" className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid content-start gap-1.5">
                {/* Body 匹配：同一地址的不同请求按请求体内容区分（如不同的 plan_time_type），留空不校验 */}
                <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                  {t.matchBody}
                  <Tooltip content={t.matchBodyHint}>
                    <span className="inline-flex cursor-help text-muted-foreground">
                      <InfoIcon className="size-3" />
                    </span>
                  </Tooltip>
                </Label>
                {/* 内容是包含/通配/正则匹配串，不一定是完整 JSON，关闭 JSON 校验 */}
                <JsonEditor
                  value={draft.matchBody || ''}
                  onChange={(next) => patch({ matchBody: next })}
                  mode="body"
                  theme={theme}
                  height={120}
                  validate={false}
                  t={t}
                />
              </div>
            </TabsContent>
          </Tabs>
          {/* 分隔线：拖拽调节请求区高度，双击恢复默认 */}
          <div className="group flex h-4 shrink-0 cursor-row-resize items-center justify-center" onMouseDown={startVerticalResize} onDoubleClick={resetReqHeight}>
            <div className="h-1 w-16 rounded-full bg-muted-foreground/25 transition-colors group-hover:bg-muted-foreground/50" />
          </div>
          {/* 响应拦截：响应格式 / 增量覆盖 + Body / Headers 分页（高度随内容自适应，超出上限内部滚动） */}
          <Tabs
            value={respTab}
            onValueChange={setRespTab}
            className="flex min-h-0 shrink-0 flex-col gap-0 overflow-hidden rounded-lg border border-foreground/10 dark:border-foreground/15"
            style={{ minHeight: RULE_REQ_MIN_HEIGHT, maxHeight: RULE_RESP_MAX_HEIGHT }}
          >
            <TabsList variant="line">
              <Tooltip content={t.responseCard}>
                <span className="-mr-1.5 inline-flex cursor-help text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                </span>
              </Tooltip>
              <TabsTrigger variant="line" value="body">{t.tabBody}</TabsTrigger>
              <TabsTrigger variant="line" value="headers">{t.tabHeaders}</TabsTrigger>
            </TabsList>
            {respTab === 'body' && (
              <div className="flex items-center border-b px-2 py-2">
                {/* 响应格式 / 增量覆盖连接为一个输入组；左侧图标 hover 查看字段说明 */}
                <div className="flex items-stretch overflow-hidden rounded-md border">
                    <Select
                      value={draft.responseType || RESPONSE_TYPE.JSON}
                      onValueChange={(value) => patch({ responseType: value, ...(value === RESPONSE_TYPE.FILE || value === RESPONSE_TYPE.JS ? { overrideMode: OVERRIDE_MODE.FULL } : {}) })}
                    >
                      <SelectTrigger className="rounded-none border-0 gap-1 px-2 shadow-none [&>[data-slot=select-value]]:gap-1" title={t.responseType}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* 响应格式为通用格式名，不做国际化 */}
                        <SelectItem value={RESPONSE_TYPE.JSON}>JSON</SelectItem>
                        <SelectItem value={RESPONSE_TYPE.TEXT}>Text</SelectItem>
                        <SelectItem value={RESPONSE_TYPE.JS}>JavaScript</SelectItem>
                        <SelectItem value={RESPONSE_TYPE.HTML}>HTML</SelectItem>
                        <SelectItem value={RESPONSE_TYPE.CSS}>CSS</SelectItem>
                        <SelectItem value={RESPONSE_TYPE.FILE}>File</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={draft.overrideMode || OVERRIDE_MODE.FULL}
                      onValueChange={(value) => patch({ overrideMode: value })}
                      disabled={draft.responseType === RESPONSE_TYPE.FILE || draft.responseType === RESPONSE_TYPE.JS}
                    >
                      <SelectTrigger className="rounded-none border-0 gap-1 px-2 shadow-none [&>[data-slot=select-value]]:gap-1" title={`${t.incremental}：${t.incrementalHint}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={OVERRIDE_MODE.FULL}>{t.full}</SelectItem>
                        <SelectItem value={OVERRIDE_MODE.INCREMENTAL}>{t.incremental}</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {respTab === 'body' ? (
                <div className="grid content-start gap-4">
                  {draft.responseType === RESPONSE_TYPE.FILE ? (
                    <div className="grid content-start gap-1.5">
                      <Label className="text-xs text-muted-foreground">File</Label>
                      <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <label className="cursor-pointer">
                            {t.chooseFile}
                            <input type="file" className="hidden" onChange={chooseFile} />
                          </label>
                        </Button>
                        <span className="text-sm">{draft.responseFileName || t.noFile}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.fileHint}</p>
                    </div>
                  ) : draft.responseType === RESPONSE_TYPE.JS ? (
                    <div className="grid content-start gap-1.5">
                      <Textarea
                        className="min-h-48 font-mono text-xs"
                        value={draft.overrideTxt || ''}
                        onChange={(event) => patch({ overrideTxt: event.target.value })}
                        spellCheck="false"
                        placeholder={'// 返回的脚本内容，按字面响应\nfunction main() {\n  console.log("hello from mock");\n}'}
                      />
                      <p className="text-xs text-muted-foreground">{t.jsHint}</p>
                    </div>
                  ) : draft.responseType === RESPONSE_TYPE.JSON ? (
                    <div className="grid content-start gap-1.5">
                      <JsonEditor
                        value={draft.overrideTxt || ''}
                        onChange={(next) => patch({ overrideTxt: next })}
                        mode="body"
                        theme={theme}
                        height={280}
                        placeholder={'{\n  "code": 0,\n  "msg": "ok"\n}'}
                        t={t}
                      />
                    </div>
                  ) : (
                    <div className="grid content-start gap-1.5">
                      <Textarea className="min-h-40 font-mono text-xs" value={draft.overrideTxt || ''} onChange={(event) => patch({ overrideTxt: event.target.value })} spellCheck="false" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid content-start gap-1.5">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    {t.headers}
                    <Tooltip content={t.headersHint}>
                      <span className="inline-flex cursor-help text-muted-foreground">
                        <InfoIcon className="size-3" />
                      </span>
                    </Tooltip>
                  </Label>
                  <JsonEditor
                    value={headersValue}
                    onChange={(next) => {
                      setHeadersValue(next);
                      if (autoSave) {
                        // 自动保存：JSON 可解析时立即写入响应头
                        let headers = rule.responseHeaders;
                        try {
                          const parsed = JSON.parse(next);
                          if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') headers = parsed;
                        } catch {}
                        onChange({ responseHeaders: headers });
                      }
                    }}
                    mode="headers"
                    theme={theme}
                    height={160}
                    placeholder={'{\n  "Content-Type": "application/json"\n}'}
                    t={t}
                  />
                </div>
              )}
              {intercepted.length > 0 && (
                <div className="mt-4 rounded-lg border p-3">
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
          </Tabs>
        </div>
        {/* 底部悬浮确认按钮组（自动保存模式下不出现）：编辑中=取消/保存；点过返回=退出形态（放弃/保存并返回）+抖动 */}
        {!autoSave && dirty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center">
            <div
              key={shakeCount}
              className={cn(
                'pointer-events-auto flex items-center gap-4 rounded-full border border-foreground/10 bg-background/85 py-2.5 pl-5 pr-2.5 shadow-xl backdrop-blur dark:border-foreground/15',
                shakeCount > 0 && 'animate-shake'
              )}
            >
              <span className="text-sm text-muted-foreground">{exiting ? t.backDiscardHint : t.unsavedHint}</span>
              <div className="flex items-center gap-1.5">
                {exiting ? (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-4" onClick={discardAndBack}>
                      {t.discardAndBack}
                    </Button>
                    <Button type="button" size="sm" className="h-9 rounded-full px-5" onClick={saveAndBack}>
                      {t.saveAndBack}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-4" onClick={reset}>
                      {t.cancel}
                    </Button>
                    <Button type="button" size="sm" className="h-9 rounded-full px-5" onClick={save}>
                      {t.save}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Query 参数批量编辑：每行一条 key=value，确认后写回匹配地址 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.batchEdit}</DialogTitle>
            <DialogDescription>{t.batchEditHint}</DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-48 font-mono text-xs"
            value={batchText}
            onChange={(event) => setBatchText(event.target.value)}
            spellCheck="false"
            placeholder={'key1=value1\nkey2=value2'}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBatchOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="button" onClick={applyBatch}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
