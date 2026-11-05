# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Chinese version: [CHANGELOG.md](./CHANGELOG.md)

## [1.0.1] - 2026-11-05

### Added

- **Request override** — replace the request body of non-GET requests per rule (`matchBody`), with Mock.js template support
- **Match log** — a modal showing every rule evaluation reported by the page script (which rule hit / why it missed), with a "matched only" filter and one-click clear; entries are persisted by the service worker (last 100), so evaluations made while the panel was closed can still be reviewed; a status line shows the config the page script currently sees, making "silently not working" visible
- Quick import entry in the panel header (Side Panel / Popup)

### Fixed

- `Button` did not forward refs, so on React 18 Radix dropdown menus failed to position (rendered off-screen, invisible)
- Dropdown menu items now use `onSelect`, fixing pointer clicks that never fired

## [1.0.0] - 2026-10-29

### Added

- Browser-extension Ajax/Fetch response interceptor & mocking tool: rule groups with include / `*` wildcard / regex matching, method filters, drag to reorder, right-click move-to-top / bottom
- Response overrides: JSON full / incremental, plain text, JavaScript / HTML / CSS static replacement, file responses, header & status overrides
- Request override: replace request bodies of non-GET requests per rule (`matchBody`), with Mock.js template support
- Full Mock.js syntax support, `@` placeholder completions in the editor, bundled Mock exposed as `window.Mock`
- Rule-group JSON import (merged by name) / export / blank template download
- Chinese & English UI, light / dark themes
