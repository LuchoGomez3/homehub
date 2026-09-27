import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../server.js';
import { logger } from '../utils/logger.js';

async function family(fastify: FastifyInstance) {
  fastify.decorateRequest('family', null);

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

}

// Mismo motivo que authPlugin: sin fastify-plugin el hook no llega a las
// rutas. Depende de 'auth' porque lee request.user, que se completa en el
// preHandler de auth, registrado antes.
export const familyPlugin = fp(family, { name: 'family', dependencies: ['auth'] });
