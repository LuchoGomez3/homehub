'use client';

import { useTranslation } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { cn } from '@homehub/ui';

interface ExpenseTrendsProps {}

export function ExpenseChart() {
  const t = useTranslation();

  const { data } = useQuery({
    queryKey: ['expense-trends'],
    queryFn: () => api.getExpenseTrends(),
  });

  if (!data) return null;

  return (
    <Card className="col-span-1 lg:col-span-3 xl:col-span-6">
      <CardHeader>
        <CardTitle>{t('dashboard.expenseTrends') || 'Tendencia de gastos'}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ colors: { primary: 'hsl(var(--primary))', secondary: 'hsl(var(--secondary))' } }}>
          {/* Simplified chart - in production use Recharts */}
          <div className="h-[300px] flex items-end justify-around gap-2 p-4">
            {data.map((item, index) => (
              <div key={item.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${Math.max((item.total / 1000) * 100, 20)}px` }}
                />
                <span className="text-xs text-muted-foreground mt-2">{item.month}</span>
                <span className="text-xs font-medium">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Format currency helper (reuse from ui)
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}