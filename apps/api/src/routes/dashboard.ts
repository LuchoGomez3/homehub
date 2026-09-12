import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  const familyPrisma = fastify.familyPrisma(request => request.family!.id);

  // Dashboard summary
  fastify.get('/', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ expensesThisMonth: Type.Number(), billsPending: Type.Number(), billsOverdue: Type.Number(), todosPending: Type.Number(), todosUrgent: Type.Number(), shoppingPending: Type.Number(), upcomingEvents: Type.Number(), recentExpenses: Type.Array(Type.Object({ id: Type.String(), amount: Type.Number(), category: Type.String(), date: Type.String() })), upcomingBills: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), amount: Type.Number(), dueDate: Type.String(), status: Type.String() })), urgentTodos: Type.Array(Type.Object({ id: Type.String(), title: Type.String(), priority: Type.String(), dueDate: Type.Union([Type.String(), Type.Null()]) })), shoppingItems: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), category: Type.String() })) }) }) } },
  }, async (request) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      expensesThisMonth,
      billsPending,
      billsOverdue,
      todosPending,
      todosUrgent,
      shoppingPending,
      upcomingEvents,
      recentExpenses,
      upcomingBills,
      urgentTodos,
      shoppingItems,
    ] = await Promise.all([
      familyPrisma.expense.aggregate({
        where: { familyId: request.family!.id, date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      familyPrisma.bill.count({ where: { familyId: request.family!.id, status: 'PENDING' } }),
      familyPrisma.bill.count({ where: { familyId: request.family!.id, status: 'OVERDUE' } }),
      familyPrisma.todo.count({ where: { familyId: request.family!.id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      familyPrisma.todo.count({ where: { familyId: request.family!.id, priority: 'URGENT', status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      familyPrisma.shoppingItem.count({ where: { familyId: request.family!.id, isDone: false } }),
      familyPrisma.event.count({ where: { familyId: request.family!.id, startDate: { gte: now, lte: weekFromNow } } }),
      familyPrisma.expense.findMany({
        where: { familyId: request.family!.id },
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, amount: true, category: true, date: true },
      }),
      familyPrisma.bill.findMany({
        where: { familyId: request.family!.id, status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: { id: true, name: true, amount: true, dueDate: true, status: true },
      }),
      familyPrisma.todo.findMany({
        where: { familyId: request.family!.id, priority: 'URGENT', status: { in: ['PENDING', 'IN_PROGRESS'] } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: { id: true, title: true, priority: true, dueDate: true },
      }),
      familyPrisma.shoppingItem.findMany({
        where: { familyId: request.family!.id, isDone: false },
        orderBy: { category: 'asc' },
        take: 10,
        select: { id: true, name: true, category: true },
      }),
    ]);

    return {
      success: true,
      data: {
        expensesThisMonth: Number(expensesThisMonth._sum.amount || 0),
        billsPending,
        billsOverdue,
        todosPending,
        todosUrgent,
        shoppingPending,
        upcomingEvents,
        recentExpenses: recentExpenses.map(e => ({ ...e, amount: Number(e.amount) })),
        upcomingBills: upcomingBills.map(b => ({ ...b, amount: Number(b.amount) })),
        urgentTodos,
        shoppingItems,
      },
    };
  });

  // Expense trends (last 6 months)
  fastify.get('/expense-trends', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Array(Type.Object({ month: Type.String(), total: Type.Number(), count: Type.Integer() })) }) } },
  }, async (request) => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const expenses = await familyPrisma.expense.findMany({
      where: { familyId: request.family!.id, date: { gte: sixMonthsAgo } },
      select: { amount: true, date: true },
    });

    const byMonth: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const month = new Date(e.date).toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, count: 0 };
      byMonth[month].total += Number(e.amount);
      byMonth[month].count += 1;
    }

    // Fill missing months
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toISOString().slice(0, 7);
      result.push({
        month,
        total: byMonth[month]?.total || 0,
        count: byMonth[month]?.count || 0,
      });
    }

    return { success: true, data: result };
  });
}