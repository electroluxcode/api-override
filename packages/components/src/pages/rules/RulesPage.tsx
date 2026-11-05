import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { GroupListPane } from './GroupListPane';
import { RuleEditor } from './RuleEditor';
import { RuleTable } from './RuleTable';

export function RulesPage({
  groups,
  group,
  activeGroupId,
  detailRule,
  t,
  theme,
  autoSave,
  intercepted,
  addRule,
  updateRule,
  removeRule,
  duplicateRule,
  setDetailRuleKey,
  onSelectGroup,
  onAddGroup,
  onRenameGroup,
  onReorderGroups,
  onToggleGroup,
  onDeleteGroup,
  onBatchEnable,
  onBatchDelete
}) {
  // 单击右侧分组标题进入行内重命名（hook 须在提前 return 之前）
  const [titleRenaming, setTitleRenaming] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const commitTitleRename = () => {
    const name = titleValue.trim();
    if (name && group) onRenameGroup(group.id, name);
    setTitleRenaming(false);
  };
  if (!group)
    return (
      <main className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{t.noRules}</p>
          <Button type="button" onClick={onAddGroup}>
            <PlusIcon />
            {t.addGroup}
          </Button>
        </div>
      </main>
    );
  return (
    <main className="flex h-full min-h-0">
      {/* 进入规则详情时隐藏规则组侧栏，让详情占满整个页面容器 */}
      {!detailRule && (
        <GroupListPane
          groups={groups}
          activeGroupId={activeGroupId}
          t={t}
          onSelect={onSelectGroup}
          onAdd={onAddGroup}
          onRename={onRenameGroup}
          onReorderGroups={onReorderGroups}
          onToggle={onToggleGroup}
          onDelete={onDeleteGroup}
          onBatchEnable={onBatchEnable}
          onBatchDelete={onBatchDelete}
        />
      )}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {detailRule ? (
          <RuleEditor
            key={detailRule.key}
            rule={detailRule}
            t={t}
            theme={theme}
            autoSave={autoSave}
            intercepted={intercepted[detailRule.match]}
            onChange={(patch) => updateRule(detailRule.key, patch)}
            onDelete={() => removeRule(group.id, detailRule.key)}
            onBack={() => setDetailRuleKey(null)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
              <div className="min-w-0">
                {titleRenaming ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      className="h-8 w-56"
                      value={titleValue}
                      onChange={(event) => setTitleValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitTitleRename();
                        if (event.key === 'Escape') setTitleRenaming(false);
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={commitTitleRename} title={t.confirm}>
                      <CheckIcon />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTitleRenaming(false)} title={t.cancel}>
                      <XIcon />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h2
                      className="cursor-pointer truncate text-base font-semibold hover:text-foreground/80"
                      title={group.name}
                      onClick={() => {
                        setTitleValue(group.name || '');
                        setTitleRenaming(true);
                      }}
                    >
                      {group.name}
                    </h2>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{group.enabled ? t.enabled : t.disabled}</span>
                  <Switch checked={group.enabled} onCheckedChange={() => onToggleGroup(group.id)} aria-label={t.groupOn} />
                </label>
                <Button type="button" size="sm" onClick={addRule}>
                  <PlusIcon />
                  {t.addRule}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <RuleTable
                rules={group.rules}
                t={t}
                onOpen={setDetailRuleKey}
                onToggle={(key) => {
                  const rule = group.rules.find((item) => item.key === key);
                  updateRule(key, { switchOn: rule?.switchOn === false });
                }}
                onDelete={(key) => removeRule(group.id, key)}
                onRename={(key, label) => updateRule(key, { label })}
                onDuplicate={(key) => duplicateRule(group.id, key)}
                emptyAction={addRule}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
