'use client';

import { useTranslation } from 'next-intl';
import { formatCurrency } from '@homehub/ui';
import { CreditCard, FileText, ListTodo, ShoppingCart, Calendar, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@homehub/ui/components/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'default' | 'destructive' | 'success' | 'warning';
}

function StatsCard({ title, value, icon, trend, color = 'default' }: StatsCardProps) {
  const colors = {
    default: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    destructive: 'bg-red-500/10 text-red-600 dark:text-red-400',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend && (
              <p className={`text-sm mt-1 flex items-center gap-1 ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{trend.label}</span>
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-xl', colors[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsCardsProps {
  data: {
    expensesThisMonth: number;
    billsPending: number;
    billsOverdue: number;
    todosPending: number;
    todosUrgent: number;
    shoppingPending: number;
    upcomingEvents: number;
  };
}

export function StatsCards({ data }: StatsCardsProps) {
  const t = useTranslation();

  const cards = [
    {
      title: t('dashboard.expensesThisMonth'),
      value: formatCurrency(data.expensesThisMonth),
      icon: <CreditCard className="h-6 w-6" />,
      color: 'default' as const,
    },
    {
      title: t('dashboard.billsPending'),
      value: data.billsPending,
      icon: <FileText className="h-6 w-6" />,
      color: 'warning' as const,
    },
    {
      title: t('dashboard.billsOverdue'),
      value: data.billsOverdue,
      icon: <AlertTriangle className="h-6 w-6" />,
      color: data.billsOverdue > 0 ? 'destructive' as const : 'success' as const,
    },
    {
      title: t('dashboard.todosPending'),
      value: data.todosPending,
      icon: <ListTodo className="h-6 w-6" />,
      color: 'default' as const,
    },
    {
      title: t('dashboard.shoppingItems'),
      value: data.shoppingPending,
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'success' as const,
    },
    {
      title: t('dashboard.upcomingEvents'),
      value: data.upcomingEvents,
      icon: <Calendar className="h-6 w-6" />,
      color: 'default' as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, index) => (
        <StatsCard key={index} {...card} />
      ))}
    </div>
  );
}