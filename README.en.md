<div align="center">

<img src="docs/logo.png" width="96" alt="API Override" />

# API Override

**Ajax/Fetch response interceptor & mocking tool, as a browser extension**

Intercept XHR / Fetch requests on any page, manage response overrides in rule groups, with full Mock.js syntax support.

English · [简体中文](./README.md)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

![Preview](docs/preview.png)

## ✨ Features

- 🗂️ **Rule groups** — organize rules into groups with include / `*` wildcard / regex matching and optional method filter
- 🎯 **Response overrides** — JSON full override or incremental merge, plain text, file responses, header & status overrides
- 🧪 **Mock.js syntax** — `@cname`, `@integer(1, 100)`, `"list|1-3"` out of the box, bare placeholders included
- 🧠 **Expert mode** — generate headers, payloads and responses dynamically with JS functions
- 📦 **Import / export** — JSON group import (merged by name), export and blank template download
- 🌗 **Themes** — Chinese & English UI, light / dark themes

## 🚀 Quick start

```bash
pnpm install
pnpm build
```

1. Open `chrome://extensions` and enable "Developer mode"
2. "Load unpacked" → select `apps/extension/dist`
3. Click the toolbar icon and add your first rule

### Basic usage

1. Create a group (or use the default one), click "New rule"
2. Fill in the match pattern, e.g. `/v1/activity-banner` (`*` wildcards and regex supported)
3. Pick a response type (JSON / text / file), enter the response body, save and enable the rule
4. Turn on the global switch and refresh the target page

## 🧪 Mock.js support

Response bodies fully support [Mock.js](https://github.com/nuysoft/Mock) syntax

```json
{
  "code": 0,
  "name": "@cname",
  "list|1-3": [{ "id|+1": 1, "email": "@email" }]
}
```

## 📄 License

[MIT](./LICENSE)
