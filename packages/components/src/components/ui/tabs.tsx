import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Root 用 forwardRef 转发引用：卡片式用法（如规则编辑器）需要拿到根元素量测实际高度
const Tabs = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof TabsPrimitive.Root>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Root ref={ref} className={cn('flex flex-col gap-2', className)} {...props} />
);
Tabs.displayName = 'Tabs';

function TabsList({ className, variant = 'block', ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: 'block' | 'line' }) {
  return (
    <TabsPrimitive.List
      className={cn(
        variant === 'line' ? 'flex w-full items-center gap-4 border-b px-3 text-muted-foreground' : 'flex items-center gap-1 border-b px-2 py-1.5 text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  variant = 'block',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { variant?: 'block' | 'line' }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center gap-1.5 text-sm whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        variant === 'line'
          ? '-mb-px rounded-none border-b-2 border-transparent px-1 py-2.5 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none'
          : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-muted data-[state=active]:font-medium data-[state=active]:text-foreground',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('flex-1 outline-none', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
