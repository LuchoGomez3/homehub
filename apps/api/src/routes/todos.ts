import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { Prisma } from '@prisma/client';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { createTodoSchema, updateTodoSchema, todoFiltersSchema, TodoStatus, Priority } from '@homehub/shared';

const createTodoBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  status: Type.Optional(Type.Union(Object.values(TodoStatus).map(v => Type.Literal(v)))),
  priority: Type.Optional(Type.Union(Object.values(Priority).map(v => Type.Literal(v)))),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const updateTodoBody = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  status: Type.Optional(Type.Union(Object.values(TodoStatus).map(v => Type.Literal(v)))),
  priority: Type.Optional(Type.Union(Object.values(Priority).map(v => Type.Literal(v)))),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  assigneeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const todoQuery = Type.Object({
  status: Type.Optional(Type.Union(Object.values(TodoStatus).map(v => Type.Literal(v)))),
  priority: Type.Optional(Type.Union(Object.values(Priority).map(v => Type.Literal(v)))),
  assigneeId: Type.Optional(Type.String()),
  dueBefore: Type.Optional(Type.String({ format: 'date' })),
  dueAfter: Type.Optional(Type.String({ format: 'date' })),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  sortBy: Type.Optional(Type.Union([Type.Literal('dueDate'), Type.Literal('priority'), Type.Literal('createdAt'), Type.Literal('title')])),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

const todoResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  priority: Type.String(),
  dueDate: Type.Union([DateTime(), Type.Null()]),
  assigneeId: Type.Union([Type.String(), Type.Null()]),
  assignee: Type.Union([Type.Object({ id: Type.String(), name: Type.String(), avatar: Type.Union([Type.String(), Type.Null()]) }), Type.Null()]),
  createdAt: DateTime(),
  updatedAt: DateTime(),
});

const paginatedTodoResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    data: Type.Array(todoResponse),
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

export const todoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const familyPrisma = fastify.familyPrisma(request => request.family!.id);

  // List todos
  fastify.get('/', {
    schema: { querystring: todoQuery, response: { 200: paginatedTodoResponse } },
  }, async (request) => {
    const { page = 1, limit = 20, sortBy = 'dueDate', sortOrder = 'asc', ...filters } = request.query;
    const where: Prisma.TodoWhereInput = { familyId: request.family!.id };

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.dueBefore || filters.dueAfter) {
      const dueDateFilter: Prisma.DateTimeFilter = {};
      if (filters.dueBefore) dueDateFilter.lte = new Date(filters.dueBefore);
      if (filters.dueAfter) dueDateFilter.gte = new Date(filters.dueAfter);
      where.dueDate = dueDateFilter;
    }

    const [todos, total] = await Promise.all([
      familyPrisma.todo.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { assignee: { select: { id: true, name: true, avatar: true } } },
      }),
      familyPrisma.todo.count({ where }),
    ]);

    return {
      success: true,
      data: { data: todos, meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } },
    };
  });

  // Get todo by ID
  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: todoResponse }) } },
  }, async (request, reply) => {
    const todo = await familyPrisma.todo.findUnique({
      where: { id: request.params.id },
      include: { assignee: { select: { id: true, name: true, avatar: true } } },
    });
    if (!todo) throw fastify.httpErrors.notFound('Todo not found');
    return { success: true, data: todo };
  });

  // Create todo
  fastify.post('/', {
    schema: { body: createTodoBody, response: { 201: Type.Object({ success: Type.Boolean(), data: todoResponse }) } },
  }, async (request, reply) => {
    const todo = await familyPrisma.todo.create({
      data: { ...request.body, dueDate: request.body.dueDate ? new Date(request.body.dueDate) : null },
      include: { assignee: { select: { id: true, name: true, avatar: true } } },
    });
    fastify.io.to(`family:${request.family!.id}`).emit('todo:created', todo);
    return reply.status(201).send({ success: true, data: todo });
  });

  // Update todo
  fastify.patch('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), body: updateTodoBody, response: { 200: Type.Object({ success: Type.Boolean(), data: todoResponse }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.todo.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Todo not found');

    const todo = await familyPrisma.todo.update({
      where: { id: request.params.id },
      data: { ...request.body, dueDate: request.body.dueDate ? new Date(request.body.dueDate) : null },
      include: { assignee: { select: { id: true, name: true, avatar: true } } },
    });

    fastify.io.to(`family:${request.family!.id}`).emit('todo:updated', todo);
    if (request.body.assigneeId !== undefined && request.body.assigneeId !== existing.assigneeId) {
      fastify.io.to(`family:${request.family!.id}`).emit('todo:assigned', { todoId: todo.id, assigneeId: todo.assigneeId, familyId: request.family!.id });
    }
    return { success: true, data: todo };
  });

  // Delete todo
  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.todo.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Todo not found');

    await familyPrisma.todo.delete({ where: { id: request.params.id } });
    fastify.io.to(`family:${request.family!.id}`).emit('todo:deleted', { id: request.params.id, familyId: request.family!.id });
    return { success: true, data: { message: 'Todo deleted' } };
  });

  // Kanban board view
  fastify.get('/board/kanban', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ pending: Type.Array(todoResponse), inProgress: Type.Array(todoResponse), done: Type.Array(todoResponse) }) }) } },
  }, async (request) => {
    const todos = await familyPrisma.todo.findMany({
      where: { familyId: request.family!.id },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      include: { assignee: { select: { id: true, name: true, avatar: true } } },
    });

    return {
      success: true,
      data: {
        pending: todos.filter(t => t.status === 'PENDING'),
        inProgress: todos.filter(t => t.status === 'IN_PROGRESS'),
        done: todos.filter(t => t.status === 'DONE'),
      },
    };
  });
};
