import type React from 'react';
import { Button } from '@/components/ui/button';
import { CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QuickImportDialog } from '../QuickImportDialog';

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

export function UsagePage({ t, onImportJson, onClearAll, onExport, onTemplate }) {
  const [importOpen, setImportOpen] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return undefined;
    const timer = window.setTimeout(() => setStatus(''), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);
  const copyWithNotice = async (text) => setStatus((await copyText(text)) ? t.usageCopied : t.usageCopyFailed);
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
      <QuickImportDialog
        t={t}
        onImportJson={onImportJson}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => setStatus(t.importSuccess)}
      />
    </main>
  );
}
