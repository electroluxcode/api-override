# Changelog

本项目所有重要变更将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

English version: [CHANGELOG.en.md](./CHANGELOG.en.md)

## [1.0.1] - 2026-11-05

### 新增

- **请求覆盖** — 非 GET 请求可按规则替换请求体（`matchBody`），支持 Mock.js 模板
- **匹配日志** — 弹窗展示页面脚本上报的每次规则判定（命中哪条规则 / 未命中原因），支持「只看命中」筛选与一键清空；日志由 Service Worker 落盘（最近 100 条），面板未打开时的判定也能回看；顶部状态行展示页面脚本此刻看到的配置，让「静默不生效」可见
- 面板顶栏（Side Panel / Popup）新增快速导入入口

### 修复

- `Button` 未透传 ref，导致 React 18 下 Radix 下拉菜单定位失败（渲染在屏幕外不可见）
- 下拉菜单项改用 `onSelect`，修复指针点击不生效的问题

## [1.0.0] - 2026-10-29

### 新增

- 浏览器扩展版 Ajax/Fetch 响应拦截与 Mock 工具：规则分组管理，支持包含 / `*` 通配符 / 正则匹配、请求方法过滤、拖拽排序与右键置顶 / 置底
- 响应覆盖：JSON 全量 / 增量、纯文本、JavaScript / HTML / CSS 静态资源替换、文件响应、响应头与状态码覆盖
- 请求覆盖：非 GET 请求按规则替换请求体（`matchBody`），支持 Mock.js 模板
- Mock.js 语法完整兼容，编辑器 `@` 占位符补全，内置 Mock 挂载为 `window.Mock`
- 规则组 JSON 导入（按名称合并）/ 导出 / 空白模板下载
- 中英双语、亮暗主题
