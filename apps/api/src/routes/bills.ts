import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { createBillSchema, updateBillSchema, billFiltersSchema, BillCategory, BillStatus, Recurrence } from '@homehub/shared';

const createBillBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  amount: Type.Number({ minimum: 0.01, multipleOf: 0.01 }),
  dueDate: Type.String({ format: 'date-time' }),
  category: Type.Union(Object.values(BillCategory).map(v => Type.Literal(v))),
  status: Type.Optional(Type.Union(Object.values(BillStatus).map(v => Type.Literal(v)))),
  recurrence: Type.Optional(Type.Union(Object.values(Recurrence).map(v => Type.Literal(v)))),
  fileUrl: Type.Optional(Type.Union([Type.String({ format: 'uri' }), Type.Null()])),
});

const updateBillBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  amount: Type.Optional(Type.Number({ minimum: 0.01, multipleOf: 0.01 })),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
  category: Type.Optional(Type.Union(Object.values(BillCategory).map(v => Type.Literal(v)))),
  status: Type.Optional(Type.Union(Object.values(BillStatus).map(v => Type.Literal(v)))),
  recurrence: Type.Optional(Type.Union(Object.values(Recurrence).map(v => Type.Literal(v)))),
  fileUrl: Type.Optional(Type.Union([Type.String({ format: 'uri' }), Type.Null()])),
});

const billQuery = Type.Object({
  category: Type.Optional(Type.Union(Object.values(BillCategory).map(v => Type.Literal(v)))),
  status: Type.Optional(Type.Union(Object.values(BillStatus).map(v => Type.Literal(v)))),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sortBy: Type.Optional(Type.Union([Type.Literal('dueDate'), Type.Literal('amount'), Type.Literal('name'), Type.Literal('status'), Type.Literal('createdAt')])),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

const billResponse = Type.Object({
  id: Type.String(),
  name: Type.String(),
  amount: Type.Number(),
  dueDate: Type.String(),
  category: Type.String(),
  status: Type.String(),
  recurrence: Type.String(),
  fileUrl: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

const paginatedBillResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    data: Type.Array(billResponse),
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

export async function billRoutes(fastify: FastifyInstance) {
  const familyPrisma = fastify.familyPrisma(request => request.family!.id);

  // List bills
  fastify.get('/', {
    schema: { querystring: billQuery, response: { 200: paginatedBillResponse } },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'dueDate', sortOrder = 'asc', ...filters } = request.query;
    const where: Record<string, unknown> = { familyId: request.family!.id };

    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.dueDate = {};
      if (filters.startDate) where.dueDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.dueDate.lte = new Date(filters.endDate);
    }

    const [bills, total] = await Promise.all([
      familyPrisma.bill.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      familyPrisma.bill.count({ where }),
    ]);

    return {
      success: true,
      data: {
        data: bills.map(b => ({ ...b, amount: Number(b.amount) })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 },
      },
    };
  });

  // Get bill by ID
  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: billResponse }) } },
  }, async (request, reply) => {
    const bill = await familyPrisma.bill.findUnique({ where: { id: request.params.id } });
    if (!bill) throw fastify.httpErrors.notFound('Bill not found');
    return { success: true, data: { ...bill, amount: Number(bill.amount) } };
  });

  // Create bill
  fastify.post('/', {
    schema: { body: createBillBody, response: { 201: Type.Object({ success: Type.Boolean(), data: billResponse }) } },
  }, async (request, reply) => {
    const bill = await familyPrisma.bill.create({ data: { ...request.body, amount: request.body.amount } });
    fastify.io.to(`family:${request.family!.id}`).emit('bill:created', { ...bill, amount: Number(bill.amount) });
    return reply.status(201).send({ success: true, data: { ...bill, amount: Number(bill.amount) } });
  });

  // Update bill
  fastify.patch('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), body: updateBillBody, response: { 200: Type.Object({ success: Type.Boolean(), data: billResponse }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.bill.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Bill not found');

    const bill = await familyPrisma.bill.update({
      where: { id: request.params.id },
      data: { ...request.body, amount: request.body.amount },
    });

    fastify.io.to(`family:${request.family!.id}`).emit('bill:updated', { ...bill, amount: Number(bill.amount) });
    if (request.body.status === 'PAID' && existing.status !== 'PAID') {
      fastify.io.to(`family:${request.family!.id}`).emit('bill:paid', { id: bill.id, familyId: request.family!.id });
    }
    return { success: true, data: { ...bill, amount: Number(bill.amount) } };
  });

  // Delete bill
  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.bill.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Bill not found');

    await familyPrisma.bill.delete({ where: { id: request.params.id } });
    fastify.io.to(`family:${request.family!.id}`).emit('bill:deleted', { id: request.params.id, familyId: request.family!.id });
    return { success: true, data: { message: 'Bill deleted' } };
  });

  // Mark bill as paid
  fastify.post('/:id/pay', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: billResponse }) } },
  }, async (request, reply) => {
    const bill = await familyPrisma.bill.update({
      where: { id: request.params.id, familyId: request.family!.id },
      data: { status: 'PAID' },
    });
    fastify.io.to(`family:${request.family!.id}`).emit('bill:paid', { id: bill.id, familyId: request.family!.id });
    fastify.io.to(`family:${request.family!.id}`).emit('bill:updated', { ...bill, amount: Number(bill.amount) });
    return { success: true, data: { ...bill, amount: Number(bill.amount) } };
  });

  // Upcoming bills (next 30 days)
  fastify.get('/upcoming/next', {
    schema: {
      querystring: Type.Object({ days: Type.Optional(Type.Integer({ minimum: 1, maximum: 365, default: 30 })) }),
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Array(billResponse) }) },
    },
  }, async (request) => {
    const { days = 30 } = request.query;
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const bills = await familyPrisma.bill.findMany({
      where: {
        familyId: request.family!.id,
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { gte: now, lte: future },
      },
      orderBy: { dueDate: 'asc' },
    });

    return { success: true, data: bills.map(b => ({ ...b, amount: Number(b.amount) })) };
  });
}