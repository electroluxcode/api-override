import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function PreferencesPage({ t, theme, setTheme, autoSave, setAutoSave }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.settings}</div>
        <h2 className="mt-1 text-xl font-semibold">{t.settings}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.settingsDescription}</p>
      </div>
      <section className="overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium">{t.settings}</div>
          <div className="text-xs text-muted-foreground">{t.settingsDescription}</div>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">{t.theme}</span>
            <small className="text-xs text-muted-foreground">{t.themeDescription}</small>
          </div>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t.themeLight}</SelectItem>
              <SelectItem value="dark">{t.themeDark}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 border-t p-4">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">{t.autoSave}</span>
            <small className="text-xs text-muted-foreground">{t.autoSaveDescription}</small>
          </div>
          <Switch checked={autoSave} onCheckedChange={setAutoSave} aria-label={t.autoSave} />
        </div>
      </section>
    </main>
  );
}
