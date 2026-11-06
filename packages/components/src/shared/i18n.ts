export const I18N = {
  'zh-CN': {
    title: 'API Override',
    rules: '规则',
    groupManagement: '规则管理',
    groupDescription: '配置当前分组中的接口响应覆盖规则',
    settings: '设置',
    settingsDescription: '调整语言、主题和显示偏好',
    usage: '使用说明',
    usageDescription: '粘贴 AI 生成的规则 JSON，快速完成规则配置',
    usageDoc: `API Override 是一款浏览器扩展，用于拦截页面内发出的 Ajax/Fetch 请求并覆盖响应。核心用法：把规则 JSON 粘贴到本页「快速导入」即可完成配置，规则构造可以交给 AI。

## 快速导入
- 把下方「精简导入」「TypeScript 定义」复制给 AI，AI 按格式生成规则 JSON。
- 粘贴到「快速导入」输入框并点击导入：按 name 与现有规则组合并，同名覆盖、其余追加。
- 打开右上角总开关，刷新目标页面即生效；命中情况在规则详情的「最近拦截」中查看。
- 文件方式：使用说明页「数据管理」的导入 / 导出 / 模板。

## 精简导入
最小单位如下即可导入，其余字段自动补默认值（key/id 自动生成、responseType 默认 json、overrideMode 默认 full、limitMethod 默认 ALL）：
\`\`\`json
{
  "groups": [
    {
      "name": "用户接口",
      "enabled": true,
      "rules": [
        {
          "label": "获取用户信息",
          "match": "/v1/*",
          "limitMethod": "GET",
          "overrideTxt": {
            "code": 0,
            "msg": "ok"
          }
        }
      ]
    }
  ]
}
\`\`\`
同样支持：\`{rules: [...]}\`、纯规则数组 \`[{label, match, overrideTxt}]\`、单个规则对象 \`{label, match, overrideTxt}\`；overrideTxt 直接写 JSON 对象即可，导入时自动序列化（也兼容转义后的字符串写法）。match 支持包含匹配（含 * 时按通配符）与正则（filterType: regex）。

## TypeScript 定义
以下是导入格式的 TypeScript 定义，可直接提供给 AI 作为生成规则的类型约束；除 name / label / match 外均可省略，省略时按默认值处理：
\`\`\`ts
type RuleFilterType = 'normal' | 'regex';
type RequestMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ResponseType = 'json' | 'text' | 'file' | 'js' | 'html' | 'css';
type OverrideMode = 'full' | 'incremental';

interface Rule {
  key: string;                        // 任意唯一字符串
  label: string;                      // 规则展示名称
  match: string;                      // 要拦截的地址
  switchOn?: boolean;                 // 默认 true
  filterType?: RuleFilterType;        // 默认 'normal'
  limitMethod?: RequestMethod;        // 默认 'ALL'
  responseType?: ResponseType;        // 默认 'json'
  overrideMode?: OverrideMode;        // 默认 'full'，incremental 仅对 JSON 生效
  overrideTxt?: string;               // 覆盖后的响应体：json/text 为内容字符串，js/html/css 为脚本或静态资源内容（按字面返回）
  overridePayload?: string;           // 覆盖请求体（非 GET 请求），支持 Mock.js 模板
  responseHeaders?: Record<string, string>; // 追加或覆盖的响应头
  responseFileName?: string;          // responseType 为 'file' 时的文件名
  responseFileType?: string;          // 如 'application/json'
  responseFileData?: string;          // 文件内容的 data URL（base64）
  overrideStatus?: number;            // 可选：覆盖响应状态码
  overrideStatusText?: string;        // 可选：覆盖状态文本
  always200?: boolean;                // 可选：命中时强制 200
  overrideResponseFunc?: string;      // 专业模式：响应处理函数字符串
}

interface RuleGroup {
  id: string;                         // 任意唯一字符串
  name: string;                       // 分组名称
  enabled: boolean;                   // 分组启用状态
  rules: Rule[];
}

interface ExportData {
  version: 1;                         // 格式版本号
  groups: RuleGroup[];
}
\`\`\`

## Mock.js 数据模板
响应体（json / text）完整支持 Mock.js 语法，命中规则的响应每次请求都会随机生成：
\`\`\`json
{
  "code": 0,
  "data": {
    "name": "@cname",
    "email": "@email",
    "age": "@integer(18,60)",
    "list|1-5": [{ "id|+1": 1, "title": "@ctitle" }]
  }
}
\`\`\`
- \`@cname\`、\`@email\`、\`@integer(18,60)\`、\`@date\`、\`@image\` 等全部 Mock.js 占位符可用，语法以 Mock.js 官方文档为准。
- 支持数据模板：\`"list|1-5"\`（随机条数）、\`"id|+1"\`（自增）、\`"price|10-99.2"\`（范围小数）等。
- 不含占位符与模板键的内容原样返回；请求体覆盖 overridePayload 同样支持上述模板语法。
- 内置 Mock.js 已挂到页面 \`window.Mock\`：规则内容（响应/请求体）与专家函数中可直接调用 \`Mock.mock(...)\`、\`Mock.Random.xxx()\` 等。

## JS / HTML / CSS 响应格式
responseType 为 'js' / 'html' / 'css' 时，overrideTxt 填对应内容，命中后按字面返回（适合拦截 .js/.html/.css 静态资源请求并替换内容）：
\`\`\`js
// responseType 'js'：替换页面加载的某个脚本
console.log('mocked script loaded');
window.__MOCK_FLAG__ = true;
\`\`\`
- 内容不做 Mock 模板处理，按字面返回；需要动态数据时用 responseType 'json'/'text' 或专家模式。
- Content-Type 缺省：js → application/javascript，html → text/html，css → text/css，可用 responseHeaders 覆盖。

## 注意事项
- 导入按 name 合并：与现有规则组同名时覆盖该组全部内容，不同名则追加为新分组，不影响其他分组。
- key / id 可为任意字符串，导入时会自动规范化，旧版扩展导出的数据同样兼容。`,
    copy: '复制',
    usageQuickTitle: '快速操作',
    usageQuickDescription: '复制使用说明或格式模板给 AI，由 AI 按数据格式生成 override 规则',
    usageCopyDoc: '复制使用说明',
    usageClearAll: '清空全部规则组',
    usageClearConfirm: '确认清空全部规则组？',
    usageCopied: '已复制到剪贴板',
    usageCopyFailed: '复制失败，请手动选择复制',
    usageImportTitle: '快速导入',
    usageImportHint: '将 AI 生成的规则 JSON 粘贴到下方并导入；按 name 与现有规则组合并，同名覆盖、其余追加',
    usageImportPlaceholder: '粘贴 AI 生成的规则 JSON 后点击导入…',
    usageDataHint: '导出当前全部规则组为 JSON 备份，或下载模板查看数据格式。',
    usageDocTitle: '操作说明',
    usageDocHint: '快速导入流程与面向 AI 的规则格式',
    openSidePanel: '打开侧边栏',
    sidePanelUnavailable: '当前页面无法打开侧边栏',
    adminDescription: '配置面板显示位置和运行方式',
    language: '语言',
    languageDescription: '选择界面显示语言',
    theme: '主题',
    themeDescription: '选择浅色或深色主题',
    autoSave: '自动保存',
    autoSaveDescription: '修改后立即生效，无需手动确认',
    enabled: '已启用',
    disabled: '已禁用',
    groups: '规则组',
    addGroup: '新建分组',
    addRule: '新建规则',
    noRules: '暂无规则',
    batch: '批量',
    selectAll: '全选',
    confirmBatchDelete: '确认删除选中的规则组？',
    groupName: '分组名称',
    ruleName: '规则名称',
    save: '保存',
    unsavedHint: '有未保存的修改',
    backDiscardHint: '返回将放弃这些修改',
    discardAndBack: '放弃并返回',
    saveAndBack: '保存并返回',
    batchEdit: '批量编辑',
    batchEditHint: '每行一条参数，格式为 key=value，确认后写回匹配地址',
    addParam: '添加参数',
    paramRegexHint: '正则匹配模式下不支持 Query 参数表格，可直接在匹配地址中书写',
    tabBody: 'Body',
    tabHeaders: 'Headers',
    match: '匹配地址',
    filter: '匹配方式',
    method: '请求方法',
    response: '响应内容',
    headers: '响应 Headers',
    matchBody: 'Body 匹配',
    matchBodyHint: '按请求体内容区分同一地址的不同请求，匹配方式跟随上方（包含/正则），留空不校验。内容为完整 JSON 时自动按结构比较（忽略空格与键序，规则对象为请求体子集即命中）。规则遍历时配置了 Body 匹配且命中的优先改写，未配置的仅作兜底。',
    requestCard: '请求拦截 —— 拦截页面请求后，按规则进行匹配',
    responseCard: '响应拦截 —— 拦截响应后，按规则修改返回内容',
    matchLog: '日志',
    matchLogEmpty: '暂无记录。页面发起一次请求后，这里会显示规则判定结果（命中哪条或未命中）。',
    matchLogClear: '清空匹配日志',
    matchLogOnlyHit: '只看命中',
    matchHit: '命中',
    matchMiss: '未命中',
    scriptStatus: '页面脚本',
    statusOn: '总开关已开启',
    statusOff: '总开关已关闭',
    configSource: '配置来源',
    sourceService: '桌面服务',
    sourceStorage: '扩展存储',
    matchRulesHint: '未命中时显示匹配时刻页面脚本实际持有的规则数；与面板规则数对不上说明脚本拿到的配置不是面板这份',
    normal: '包含',
    regex: '正则',
    all: '全部',
    export: '导出',
    import: '导入',
    importFromFile: '从文件导入',
    template: '下载模板',
    dataManagement: '数据管理',
    manage: '管理',
    openAdmin: '打开管理',
    delete: '删除',
    position: '面板位置',
    positionDescription: '选择扩展面板打开的位置',
    floating: '页面悬浮',
    devtools: 'DevTools',
    refresh: '修改后请刷新页面并重新打开面板。',
    on: '总开关',
    intercepted: '最近拦截',
    noIntercepted: '尚未捕获请求',
    confirmDelete: '确认删除这个分组？',
    confirmDeleteRule: '确认删除这条规则？',
    themeLight: '浅色',
    themeDark: '深色',
    importSuccess: '导入成功',
    invalidFile: '文件格式无效',
    responseType: '响应格式',
    jsHint: '返回 JavaScript 脚本内容（按字面响应，不做 Mock 模板处理），Content-Type 缺省 application/javascript，可用响应 Headers 覆盖。',
    chooseFile: '选择文件',
    noFile: '尚未选择文件',
    detail: '详情',
    back: '返回',
    active: '状态',
    actions: '操作',
    count: '规则数',
    rename: '重命名',
    moveToTop: '置顶',
    moveToBottom: '置底',
    cancel: '取消',
    confirm: '确定',
    groupOn: '启用分组',
    ruleOn: '启用规则',
    enable: '启用',
    disable: '禁用',
    full: '全量覆盖',
    incremental: '增量覆盖',
    incrementalHint: '增量覆盖仅适用于 JSON，会保留原响应中未修改的字段。',
    collapse: '折叠侧边栏',
    expand: '展开侧边栏',
    current: '当前分组',
    fileHint: '支持 JSON、文本、图片等文件；文件内容会保存到扩展配置中。',
    headersHint: '使用 JSON 对象，例如 {"Content-Type":"application/json"}。',
    format: '格式化',
    invalidJson: 'JSON 格式无效，无法格式化',
    admin: '面板设置',
    interface: '界面设置',
    emptyGroup: '这个分组还没有规则。',
    commonSettings: '常用设置',
    advancedSettings: '高级设置',
    system: '系统',
    customGroups: '自定义分组',
    more: '更多',
    localProxy: '全局 API Override',
    localProxyDescription: '通过本地服务接管 hosts 映射的请求，不依赖浏览器插件。',
    serviceStatus: '本地服务状态',
    serviceOnline: '已连接',
    serviceOffline: '未连接',
    serviceChecking: '检查中',
    serviceUrl: '控制地址',
    proxyMode: '代理模式',
    proxyModeDescription: '精确模式按规则 URL 走系统代理（PAC），其余请求直连、不写 hosts；全局模式把域名写入 hosts 由本地服务转发。',
    proxyModePac: '精确模式（按规则）',
    proxyModeHosts: '全局模式（hosts）',
    proxyEnabled: '启用全局代理',
    proxyEnabledDescription: '启用后会将下面的域名写入本机 hosts，并由本地服务转发。',
    hostMappings: 'Hosts 映射',
    hostMappingsDescription: '请求域名会指向 127.0.0.1；上游填写真实 API 域名。',
    host: '请求域名',
    upstream: '上游域名',
    protocol: '协议',
    addMapping: '新增映射',
    removeMapping: '删除映射',
    syncHosts: '同步 hosts',
    clearHosts: '清理 hosts',
    refreshService: '刷新状态',
    mappingSaved: '配置已同步到本地服务',
    serviceUnavailable: '无法连接本地服务，请先启动 service。',
    hostsPermission: '写入 hosts 需要管理员权限。',
    http: 'HTTP',
    https: 'HTTPS',
    localProxyHint:
      'Windows hosts: C:\\Windows\\System32\\drivers\\etc\\hosts；macOS hosts: /etc/hosts。HTTPS 接管会使用 mkcert 自动生成本地证书，证书保存在 api-overrides/certs/。'
  },
  'en-US': {
    title: 'API Override',
    rules: 'Rules',
    groupManagement: 'Rule management',
    groupDescription: 'Configure response override rules in this group',
    settings: 'Settings',
    settingsDescription: 'Configure language, theme and display preferences',
    usage: 'Usage guide',
    usageDescription: 'Paste AI-generated rule JSON to configure rules in seconds',
    usageDoc: `API Override is a browser extension that intercepts Ajax/Fetch requests made by web pages and overrides their responses. Core usage: paste rule JSON into "Quick import" on this page; rule construction can be handed to an AI assistant.

## Quick import
- Copy the "Minimal import" and "TypeScript definition" sections below to the AI; it generates rule JSON following the format.
- Paste the JSON into "Quick import" and click Import: groups are merged by name — same name overwrites, others are appended.
- Turn on the global switch and refresh the target page; matched requests are listed under "Recent interceptions" in the rule details.
- File based: use Import / Export / Template in the "Data management" section of this usage page.

## Minimal import
The smallest importable unit; every omitted field falls back to its default (key/id auto-generated, responseType json, overrideMode full, limitMethod ALL):
\`\`\`json
{
  "groups": [
    {
      "name": "User APIs",
      "enabled": true,
      "rules": [
        {
          "label": "Get user info",
          "match": "/v1/*",
          "limitMethod": "GET",
          "overrideTxt": {
            "code": 0,
            "msg": "ok"
          }
        }
      ]
    }
  ]
}
\`\`\`
Also accepted: \`{rules: [...]}\`, a bare array of rules \`[{label, match, overrideTxt}]\`, or a single rule object \`{label, match, overrideTxt}\`; overrideTxt can be a JSON object and is serialized automatically (escaped-string form is still accepted). match supports contains (a match containing * is treated as a wildcard) and regex (filterType: regex).

## TypeScript definition
The TypeScript definition of the import format, to hand to the AI as a type constraint; everything except name / label / match is optional and falls back to defaults:
\`\`\`ts
type RuleFilterType = 'normal' | 'regex';
type RequestMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ResponseType = 'json' | 'text' | 'file' | 'js' | 'html' | 'css';
type OverrideMode = 'full' | 'incremental';

interface Rule {
  key: string;                        // any unique string
  label: string;                      // display name
  match: string;                      // URL to intercept
  switchOn?: boolean;                 // default true
  filterType?: RuleFilterType;        // default 'normal'
  limitMethod?: RequestMethod;        // default 'ALL'
  responseType?: ResponseType;        // default 'json'
  overrideMode?: OverrideMode;        // default 'full'; incremental applies to JSON only
  overrideTxt?: string;               // overridden response body: content string for json/text, script/static content for js/html/css (returned literally)
  overridePayload?: string;           // overridden request body (non-GET requests), Mock.js templates supported
  responseHeaders?: Record<string, string>; // headers to append or override
  responseFileName?: string;          // file name when responseType is 'file'
  responseFileType?: string;          // e.g. 'application/json'
  responseFileData?: string;          // file content as base64 data URL
  overrideStatus?: number;            // optional: override status code
  overrideStatusText?: string;        // optional: override status text
  always200?: boolean;                // optional: force 200 when matched
  overrideResponseFunc?: string;      // expert mode: response handler function string
}

interface RuleGroup {
  id: string;                         // any unique string
  name: string;                       // group name
  enabled: boolean;                   // group enabled state
  rules: Rule[];
}

interface ExportData {
  version: 1;                         // format version
  groups: RuleGroup[];
}
\`\`\`

## Mock.js data templates
Response bodies (json / text) fully support Mock.js syntax; each intercepted response is randomly generated per request:
\`\`\`json
{
  "code": 0,
  "data": {
    "name": "@cname",
    "email": "@email",
    "age": "@integer(18,60)",
    "list|1-5": [{ "id|+1": 1, "title": "@ctitle" }]
  }
}
\`\`\`
- All Mock.js placeholders work: \`@cname\`, \`@email\`, \`@integer(18,60)\`, \`@date\`, \`@image\`, etc. Syntax follows the official Mock.js docs.
- Data template rules are supported: \`"list|1-5"\` (random count), \`"id|+1"\` (auto increment), \`"price|10-99.2"\` (ranged float), etc.
- Content without placeholders or template keys is returned as-is; the request-body override (overridePayload) supports the same template syntax.
- The bundled Mock.js is exposed as \`window.Mock\` on the page: rule content (response / request body) and expert functions can call \`Mock.mock(...)\`, \`Mock.Random.xxx()\`, etc.

## JS / HTML / CSS response types
When responseType is 'js' / 'html' / 'css', overrideTxt holds the corresponding content returned as-is on match (useful for intercepting .js/.html/.css static requests and replacing the content):
\`\`\`js
// responseType 'js': replace a script loaded by the page
console.log('mocked script loaded');
window.__MOCK_FLAG__ = true;
\`\`\`
- Content is not processed as a Mock template; it is returned literally. For dynamic data use responseType 'json'/'text' or expert mode.
- Default Content-Type: js → application/javascript, html → text/html, css → text/css; override with responseHeaders.

## Notes
- Import merges by name: a group with the same name is fully replaced, groups with new names are appended; other groups are untouched.
- key / id accept any string and are normalized on import; data exported by the legacy extension is also compatible.`,
    copy: 'Copy',
    usageQuickTitle: 'Quick actions',
    usageQuickDescription: 'Copy the guide or format template for the AI; the AI generates override rules following the data format',
    usageCopyDoc: 'Copy usage guide',
    usageClearAll: 'Clear all rule groups',
    usageClearConfirm: 'Clear all rule groups?',
    usageCopied: 'Copied to clipboard',
    usageCopyFailed: 'Copy failed, please copy manually',
    usageImportTitle: 'Quick import',
    usageImportHint: 'Paste the rule JSON generated by the AI below and import; groups merge by name — same name overwrites, others are appended',
    usageImportPlaceholder: 'Paste the AI-generated rule JSON here, then click Import…',
    usageDataHint: 'Export all rule groups as a JSON backup, or download the template to see the data format.',
    usageDocTitle: 'Guide',
    usageDocHint: 'Quick import workflow and the AI-oriented rule format',
    openSidePanel: 'Open side panel',
    sidePanelUnavailable: 'Side panel is unavailable on this page',
    adminDescription: 'Configure panel placement and runtime behavior',
    language: 'Language',
    languageDescription: 'Choose the interface language',
    theme: 'Theme',
    themeDescription: 'Choose a light or dark theme',
    autoSave: 'Auto save',
    autoSaveDescription: 'Apply edits immediately without confirmation',
    enabled: 'Enabled',
    disabled: 'Disabled',
    groups: 'Rule groups',
    addGroup: 'New group',
    addRule: 'New rule',
    noRules: 'No rules',
    batch: 'Batch',
    selectAll: 'Select all',
    confirmBatchDelete: 'Delete selected rule groups?',
    groupName: 'Group name',
    ruleName: 'Rule name',
    save: 'Save',
    unsavedHint: 'You have unsaved changes',
    backDiscardHint: 'Going back will discard these changes',
    discardAndBack: 'Discard and go back',
    saveAndBack: 'Save and go back',
    batchEdit: 'Batch edit',
    batchEditHint: 'One param per line, in key=value format; confirmed changes are written back to the match URL',
    addParam: 'Add param',
    paramRegexHint: 'Query params table is unavailable in regex mode; write the query directly in the match URL',
    tabBody: 'Body',
    tabHeaders: 'Headers',
    match: 'Match URL',
    filter: 'Match type',
    method: 'Method',
    response: 'Response',
    headers: 'Response headers',
    matchBody: 'Body match',
    matchBodyHint:
      'Distinguishes requests to the same URL by their body, using the match mode above (contains / regex). Leave empty to skip. When both sides parse as JSON they are compared structurally (whitespace and key order ignored; the rule object may be a subset of the body). Rules with a body condition take priority when matched; rules without one only act as fallback.',
    requestCard: 'Request — rules are matched after the request is intercepted',
    responseCard: 'Response — the returned content is modified after interception',
    matchLog: 'Log',
    matchLogEmpty: 'No entries yet. Send a request on the page and the match decision (which rule hit, or none) shows up here.',
    matchLogClear: 'Clear match log',
    matchLogOnlyHit: 'Hits only',
    matchHit: 'hit',
    matchMiss: 'miss',
    scriptStatus: 'Page script',
    statusOn: 'master switch on',
    statusOff: 'master switch off',
    configSource: 'Config source',
    sourceService: 'desktop service',
    sourceStorage: 'extension storage',
    matchRulesHint: 'On a miss this shows how many rules the page script actually held at match time; if it differs from the panel, the script is not using the panel rules',
    normal: 'Contains',
    regex: 'Regex',
    all: 'All',
    export: 'Export',
    import: 'Import',
    importFromFile: 'Import from file',
    template: 'Download template',
    dataManagement: 'Data management',
    manage: 'Manage',
    openAdmin: 'Open management',
    delete: 'Delete',
    position: 'Panel position',
    positionDescription: 'Choose where the extension panel opens',
    floating: 'Floating',
    devtools: 'DevTools',
    refresh: 'Refresh the page and reopen the panel after changing this option.',
    on: 'Global switch',
    intercepted: 'Recent interceptions',
    noIntercepted: 'No request captured',
    confirmDelete: 'Delete this group?',
    confirmDeleteRule: 'Delete this rule?',
    themeLight: 'Light',
    themeDark: 'Dark',
    importSuccess: 'Imported',
    invalidFile: 'Invalid file',
    responseType: 'Response type',
    jsHint: 'Returns the JavaScript script content as-is (no Mock template processing); the default Content-Type is application/javascript and can be overridden via response headers.',
    chooseFile: 'Choose file',
    noFile: 'No file selected',
    detail: 'Details',
    back: 'Back',
    active: 'Status',
    actions: 'Actions',
    count: 'Rules',
    rename: 'Rename',
    moveToTop: 'Move to top',
    moveToBottom: 'Move to bottom',
    cancel: 'Cancel',
    confirm: 'Confirm',
    groupOn: 'Group enabled',
    ruleOn: 'Rule enabled',
    enable: 'Enable',
    disable: 'Disable',
    full: 'Full override',
    incremental: 'Incremental override',
    incrementalHint: 'Incremental override is only available for JSON and keeps fields not changed in the response.',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
    current: 'Current group',
    fileHint: 'JSON, text and binary files are supported; file content is stored in extension settings.',
    headersHint: 'Use a JSON object, for example {"Content-Type":"application/json"}.',
    format: 'Format',
    invalidJson: 'Invalid JSON, cannot format',
    admin: 'Panel settings',
    interface: 'Interface settings',
    emptyGroup: 'This group has no rules yet.',
    commonSettings: 'Common',
    advancedSettings: 'Advanced',
    system: 'System',
    customGroups: 'Custom groups',
    more: 'More',
    localProxy: 'Global API Override',
    localProxyDescription: 'Route hosts mappings through a local service without browser extension limits.',
    serviceStatus: 'Local service',
    serviceOnline: 'Connected',
    serviceOffline: 'Not connected',
    serviceChecking: 'Checking',
    serviceUrl: 'Control URL',
    proxyMode: 'Proxy mode',
    proxyModeDescription:
      'Precise mode routes only rule-matched URLs through the system proxy (PAC); everything else stays direct and no hosts entries are written. Global mode redirects whole domains via the hosts file.',
    proxyModePac: 'Precise (per rule)',
    proxyModeHosts: 'Global (hosts)',
    proxyEnabled: 'Enable global proxy',
    proxyEnabledDescription: 'Enabled mappings are written to the local hosts file and handled by the local service.',
    hostMappings: 'Hosts mappings',
    hostMappingsDescription: 'Requests are routed to 127.0.0.1; upstream is the real API host.',
    host: 'Request host',
    upstream: 'Upstream host',
    protocol: 'Protocol',
    addMapping: 'Add mapping',
    removeMapping: 'Remove mapping',
    syncHosts: 'Sync hosts',
    clearHosts: 'Clear hosts',
    refreshService: 'Refresh status',
    mappingSaved: 'Configuration synced',
    serviceUnavailable: 'Cannot connect to local service. Start service first.',
    hostsPermission: 'Writing hosts requires administrator privileges.',
    http: 'HTTP',
    https: 'HTTPS',
    localProxyHint:
      'Windows hosts: C:\\Windows\\System32\\drivers\\etc\\hosts; macOS hosts: /etc/hosts. HTTPS interception uses mkcert and stores the local certificate in api-overrides/certs/.'
  }
};
