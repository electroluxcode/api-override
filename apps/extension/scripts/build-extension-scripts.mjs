// 扩展脚本构建：三个产物全部由 TS 源码打包（public/ 下不再手工维护任何脚本）：
//   1. packages/core/src/runtime.ts          → dist/pageScripts/main.js   页面 hook（Mock 由 public/pageScripts/vendor/mock.js 预先注入）
//   2. apps/extension/src/content/index.ts   → dist/content.js            content script 桥
//   3. apps/extension/src/background/index.ts → dist/service_worker.js    background service worker
// 需要防重复注入的脚本（page script / content script 可能被执行两次，二次执行会二次包装 hook）用
// banner/footer 注入全局标记哨兵。banner 结尾必须带分号：与 esbuild 的 iife 产物 `(() => {...})()`
// 之间没有换行保护，无分号会被 ASI 拼接成 `true(() => {...})()` 调用。
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..'); // 仓库根（entry 路径基准）
const extDir = path.resolve(here, '..'); // apps/extension（产物路径基准：dist 必须落在扩展目录，manifest 同级）

const TARGETS = [
  {
    entry: 'packages/core/src/runtime.ts',
    out: 'dist/pageScripts/main.js',
    guard: '__apiOverridePageInjected',
    header: [
      '// 防止重复注入：脚本可能被多实例 / 重复注入的 content.js 加载两次，',
      '// 第二次执行会二次包装 fetch/XHR hook，用全局标记去重。'
    ]
  },
  {
    entry: 'apps/extension/src/content/index.ts',
    out: 'dist/content.js',
    guard: '__apiOverrideContentInjected',
    header: [
      '// 防止重复注入：registerContentScripts 与 executeScript 兜底都可能注入本文件，',
      '// 二次执行会重复注入页面脚本并重复挂事件转发，用全局标记去重。'
    ]
  },
  {
    entry: 'apps/extension/src/background/index.ts',
    out: 'dist/service_worker.js',
    guard: null,
    header: []
  }
];

for (const { entry, out, guard, header } of TARGETS) {
  const bannerLines = [...header];
  if (guard) {
    bannerLines.push(';(() => {', `if (globalThis.${guard}) return`, `globalThis.${guard} = true;`);
  }
  const result = await build({
    entryPoints: [path.resolve(root, entry)],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    write: false,
    banner: bannerLines.length ? { js: bannerLines.join('\n') } : undefined,
    footer: guard ? { js: '})()' } : undefined
  });
  const outFile = path.resolve(extDir, out);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, result.outputFiles[0].text);
  console.log('extension script built:', path.relative(process.cwd(), outFile));
}
