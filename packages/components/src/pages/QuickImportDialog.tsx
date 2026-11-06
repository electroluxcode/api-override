import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CopyIcon, FileUpIcon, UploadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

// 快速导入弹窗：从文本粘贴或从文件（点击 / 拖拽）读取规则组 JSON，按名称合并导入（使用说明页与面板顶栏共用）
export function QuickImportDialog({ t, onImportJson, open, onOpenChange, onImported }) {
  const [importTab, setImportTab] = useState('text');
  const [importText, setImportText] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const handleCopyDoc = async () => setCopied(await copyText(t.usageDoc));
  // 读取本地文件内容（导入前可预览文件名，重复选择同一文件也生效）
  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileText(String(reader.result || ''));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };
  const handleChooseFile = (event) => {
    readFile(event.target.files?.[0]);
    event.target.value = '';
  };
  const activeText = importTab === 'file' ? fileText : importText;
  const handleImport = () => {
    if (!activeText.trim() || !onImportJson) return;
    if (onImportJson(activeText)?.ok) {
      setImportText('');
      setFileText('');
      setFileName('');
      onOpenChange(false);
      onImported?.();
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.usageImportTitle}</DialogTitle>
          <DialogDescription>{t.usageImportHint}</DialogDescription>
        </DialogHeader>
        <Tabs value={importTab} onValueChange={setImportTab}>
          <TabsList>
            {/* 页签文案不做国际化 key 复用（与「从文件导入」按钮一致） */}
            <TabsTrigger value="text">{t.importFromText}</TabsTrigger>
            <TabsTrigger value="file">{t.importFromFile}</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-3">
            <Textarea
              className="min-h-40 max-h-64 font-mono text-xs"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={t.usageImportPlaceholder}
              spellCheck="false"
            />
          </TabsContent>
          <TabsContent value="file" className="mt-3">
            <input ref={fileRef} type="file" accept=".json,application/json,.txt" className="hidden" onChange={handleChooseFile} />
            {/* 大按钮式拖拽区：点击选择或拖入文件；已选文件时展示文件名，可再次点击/拖拽替换 */}
            <button
              type="button"
              className={cn(
                'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors',
                dragOver ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-accent/50'
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                readFile(event.dataTransfer.files?.[0]);
              }}
            >
              <UploadIcon className="size-6" />
              {fileName ? (
                <span className="max-w-full truncate px-2 font-medium text-foreground" title={fileName}>
                  {fileName}
                </span>
              ) : (
                <span>{t.importDropHint}</span>
              )}
            </button>
          </TabsContent>
        </Tabs>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={handleCopyDoc}>
            <CopyIcon />
            {copied ? t.usageCopied : t.usageCopyDoc}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportText('');
                setFileText('');
                setFileName('');
                onOpenChange(false);
              }}
            >
              {t.cancel}
            </Button>
            <Button type="button" disabled={!activeText.trim()} onClick={handleImport}>
              <FileUpIcon />
              {t.import}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
