<div align="center">

<img src="docs/logo.png" width="96" alt="API Override" />

# API Override

**Ajax/Fetch response interceptor & mocking tool, as a browser extension**

English · [简体中文](./README.md)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

![Preview](docs/preview.png)

## ✨ Features

- 🗂️ **Rule groups** — include / `*` wildcard / regex matching with method & body filters, drag to reorder
- 🎯 **Response overrides** — JSON full / incremental, Text / JavaScript / HTML / CSS / file, headers & status codes
- 📤 **Request override** — replace the request body of non-GET requests per rule
- 📜 **Match log** — review rule evaluations per request
- 🧪 **Mock.js** — `@cname` and friends out of the box; bundled Mock exposed as `window.Mock`
- 📦 **Import / export** — one-click group JSON import & export
- 🌗 **Themes** — light / dark, Chinese & English

## 🚀 Quick start

```bash
pnpm install
pnpm build
```

1. In `chrome://extensions`, enable "Developer mode" → "Load unpacked" → select `apps/extension/dist`
2. Create a rule, fill in the match pattern (e.g. `/v1/activity-banner`), pick a response type and save
3. Turn on the global switch and refresh the target page

## 📄 License

[MIT](./LICENSE)
