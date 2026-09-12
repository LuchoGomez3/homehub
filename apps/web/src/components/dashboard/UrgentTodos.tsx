'use client';

import { useTranslation } from 'next-intl';
import { ArrowUpRight, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@homehub/ui/components/card';
import { Badge } from '@homehub/ui/components/badge';

interface UrgentTodosProps {
  todos: Array<{ id: string; title: string; priority: string; dueDate: string | null }>;
}

export function UrgentTodos({ todos }: UrgentTodosProps) {
  const t = useTranslation();

  const priorityConfig = {
    URGENT: { label: t('todos.priorities.URGENT'), icon: AlertTriangle, color: 'destructive' as const },
    HIGH: { label: t('todos.priorities.HIGH'), icon: AlertTriangle, color: 'destructive' as const },
    MEDIUM: { label: t('todos.priorities.MEDIUM'), icon: Clock, color: 'warning' as const },
    LOW: { label: t('todos.priorities.LOW'), icon: Clock, color: 'default' as const },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{t('dashboard.urgentTodos')}</CardTitle>
        <Link href="/es/todos" className="text-sm text-primary hover:underline flex items-center gap-1">
          {t('common.viewAll')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('todos.noTodos')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todos.slice(0, 5).map((todo) => {
              const config = priorityConfig[todo.priority as keyof typeof priorityConfig] || priorityConfig.MEDIUM;
              const Icon = config.icon;
              const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date();
              return (
                <div key={todo.id} className="flex items-start justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color === 'destructive' ? 'bg-red-100 text-red-600' : 'bg-muted'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{todo.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={config.color}>{config.label}</Badge>
                        {todo.dueDate && (
                          <Badge variant={isOverdue ? 'destructive' : 'default'}>
                            {new Date(todo.dueDate).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>
                    </div>
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