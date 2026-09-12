'use client';

import { useTranslation } from 'next-intl';
import { formatCurrency } from '@homehub/ui';
import { ArrowUpRight, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';

interface RecentExpensesProps {
  expenses: Array<{ id: string; amount: number; category: string; date: string }>;
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const t = useTranslation();
  const expenseLabels: Record<string, { es: string; en: string }> = {
    FOOD: { es: 'Alimentación', en: 'Food' },
    TRANSPORT: { es: 'Transporte', en: 'Transport' },
    HOUSING: { es: 'Vivienda', en: 'Housing' },
    UTILITIES: { es: 'Servicios', en: 'Utilities' },
    HEALTH: { es: 'Salud', en: 'Health' },
    EDUCATION: { es: 'Educación', en: 'Education' },
    ENTERTAINMENT: { es: 'Entretenimiento', en: 'Entertainment' },
    CLOTHING: { es: 'Ropa', en: 'Clothing' },
    OTHER: { es: 'Otros', en: 'Other' },
  };

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t('dashboard.recentExpenses')}</CardTitle>
        <Link href="/es/expenses" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('common.viewAll')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{t('expenses.noExpenses')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{expenseLabels[expense.category]?.[t.resolvedLocale as 'es' | 'en'] || expense.category}</p>
                    <p className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  -{formatCurrency(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}