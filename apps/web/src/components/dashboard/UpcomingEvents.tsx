'use client';

import { useTranslation } from 'next-intl';
import { ArrowUpRight, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';
import { Badge } from '@homehub/ui/components/badge';

interface UpcomingEventsProps {
  events: number;
}

export function UpcomingEvents({ events }: UpcomingEventsProps) {
  const t = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t('dashboard.upcomingEvents')}</CardTitle>
        <Link href="/es/calendar" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('common.viewAll')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {events === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{t('calendar.noEvents')}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{events}</p>
              <p className="text-sm text-muted-foreground">{t('calendar.upcomingEvents') || 'próximos eventos'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}