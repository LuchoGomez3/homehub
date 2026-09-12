'use client';

import { useTranslation } from 'next-intl';
import { ArrowUpRight, ShoppingCart, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';
import { Badge } from '@homehub/ui/components/badge';

interface ShoppingSummaryProps {
  items: Array<{ id: string; name: string; category: string }>;
}

const categoryLabels: Record<string, { es: string; en: string }> = {
  PANTRY: { es: 'Despensa', en: 'Pantry' },
  CLEANING: { es: 'Limpieza', en: 'Cleaning' },
  FRESH: { es: 'Frescos', en: 'Fresh' },
  FROZEN: { es: 'Congelados', en: 'Frozen' },
  BEVERAGES: { es: 'Bebidas', en: 'Beverages' },
  PERSONAL_CARE: { es: 'Cuidado Personal', en: 'Personal Care' },
  PET: { es: 'Mascotas', en: 'Pet' },
  OTHER: { es: 'Otros', en: 'Other' },
};

export function ShoppingSummary({ items }: ShoppingSummaryProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t('dashboard.shoppingItems')}</CardTitle>
        <Link href="/es/shopping" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('common.viewAll')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{t('shopping.noItems')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{item.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[item.category]?.[t.resolvedLocale as 'es' | 'en'] || item.category}
                </Badge>
              </div>
            ))}
            {items.length > 8 && (
              <Link href="/es/shopping" className="text-sm text-primary hover:underline block text-center mt-2">
                +{items.length - 8} {t('common.more')}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}