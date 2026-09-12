'use client';

import * as React from 'react';
import { cn } from '@homehub/ui';

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { config?: { colors?: Record<string, string> } }
>(({ className, children, config, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('w-full h-full', className)}
      style={{ ...config?.colors } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
});
ChartContainer.displayName = 'ChartContainer';

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('border bg-background p-2 rounded shadow', className)} {...props} />
));
ChartTooltip.displayName = 'ChartTooltip';

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('grid gap-1', className)} {...props} />
));
ChartTooltipContent.displayName = 'ChartTooltipContent';

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-wrap gap-4', className)} {...props} />
));
ChartLegend.displayName = 'ChartLegend';

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-1.5', className)} {...props} />
));
ChartLegendContent.displayName = 'ChartLegendContent';

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent };