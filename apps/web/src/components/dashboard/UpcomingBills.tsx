'use client';

import { useTranslation } from 'next-intl';
import { formatCurrency } from '@homehub/ui';
import { ArrowUpRight, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';
import { Badge } from '@homehub/ui/components/badge';

interface UpcomingBillsProps {
  bills: Array<{ id: string; name: string; amount: number; dueDate: string; status: string }>;
}

export function UpcomingBills({ bills }: UpcomingBillsProps) {
  const t = useTranslation();

  const statusConfig = {
    PENDING: { label: t('bills.statuses.PENDING'), icon: Clock, color: 'default' as const },
    OVERDUE: { label: t('bills.statuses.OVERDUE'), icon: AlertCircle, color: 'destructive' as const },
    PAID: { label: t('bills.statuses.PAID'), icon: CheckCircle, color: 'success' as const },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t('dashboard.upcomingBills')}</CardTitle>
        <Link href="/es/bills" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('common.viewAll')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('bills.noBills')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.slice(0, 5).map((bill) => {
              const config = statusConfig[bill.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const Icon = config.icon;
              const isOverdue = bill.status === 'OVERDUE';
              return (
                <div key={bill.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-muted'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(bill.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.color}>{config.label}</Badge>
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : ''}`}>
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}