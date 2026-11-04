import { FILTER_TYPE, HTTP_METHODS, OVERRIDE_MODE, RESPONSE_TYPE } from '@api-override/core/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import JsonEditor from '@/components/JsonEditor';
import { ArrowLeftIcon, CheckIcon, InfoIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { METHOD_TRIGGER_COLORS, METHOD_TRIGGER_FALLBACK, RULE_REQ_MIN_HEIGHT, RULE_RESP_MAX_HEIGHT } from './constants';
import { useParamRows, useReqHeight, useResponseFile, useRuleDraft } from './useRuleEditor';

// 分页按钮样式：激活项为圆角高亮块（对齐接口调试工具的分页样式）
const tabCls = (active) => cn('rounded-md px-3 py-1.5 text-sm transition-colors', active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground');

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
  const handleBack = () => {
    if (dirty) save();
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
          <div className="mb-3 flex shrink-0 items-center overflow-hidden rounded-lg border border-foreground/15 dark:border-foreground/20">
            {/* 请求方法在最左，底色整体铺在触发器上以区分下拉与输入框 */}
            <Select value={draft.limitMethod || 'ALL'} onValueChange={(value) => patch({ limitMethod: value })}>
              <SelectTrigger
                className={cn(
                  'w-auto rounded-l-md rounded-r-none border-0 gap-1.5 px-2.5 font-semibold shadow-none [&>[data-slot=select-value]]:gap-1.5',
                  METHOD_TRIGGER_COLORS[draft.limitMethod] || METHOD_TRIGGER_FALLBACK
                )}
                title={t.method}
              >
                <InfoIcon className="size-3 opacity-80" />
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
            <Select value={draft.filterType || FILTER_TYPE.NORMAL} onValueChange={(value) => patch({ filterType: value })}>
              <SelectTrigger
                className="w-auto rounded-none rounded-r-md border-0 gap-1.5 bg-sky-500/15! px-2.5 text-sky-500 shadow-none hover:bg-sky-500/25! [&>[data-slot=select-value]]:gap-1.5"
                title={`${t.filter}（Contains / Regex）`}
              >
                <InfoIcon className="size-3 opacity-80" />
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
          <div
            ref={cardRef}
            className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-foreground/15 dark:border-foreground/20"
            style={reqHeightMode === 'fixed' ? { height: reqHeight } : { minHeight: RULE_REQ_MIN_HEIGHT, maxHeight: reqHeight }}
          >
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              <button type="button" onClick={() => setReqTab('params')} className={tabCls(reqTab === 'params')}>
                {/* 页签名为通用名，不做国际化 */}
                Param
              </button>
              <button type="button" onClick={() => setReqTab('payload')} className={tabCls(reqTab === 'payload')}>
                {t.tabBody}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {reqTab === 'params' ? (
                <div className="grid content-start gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Query</Label>
                    {draft.filterType !== FILTER_TYPE.REGEX && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={enterBatch}>
                        {t.batchEdit}
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
              ) : (
                <div className="grid content-start gap-1.5">
                  {/* Body 匹配：同一地址的不同请求按请求体内容区分（如不同的 plan_time_type），留空不校验 */}
                  <Label className="text-xs text-muted-foreground">{t.matchBody}</Label>
                  <Input
                    className="h-8 font-mono text-xs"
                    value={draft.matchBody || ''}
                    onChange={(event) => patch({ matchBody: event.target.value })}
                    placeholder={'"plan_time_type": "YEAR"'}
                  />
                  <small className="text-xs text-muted-foreground">{t.matchBodyHint}</small>
                  <Label className="mt-1 text-xs text-muted-foreground">{t.requestPayload}</Label>
                  {/* 与响应体同一编辑器：输入 @ 提示 Mock.js 占位符，支持裸写占位符的校验/格式化 */}
                  <JsonEditor
                    value={draft.overridePayload || ''}
                    onChange={(next) => patch({ overridePayload: next })}
                    mode="body"
                    theme={theme}
                    height={160}
                    placeholder={'{\n  "page": "@integer(1,10)"\n}'}
                    t={t}
                  />
                  <small className="text-xs text-muted-foreground">{t.payloadHint}</small>
                </div>
              )}
            </div>
          </div>
          {/* 分隔线：拖拽调节请求区高度，双击恢复默认 */}
          <div className="group flex h-4 shrink-0 cursor-row-resize items-center justify-center" onMouseDown={startVerticalResize} onDoubleClick={resetReqHeight}>
            <div className="h-1 w-16 rounded-full bg-muted-foreground/25 transition-colors group-hover:bg-muted-foreground/50" />
          </div>
          {/* 响应拦截：响应格式 / 增量覆盖 + Body / Headers 分页（高度随内容自适应，超出上限内部滚动） */}
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border border-foreground/15 dark:border-foreground/20"
            style={{ minHeight: RULE_REQ_MIN_HEIGHT, maxHeight: RULE_RESP_MAX_HEIGHT }}
          >
            <div className="flex items-center gap-1 border-b px-2 py-1.5">
              <button type="button" onClick={() => setRespTab('body')} className={tabCls(respTab === 'body')}>
                {t.tabBody}
              </button>
              <button type="button" onClick={() => setRespTab('headers')} className={tabCls(respTab === 'headers')}>
                {t.tabHeaders}
              </button>
            </div>
            {respTab === 'body' && (
              <div className="flex items-center border-b px-2 py-2">
                {/* 响应格式 / 增量覆盖连接为一个输入组；左侧图标 hover 查看字段说明 */}
                <div className="flex items-stretch overflow-hidden rounded-md border">
                    <Select
                      value={draft.responseType || RESPONSE_TYPE.JSON}
                      onValueChange={(value) => patch({ responseType: value, ...(value === RESPONSE_TYPE.FILE || value === RESPONSE_TYPE.JS ? { overrideMode: OVERRIDE_MODE.FULL } : {}) })}
                    >
                      <SelectTrigger className="rounded-none border-0 gap-1 px-2 shadow-none [&>[data-slot=select-value]]:gap-1" title={t.responseType}>
                        <InfoIcon className="size-3 text-muted-foreground" />
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
                        <InfoIcon className="size-3 text-muted-foreground" />
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
                  {draft.overrideMode === OVERRIDE_MODE.INCREMENTAL && <p className="text-xs text-muted-foreground">{t.incrementalHint}</p>}
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
                  <Label className="text-xs text-muted-foreground">{t.headers}</Label>
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
                  <small className="text-xs text-muted-foreground">{t.headersHint}</small>
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
          </div>
        </div>
        {/* 有修改时底部悬浮二次确认按钮组（自动保存模式下不出现） */}
        {!autoSave && dirty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-foreground/15 bg-background/85 py-2.5 pl-5 pr-2.5 shadow-xl backdrop-blur dark:border-foreground/20">
              <span className="text-sm text-muted-foreground">{t.unsavedHint}</span>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-4" onClick={reset}>
                  {t.cancel}
                </Button>
                <Button type="button" size="sm" className="h-9 rounded-full px-5" onClick={save}>
                  {t.save}
                </Button>
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
