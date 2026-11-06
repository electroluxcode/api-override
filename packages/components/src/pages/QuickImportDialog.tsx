import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CopyIcon, FileUpIcon } from 'lucide-react';
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

// 快速导入弹窗：粘贴 AI 生成的规则组 JSON，按名称合并导入（使用说明页与面板顶栏共用）；支持一键复制使用说明
export function QuickImportDialog({ t, onImportJson, open, onOpenChange, onImported }) {
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const handleCopyDoc = async () => setCopied(await copyText(t.usageDoc));
  // 从文件导入：读取 .json 文件内容填入文本框，用户确认后统一走 handleImport（便于导入前查看/修改）
  const handleChooseFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // 允许重复选择同一文件
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
  };
  const handleImport = () => {
    if (!importText.trim() || !onImportJson) return;
    if (onImportJson(importText)?.ok) {
      setImportText('');
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
        <Textarea
          className="min-h-40 max-h-64 font-mono text-xs"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder={t.usageImportPlaceholder}
          spellCheck="false"
        />
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUpIcon />
              {t.importFromFile}
            </Button>
            <input ref={fileRef} type="file" accept=".json,application/json,.txt" className="hidden" onChange={handleChooseFile} />
            <Button type="button" variant="outline" size="sm" onClick={handleCopyDoc}>
              <CopyIcon />
              {copied ? t.usageCopied : t.usageCopyDoc}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportText('');
                onOpenChange(false);
              }}
            >
              {t.cancel}
            </Button>
            <Button type="button" onClick={handleImport}>
              {t.import}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
