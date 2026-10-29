# API Override

[English](./README.en.md) | 简体中文

浏览器扩展版的 Ajax/Fetch 响应拦截与 Mock 工具（Chrome MV3）。支持规则分组、JSON/文本/文件响应覆盖，完整兼容 Mock.js 语法。

## 使用

```bash
pnpm install
pnpm build
```

`chrome://extensions` 开启开发者模式 →「加载已解压的扩展程序」→ 选择 `apps/extension/dist`，点击工具栏图标即可添加规则。

## 主要特性

- 规则按分组管理，支持包含/通配符/正则匹配，可限定请求方法
- JSON 全量覆盖或增量合并，纯文本、文件响应，响应头与状态码覆盖
- 完整 Mock.js 语法：`@cname`、`@integer(1, 100)`、`"list|1-3"` 等，裸占位符也可直接写
- 规则组导入/导出/模板下载
- 中英双语、明暗主题

## License

MIT
