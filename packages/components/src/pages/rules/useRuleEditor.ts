import { useEffect, useRef, useState } from 'react';
import { OVERRIDE_MODE, RESPONSE_TYPE } from '@api-override/core/constants';
import { RULE_REQ_DEFAULT_HEIGHT, RULE_REQ_MAX_HEIGHT, RULE_REQ_MIN_HEIGHT, parseQueryRows, readStoredRuleReqHeight, rowsToMatch } from './constants';
import { saveSetting } from '@/shared/platform';

/**
 * 规则详情编辑器的三块可复用状态：
 * - useRuleDraft：草稿式编辑（字段先改本地草稿，保存或返回时才写入规则）
 * - useParamRows：Query 参数表格与匹配地址 ?query 的双向同步
 * - useReqHeight：请求区高度的拖拽调节与持久化
 */

const headersText = (headers) => JSON.stringify(headers || {}, null, 2);

// 草稿式编辑：切换规则时重置草稿；自动保存开启时字段改动直接写入规则，跳过底部确认
export function useRuleDraft(rule, autoSave, onChange) {
  const [draft, setDraft] = useState(rule);
  const [headersValue, setHeadersValue] = useState(headersText(rule.responseHeaders));
  useEffect(() => {
    setDraft(rule);
    setHeadersValue(headersText(rule.responseHeaders));
  }, [rule.key]); // 切换规则时重置草稿
  const patch = (values) => {
    setDraft((state) => ({ ...state, ...values }));
    if (autoSave) onChange(values);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule) || headersValue !== headersText(rule.responseHeaders);
  const save = () => {
    let headers = draft.responseHeaders;
    try {
      const parsed = JSON.parse(headersValue);
      if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') headers = parsed;
    } catch {}
    setHeadersValue(headersText(headers));
    patch({ responseHeaders: headers });
    onChange({ ...draft, responseHeaders: headers });
  };
  // 放弃修改：草稿回滚到已保存的规则
  const reset = () => {
    setDraft(rule);
    setHeadersValue(headersText(rule.responseHeaders));
  };
  return { draft, patch, dirty, save, reset, headersValue, setHeadersValue };
}

// Query 参数：表格是匹配地址 query 部分的编辑视图；空 key 的行只留在表格里，不拼接进匹配地址
export function useParamRows(match, patch) {
  const [paramRows, setParamRows] = useState(parseQueryRows(match));
  const [lastParamMatch, setLastParamMatch] = useState(match);
  const [batchOpen, setBatchOpen] = useState(false); // Query 参数批量编辑弹窗
  const [batchText, setBatchText] = useState('');
  useEffect(() => {
    if (match !== lastParamMatch) {
      // 匹配地址被直接编辑（URL 输入框），重新解析 query 到表格
      setParamRows(parseQueryRows(match));
      setLastParamMatch(match);
    }
  }, [match]);
  // 表格默认展示一行空参数
  const displayParamRows = paramRows.length > 0 ? paramRows : [{ key: '', value: '' }];
  const writeParamRows = (rows) => {
    setParamRows(rows);
    const next = rowsToMatch(match, rows);
    setLastParamMatch(next);
    patch({ match: next });
  };
  const updateParam = (index, field, value) => writeParamRows(displayParamRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const addParam = () => writeParamRows([...displayParamRows, { key: '', value: '' }]);
  const removeParam = (index) => writeParamRows(displayParamRows.filter((_, i) => i !== index));
  // 批量编辑：每行一条 key=value，确认后写回匹配地址
  const enterBatch = () => {
    setBatchText(displayParamRows.map((row) => `${row.key}=${row.value}`).join('\n'));
    setBatchOpen(true);
  };
  const applyBatch = () => {
    const rows = batchText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const eq = line.indexOf('=');
        return eq === -1 ? { key: line.trim(), value: '' } : { key: line.slice(0, eq).trim(), value: line.slice(eq + 1) };
      });
    writeParamRows(rows);
    setBatchOpen(false);
  };
  return { displayParamRows, updateParam, addParam, removeParam, batchOpen, setBatchOpen, batchText, setBatchText, enterBatch, applyBatch };
}

// 上下拖动分隔线调节请求区高度，松开时持久化；双击恢复默认（并回到内容自适应模式）
export function useReqHeight() {
  const [reqHeight, setReqHeight] = useState(readStoredRuleReqHeight); // 请求区最大高度（分隔线拖拽调节）
  const [reqHeightMode, setReqHeightMode] = useState('auto'); // auto=随内容自适应；拖拽分隔线后进入 fixed 固定高度，双击恢复
  const reqHeightRef = useRef(reqHeight);
  reqHeightRef.current = reqHeight;
  const cardRef = useRef<HTMLDivElement>(null); // 分隔线上方的请求区卡片，拖拽时量测其实际高度
  const startVerticalResize = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    // 以卡片的当前实际高度为基准：自适应模式下内容高度可能远小于存储的上限值，
    // 若直接用存储值起算，一拖动高度就会跳变
    const startHeight = cardRef.current?.getBoundingClientRect().height || reqHeightRef.current;
    const onMove = (moveEvent) => {
      setReqHeightMode('fixed'); // 拖动即切换为固定高度，否则自适应卡片感知不到 maxHeight 变化
      setReqHeight(Math.min(RULE_REQ_MAX_HEIGHT, Math.max(RULE_REQ_MIN_HEIGHT, startHeight + (moveEvent.clientY - startY))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveSetting('ui_rule_request_height', reqHeightRef.current);
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const resetReqHeight = () => {
    setReqHeightMode('auto');
    setReqHeight(RULE_REQ_DEFAULT_HEIGHT);
    saveSetting('ui_rule_request_height', RULE_REQ_DEFAULT_HEIGHT);
  };
  return { reqHeight, reqHeightMode, cardRef, startVerticalResize, resetReqHeight };
}

// 响应文件选择：读取为 dataURL，一键切到 File 覆盖
export function useResponseFile(patch) {
  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      patch({
        responseType: RESPONSE_TYPE.FILE,
        overrideMode: OVERRIDE_MODE.FULL,
        responseFileName: file.name,
        responseFileType: file.type || 'application/octet-stream',
        responseFileData: reader.result
      });
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  return chooseFile;
}
