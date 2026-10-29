# API Override

English | [简体中文](./README.md)

A browser-extension Ajax/Fetch response interceptor and mocking tool (Chrome MV3). Rule groups, JSON/text/file response overrides, and full Mock.js syntax support.

## Usage

```bash
pnpm install
pnpm build
```

Enable Developer mode in `chrome://extensions` → "Load unpacked" → select `apps/extension/dist`, then click the toolbar icon to add rules.

## Highlights

- Grouped rules with include/wildcard/regex matching and optional method filter
- JSON full override or incremental merge, plain text and file responses, header & status overrides
- Full Mock.js syntax: `@cname`, `@integer(1, 100)`, `"list|1-3"`, bare placeholders included
- Group import / export / template download
- Chinese & English UI, light and dark themes

## License

MIT
