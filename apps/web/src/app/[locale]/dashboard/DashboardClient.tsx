'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'next-intl';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RecentExpenses } from '@/components/dashboard/RecentExpenses';
import { UpcomingBills } from '@/components/dashboard/UpcomingBills';
import { UrgentTodos } from '@/components/dashboard/UrgentTodos';
import { ShoppingSummary } from '@/components/dashboard/ShoppingSummary';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { ExpenseChart } from '@/components/dashboard/ExpenseChart';
import { useAuthStore } from '@/stores/auth';
import { useRealtimeStore } from '@/stores/auth';
import { useSocket } from '@/hooks/use-socket';

interface DashboardData {
  expensesThisMonth: number;
  billsPending: number;
  billsOverdue: number;
  todosPending: number;
  todosUrgent: number;
  shoppingPending: number;
  upcomingEvents: number;
  recentExpenses: Array<{ id: string; amount: number; category: string; date: string }>;
  upcomingBills: Array<{ id: string; name: string; amount: number; dueDate: string; status: string }>;
  urgentTodos: Array<{ id: string; title: string; priority: string; dueDate: string | null }>;
  shoppingItems: Array<{ id: string; name: string; category: string }>;
}

export function DashboardClient({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const t = useTranslation();
  const { setAuth, setLoading, isAuthenticated } = useAuthStore();
  const { setExpenses, setBills, setTodos, setShoppingItems, setEvents, setUsers } = useRealtimeStore();
  const [queryClient] = useState(() => new QueryClient());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (initialUser) {
      setAuth({
        user: initialUser,
        family: initialUser.family,
        accessToken: localStorage.getItem('accessToken') || '',
        refreshToken: localStorage.getItem('refreshToken') || '',
      });
    }
    setHydrated(true);
  }, [initialUser, setAuth]);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    enabled: isAuthenticated && hydrated,
  });

  // Initialize socket connection
  useSocket();

  // Sync real-time data
  useEffect(() => {
    if (dashboardData) {
      setExpenses(dashboardData.recentExpenses as any);
      setBills(dashboardData.upcomingBills as any);
      setTodos(dashboardData.urgentTodos as any);
      setShoppingItems(dashboardData.shoppingItems as any);
    }
  }, [dashboardData, setExpenses, setBills, setTodos, setShoppingItems]);

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          </div>
          <StatsCards data={dashboardData!} />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RecentExpenses expenses={dashboardData!.recentExpenses} />
            <UpcomingBills bills={dashboardData!.upcomingBills} />
            <UrgentTodos todos={dashboardData!.urgentTodos} />
            <ShoppingSummary items={dashboardData!.shoppingItems} />
            <UpcomingEvents events={dashboardData!.upcomingEvents} />
            <ExpenseChart />
          </div>
        </div>
      </DashboardLayout>
    </QueryClientProvider>
  );
}