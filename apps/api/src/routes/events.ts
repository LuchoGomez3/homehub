import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { Prisma } from '@prisma/client';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { createEventSchema, updateEventSchema, eventFiltersSchema, Recurrence } from '@homehub/shared';

const createEventBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  allDay: Type.Optional(Type.Boolean({ default: false })),
  recurrence: Type.Optional(Type.Union([...Object.values(Recurrence).map(v => Type.Literal(v)), Type.Null()])),
  color: Type.Optional(Type.Union([Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }), Type.Null()])),
  attendeeIds: Type.Optional(Type.Array(Type.String())),
});

const updateEventBody = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  allDay: Type.Optional(Type.Boolean()),
  recurrence: Type.Optional(Type.Union([...Object.values(Recurrence).map(v => Type.Literal(v)), Type.Null()])),
  color: Type.Optional(Type.Union([Type.String({ pattern: '^#[0-9A-Fa-f]{6}$' }), Type.Null()])),
  attendeeIds: Type.Optional(Type.Array(Type.String())),
});

const eventQuery = Type.Object({
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
  attendeeId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
});

const eventResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  startDate: DateTime(),
  endDate: DateTime(),
  allDay: Type.Boolean(),
  recurrence: Type.Union([Type.String(), Type.Null()]),
  color: Type.Union([Type.String(), Type.Null()]),
  attendees: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), avatar: Type.Union([Type.String(), Type.Null()]) })),
  createdAt: DateTime(),
  updatedAt: DateTime(),
});

const paginatedEventResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    data: Type.Array(eventResponse),
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

export const eventRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const familyPrisma = fastify.familyPrisma(request => request.family!.id);

  // List events
  fastify.get('/', {
    schema: { querystring: eventQuery, response: { 200: paginatedEventResponse } },
  }, async (request) => {
    const { page = 1, limit = 50, ...filters } = request.query;
    const where: Prisma.EventWhereInput = { familyId: request.family!.id };

    if (filters.startDate || filters.endDate) {
      const startDateFilter: Prisma.DateTimeFilter = {};
      if (filters.startDate) startDateFilter.gte = new Date(filters.startDate);
      if (filters.endDate) startDateFilter.lte = new Date(filters.endDate);
      where.startDate = startDateFilter;
    }
    if (filters.attendeeId) {
      where.attendees = { some: { id: filters.attendeeId } };
    }

    const [events, total] = await Promise.all([
      familyPrisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: { attendees: { select: { id: true, name: true, avatar: true } } },
      }),
      familyPrisma.event.count({ where }),
    ]);

    return {
      success: true,
      data: { data: events, meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 } },
    };
  });

  // Get event by ID
  fastify.get('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: eventResponse }) } },
  }, async (request, reply) => {
    const event = await familyPrisma.event.findUnique({
      where: { id: request.params.id },
      include: { attendees: { select: { id: true, name: true, avatar: true } } },
    });
    if (!event) throw fastify.httpErrors.notFound('Event not found');
    return { success: true, data: event };
  });

  // Create event
  fastify.post('/', {
    schema: { body: createEventBody, response: { 201: Type.Object({ success: Type.Boolean(), data: eventResponse }) } },
  }, async (request, reply) => {
    const { attendeeIds, ...data } = request.body;
    const event = await familyPrisma.event.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        attendees: attendeeIds ? { connect: attendeeIds.map(id => ({ id })) } : undefined,
      },
      include: { attendees: { select: { id: true, name: true, avatar: true } } },
    });
    fastify.io.to(`family:${request.family!.id}`).emit('event:created', event);
    return reply.status(201).send({ success: true, data: event });
  });

  // Update event
  fastify.patch('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), body: updateEventBody, response: { 200: Type.Object({ success: Type.Boolean(), data: eventResponse }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.event.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Event not found');

    const { attendeeIds, ...data } = request.body;
    const event = await familyPrisma.event.update({
      where: { id: request.params.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        attendees: attendeeIds ? { set: attendeeIds.map(id => ({ id })) } : undefined,
      },
      include: { attendees: { select: { id: true, name: true, avatar: true } } },
    });

    fastify.io.to(`family:${request.family!.id}`).emit('event:updated', event);
    return { success: true, data: event };
  });

  // Delete event
  fastify.delete('/:id', {
    schema: { params: Type.Object({ id: Type.String() }), response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
  }, async (request, reply) => {
    const existing = await familyPrisma.event.findUnique({ where: { id: request.params.id } });
    if (!existing) throw fastify.httpErrors.notFound('Event not found');

    await familyPrisma.event.delete({ where: { id: request.params.id } });
    fastify.io.to(`family:${request.family!.id}`).emit('event:deleted', { id: request.params.id, familyId: request.family!.id });
    return { success: true, data: { message: 'Event deleted' } };
  });

  // Events for calendar view (month range)
  fastify.get('/calendar/month', {
    schema: {
      querystring: Type.Object({
        start: Type.String({ format: 'date-time' }),
        end: Type.String({ format: 'date-time' }),
      }),
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Array(eventResponse) }) },
    },
  }, async (request) => {
    const { start, end } = request.query;
    const events = await familyPrisma.event.findMany({
      where: {
        familyId: request.family!.id,
        startDate: { gte: new Date(start), lte: new Date(end) },
      },
      orderBy: { startDate: 'asc' },
      include: { attendees: { select: { id: true, name: true, avatar: true } } },
    });
    return { success: true, data: events };
  });

  // Upcoming events (next 7 days)
  fastify.get('/upcoming/week', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Array(eventResponse) }) } },
  }, async (request) => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await familyPrisma.event.findMany({
      where: {
        familyId: request.family!.id,
        startDate: { gte: now, lte: week },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
      include: { attendees: { select: { id: true, name: true, avatar: true } } },
    });
    return { success: true, data: events };
  });
};
