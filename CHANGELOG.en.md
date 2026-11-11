# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Chinese version: [CHANGELOG.md](./CHANGELOG.md)

## [1.0.4] - 2026-11-11

### Fixed

- **Pasting very long text stretched dialogs / the rule editor** — an unbreakable single-line paste blew the dialog content area out horizontally (implicit grid tracks sized to content): the dialog base class now pins a single `grid-cols-1` track so content can't exceed the container width; the rule editor's plain-text / JavaScript response editors and the batch-edit dialog textarea are also height-capped (scrolling internally instead)

### Added

- **Long-press sweep multi-select in group batch mode** — hold a group item for 300ms and drag to batch select / deselect a range; if the anchor item was already selected the range is removed
- **Drag-to-resize rule table columns** — drag the handle on a column header's right edge to resize any column, double-click to reset, widths persisted

## [1.0.3] - 2026-11-11

### Fixed

- **Interception stopped working after collapsing the side panel** — the page script is now injected synchronously at `document_start` as a MAIN-world content script (statically registered via `chrome.scripting`) and applies a localStorage settings cache at startup, instead of waiting for a message from the panel; first-load requests after collapsing the panel or opening a new tab are now intercepted. Known edge: on a brand-new browser profile's very first visit to a site (cache not yet written) the earliest requests are still missed — a limitation shared by similar tools; keep the panel open and reload a few times

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
