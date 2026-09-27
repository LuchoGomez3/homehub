import type { FastifyInstance } from 'fastify';
import { prisma } from '../server.js';
import { accessJwt } from './tokens.js';
import type { AuthenticatedUser, TokenPayload } from '../types/fastify.js';

export type AccessSession = { user: AuthenticatedUser; sid: string };

/**
 * Verifica un access token y la sesion a la que apunta. Es el unico chequeo
 * de acceso: lo usan el preHandler de HTTP y el handshake del WebSocket.
 *
 * 1. Firma y vencimiento, antes de tocar la base.
 * 2. Tipo `access` con `sid`.
 * 3. La sesion existe y no esta revocada, y el usuario coincide con el token.
 *
 * Devuelve null ante cualquier falla, sin distinguir cual: el llamador
 * responde 401 o corta la conexion.
 */
export async function verifyAccessSession(
  fastify: FastifyInstance,
  token: string,
): Promise<AccessSession | null> {
  let payload: TokenPayload;
  try {
    payload = accessJwt(fastify).verify<TokenPayload>(token);
  } catch {
    return null;
  }
  if (payload.type !== 'access' || !payload.sid) return null;

  const session = await prisma.refreshToken.findUnique({
    where: { id: payload.sid },
    select: {
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          familyId: true,
          avatar: true,
          language: true,
          theme: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) return null;
  const { user } = session;
  if (user.id !== payload.sub || user.familyId !== payload.familyId) return null;

  return { user, sid: payload.sid };
}
