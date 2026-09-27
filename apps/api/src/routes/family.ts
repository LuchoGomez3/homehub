import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { prisma } from '../server.js';
import { DateTime } from '../lib/schemas.js';
import { createFamilySchema, updateFamilySchema } from '@homehub/shared';

const createFamilyBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
});

const updateFamilyBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});

const familyResponse = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    id: Type.String(),
    name: Type.String(),
    createdAt: DateTime(),
    updatedAt: DateTime(),
  }),
});

export const familyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get current family
  fastify.get('/', {
    schema: { response: { 200: familyResponse } },
  }, async (request) => {
    const family = await prisma.family.findUnique({
      where: { id: request.family!.id },
    });
    return { success: true, data: family! };
  });

  // Update family
  fastify.patch('/', {
    schema: { body: updateFamilyBody, response: { 200: familyResponse } },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    const { name } = request.body;
    const family = await prisma.family.update({
      where: { id: request.family!.id },
      data: { name },
    });
    return { success: true, data: family };
  });

  // Delete family (admin only)
  fastify.delete('/', {
    schema: { response: { 200: Type.Object({ success: Type.Boolean(), data: Type.Object({ message: Type.String() }) }) } },
    preHandler: [fastify.requireAdmin],
  }, async (request, reply) => {
    await prisma.family.delete({ where: { id: request.family!.id } });
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });
    return { success: true, data: { message: 'Family deleted successfully' } };
  });

  // Get family members
  fastify.get('/members', {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.String(),
            role: Type.String(),
            avatar: Type.Union([Type.String(), Type.Null()]),
            language: Type.String(),
            theme: Type.String(),
            createdAt: DateTime(),
          })),
        }),
      },
    },
  }, async (request) => {
    const members = await prisma.user.findMany({
      where: { familyId: request.family!.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, language: true, theme: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: members };
  });
};
