import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../server.js';
import { logger } from '../utils/logger.js';

export async function familyPlugin(fastify: FastifyInstance) {
  // Ensure user has a family and set familyId in request
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.user) return;

    // Attach family info to request
    const family = await prisma.family.findUnique({
      where: { id: request.user.familyId },
      select: { id: true, name: true },
    });

    if (!family) {
      throw fastify.httpErrors.forbidden('Family not found');
    }

    request.family = family;
  });

  // Family-scoped Prisma client
  fastify.decorate('familyPrisma', (familyId: string) => {
    return prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            if (args.where) {
              args.where = { ...args.where, familyId };
            } else {
              args.where = { familyId };
            }
            return query(args);
          },
        },
      },
    });
  });

  // Decorate request with family
  declare module 'fastify' {
    interface FastifyRequest {
      family: { id: string; name: string } | null;
    }
    interface FastifyInstance {
      familyPrisma: (familyId: string) => typeof prisma;
    }
  }
}