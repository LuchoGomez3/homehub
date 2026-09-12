import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { createExpenseSchema, updateExpenseSchema, expenseFiltersSchema, ExpenseCategory, Recurrence } from '@homehub/shared';

const createExpenseBody = Type.Object({
  amount: Type.Number({ minimum: 0.01, multipleOf: 0.01 }),
  category: Type.Union(Object.values(ExpenseCategory).map(v => Type.Literal(v))),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  date: Type.String({ format: 'date-time' }),
  isRecurring: Type.Optional(Type.Boolean({ default: false })),
  recurrence: Type.Optional(Type.Union(Object.values(Recurrence).map(v => Type.Literal(v)))),
});

const updateExpenseBody = Type.Object({
  amount: Type.Optional(Type.Number({ minimum: 0.01, multipleOf: 0.01 })),
  category: Type.Optional(Type.Union(Object.values(ExpenseCategory).map(v => Type.Literal(v)))),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  date: Type.Optional(Type.String({ format: 'date-time' })),
  isRecurring: Type.Optional(Type.Boolean()),
  recurrence: Type.Optional(Type.Union(Object.values(Recurrence).map(v => Type.Literal(v)))),
});

const expenseQuery = Type.Object({
  category: Type.Optional(Type.Union(Object.values(ExpenseCategory).map(v => Type.Literal(v)))),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
  minAmount: Type.Optional(Type.Number({ multipleOf: 0.01 })),
  maxAmount: Type.Optional(Type.Number({ multipleOf: 0.01 })),
  isRecurring: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sortBy: Type.Optional(Type.Union([Type.Literal('date'), Type.Literal('amount'), Type.Literal('category'), Type.Literal('createdAt')])),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

const expenseResponse = Type.Object({
  id: Type.String(),
  amount: Type.Number(),
  category: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  date: Type.String(),
  isRecurring: Type.Boolean(),
  recurrence: Type.Union([Type.String(), Type.Null()]),
  userId: Type.String(),
  user: Type.Object({ id: Type.String(), name: Type.String(), avatar: Type.Union([Type.String(), Type.Null()]) }),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const paginatedExpenseResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    data: Type.Array(expenseResponse),
    meta: Type.Object({
      page: Type.Integer(),
      limit: Type.Integer(),
      total: Type.Integer(),
      totalPages: Type.Integer(),
      hasNext: Type.Boolean(),
      hasPrev: Type.Boolean(),
    }),
  }),
});

export async function expenseRoutes(fastify: FastifyInstance) {
  const familyPrisma = fastify.familyPrisma(request => request.family!.id);

  // List expenses
  fastify.get('/', {
    schema: { querystring: expenseQuery, response: { 200: paginatedExpenseResponse } },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc', ...filters } = request.query;
    const where: Record<string, unknown> = { familyId: request.family!.id };

    if (filters.category) where.category = filters.category;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }
    if (filters.isRecurring !== undefined) where.isRecurring = filters.isRecurring;

    const [expenses, total] = await Promise.all([
      familyPrisma.expense.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      }),
      familyPrisma.expense.count({ where }),
    ]);

    return {
      success: true,
      data: {
        data: expenses.map(e => ({ ...e, amount: Number(e.amount) })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
      },
    };
  });

  // Get expense by ID
  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: expenseResponse }) } },
  }, async (request, reply) => {
    const expense = await familyPrisma.expense.findUnique({
      where: { id: request.params.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    if (!expense) throw fastify.httpErrors.notFound('Expense not found');
    return { success: true, data: { ...expense, amount: Number(expense.amount) } };
  });

  // Create expense
  fastify.post('/', {
    schema: { body: createExpenseBody, response: { 201: Type.Object({ success: Type.Boolean(), data: expenseResponse }) } },
  }, async (request, reply) => {
    const expense = await familyPrisma.expense.create({
      data: { ...request.body, amount: request.body.amount, userId: request.user!.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    // Emit WebSocket event
    fastify.io.to(`family:${request.family!.id}`).emit('expense:created', { ...expense, amount: Number(expense.amount) });

    return reply.status(201).send({ success: true, data: { ...expense, amount: Number(expense.amount) } });
  });

  // Update expense
  fastify.patch('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), body: updateExpenseBody, response: { 200: Type.Object({ success: Type.Boolean(), data: expenseResponse }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.expense.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Expense not found');

    const expense = await familyPrisma.expense.update({
      where: { id: request.params.id },
      data: { ...request.body, amount: request.body.amount },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    fastify.io.to(`family:${request.family!.id}`).emit('expense:updated', { ...expense, amount: Number(expense.amount) });
    return { success: true, data: { ...expense, amount: Number(expense.amount) } };
  });

  // Delete expense
  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.expense.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Expense not found');

    await familyPrisma.expense.delete({ where: { id: request.params.id } });
    fastify.io.to(`family:${request.family!.id}`).emit('expense:deleted', { id: request.params.id, familyId: request.family!.id });
    return { success: true, data: { message: 'Expense deleted' } };
  });

  // Expense stats
  fastify.get('/stats/summary', {
    schema: {
      querystring: Type.Object({ startDate: Type.Optional(Type.String({ format: 'date' })), endDate: Type.Optional(Type.String({ format: 'date' })) }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            total: Type.Number(),
            byCategory: Type.Record(Type.String(), Type.Number()),
            byMonth: Type.Record(Type.String(), Type.Number()),
            recurringTotal: Type.Number(),
            count: Type.Integer(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { startDate, endDate } = request.query;
    const where: Record<string, unknown> = { familyId: request.family!.id };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, recurring] = await Promise.all([
      familyPrisma.expense.findMany({ where, select: { amount: true, category: true, date: true, isRecurring: true } }),
      familyPrisma.expense.aggregate({ where: { ...where, isRecurring: true }, _sum: { amount: true } }),
    ]);

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    const byMonth: Record<string, number> = {};

    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
      const month = new Date(e.date).toISOString().slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + Number(e.amount);
    }

    return {
      success: true,
      data: {
        total,
        byCategory,
        byMonth,
        recurringTotal: Number(recurring._sum.amount || 0),
        count: expenses.length,
      },
    };
  });
}