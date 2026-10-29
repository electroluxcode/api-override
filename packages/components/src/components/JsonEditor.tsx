import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, type Diagnostic } from '@codemirror/lint';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// 常用响应头 key/value，供 Headers 编辑器补全
const HEADER_KEYS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Access-Control-Expose-Headers',
  'Access-Control-Max-Age',
  'Authorization',
  'Cache-Control',
  'Content-Disposition',
  'Content-Type',
  'ETag',
  'Expires',
  'Last-Modified',
  'Location',
  'Origin',
  'Pragma',
  'Referer',
  'Retry-After',
  'Set-Cookie',
  'Transfer-Encoding',
  'User-Agent',
  'Vary',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'X-Request-Id'
];
const HEADER_VALUES: Record<string, string[]> = {
  'Content-Type': ['application/json', 'application/javascript', 'text/html; charset=utf-8', 'text/plain; charset=utf-8', 'application/x-www-form-urlencoded'],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0', 'public', 'private'],
  'Access-Control-Allow-Origin': ['*', 'http://localhost:3000'],
  'Access-Control-Allow-Methods': ['GET, POST, OPTIONS', 'GET, POST, PUT, DELETE, OPTIONS'],
  'Content-Disposition': ['inline', 'attachment']
};

// Mock.js 占位符候选（label 为基础写法；带参数的占位符用 apply 展开为示例调用）
const MOCK_PLACEHOLDERS: Array<{ label: string; detail: string; apply?: string }> = [
  { label: '@cname', detail: '随机中文姓名' },
  { label: '@name', detail: '随机英文姓名' },
  { label: '@cfirst', detail: '随机中文姓' },
  { label: '@email', detail: '随机邮箱地址' },
  { label: '@integer(1, 100)', detail: '随机整数', apply: '@integer(1, 100)' },
  { label: '@natural', detail: '随机自然数' },
  { label: '@float(0, 100)', detail: '随机浮点数', apply: '@float(0, 100, 2, 2)' },
  { label: '@boolean', detail: '随机布尔值' },
  { label: '@string(5, 10)', detail: '随机字符串', apply: '@string(5, 10)' },
  { label: '@range(1, 10)', detail: '整数数组', apply: '@range(1, 10)' },
  { label: '@date(yyyy-MM-dd)', detail: '随机日期', apply: '@date(yyyy-MM-dd)' },
  { label: '@time(HH:mm:ss)', detail: '随机时间', apply: '@time(HH:mm:ss)' },
  { label: '@datetime', detail: '随机日期时间' },
  { label: '@timestamp', detail: 'Unix 时间戳（毫秒）' },
  { label: '@now', detail: '当前时间' },
  { label: '@image(200x100)', detail: '随机图片 URL', apply: "@image('200x100')" },
  { label: '@color', detail: '随机颜色值' },
  { label: '@hex', detail: '随机十六进制色值' },
  { label: '@ctitle', detail: '随机中文标题' },
  { label: '@title', detail: '随机英文标题' },
  { label: '@cword', detail: '随机中文字符' },
  { label: '@cparagraph', detail: '随机中文段落' },
  { label: '@sentence', detail: '随机英文句子' },
  { label: '@url', detail: '随机 URL' },
  { label: '@domain', detail: '随机域名' },
  { label: '@protocol', detail: '随机协议（http/https）' },
  { label: '@ip', detail: '随机 IP 地址' },
  { label: '@region', detail: '随机大区' },
  { label: '@province', detail: '随机省份' },
  { label: '@city', detail: '随机城市' },
  { label: '@county', detail: '随机县区' },
  { label: '@zip', detail: '随机邮政编码' },
  { label: '@guid', detail: '随机 GUID' },
  { label: '@id', detail: '随机身份证号' },
  { label: '@increment', detail: '全局自增数' }
];

// 输入 @ 后提示 Mock.js 占位符，Tab/回车应用（带参数的展开为示例调用）
const mockCompletion = (context: CompletionContext): CompletionResult | null => {
  const before = context.matchBefore(/@[\w.-]*/);
  if (!before) return null;
  return {
    from: before.from,
    options: MOCK_PLACEHOLDERS.map(({ label, detail, apply }) => ({ label, detail, type: 'function' as const, apply: apply ?? label })),
    validFor: /^@[\w.-]*$/
  };
};

// 光标处于 "xxx" 引号内时给出键名/值候选
const quoteContext = (context: CompletionContext) => {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  return { line, before, quote: before.match(/"([^"]*)$/) };
};

const headerCompletion = (context: CompletionContext): CompletionResult | null => {
  const { pos } = context;
  const { before, quote } = quoteContext(context);
  if (!quote) return null;
  // 值位置："key": "val|" → 按已知 key 提示常用值
  const valueMatch = before.match(/"([^"]+)"\s*:\s*"([^"]*)$/);
  if (valueMatch) {
    const options = (HEADER_VALUES[valueMatch[1]] || []).map((label) => ({ label, type: 'text' as const }));
    return options.length ? { from: pos - valueMatch[2].length, options, validFor: /^[\w\-./;=,\s]*$/ } : null;
  }
  // 键位置："Con|"
  return {
    from: pos - quote[1].length,
    options: HEADER_KEYS.map((label) => ({ label, type: 'property' as const })),
    validFor: /^"?[\w-]*"?$/
  };
};

// 响应体补全：提示文档中已出现过的键名，方便复用结构；@ 开头时交给 Mock.js 占位符提示
const docKeyCompletion = (context: CompletionContext): CompletionResult | null => {
  const { pos, state } = context;
  const { quote } = quoteContext(context);
  if (!quote?.[1] || quote[1].startsWith('@')) return null;
  const keys = new Set<string>();
  for (const match of state.doc.toString().matchAll(/"([^"\\]+)"\s*:/g)) keys.add(match[1]);
  if (!keys.size) return null;
  return {
    from: pos - quote[1].length,
    options: [...keys].slice(0, 200).map((label) => ({ label, type: 'property' as const })),
    validFor: /^"?[^"]*"?$/
  };
};

// 允许 Mock.js 占位符裸写在值位置（如 "test": @integer(1, 100)）：
// 校验前先把裸占位符补上引号（运行时 Mock 处理带引号与裸写均可），补引号后能通过 JSON 校验则视为合法
const quoteBareMockValues = (text: string) => text.replace(/(:\s*)@([\w.$-]+(?:\s*\([^)]*\))?)/g, '$1"@$2"');

const mockAwareJsonLinter = (view: EditorView): Diagnostic[] => {
  try {
    JSON.parse(quoteBareMockValues(view.state.doc.toString()));
    return [];
  } catch {
    return jsonParseLinter()(view);
  }
};

export default function JsonEditor({
  value,
  onChange,
  mode = 'body',
  theme,
  height = 240,
  placeholder,
  t
}: {
  value: string;
  onChange: (value: string) => void;
  mode?: 'body' | 'headers';
  theme?: string;
  height?: number;
  placeholder?: string;
  t: { format: string; invalidJson: string };
}) {
  const codeMirrorTheme = theme === 'dark' ? 'dark' : 'light';
  const [status, setStatus] = useState('');
  const statusTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(statusTimer.current), []);
  const extensions = useMemo(
    () => [
      json(),
      linter(mockAwareJsonLinter),
      EditorView.lineWrapping,
      autocompletion({ override: mode === 'headers' ? [headerCompletion] : [mockCompletion, docKeyCompletion] })
    ],
    [mode]
  );
  const format = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
      setStatus('');
    } catch {
      // 裸写 Mock 占位符（"test": @integer(1, 100)）时补引号后再格式化
      try {
        const parsed = JSON.parse(quoteBareMockValues(value));
        onChange(JSON.stringify(parsed, null, 2));
        setStatus('');
      } catch {
        setStatus(t.invalidJson);
        window.clearTimeout(statusTimer.current);
        statusTimer.current = window.setTimeout(() => setStatus(''), 2600);
      }
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-end gap-2 border-b bg-muted/40 px-2 py-1">
        {status && <span className="mr-auto text-xs text-destructive">{status}</span>}
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={format}>
          {t.format}
        </Button>
      </div>
      <CodeMirror
        value={value}
        theme={codeMirrorTheme}
        height={`${height}px`}
        placeholder={placeholder}
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ highlightSelectionMatches: false, autocompletion: true }}
      />
    </div>
  );
}
