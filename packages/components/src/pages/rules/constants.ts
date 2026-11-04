// 规则组列表宽度可拖拽调节并持久化；低于阈值进入收起（图标）态
export const GROUP_LIST_MIN_WIDTH = 48;
export const GROUP_LIST_MAX_WIDTH = 480;
export const GROUP_LIST_DEFAULT_WIDTH = 320;
export const GROUP_LIST_COLLAPSED_THRESHOLD = 96;
// 规则组拖拽排序：按下后移动超过该阈值即进入拖拽（无需长按），更小的位移视为普通点击
export const GROUP_DRAG_START_MOVE_PX = 5;
export const GROUP_LIST_ITEM_GAP = 4; // 与列表容器 gap-1 保持一致

export const readStoredGroupListWidth = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('api_override_settings') || '{}').ui_group_list_width;
    const width = Number(stored);
    if (Number.isFinite(width)) return Math.min(GROUP_LIST_MAX_WIDTH, Math.max(GROUP_LIST_MIN_WIDTH, width));
  } catch {}
  return GROUP_LIST_DEFAULT_WIDTH;
};

// 规则详情：请求区最大高度可拖拽调节并持久化（双击分隔线恢复默认），内容不足时卡片自适应收窄
export const RULE_REQ_MIN_HEIGHT = 140;
export const RULE_REQ_MAX_HEIGHT = 720;
export const RULE_REQ_DEFAULT_HEIGHT = 320;
export const RULE_RESP_MAX_HEIGHT = 480; // 响应区内容自适应，超出该高度内部滚动

export const readStoredRuleReqHeight = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('api_override_settings') || '{}').ui_rule_request_height;
    const height = Number(stored);
    if (Number.isFinite(height)) return Math.min(RULE_REQ_MAX_HEIGHT, Math.max(RULE_REQ_MIN_HEIGHT, height));
  } catch {}
  return RULE_REQ_DEFAULT_HEIGHT;
};

// Query 参数表是匹配地址 query 部分的结构化视图：编辑表格即改写 match 的 ?query
export const splitMatchQuery = (match) => {
  const index = (match || '').indexOf('?');
  return index === -1 ? [match || '', ''] : [match.slice(0, index), match.slice(index + 1)];
};
export const parseQueryRows = (match) => [...new URLSearchParams(splitMatchQuery(match)[1])].map(([key, value]) => ({ key, value }));
export const rowsToMatch = (match, rows) => {
  const [path] = splitMatchQuery(match);
  const params = new URLSearchParams();
  rows.forEach(({ key, value }) => {
    if (key) params.append(key, value); // key 为空的行不拼接进匹配地址
  });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

// 请求方法下拉配色（参考 API 客户端惯例：彩色底 + 同色文字），整体铺在触发器上；ALL 及未知值回退为中性色
export const METHOD_TRIGGER_COLORS = {
  GET: 'bg-emerald-500/15! text-emerald-500 hover:bg-emerald-500/25!',
  POST: 'bg-orange-500/15! text-orange-400 hover:bg-orange-500/25!',
  PUT: 'bg-sky-500/15! text-sky-500 hover:bg-sky-500/25!',
  PATCH: 'bg-violet-500/15! text-violet-400 hover:bg-violet-500/25!',
  DELETE: 'bg-red-500/15! text-red-500 hover:bg-red-500/25!'
};
export const METHOD_TRIGGER_FALLBACK = 'bg-foreground/15! text-foreground/85 hover:bg-foreground/20!';
