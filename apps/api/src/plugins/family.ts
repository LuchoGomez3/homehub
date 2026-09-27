import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { prisma } from '../server.js';

/** Modelos con columna `familyId` propia: los unicos que se scopean. */
const SCOPED_MODELS = new Set(['Expense', 'Bill', 'Todo', 'Event', 'ShoppingItem']);

type ScopableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

function withFamily<T extends Record<string, unknown>>(value: T | undefined, familyId: string) {
  return { ...value, familyId };
}

/**
 * Cliente de Prisma limitado a una familia. Se crea por request con el id de
 * la sesion (`request.family.id`), nunca con un valor que venga del cliente.
 *
 * - Lecturas, updates, deletes, count, aggregate: `familyId` se agrega al
 *   where. Un id de otra familia no matchea y la ruta responde 404.
 * - Creates y el create de un upsert: `familyId` se pisa en `data`, aunque
 *   la ruta haya pasado otro.
 * - Updates: `familyId` en `data` tambien se pisa, para que un registro no
 *   se pueda mover a otra familia.
 *
 * Solo toca SCOPED_MODELS. Los modelos relacionados que se piden con
 * include/select (p. ej. el `user` de un gasto) no se filtran.
 */
export function scopedPrisma(familyId: string) {
  return prisma.$extends({
    name: 'family-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SCOPED_MODELS.has(model)) return query(args);

          const a = args as ScopableArgs;
          switch (operation) {
            case 'create':
              a.data = withFamily(a.data as Record<string, unknown>, familyId);
              break;
            case 'createMany':
            case 'createManyAndReturn':
              a.data = Array.isArray(a.data)
                ? a.data.map((d) => withFamily(d, familyId))
                : withFamily(a.data, familyId);
              break;
            case 'upsert':
              a.where = withFamily(a.where, familyId);
              a.create = withFamily(a.create, familyId);
              if (a.update && 'familyId' in a.update) a.update = withFamily(a.update, familyId);
              break;
            case 'update':
            case 'updateMany':
              a.where = withFamily(a.where, familyId);
              if (a.data && !Array.isArray(a.data) && 'familyId' in a.data) {
                a.data = withFamily(a.data, familyId);
              }
              break;
            default:
              a.where = withFamily(a.where, familyId);
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof scopedPrisma>;

async function family(fastify: FastifyInstance) {
  fastify.decorateRequest('family', null);

  // Ensure user has a family and set familyId in request
  fastify.addHook('preHandler', async (request) => {
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

  fastify.decorate('familyPrisma', scopedPrisma);
}

// Mismo motivo que authPlugin: sin fastify-plugin el hook no llega a las
// rutas. Depende de 'auth' porque lee request.user, que se completa en el
// preHandler de auth, registrado antes.
export const familyPlugin = fp(family, { name: 'family', dependencies: ['auth'] });
