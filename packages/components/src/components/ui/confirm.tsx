import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

// 将 window.confirm 升级为 AlertDialog 的 Promise 化封装：
// App 外层包 Provider，任意 hooks（如 useAppState）通过 useConfirm 调用。
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = React.useCallback<ConfirmFn>(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    []
  );
  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(state)} onOpenChange={(open) => !open && settle(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title || state?.description}</AlertDialogTitle>
            {state?.title && state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{state?.cancelLabel || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction className={state?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''} onClick={() => settle(true)}>
              {state?.confirmLabel || 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = React.useContext(ConfirmContext);
  if (!context) return async () => window.confirm('Confirm?');
  return context;
}
