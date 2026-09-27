import type { FastifyInstance } from 'fastify';
import { prisma } from '../server.js';

/**
 * Corta con 400 si alguno de los ids no es de un usuario de `familyId`.
 * Va antes de conectar usuarios a un registro (assignee de un todo,
 * attendees de un evento): el scoping de familyPrisma no alcanza a los
 * `connect`, y el include de la respuesta devolveria nombre y avatar de un
 * usuario de otra familia.
 *
 * El mensaje no distingue "no existe" de "es de otra familia", para no
 * revelar que ids existen.
 */
export async function assertFamilyMembers(
  fastify: FastifyInstance,
  familyId: string,
  userIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const found = await prisma.user.count({ where: { id: { in: unique }, familyId } });
  if (found !== unique.length) {
    throw fastify.httpErrors.badRequest('Users must belong to this family');
  }
}
