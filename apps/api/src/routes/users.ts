import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { updateUserSchema } from '@homehub/shared';

const updateUserBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  avatar: Type.Optional(Type.Union([Type.String({ format: 'uri' }), Type.Null()])),
  language: Type.Optional(Type.Union([Type.Literal('es'), Type.Literal('en')])),
  theme: Type.Optional(Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('system')])),
});

const userResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    id: Type.String(),
    email: Type.String(),
    name: Type.String(),
    role: Type.String(),
    familyId: Type.String(),
    avatar: Type.Union([Type.String(), Type.Null()]),
    language: Type.String(),
    theme: Type.String(),
    createdAt: DateTime(),
    updatedAt: DateTime(),
  }),
});

export const userRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get current user profile
  fastify.get('/me', {
    schema: { response: { 200: userResponse } },
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true, createdAt: true, updatedAt: true },
    });
    return { success: true, data: user! };
  });

  // Update current user profile
  fastify.patch('/me', {
    schema: { body: updateUserBody, response: { 200: userResponse } },
  }, async (request, reply) => {
    const user = await prisma.user.update({
      where: { id: request.user!.id },
      data: request.body,
      select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true, createdAt: true, updatedAt: true },
    });
    return { success: true, data: user };
  });

  // Change password
  fastify.post('/me/change-password', {
    schema: {
      body: Type.Object({
        currentPassword: Type.String(),
        newPassword: Type.String({ minLength: 8, maxLength: 128 }),
      }),
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) },
    },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body;
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });

    if (!user || !(await fastify.verifyPassword(currentPassword, user.passwordHash))) {
      throw fastify.httpErrors.unauthorized('Current password is incorrect');
    }

    const passwordHash = await fastify.hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return { success: true, data: { message: 'Password changed successfully' } };
  });

  // Admin: Get all users in family
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            data: Type.Array(Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.String(),
              role: Type.String(),
              avatar: Type.Union([Type.String(), Type.Null()]),
              language: Type.String(),
              theme: Type.String(),
              createdAt: DateTime(),
              updatedAt: DateTime(),
            })),
            meta: Type.Object({
              page: Type.Integer(),
              limit: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
              hasNext: Type.Boolean(),
              hasPrev: Type.Boolean(),
            }),
          }),
        }),
      },
    },
    preHandler: [fastify.requireAdmin],
  }, async (request) => {
    const { page = 1, limit = 20 } = request.query;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { familyId: request.family!.id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true, avatar: true, language: true, theme: true, createdAt: true, updatedAt: true },
      }),
      prisma.user.count({ where: { familyId: request.family!.id } }),
    ]);

    return {
      success: true,
      data: {
        data: users,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    };
  });

  // Admin: Update user role
  fastify.patch('/:id/role', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({ role: Type.Union([Type.Literal('ADMIN'), Type.Literal('MEMBER')]) }),
      response: { 200: userResponse },
    },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params;
    const { role } = request.body;

    if (id === request.user!.id) {
      throw fastify.httpErrors.badRequest('Cannot change your own role');
    }

    const user = await prisma.user.update({
      where: { id, familyId: request.family!.id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, familyId: true, avatar: true, language: true, theme: true, createdAt: true, updatedAt: true },
    });

    return { success: true, data: user };
  });

  // Admin: Remove user from family
  fastify.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) },
    },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params;

    if (id === request.user!.id) {
      throw fastify.httpErrors.badRequest('Cannot remove yourself');
    }

    await prisma.user.delete({ where: { id, familyId: request.family!.id } });
    return { success: true, data: { message: 'User removed from family' } };
  });
};
