import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// 与 useAppState 的 theme 状态联动的 sonner 包装；扩展内没有 next-themes，
// 直接透传当前主题。
function Toaster({ theme, ...props }: ToasterProps & { theme?: 'dark' | 'light' }) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)'
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
